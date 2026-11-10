import { GROUP_COLORS, type GroupColor, type GroupRule, type GroupRuleInput } from '../types/groupRule.ts';

export const GROUP_RULE_KEY_PREFIX = 'groupRules:v1:';
const SCHEMA_VERSION = 1;
const MAX_NAME_LENGTH = 60;

export class GroupRuleDataError extends Error {
  constructor() {
    super('Saved grouping rules are invalid. No changes were made.');
    this.name = 'GroupRuleDataError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function normalizeGroupName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > MAX_NAME_LENGTH) throw new Error(`Name must be 1–${MAX_NAME_LENGTH} characters.`);
  return name;
}

export function normalizeDomain(value: string): string {
  const input = value.trim().toLowerCase().replace(/\.$/, '');
  if (!input || /[\s/:@*?#]/.test(input)) throw new Error('Enter a domain only, such as github.com.');
  let hostname: string;
  try { hostname = new URL(`https://${input}/`).hostname; }
  catch { throw new Error('Enter a valid domain.'); }
  if (hostname !== input || !hostname.split('.').every((label) =>
    label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
    throw new Error('Enter a valid domain.');
  }
  return hostname;
}

function normalizeColor(value: unknown): GroupColor {
  if (typeof value !== 'string' || !GROUP_COLORS.some((color) => color === value)) {
    throw new Error('Choose a supported Chrome group color.');
  }
  return value as GroupColor;
}

export function normalizeRuleInput(input: GroupRuleInput): GroupRuleInput {
  return { name: normalizeGroupName(input.name), groupTitle: normalizeGroupName(input.groupTitle),
    domain: normalizeDomain(input.domain), color: normalizeColor(input.color) };
}

export function normalizeStoredRule(value: unknown, expectedId: string): GroupRule {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION ||
    !onlyKeys(value, ['schemaVersion', 'rule']) || !isRecord(value.rule)) throw new GroupRuleDataError();
  const raw = value.rule;
  if (!onlyKeys(raw, ['id', 'name', 'groupTitle', 'domain', 'color', 'createdAt', 'updatedAt']) ||
    typeof raw.id !== 'string' || raw.id !== expectedId || typeof raw.name !== 'string' ||
    typeof raw.groupTitle !== 'string' || typeof raw.domain !== 'string' ||
    !validTimestamp(raw.createdAt) || !validTimestamp(raw.updatedAt) || raw.updatedAt < raw.createdAt) {
    throw new GroupRuleDataError();
  }
  try {
    const normalized = normalizeRuleInput(raw as unknown as GroupRuleInput);
    return { id: raw.id, ...normalized, createdAt: raw.createdAt, updatedAt: raw.updatedAt };
  } catch { throw new GroupRuleDataError(); }
}

export async function getGroupRules(): Promise<GroupRule[]> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith(GROUP_RULE_KEY_PREFIX))
    .map(([key, value]) => normalizeStoredRule(value, key.slice(GROUP_RULE_KEY_PREFIX.length)))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export async function createGroupRule(input: GroupRuleInput): Promise<GroupRule[]> {
  const normalized = normalizeRuleInput(input);
  const now = Date.now();
  const rule: GroupRule = { id: crypto.randomUUID(), ...normalized, createdAt: now, updatedAt: now };
  await chrome.storage.local.set({ [GROUP_RULE_KEY_PREFIX + rule.id]: { schemaVersion: SCHEMA_VERSION, rule } });
  return getGroupRules();
}

export async function updateGroupRule(id: string, input: GroupRuleInput): Promise<GroupRule[]> {
  const normalized = normalizeRuleInput(input);
  const key = GROUP_RULE_KEY_PREFIX + id;
  const stored = await chrome.storage.local.get(key);
  if (stored[key] === undefined) throw new Error('Grouping rule no longer exists.');
  const previous = normalizeStoredRule(stored[key], id);
  const rule: GroupRule = { ...previous, ...normalized, updatedAt: Math.max(Date.now(), previous.updatedAt) };
  await chrome.storage.local.set({ [key]: { schemaVersion: SCHEMA_VERSION, rule } });
  return getGroupRules();
}

export async function deleteGroupRule(id: string): Promise<GroupRule[]> {
  const key = GROUP_RULE_KEY_PREFIX + id;
  const stored = await chrome.storage.local.get(key);
  if (stored[key] === undefined) throw new Error('Grouping rule no longer exists.');
  normalizeStoredRule(stored[key], id);
  await chrome.storage.local.remove(key);
  return getGroupRules();
}
