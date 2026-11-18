import { getGroupRules } from './groupRuleService.ts';
import { AUTO_GROUPING_PENDING_PREFIX, getAutoGroupingEnabled } from './autoGroupingSettings.ts';
import { autoGroupNewTab } from './tabGroupingService.ts';

export { AUTO_GROUPING_PENDING_PREFIX } from './autoGroupingSettings.ts';

export function createAutoGroupingController() {
  const running = new Map<number, { dirty: boolean }>();
  const windowQueues = new Map<number, Promise<void>>();
  const pendingKey = (tabId: number) => `${AUTO_GROUPING_PENDING_PREFIX}${tabId}`;

  async function isPending(tabId: number): Promise<boolean> {
    const key = pendingKey(tabId);
    const stored = await chrome.storage.session.get(key);
    return stored[key] === true;
  }

  async function inWindowQueue(windowId: number, operation: () => Promise<void>): Promise<void> {
    const previous = windowQueues.get(windowId) ?? Promise.resolve();
    const task = previous.catch(() => {}).then(operation);
    const settled = task.then(() => {}, () => {});
    windowQueues.set(windowId, settled);
    try { await task; }
    finally { if (windowQueues.get(windowId) === settled) windowQueues.delete(windowId); }
  }

  async function processPending(tabId: number): Promise<void> {
    if (!await isPending(tabId)) return;
    if (!await getAutoGroupingEnabled()) {
      await chrome.storage.session.remove(pendingKey(tabId));
      return;
    }
    let tab: chrome.tabs.Tab;
    try { tab = await chrome.tabs.get(tabId); }
    catch {
      await chrome.storage.session.remove(pendingKey(tabId));
      return;
    }
    await inWindowQueue(tab.windowId, async () => {
      if (!await isPending(tabId)) return;
      if (!await getAutoGroupingEnabled()) {
        await chrome.storage.session.remove(pendingKey(tabId));
        return;
      }
      let current: chrome.tabs.Tab;
      try { current = await chrome.tabs.get(tabId); }
      catch {
        await chrome.storage.session.remove(pendingKey(tabId));
        return;
      }
      if (current.windowId !== tab.windowId) return;
      const rules = await getGroupRules();
      if (!await getAutoGroupingEnabled()) {
        await chrome.storage.session.remove(pendingKey(tabId));
        return;
      }
      const outcome = await autoGroupNewTab(tabId, current.windowId, current.url, rules);
      if (outcome === 'grouped' || outcome === 'already-grouped' || outcome === 'unmatched') {
        await chrome.storage.session.remove(pendingKey(tabId));
      }
    });
  }

  async function schedule(tabId: number): Promise<void> {
    const active = running.get(tabId);
    if (active) { active.dirty = true; return; }
    const state = { dirty: true };
    running.set(tabId, state);
    try {
      while (state.dirty) {
        state.dirty = false;
        await processPending(tabId);
      }
    } finally { running.delete(tabId); }
  }

  return {
    onCreated: async (tab: chrome.tabs.Tab): Promise<void> => {
      if (tab.id === undefined || !await getAutoGroupingEnabled()) return;
      await chrome.storage.session.set({ [pendingKey(tab.id)]: true });
      await schedule(tab.id);
    },
    onUpdated: schedule,
    onRemoved: (tabId: number): Promise<void> => chrome.storage.session.remove(pendingKey(tabId)),
    resumePending: async (): Promise<void> => {
      const stored = await chrome.storage.session.get(null);
      const ids = Object.entries(stored)
        .filter(([key, value]) => key.startsWith(AUTO_GROUPING_PENDING_PREFIX) && value === true)
        .map(([key]) => Number(key.slice(AUTO_GROUPING_PENDING_PREFIX.length)))
        .filter((id) => Number.isSafeInteger(id) && id >= 0);
      await Promise.all(ids.map(schedule));
    },
  };
}
