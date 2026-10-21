export type PhotoKind = 'crop' | 'animal';
export type HelpType = 'expert' | 'assistance';

/** Acknowledge RPC UI updates only after React commits the matching card. */
export class WorkflowRenderTracker {
  private version = -1;
  private pending = new Set<{ version: number; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();

  waitFor(version: number, timeout = 3500): Promise<void> {
    if (version <= this.version) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const entry = { version, resolve, reject, timer: setTimeout(() => {
        this.pending.delete(entry);
        reject(new Error('The workflow card has not rendered'));
      }, timeout) };
      this.pending.add(entry);
    });
  }

  rendered(version: number): void {
    this.version = Math.max(this.version, version);
    for (const entry of this.pending) {
      if (entry.version <= this.version) {
        clearTimeout(entry.timer);
        this.pending.delete(entry);
        entry.resolve();
      }
    }
  }

  reset(): void {
    this.version = -1;
    for (const entry of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Call ended before the workflow rendered'));
    }
    this.pending.clear();
  }
}

export interface WorkflowState {
  version: number;
  phase: 'idle' | 'photo' | 'assessment' | 'details' | 'confirmation' | 'submitted';
  help_type?: HelpType | null;
  kind: PhotoKind;
  assessment: null | {
    scan_id: string;
    status: string;
    disease_name: string;
    subject: string;
    symptoms: string[];
  };
  draft: null | { id: string; request_type: HelpType; district: string; description: string };
  receipt: null | { draft_id: string; reference_number: string; status: string; request_type: HelpType };
}

export type WorkflowAction =
  | { action: 'sync' }
  | { action: 'skip_photo' }
  | { action: 'photo'; kind: PhotoKind }
  | { action: 'scan'; scan_id: string; kind: PhotoKind; photo_version: number }
  | { action: 'select'; request_type: HelpType }
  | { action: 'prepare'; draft: { request_type: HelpType; district: string; description: string } }
  | { action: 'confirm' | 'cancel'; draft_id: string };

export function parseWorkflowState(payload: string): WorkflowState {
  const value = JSON.parse(payload);
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const helpType = (v: unknown) => v === 'expert' || v === 'assistance';
  const strings = (v: unknown, keys: string[]) => object(v) && keys.every(k => typeof v[k] === 'string');
  if (!object(value) || !Number.isSafeInteger(value.version) || (value.version as number) < 0
    || !['idle', 'photo', 'assessment', 'details', 'confirmation', 'submitted'].includes(value.phase as string)
    || !['crop', 'animal'].includes(value.kind as string)) throw new Error('Invalid workflow state');
  if (value.help_type !== undefined && value.help_type !== null && !helpType(value.help_type))
    throw new Error('Invalid help type');
  if (value.assessment !== null && (!object(value.assessment)
    || !strings(value.assessment, ['scan_id', 'status', 'disease_name', 'subject'])
    || !Array.isArray(value.assessment.symptoms) || !value.assessment.symptoms.every(s => typeof s === 'string')))
    throw new Error('Invalid assessment');
  if (value.draft !== null && (!object(value.draft) || !helpType(value.draft.request_type)
    || !strings(value.draft, ['id', 'district', 'description'])))
    throw new Error('Invalid request draft');
  if (value.receipt !== null && (!object(value.receipt) || !helpType(value.receipt.request_type)
    || !strings(value.receipt, ['draft_id', 'reference_number', 'status'])))
    throw new Error('Invalid request receipt');
  return value as unknown as WorkflowState;
}
