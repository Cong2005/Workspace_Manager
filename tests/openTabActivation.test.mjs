import assert from 'node:assert/strict';
import test from 'node:test';
import { activateTab } from '../src/sidepanel/tabs/tabsService.ts';
import { tabRowActions } from '../src/sidepanel/tabs/tabRowActions.ts';

test('Open Tab activates its existing ID without creating or changing its URL', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  const calls = [];
  globalThis.chrome = {
    tabs: {
      get: async (id) => { calls.push(['get', id]); return { id, windowId: 8, active: false, url: 'https://example.com/' }; },
      update: async (id, properties) => {
        calls.push(['update', id, properties]);
        return { id, windowId: 8, active: true, url: 'https://example.com/' };
      },
      create: () => { throw new Error('Open Tabs must never create a tab'); },
      remove: () => { throw new Error('Open Tabs must never close a tab on activation'); },
    },
    windows: {
      get: async (id) => { calls.push(['window.get', id]); return { id, focused: false }; },
      update: async (id, properties) => { calls.push(['window.update', id, properties]); },
    },
  };
  await activateTab(42);
  assert.deepEqual(calls, [
    ['get', 42], ['update', 42, { active: true }],
    ['window.get', 8], ['window.update', 8, { focused: true }],
  ]);
});

test('already active tab is not updated and a focused window is not refocused', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  globalThis.chrome = {
    tabs: {
      get: async () => ({ id: 42, windowId: 7, active: true }),
      update: () => { throw new Error('Redundant tab update'); },
    },
    windows: {
      get: async () => ({ id: 7, focused: true }),
      update: () => { throw new Error('Redundant window update'); },
    },
  };
  await activateTab(42);
});

test('invalid or closed tab ID never triggers activation', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  globalThis.chrome = {
    tabs: {
      get: async () => { throw new Error('No tab with id'); },
      update: () => { throw new Error('Unexpected update'); },
    },
  };
  await assert.rejects(activateTab(-1), /Invalid Chrome tab ID/);
  await assert.rejects(activateTab(42), /No tab with id/);
});

test('checkbox and close button do not dispatch Open Tab activation', () => {
  const calls = [];
  let stopped = 0;
  const actions = tabRowActions(42, {
    onActivate: (id) => calls.push(['activate', id]),
    onClose: (id) => calls.push(['close', id]),
    onToggleSelect: (id) => calls.push(['select', id]),
  });
  const event = { stopPropagation: () => { stopped++; } };
  actions.selectClick(event);
  actions.selectChange();
  actions.close(event);
  assert.deepEqual(calls, [['select', 42], ['close', 42]]);
  assert.equal(stopped, 2);
  actions.activate();
  assert.deepEqual(calls.at(-1), ['activate', 42]);
});
