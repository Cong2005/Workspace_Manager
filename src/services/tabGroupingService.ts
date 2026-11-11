import type { GroupColor, GroupRule } from '../types/groupRule';
import { GROUP_COLORS } from '../types/groupRule.ts';
import { normalizeGroupName } from './groupRuleService.ts';
import type { OpenTab } from '../sidepanel/tabs/tabsService';

export interface GroupMatch {
  tabId: number;
  tabTitle: string;
  url: string;
  ruleId: string;
  ruleName: string;
  willMove: boolean;
}

export interface PlannedGroup {
  title: string;
  color: GroupColor;
  matches: GroupMatch[];
}

export interface GroupingPreview {
  groups: PlannedGroup[];
  matchingTabs: number;
  affectedTabs: number;
}

export interface GroupingResult {
  groupedTabs: number;
  createdGroups: number;
  reusedGroups: number;
  failedGroups: { title: string; message: string }[];
}

export function matchesDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const target = domain.toLowerCase().replace(/\.$/, '');
  return host === target || host.endsWith(`.${target}`);
}

function hostnameForRule(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.hostname : null;
  } catch { return null; }
}

export function buildGroupingPreview(
  tabs: OpenTab[], rules: GroupRule[], existingGroups: chrome.tabGroups.TabGroup[] = [],
): GroupingPreview {
  const priority = [...rules].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const groups: PlannedGroup[] = [];
  const groupPriorities = new Map<string, number>();
  for (const tab of [...tabs].sort((a, b) => a.index - b.index)) {
    if (tab.pinned) continue;
    const host = hostnameForRule(tab.url);
    if (!host) continue;
    const rule = priority.find((item) => matchesDomain(host, item.domain));
    if (!rule) continue;
    const key = rule.groupTitle.toLowerCase();
    const rulePriority = priority.indexOf(rule);
    let group = groups.find((item) => item.title.toLowerCase() === key);
    if (!group) {
      group = { title: rule.groupTitle, color: rule.color, matches: [] };
      groups.push(group);
      groupPriorities.set(key, rulePriority);
    } else if (rulePriority < (groupPriorities.get(key) ?? Infinity)) {
      group.title = rule.groupTitle;
      group.color = rule.color;
      groupPriorities.set(key, rulePriority);
    }
    group.matches.push({ tabId: tab.id, tabTitle: tab.title || tab.url || 'Untitled tab',
      url: tab.url!, ruleId: rule.id, ruleName: rule.name, willMove: true });
  }
  let affectedTabs = 0;
  for (const group of groups) {
    const existing = findExistingGroup(existingGroups, group.title);
    for (const match of group.matches) {
      const tab = tabs.find((item) => item.id === match.tabId);
      match.willMove = !existing || tab?.groupId !== existing.id;
      if (match.willMove) affectedTabs++;
    }
  }
  return { groups, matchingTabs: groups.reduce((sum, group) => sum + group.matches.length, 0), affectedTabs };
}

function samePreview(a: GroupingPreview, b: GroupingPreview): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function findExistingGroup(groups: chrome.tabGroups.TabGroup[], title: string) {
  return groups.find((group) => group.title?.trim().toLowerCase() === title.toLowerCase());
}

async function groupIntoTarget(
  tabs: OpenTab[], title: string, color: GroupColor, existingGroups: chrome.tabGroups.TabGroup[],
): Promise<{ groupedTabs: number; created: boolean }> {
  const existing = findExistingGroup(existingGroups, title);
  const eligible = existing ? tabs.filter((tab) => tab.groupId !== existing.id) : tabs;
  let groupId = existing?.id;
  if (eligible.length > 0) {
    const tabIds = eligible.map((tab) => tab.id) as [number, ...number[]];
    groupId = await chrome.tabs.group(existing ? { tabIds, groupId: existing.id } : { tabIds });
  }
  if (groupId === undefined) return { groupedTabs: 0, created: false };
  if (existing?.title === title && existing.color === color) {
    return { groupedTabs: eligible.length, created: false };
  }
  try {
    const updated = await chrome.tabGroups.update(groupId, { title, color });
    if (updated && !existing) existingGroups.push(updated);
  } catch {
    throw new Error('Tabs may have been grouped, but Chrome could not set the group name or color.');
  }
  return { groupedTabs: eligible.length, created: !existing };
}

export async function groupSelectedTabs(
  windowId: number, tabIds: number[], title: string, color: GroupColor,
): Promise<{ groupedTabs: number; created: boolean }> {
  const normalizedTitle = normalizeGroupName(title);
  if (!GROUP_COLORS.some((supported) => supported === color)) throw new Error('Choose a supported Chrome group color.');
  if (!tabIds.length || new Set(tabIds).size !== tabIds.length) throw new Error('Select one or more distinct tabs.');
  const tabs = await chrome.tabs.query({ windowId }) as OpenTab[];
  const selected = tabIds.map((id) => tabs.find((tab) => tab.id === id));
  if (selected.some((tab) => !tab)) throw new Error('A selected tab is no longer in this window.');
  if (selected.some((tab) => tab?.pinned)) throw new Error('Pinned tabs cannot be grouped.');
  const groups = await chrome.tabGroups.query({ windowId });
  return groupIntoTarget(selected as OpenTab[], normalizedTitle, color, groups);
}

export async function applyGroupingPreview(
  windowId: number, preview: GroupingPreview, rules: GroupRule[],
): Promise<GroupingResult> {
  const tabs = await chrome.tabs.query({ windowId }) as OpenTab[];
  const groups = await chrome.tabGroups.query({ windowId });
  const current = buildGroupingPreview(tabs, rules, groups);
  if (!samePreview(current, preview)) throw new Error('Tabs or rules changed. Preview grouping again.');
  const result: GroupingResult = { groupedTabs: 0, createdGroups: 0, reusedGroups: 0, failedGroups: [] };
  for (const plan of preview.groups) {
    const selected = plan.matches.map((match) => tabs.find((tab) => tab.id === match.tabId));
    if (selected.some((tab) => !tab || tab.pinned)) {
      result.failedGroups.push({ title: plan.title, message: 'A tab was closed or is pinned.' });
      continue;
    }
    try {
      const outcome = await groupIntoTarget(selected as OpenTab[], plan.title, plan.color, groups);
      result.groupedTabs += outcome.groupedTabs;
      if (outcome.created) result.createdGroups++;
      else result.reusedGroups++;
    } catch (error) {
      result.failedGroups.push({ title: plan.title,
        message: error instanceof Error ? error.message : 'Chrome could not group these tabs.' });
    }
  }
  return result;
}
