import type { OpenTab } from '../tabs/tabsService';

export interface DuplicateGroup {
  url: string;
  tabs: OpenTab[];
  defaultKeeperId: number;
}

export function canonicalDuplicateUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function chooseDefaultKeeper(tabs: OpenTab[]): OpenTab {
  if (tabs.length === 0) throw new Error('Duplicate group has no tabs.');
  return [...tabs].sort((a, b) =>
    Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
    Number(Boolean(b.active)) - Number(Boolean(a.active)) ||
    a.index - b.index || a.id - b.id)[0];
}

export function findDuplicateGroups(tabs: OpenTab[]): DuplicateGroup[] {
  const byUrl = new Map<string, OpenTab[]>();
  for (const tab of [...tabs].sort((a, b) => a.index - b.index)) {
    const url = canonicalDuplicateUrl(tab.url);
    if (!url) continue;
    const group = byUrl.get(url) ?? [];
    group.push(tab);
    byUrl.set(url, group);
  }
  return [...byUrl.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([url, group]) => ({ url, tabs: group, defaultKeeperId: chooseDefaultKeeper(group).id }))
    .sort((a, b) => a.tabs[0].index - b.tabs[0].index);
}
