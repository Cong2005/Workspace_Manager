import { canonicalDuplicateUrl, findDuplicateGroups, type DuplicateGroup } from './duplicateDetection.ts';
import type { OpenTab } from '../tabs/tabsService';

export interface CleanupTabSnapshot {
  id: number;
  title: string;
  url: string;
  pinned: boolean;
  active: boolean;
  audible: boolean;
  windowId: number;
}

export interface CleanupGroupPreview {
  url: string;
  keeper: CleanupTabSnapshot;
  members: CleanupTabSnapshot[];
  toClose: CleanupTabSnapshot[];
}

export interface CleanupPreview {
  windowId: number;
  groups: CleanupGroupPreview[];
  closeCount: number;
}

export interface CleanupResult {
  closed: number;
  failed: number;
  skipped: number;
  needsRepreview: boolean;
  errors: string[];
}

function snapshot(tab: OpenTab): CleanupTabSnapshot {
  return { id: tab.id, title: tab.title || tab.url || 'Untitled tab', url: tab.url || '',
    pinned: Boolean(tab.pinned), active: Boolean(tab.active), audible: Boolean(tab.audible),
    windowId: tab.windowId };
}

export function makeCleanupPreview(
  windowId: number, groups: DuplicateGroup[], keepers: Record<string, number>, allowPinnedClose = false,
): CleanupPreview {
  const planned = groups.map((group): CleanupGroupPreview => {
    const keeperId = group.tabs.some((tab) => tab.id === keepers[group.url])
      ? keepers[group.url] : group.defaultKeeperId;
    const members = group.tabs.map(snapshot);
    const keeper = members.find((tab) => tab.id === keeperId)!;
    return { url: group.url, keeper, members,
      toClose: members.filter((tab) => tab.id !== keeperId && (allowPinnedClose || !tab.pinned)) };
  });
  return { windowId, groups: planned, closeCount: planned.reduce((sum, group) => sum + group.toClose.length, 0) };
}

function sameMembers(actual: OpenTab[], expected: CleanupTabSnapshot[], url: string, windowId: number): boolean {
  const expectedById = new Map(expected.map((tab) => [tab.id, tab]));
  const currentGroup = actual.filter((tab) => canonicalDuplicateUrl(tab.url) === url);
  if (currentGroup.length !== expected.length) return false;
  return currentGroup.every((tab) => {
    const prior = expectedById.get(tab.id);
    return prior !== undefined && tab.windowId === windowId && tab.url === prior.url &&
      Boolean(tab.pinned) === prior.pinned && Boolean(tab.active) === prior.active &&
      Boolean(tab.audible) === prior.audible;
  });
}

const activeCleanups = new Set<number>();

export async function cleanupDuplicates(preview: CleanupPreview): Promise<CleanupResult> {
  if (activeCleanups.has(preview.windowId)) throw new Error('Cleanup is already running in this window.');
  activeCleanups.add(preview.windowId);
  const result: CleanupResult = { closed: 0, failed: 0, skipped: 0, needsRepreview: false, errors: [] };
  try {
    for (const group of preview.groups) {
      const remaining = [...group.members];
      for (let index = 0; index < group.toClose.length; index++) {
        const target = group.toClose[index];
        let tabs: OpenTab[];
        try {
          tabs = (await chrome.tabs.query({ windowId: preview.windowId }))
            .filter((tab): tab is OpenTab => tab.id !== undefined);
        } catch (error) {
          result.failed += group.toClose.length - index;
          result.errors.push(error instanceof Error ? error.message : 'Could not query Chrome tabs.');
          break;
        }
        if (!sameMembers(tabs, remaining, group.url, preview.windowId) ||
          !tabs.some((tab) => tab.id === group.keeper.id)) {
          result.skipped += group.toClose.length - index;
          result.needsRepreview = true;
          break;
        }
        try {
          await chrome.tabs.remove(target.id);
          result.closed++;
          remaining.splice(remaining.findIndex((tab) => tab.id === target.id), 1);
        } catch (error) {
          result.failed++;
          result.errors.push(`Tab ${target.id}: ${error instanceof Error ? error.message : 'Chrome could not close it.'}`);
        }
      }
    }
    return result;
  } finally {
    activeCleanups.delete(preview.windowId);
  }
}

export function currentDuplicateSummary(tabs: OpenTab[]) {
  const groups = findDuplicateGroups(tabs);
  return { groups, totalTabs: tabs.length, redundantTabs: groups.reduce((sum, group) => sum + group.tabs.length - 1, 0) };
}
