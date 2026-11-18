import assert from 'node:assert/strict';
import test from 'node:test';
import { createAutoGroupingController, AUTO_GROUPING_PENDING_PREFIX } from '../src/services/autoGroupingService.ts';
import { AUTO_GROUPING_SETTINGS_KEY, getAutoGroupingEnabled,
  setAutoGroupingEnabled } from '../src/services/autoGroupingSettings.ts';
import { GROUP_RULE_KEY_PREFIX } from '../src/services/groupRuleService.ts';

const rule = (id = 'rule-1', domain = 'chatgpt.com', title = 'AI Tools', color = 'blue', createdAt = 1) => ({
  id, name: `Rule ${id}`, domain, groupTitle: title, color, createdAt, updatedAt: createdAt,
});
const tab = (id, url, extra = {}) => ({ id, windowId: 7, index: id, url,
  pinned: false, groupId: -1, active: false, ...extra });

function setup(t, { enabled = false, tabs = [], rules = [rule()], groups = [] } = {}) {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  const local = new Map();
  const session = new Map();
  const currentTabs = new Map(tabs.map((item) => [item.id, { ...item }]));
  const currentGroups = groups.map((group) => ({ ...group }));
  const calls = { grouped: [], updated: [] };
  if (enabled) local.set(AUTO_GROUPING_SETTINGS_KEY, { schemaVersion: 1, enabled: true });
  for (const item of rules) local.set(GROUP_RULE_KEY_PREFIX + item.id, { schemaVersion: 1, rule: item });
  const area = (map) => ({
    get: async (key) => key === null ? Object.fromEntries(map) :
      Object.fromEntries([key].flat().filter((item) => map.has(item)).map((item) => [item, map.get(item)])),
    set: async (entries) => { for (const [key, value] of Object.entries(entries)) map.set(key, value); },
    remove: async (keys) => { for (const key of [keys].flat()) map.delete(key); },
  });
  globalThis.chrome = {
    storage: { local: area(local), session: area(session) },
    tabs: {
      get: async (id) => {
        const item = currentTabs.get(id);
        if (!item) throw new Error('Tab not found');
        return { ...item };
      },
      group: async ({ tabIds, groupId, createProperties }) => {
        calls.grouped.push({ tabIds, groupId, createProperties });
        const id = groupId ?? 100 + currentGroups.length;
        if (groupId === undefined) currentGroups.push({ id, windowId: createProperties?.windowId,
          title: '', color: 'grey' });
        for (const tabId of tabIds) currentTabs.get(tabId).groupId = id;
        return id;
      },
      create: () => { throw new Error('Auto Grouping must not create tabs'); },
      remove: () => { throw new Error('Auto Grouping must not remove tabs'); },
      update: () => { throw new Error('Auto Grouping must not activate tabs'); },
    },
    tabGroups: {
      query: async ({ windowId }) => currentGroups.filter((group) => group.windowId === windowId)
        .map((group) => ({ ...group })),
      update: async (id, properties) => {
        calls.updated.push({ id, properties });
        const group = currentGroups.find((item) => item.id === id);
        Object.assign(group, properties);
        return { ...group };
      },
    },
  };
  return { local, session, currentTabs, currentGroups, calls };
}

test('Auto Grouping defaults OFF and leaves new tabs untouched', async (t) => {
  const state = setup(t, { tabs: [tab(1, 'https://chatgpt.com/')] });
  assert.equal(await getAutoGroupingEnabled(), false);
  await createAutoGroupingController().onCreated(state.currentTabs.get(1));
  assert.equal(state.calls.grouped.length, 0);
  assert.equal(state.session.size, 0);
  await setAutoGroupingEnabled(true);
  assert.equal(await getAutoGroupingEnabled(), true);
  await createAutoGroupingController().onUpdated(1);
  assert.equal(state.calls.grouped.length, 0, 'enabling must not group an older tab');
});

test('new matching tab joins an existing group without changing its manual metadata', async (t) => {
  const state = setup(t, { enabled: true, tabs: [tab(1, 'https://sub.chatgpt.com/a')],
    groups: [{ id: 50, windowId: 7, title: 'AI Tools', color: 'pink' }] });
  await createAutoGroupingController().onCreated(state.currentTabs.get(1));
  assert.deepEqual(state.calls.grouped, [{ tabIds: [1], groupId: 50, createProperties: undefined }]);
  assert.deepEqual(state.calls.updated, []);
  assert.equal(state.currentTabs.get(1).groupId, 50);
  assert.equal(state.session.size, 0);
});

test('new matching tabs create one group and preserve focus', async (t) => {
  const state = setup(t, { enabled: true,
    tabs: [tab(1, 'https://chatgpt.com/'), tab(2, 'https://chatgpt.com/new')] });
  const controller = createAutoGroupingController();
  await Promise.all([controller.onCreated(state.currentTabs.get(1)),
    controller.onCreated(state.currentTabs.get(2))]);
  assert.equal(state.currentGroups.length, 1);
  assert.equal(state.currentGroups[0].title, 'AI Tools');
  assert.equal(state.currentGroups[0].color, 'blue');
  assert.deepEqual(state.calls.grouped.map(({ groupId }) => groupId), [undefined, 100]);
  assert.deepEqual([...state.currentTabs.values()].map(({ active }) => active), [false, false]);
});

test('destination group is selected only inside the new tab window', async (t) => {
  const state = setup(t, { enabled: true, tabs: [tab(1, 'https://chatgpt.com/', { windowId: 8 })],
    groups: [{ id: 50, windowId: 7, title: 'AI Tools', color: 'pink' }] });
  await createAutoGroupingController().onCreated(state.currentTabs.get(1));
  assert.deepEqual(state.calls.grouped, [{ tabIds: [1], groupId: undefined,
    createProperties: { windowId: 8 } }]);
  assert.equal(state.currentGroups.find((group) => group.id === 50).color, 'pink');
  assert.equal(state.currentGroups.find((group) => group.windowId === 8).title, 'AI Tools');
});

test('unmatched, lookalike, pinned and already grouped tabs are skipped', async (t) => {
  const state = setup(t, { enabled: true, tabs: [
    tab(1, 'https://other.test/'), tab(2, 'https://evilchatgpt.com/'),
    tab(3, 'https://chatgpt.com/', { pinned: true }),
    tab(4, 'https://chatgpt.com/', { groupId: 55 }),
    tab(5, 'chrome://settings'),
  ] });
  const controller = createAutoGroupingController();
  for (const item of state.currentTabs.values()) await controller.onCreated(item);
  assert.equal(state.calls.grouped.length, 0);
  assert.equal(state.session.has(AUTO_GROUPING_PENDING_PREFIX + 5), true);
  assert.equal(state.session.size, 1);
});

test('URL arriving after creation is grouped once despite repeated updates', async (t) => {
  const state = setup(t, { enabled: true, tabs: [tab(1, 'about:blank')] });
  const controller = createAutoGroupingController();
  await controller.onCreated(state.currentTabs.get(1));
  state.currentTabs.get(1).url = 'https://chatgpt.com/';
  await Promise.all(Array.from({ length: 8 }, () => controller.onUpdated(1)));
  await controller.onUpdated(1);
  assert.equal(state.calls.grouped.length, 1);
  assert.equal(state.session.size, 0);
});

test('new controller after Service Worker restart resumes session marker', async (t) => {
  const state = setup(t, { enabled: true, tabs: [tab(1, 'about:blank')] });
  await createAutoGroupingController().onCreated(state.currentTabs.get(1));
  state.currentTabs.get(1).url = 'https://chatgpt.com/';
  await createAutoGroupingController().resumePending();
  assert.equal(state.calls.grouped.length, 1);
});

test('oldest matching domain rule wins for Auto Grouping', async (t) => {
  const state = setup(t, { enabled: true, tabs: [tab(1, 'https://sub.chatgpt.com/')],
    rules: [rule('later', 'sub.chatgpt.com', 'Other', 'red', 2),
      rule('earlier', 'chatgpt.com', 'AI Tools', 'blue', 1)] });
  await createAutoGroupingController().onCreated(state.currentTabs.get(1));
  assert.equal(state.currentGroups[0].title, 'AI Tools');
  assert.equal(state.currentGroups[0].color, 'blue');
});

test('turning Auto Grouping OFF clears pending tab without changing it', async (t) => {
  const state = setup(t, { enabled: true, tabs: [tab(1, 'about:blank')] });
  const controller = createAutoGroupingController();
  await controller.onCreated(state.currentTabs.get(1));
  await setAutoGroupingEnabled(false);
  assert.equal(state.session.size, 0);
  state.currentTabs.get(1).url = 'https://chatgpt.com/';
  await setAutoGroupingEnabled(true);
  await controller.onUpdated(1);
  assert.equal(state.calls.grouped.length, 0);
  assert.equal(state.session.size, 0);
});

test('URL changed during validation is not grouped using stale rule', async (t) => {
  const state = setup(t, { enabled: true, tabs: [tab(1, 'https://chatgpt.com/')] });
  const query = globalThis.chrome.tabGroups.query;
  globalThis.chrome.tabGroups.query = async (options) => {
    state.currentTabs.get(1).url = 'https://other.test/';
    return query(options);
  };
  await createAutoGroupingController().onCreated(state.currentTabs.get(1));
  assert.equal(state.calls.grouped.length, 0);
  assert.equal(state.session.has(AUTO_GROUPING_PENDING_PREFIX + 1), true);
  await createAutoGroupingController().onUpdated(1);
  assert.equal(state.session.size, 0);
});

test('invalid settings are reported without overwriting stored data', async (t) => {
  const state = setup(t);
  const corrupt = { schemaVersion: 9, enabled: true };
  state.local.set(AUTO_GROUPING_SETTINGS_KEY, corrupt);
  await assert.rejects(setAutoGroupingEnabled(false), /invalid/);
  assert.equal(state.local.get(AUTO_GROUPING_SETTINGS_KEY), corrupt);
});
