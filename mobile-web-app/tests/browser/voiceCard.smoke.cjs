// Requires a running Expo web dev server. All auth/backend/RTC traffic is mocked.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    let analysisCalls = 0;
    const page = await browser.newPage({ viewport: { width: 375, height: 667 }, permissions: ['microphone'] });
    page.on('pageerror', error => console.error('Browser error:', error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('Browser console:', message.text().slice(0, 400)); });
    await page.route('http://localhost:8080/**', route => route.fulfill({ json: { token: 'mock-room-token', identity: '7', room: 'mock-room' } }));
    await page.route('http://localhost/api/v1/**', route => {
      if (route.request().url().includes('/crop/detect')) {
        analysisCalls++;
        return route.fulfill({ json: { scan_id: 'scan-test', is_plant: true } });
      }
      return route.fulfill({ json: { forecast: [], crops: [], trends: [], advice: '', source: 'mock' } });
    });
    await page.addInitScript(() => {
      const payload = btoa(JSON.stringify({ sub: '7', name: 'Test Farmer', exp: 2100000000, type: 'access' }));
      localStorage.setItem('kissan_access_token', 'test.' + payload + '.test');
      localStorage.setItem('kissan_user_id', '7');
      localStorage.setItem('kissan_user_name', 'Test Farmer');
      localStorage.setItem('kissan_app_language', 'en');
      localStorage.setItem('kissan_onboarding_complete', 'true');
    });
    await page.goto('http://localhost:8081');
    await page.getByText('Helpline', { exact: true }).first().waitFor({ timeout: 30000 });
    await page.evaluate(() => {
      const [id] = [...globalThis.__r.getModules()].find(([, m]) => m.verboseName?.endsWith('livekit-client.esm.mjs'));
      const sdk = globalThis.__r(id);
      const handlers = new Map();
      let state = { version: 1, phase: 'idle', kind: 'crop', assessment: null, draft: null, receipt: null };
      const setupFrameMetadata = sdk.Room.prototype.setupFrameMetadata;
      sdk.Room.prototype.setupFrameMetadata = function () {
        setupFrameMetadata.call(this);
        // connect/disconnect are SDK instance fields, so replace them after initialization.
        this.connect = async () => {
          this.state = sdk.ConnectionState.Connected;
          this.remoteParticipants.set('agent-test', { identity: 'agent-test', isAgent: true });
        };
        this.disconnect = async () => {};
      };
      sdk.LocalParticipant.prototype.publishTrack = async function () { return {}; };
      sdk.LocalParticipant.prototype.registerRpcMethod = function (method, handler) { handlers.set(method, handler); };
      sdk.LocalParticipant.prototype.performRpc = async function ({ payload }) {
        const action = JSON.parse(payload);
        if (action.action === 'skip_photo') state = { ...state, version: state.version + 1, phase: 'idle' };
        if (action.action === 'scan') state = { ...state, version: state.version + 1, phase: 'assessment',
          assessment: { scan_id: action.scan_id, disease_name: 'Possible leaf disease', status: 'completed', subject: 'cotton', symptoms: [] } };
        if (action.action === 'select') state = { ...state, version: state.version + 1, phase: 'details', help_type: action.request_type };
        if (action.action === 'confirm') state = { ...state, version: state.version + 1, phase: 'submitted',
          receipt: { draft_id: action.draft_id, reference_number: 'KR-demo-123', status: 'registered', request_type: state.help_type } };
        return JSON.stringify(state);
      };
      globalThis.emitPhotoCard = async () => {
        state = { ...state, version: state.version + 1, phase: 'photo' };
        return handlers.get('kissan.ui')({ callerIdentity: 'agent-test', payload: JSON.stringify(state) });
      };
      globalThis.emitHelpStep = async () => {
        state = { ...state, version: state.version + 1, phase: 'details', help_type: 'assistance' };
        return handlers.get('kissan.ui')({ callerIdentity: 'agent-test', payload: JSON.stringify(state) });
      };
      globalThis.emitVoiceDraft = async () => {
        state = { ...state, version: state.version + 1, phase: 'confirmation',
          draft: { id: 'draft-test', request_type: state.help_type, district: 'Multan', description: 'Cotton leaves damaged; needs financial assistance.' } };
        return handlers.get('kissan.ui')({ callerIdentity: 'agent-test', payload: JSON.stringify(state) });
      };
    });
    await page.getByText('Helpline', { exact: true }).first().click();
    await page.getByText('Call Now', { exact: true }).click();
    await page.getByText('Call Now', { exact: true }).click();
    await page.getByText('Mute', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Choose photo', exact: true }).count(), 0);
    assert.equal(await page.getByText('Help during your call', { exact: true }).count(), 0);
    const acknowledgement = JSON.parse(await page.evaluate(() => globalThis.emitPhotoCard()));
    assert.equal(acknowledgement.received, true);
    assert.equal(acknowledgement.version, 2);
    try {
      await page.getByRole('button', { name: 'Choose photo', exact: true }).waitFor({ timeout: 15000 });
    } catch (error) {
      console.error('Call screen:', (await page.locator('body').innerText()).slice(0, 1200));
      throw error;
    }
    const box = await page.getByRole('button', { name: 'Choose photo', exact: true }).boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height < 667, `Photo button outside viewport: ${JSON.stringify(box)}`);
    assert.equal(await page.getByRole('button', { name: 'Choose photo', exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Crop', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Expert review', exact: true }).count(), 0);
    await page.getByRole('button', { name: "I don't have a photo now", exact: true }).click();
    await page.getByRole('button', { name: 'Choose photo', exact: true }).waitFor({ state: 'hidden' });
    await page.evaluate(() => globalThis.emitPhotoCard());
    const fileChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose photo', exact: true }).click();
    await (await fileChooser).setFiles({ name: 'leaf.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ioAAAAASUVORK5CYII=', 'base64') });
    await page.getByRole('button', { name: 'Send photo for assessment', exact: true }).waitFor();
    assert.equal(analysisCalls, 0, 'Selecting a photo must not immediately analyze it');
    await page.getByRole('button', { name: 'Send photo for assessment', exact: true }).click();
    await page.getByRole('button', { name: 'Expert review', exact: true }).waitFor();
    assert.equal(analysisCalls, 1, 'Use the existing crop service exactly once');
    assert.equal(await page.getByRole('button', { name: 'Choose photo', exact: true }).count(), 0);
    assert.equal(await page.getByRole('textbox').count(), 0);
    await page.getByRole('button', { name: 'Expert review', exact: true }).click();
    await page.getByText('Tell your assistant the details. Your request will be filled in as you speak.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox').count(), 0, 'Voice details must not force a form');
    await page.evaluate(() => globalThis.emitHelpStep());
    await page.getByText('Possible leaf disease', { exact: true }).waitFor();
    assert.equal(await page.getByText('Assistance request', { exact: true }).count(), 0,
      'Voice help selection keeps the assessment card instead of opening another titled panel');
    await page.evaluate(() => globalThis.emitVoiceDraft());
    await page.getByRole('button', { name: 'Confirm and send to our team', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Confirm and send to our team', exact: true }).click();
    await page.getByText('KR-demo-123', { exact: true }).waitFor();
    console.log('PASS: idle hides cards; agent opens photo; preview gates one existing analysis call; voice-led help shows only current stage; confirmed request shows receipt at 375x667.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
