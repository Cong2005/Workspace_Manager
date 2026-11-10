import { normalizePageUrl } from './workspaceService.ts';
import type { RestoreResult, SavedSession } from '../types/session';

export interface RestoreOptions {
  target: 'current' | 'new';
  skipDuplicates: boolean;
}

export async function restoreSession(session: SavedSession, options: RestoreOptions): Promise<RestoreResult> {
  const result: RestoreResult = { opened: 0, failed: 0, skippedDuplicate: 0, skippedInvalid: 0 };
  const existing = new Set<string>();
  if (options.skipDuplicates) {
    for (const tab of await chrome.tabs.query({})) {
      if (!tab.url) continue;
      try { existing.add(normalizePageUrl(tab.url)); } catch { /* unsupported open tab */ }
    }
  }

  const toOpen: string[] = [];
  for (const page of [...session.pages].sort((a, b) => a.position - b.position)) {
    let url: string;
    try { url = normalizePageUrl(page.url); }
    catch { result.skippedInvalid++; continue; }
    if (options.skipDuplicates && existing.has(url)) {
      result.skippedDuplicate++;
      continue;
    }
    existing.add(url);
    toOpen.push(url);
  }
  if (toOpen.length === 0) return result;

  let windowId: number;
  let nextIndex: number;
  if (options.target === 'new') {
    try {
      const window = await chrome.windows.create({ url: toOpen[0], focused: true });
      result.opened++;
      if (window?.id === undefined) {
        result.failed += toOpen.length - 1;
        return result;
      }
      windowId = window.id;
      nextIndex = 1;
    } catch {
      result.failed += toOpen.length;
      return result;
    }
  } else {
    const window = await chrome.windows.getCurrent();
    if (window.id === undefined) throw new Error('Cannot identify the current Chrome window.');
    windowId = window.id;
    nextIndex = (await chrome.tabs.query({ windowId })).length;
  }

  for (const url of toOpen.slice(options.target === 'new' ? 1 : 0)) {
    try {
      await chrome.tabs.create({ windowId, url, index: nextIndex, active: false });
      result.opened++;
      nextIndex++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
