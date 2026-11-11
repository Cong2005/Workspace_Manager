import { getWorkspaces, normalizePageUrl } from './workspaceService.ts';
import type { CaptureResult, SavedSession, SessionPage, SkipCounts, SkipReason } from '../types/session';

export const SESSION_KEY_PREFIX = 'sessions:v1:';
const SCHEMA_VERSION = 1;
export const MAX_SESSION_NAME_LENGTH = 60;

export class SessionDataError extends Error {
  constructor() {
    super('Saved session data is invalid. No changes were made.');
    this.name = 'SessionDataError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeSessionName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > MAX_SESSION_NAME_LENGTH) {
    throw new Error(`Session name must be 1–${MAX_SESSION_NAME_LENGTH} characters.`);
  }
  return name;
}

function safeFavicon(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new SessionDataError();
  try { return normalizePageUrl(value); } catch { throw new SessionDataError(); }
}

export function normalizeStoredSession(value: unknown, expectedId: string): SavedSession {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION ||
    !hasOnlyKeys(value, ['schemaVersion', 'session']) || !isRecord(value.session)) {
    throw new SessionDataError();
  }
  const raw = value.session;
  if (!hasOnlyKeys(raw, ['id', 'name', 'workspaceId', 'pages', 'createdAt']) ||
    !validId(raw.id) || raw.id !== expectedId || typeof raw.name !== 'string' ||
    (raw.workspaceId !== undefined && !validId(raw.workspaceId)) ||
    !Array.isArray(raw.pages) || !validTimestamp(raw.createdAt)) {
    throw new SessionDataError();
  }
  let name: string;
  try { name = normalizeSessionName(raw.name); } catch { throw new SessionDataError(); }
  const pageIds = new Set<string>();
  const positions = new Set<number>();
  const pages = raw.pages.map((page): SessionPage => {
    if (!isRecord(page) || !hasOnlyKeys(page, ['id', 'title', 'url', 'faviconUrl', 'position']) ||
      !validId(page.id) || pageIds.has(page.id) || typeof page.title !== 'string' ||
      typeof page.url !== 'string' || !Number.isInteger(page.position) ||
      (page.position as number) < 0 || positions.has(page.position as number)) {
      throw new SessionDataError();
    }
    pageIds.add(page.id);
    positions.add(page.position as number);
    let url: string;
    try { url = normalizePageUrl(page.url); } catch { throw new SessionDataError(); }
    const faviconUrl = safeFavicon(page.faviconUrl);
    return { id: page.id, title: page.title.trim() || new URL(url).hostname,
      url, ...(faviconUrl ? { faviconUrl } : {}), position: page.position as number };
  }).sort((a, b) => a.position - b.position);
  return { id: raw.id, name, ...(raw.workspaceId ? { workspaceId: raw.workspaceId as string } : {}),
    pages, createdAt: raw.createdAt };
}

export function assessTab(tab: Pick<chrome.tabs.Tab, 'url'>): { url?: string; reason?: SkipReason } {
  if (!tab.url) return { reason: 'Missing URL' };
  try { return { url: normalizePageUrl(tab.url) }; }
  catch { return { reason: 'Unsupported or private URL' }; }
}

export function assessTabs(tabs: Pick<chrome.tabs.Tab, 'url'>[]): { eligible: number; skipped: SkipCounts } {
  const skipped: SkipCounts = { 'Missing URL': 0, 'Unsupported or private URL': 0 };
  let eligible = 0;
  for (const tab of tabs) {
    const assessment = assessTab(tab);
    if (assessment.reason) skipped[assessment.reason]++;
    else eligible++;
  }
  return { eligible, skipped };
}

function makePages(tabs: chrome.tabs.Tab[]): { pages: SessionPage[]; skipped: SkipCounts } {
  const skipped: SkipCounts = { 'Missing URL': 0, 'Unsupported or private URL': 0 };
  const pages: SessionPage[] = [];
  for (const tab of [...tabs].sort((a, b) => a.index - b.index)) {
    const assessment = assessTab(tab);
    if (!assessment.url) { skipped[assessment.reason!]++; continue; }
    let faviconUrl: string | undefined;
    if (tab.favIconUrl) {
      try { faviconUrl = normalizePageUrl(tab.favIconUrl); } catch { /* favicon is optional */ }
    }
    pages.push({ id: crypto.randomUUID(), title: tab.title?.trim() || new URL(assessment.url).hostname,
      url: assessment.url, ...(faviconUrl ? { faviconUrl } : {}), position: tab.index });
  }
  return { pages, skipped };
}

export async function getSessions(): Promise<SavedSession[]> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith(SESSION_KEY_PREFIX))
    .map(([key, value]) => normalizeStoredSession(value, key.slice(SESSION_KEY_PREFIX.length)))
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

export async function getSessionById(id: string): Promise<SavedSession | null> {
  if (!validId(id)) throw new Error('Invalid session ID.');
  const key = SESSION_KEY_PREFIX + id;
  const stored = await chrome.storage.local.get(key);
  return stored[key] === undefined ? null : normalizeStoredSession(stored[key], id);
}

export async function createSession(name: string, windowId: number, workspaceId?: string): Promise<CaptureResult> {
  const normalizedName = normalizeSessionName(name);
  if (!Number.isInteger(windowId) || windowId < 0) throw new Error('Invalid Chrome window.');
  if (workspaceId) {
    const workspaces = await getWorkspaces();
    if (!workspaces.some((workspace) => workspace.id === workspaceId)) {
      throw new Error('Linked workspace no longer exists.');
    }
  }
  const tabs = await chrome.tabs.query({ windowId });
  const { pages, skipped } = makePages(tabs);
  if (pages.length === 0) throw new Error('No supported pages are open in this window.');
  const session: SavedSession = {
    id: crypto.randomUUID(), name: normalizedName,
    ...(workspaceId ? { workspaceId } : {}), pages, createdAt: Date.now(),
  };
  await chrome.storage.local.set({ [SESSION_KEY_PREFIX + session.id]: { schemaVersion: SCHEMA_VERSION, session } });
  return { session, totalTabs: tabs.length, skipped };
}

export async function deleteSession(id: string): Promise<void> {
  const session = await getSessionById(id);
  if (!session) throw new Error('Session no longer exists.');
  await chrome.storage.local.remove(SESSION_KEY_PREFIX + id);
}
