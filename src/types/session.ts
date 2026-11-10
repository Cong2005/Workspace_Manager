export interface SessionPage {
  id: string;
  title: string;
  url: string;
  faviconUrl?: string;
  position: number;
}

export interface SavedSession {
  id: string;
  name: string;
  workspaceId?: string;
  pages: SessionPage[];
  createdAt: number;
}

export type SkipReason = 'Missing URL' | 'Unsupported or private URL';
export type SkipCounts = Record<SkipReason, number>;

export interface CaptureResult {
  session: SavedSession;
  totalTabs: number;
  skipped: SkipCounts;
}

export interface RestoreResult {
  opened: number;
  failed: number;
  skippedDuplicate: number;
  skippedInvalid: number;
}

export type SessionCommand =
  | { scope: 'session'; action: 'getAll' }
  | { scope: 'session'; action: 'getById'; id: string }
  | { scope: 'session'; action: 'create'; name: string; windowId: number; workspaceId?: string }
  | { scope: 'session'; action: 'delete'; id: string };

export type SessionResponse =
  | { ok: true; action: 'getAll'; sessions: SavedSession[] }
  | { ok: true; action: 'getById'; session: SavedSession | null }
  | { ok: true; action: 'create'; capture: CaptureResult }
  | { ok: true; action: 'delete' }
  | { ok: false; error: string };
