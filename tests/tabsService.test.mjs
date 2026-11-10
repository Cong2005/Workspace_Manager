import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterTabs,
  getTabLocation,
  getWindowTabs,
  tabStillExists,
} from '../src/sidepanel/tabs/tabsService.ts';

const tab = (id, index, title, url) => ({ id, index, title, url, windowId: 7 });

test('filters title and URL without case sensitivity or a Chrome query', () => {
  const tabs = [
    tab(1, 0, 'React Docs', 'https://react.dev/learn'),
    tab(2, 1, 'Inbox', 'https://mail.example.com/messages'),
  ];
  assert.deepEqual(filterTabs(tabs, '  REACT  ').map(({ id }) => id), [1]);
  assert.deepEqual(filterTabs(tabs, 'EXAMPLE.COM').map(({ id }) => id), [2]);
  assert.deepEqual(filterTabs(tabs, '/MESSAGES').map(({ id }) => id), [2]);
  assert.deepEqual(filterTabs(tabs, ''), tabs);
});

test('handles missing and malformed URLs', () => {
  assert.equal(getTabLocation(), 'URL unavailable');
  assert.equal(getTabLocation('not a URL'), 'not a URL');
  assert.equal(getTabLocation('chrome://settings'), 'chrome://settings');
  assert.equal(getTabLocation('https://Example.com/path'), 'example.com');
  assert.deepEqual(filterTabs([tab(1, 0, undefined, undefined)], 'missing'), []);
});

test('queries only the requested window and sorts by Chrome tab index', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  const calls = [];
  globalThis.chrome = {
    tabs: {
      query: async (options) => {
        calls.push(options);
        return [tab(3, 2, 'Third'), tab(1, 0, 'First'), tab(2, 1, 'Second')];
      },
    },
  };

  assert.deepEqual((await getWindowTabs(7)).map(({ id }) => id), [1, 2, 3]);
  assert.deepEqual(calls, [{ windowId: 7 }]);
});

test('identifies a tab that was already closed', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  globalThis.chrome = {
    tabs: { get: async () => { throw new Error('No tab with id'); } },
  };
  assert.equal(await tabStillExists(12), false);
});
