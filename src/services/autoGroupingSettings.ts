export const AUTO_GROUPING_SETTINGS_KEY = 'autoGrouping:settings:v1';
export const AUTO_GROUPING_PENDING_PREFIX = 'autoGrouping:pending:v1:';

type AutoGroupingSettings = { schemaVersion: 1; enabled: boolean };

export function parseAutoGroupingSettings(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'object' || value === null || Array.isArray(value) ||
    Object.keys(value).length !== 2 || !('schemaVersion' in value) ||
    !('enabled' in value) || value.schemaVersion !== 1 || typeof value.enabled !== 'boolean') {
    throw new Error('Auto Grouping settings are invalid. No changes were made.');
  }
  return value.enabled;
}

export async function getAutoGroupingEnabled(): Promise<boolean> {
  const stored = await chrome.storage.local.get(AUTO_GROUPING_SETTINGS_KEY);
  return parseAutoGroupingSettings(stored[AUTO_GROUPING_SETTINGS_KEY]);
}

export async function setAutoGroupingEnabled(enabled: boolean): Promise<void> {
  await getAutoGroupingEnabled();
  const settings: AutoGroupingSettings = { schemaVersion: 1, enabled };
  await chrome.storage.local.set({ [AUTO_GROUPING_SETTINGS_KEY]: settings });
  if (!enabled) {
    const stored = await chrome.storage.session.get(null);
    const pendingKeys = Object.keys(stored).filter((key) => key.startsWith(AUTO_GROUPING_PENDING_PREFIX));
    if (pendingKeys.length) await chrome.storage.session.remove(pendingKeys);
  }
}
