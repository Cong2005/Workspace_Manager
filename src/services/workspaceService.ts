import type { PageInput, SavedPage, Workspace } from '../types/workspace';

export const WORKSPACES_KEY = 'workspaces';
export const MAX_WORKSPACE_NAME_LENGTH = 60;
const SENSITIVE_PARAMETER = /^(?:access_?token|refresh_?token|id_?token|token|auth(?:orization)?|api_?key|password|passwd|secret|session_?id)$/i;

export class WorkspaceDataError extends Error {
  constructor() {
    super('Saved workspace data is invalid. No changes were made.');
    this.name = 'WorkspaceDataError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeWorkspaceName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > MAX_WORKSPACE_NAME_LENGTH) {
    throw new Error(`Workspace name must be 1–${MAX_WORKSPACE_NAME_LENGTH} characters.`);
  }
  return name;
}

export function normalizePageUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Only valid HTTP or HTTPS pages can be saved.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('Only valid HTTP or HTTPS pages without embedded credentials can be saved.');
  }
  if (hasSensitiveParameters(url)) {
    throw new Error('This URL contains a credential or token parameter and cannot be saved.');
  }
  return url.href;
}

function hasSensitiveParameters(url: URL): boolean {
  if ([...url.searchParams.keys()].some((key) => SENSITIVE_PARAMETER.test(key))) return true;
  const fragment = url.hash.slice(1);
  return fragment.includes('=') &&
    [...new URLSearchParams(fragment).keys()].some((key) => SENSITIVE_PARAMETER.test(key));
}

function normalizeFavicon(value: unknown, strict = false): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new WorkspaceDataError();
  try {
    const url = new URL(value);
    if ((url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username && !url.password && !hasSensitiveParameters(url)) return url.href;
    if (strict) throw new WorkspaceDataError();
    return undefined;
  } catch {
    if (strict) throw new WorkspaceDataError();
    return undefined;
  }
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function normalizeStoredWorkspaces(value: unknown): Workspace[] {
  if (!Array.isArray(value)) throw new WorkspaceDataError();
  const workspaceIds = new Set<string>();
  return value.map((raw): Workspace => {
    if (!isRecord(raw) ||
      !hasOnlyKeys(raw, ['id', 'name', 'pages', 'createdAt', 'updatedAt']) ||
      !validId(raw.id) || typeof raw.name !== 'string' || !Array.isArray(raw.pages) ||
      !validTimestamp(raw.createdAt) || !validTimestamp(raw.updatedAt) ||
      raw.updatedAt < raw.createdAt || workspaceIds.has(raw.id)) {
      throw new WorkspaceDataError();
    }
    const id = raw.id;
    workspaceIds.add(id);
    let name: string;
    try { name = normalizeWorkspaceName(raw.name); } catch { throw new WorkspaceDataError(); }
    const pageIds = new Set<string>();
    const pages = raw.pages.map((page): SavedPage => {
      if (!isRecord(page) ||
        !hasOnlyKeys(page, ['id', 'title', 'url', 'faviconUrl', 'addedAt']) ||
        !validId(page.id) || pageIds.has(page.id) ||
        typeof page.title !== 'string' || typeof page.url !== 'string' ||
        !validTimestamp(page.addedAt)) {
        throw new WorkspaceDataError();
      }
      pageIds.add(page.id);
      let url: string;
      try { url = normalizePageUrl(page.url); } catch { throw new WorkspaceDataError(); }
      const faviconUrl = normalizeFavicon(page.faviconUrl, true);
      return { id: page.id, title: page.title.trim() || new URL(url).hostname,
        url, ...(faviconUrl ? { faviconUrl } : {}), addedAt: page.addedAt };
    });
    return { id, name, pages, createdAt: raw.createdAt, updatedAt: raw.updatedAt };
  });
}

async function readWorkspaces(): Promise<Workspace[]> {
  const stored = await chrome.storage.local.get(WORKSPACES_KEY);
  const value: unknown = stored[WORKSPACES_KEY];
  return value === undefined ? [] : normalizeStoredWorkspaces(value);
}

let operationQueue: Promise<void> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function updateWorkspaces(change: (workspaces: Workspace[]) => Workspace[]): Promise<Workspace[]> {
  const current = await readWorkspaces();
  const next = change(current);
  if (next === current) return current;
  await chrome.storage.local.set({ [WORKSPACES_KEY]: next });
  return next;
}

function findWorkspace(workspaces: Workspace[], id: string): Workspace {
  const workspace = workspaces.find((item) => item.id === id);
  if (!workspace) throw new Error('Workspace no longer exists.');
  return workspace;
}

export function getWorkspaces(): Promise<Workspace[]> {
  return serialize(readWorkspaces);
}

export function createWorkspace(name: string): Promise<Workspace[]> {
  return serialize(() => updateWorkspaces((workspaces) => {
    const now = Date.now();
    return [...workspaces, {
      id: crypto.randomUUID(), name: normalizeWorkspaceName(name), pages: [],
      createdAt: now, updatedAt: now,
    }];
  }));
}

export function renameWorkspace(workspaceId: string, name: string): Promise<Workspace[]> {
  return serialize(() => updateWorkspaces((workspaces) => {
    const current = findWorkspace(workspaces, workspaceId);
    const normalized = normalizeWorkspaceName(name);
    if (normalized === current.name) return workspaces;
    return workspaces.map((item) => item.id === workspaceId
      ? { ...item, name: normalized, updatedAt: Math.max(Date.now(), item.updatedAt) } : item);
  }));
}

export function deleteWorkspace(workspaceId: string): Promise<Workspace[]> {
  return serialize(() => updateWorkspaces((workspaces) => {
    findWorkspace(workspaces, workspaceId);
    return workspaces.filter((item) => item.id !== workspaceId);
  }));
}

export function addPageToWorkspace(workspaceId: string, input: PageInput): Promise<Workspace[]> {
  return serialize(() => updateWorkspaces((workspaces) => {
    const current = findWorkspace(workspaces, workspaceId);
    const url = normalizePageUrl(input.url);
    if (current.pages.some((page) => page.url === url)) {
      throw new Error('This page is already saved in this workspace.');
    }
    const faviconUrl = normalizeFavicon(input.faviconUrl);
    const now = Date.now();
    const page: SavedPage = {
      id: crypto.randomUUID(), title: input.title?.trim() || new URL(url).hostname,
      url, ...(faviconUrl ? { faviconUrl } : {}), addedAt: now,
    };
    return workspaces.map((item) => item.id === workspaceId
      ? { ...item, pages: [...item.pages, page], updatedAt: Math.max(now, item.updatedAt) } : item);
  }));
}

export function removePageFromWorkspace(workspaceId: string, pageId: string): Promise<Workspace[]> {
  return serialize(() => updateWorkspaces((workspaces) => {
    const current = findWorkspace(workspaces, workspaceId);
    if (!current.pages.some((page) => page.id === pageId)) {
      throw new Error('Saved page no longer exists.');
    }
    return workspaces.map((item) => item.id === workspaceId
      ? { ...item, pages: item.pages.filter((page) => page.id !== pageId),
        updatedAt: Math.max(Date.now(), item.updatedAt) }
      : item);
  }));
}
