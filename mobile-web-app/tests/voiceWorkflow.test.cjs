const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/services/voiceWorkflow.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, setTimeout, clearTimeout };
vm.runInNewContext(compiled, context);
const parse = value => context.exports.parseWorkflowState(JSON.stringify(value));
const idle = { version: 0, phase: 'idle', kind: 'crop', assessment: null, draft: null, receipt: null };

test('UI acknowledgement waits for the matching committed card', async () => {
  const tracker = new context.exports.WorkflowRenderTracker();
  let acknowledged = false;
  const waiting = tracker.waitFor(3).then(() => { acknowledged = true; });
  tracker.rendered(2);
  await Promise.resolve();
  assert.equal(acknowledged, false);
  tracker.rendered(3);
  await waiting;
  assert.equal(acknowledged, true);
});

test('a missing render times out instead of acknowledging a visible card', async () => {
  const tracker = new context.exports.WorkflowRenderTracker();
  await assert.rejects(tracker.waitFor(1, 5), /has not rendered/);
});

test('ending a call rejects pending UI acknowledgements', async () => {
  const tracker = new context.exports.WorkflowRenderTracker();
  const result = assert.rejects(tracker.waitFor(1), /Call ended/);
  tracker.reset();
  await result;
});

test('accepts a service assessment, confirmation draft and saved receipt', () => {
  const state = { ...idle, version: 3, phase: 'submitted',
    assessment: { scan_id: 'scan-1', status: 'completed', disease_name: 'Possible leaf disease', subject: 'cotton', symptoms: ['Spots'] },
    draft: { id: 'draft-1', request_type: 'expert', district: 'Multan', description: 'Please review my crop' },
    receipt: { draft_id: 'draft-1', reference_number: 'KR-123', status: 'registered', request_type: 'expert' },
  };
  const parsed = parse(state);
  assert.equal(parsed.receipt.reference_number, 'KR-123');
  assert.equal(parsed.assessment.scan_id, 'scan-1');
});

test('rejects unexpected UI phases and malformed server fields', () => {
  const invalid = [null, [], { ...idle, version: -1 }, { ...idle, version: '1' },
    { ...idle, phase: 'execute_code' }, { ...idle, kind: 'unknown' },
    { ...idle, assessment: { scan_id: 'scan-1', status: 'completed', disease_name: 'x', subject: 'cotton', symptoms: [{}] } },
    { ...idle, draft: { id: 'draft-1', request_type: 'purchase', district: 'Multan', description: 'Buy medicine' } },
    { ...idle, receipt: { draft_id: 'draft-1', reference_number: {}, status: 'registered', request_type: 'expert' } },
  ];
  invalid.forEach(value => assert.throws(() => parse(value)));
});

test('all supported languages include actionable confirmation and tracking labels', () => {
  const translations = require('../src/i18n/voiceHelp.json');
  const englishKeys = Object.keys(translations.en).sort();
  for (const language of ['en', 'ur', 'sd']) {
    assert.deepEqual(Object.keys(translations[language]).sort(), englishKeys);
    for (const status of ['registered', 'in_review', 'resolved', 'closed']) {
      assert.ok(translations[language].status[status]);
    }
    assert.ok(translations[language].confirmHint);
  }
});
