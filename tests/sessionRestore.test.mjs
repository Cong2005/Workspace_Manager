import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreSession } from '../src/services/sessionRestore.ts';

const session = (pages) => ({ id: 's1', name: 'Today', createdAt: 1,
  pages: pages.map(([position, url], index) => ({ id: `p${index}`, title: `Page ${index}`, position, url })) });

test('restores in saved order and skips URLs already open or repeated', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  const created = [];
  globalThis.chrome = {
    tabs: {
      query: async (options) => options.windowId ? [{ url: 'https://open.example/' }] : [{ url: 'https://open.example/' }],
      create: async (options) => { created.push(options); return { id: created.length }; },
    },
    windows: { getCurrent: async () => ({ id: 7 }) },
  };
  const input = session([[3, 'https://last.example/'], [0, 'https://open.example/'],
    [2, 'https://last.example/'], [1, 'https://middle.example/']]);
  const result = await restoreSession(input, { target: 'current', skipDuplicates: true });
  assert.deepEqual(result, { opened: 2, failed: 0, skippedDuplicate: 2, skippedInvalid: 0 });
  assert.deepEqual(created.map(({ url, index }) => [url, index]),
    [['https://middle.example/', 1], ['https://last.example/', 2]]);
  assert.deepEqual(input.pages.map(({ position }) => position), [3, 0, 2, 1]);
});

test('reports partial failures and invalid URLs without closing tabs', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  const calls = [];
  globalThis.chrome = {
    tabs: {
      query: async () => [],
      create: async (options) => {
        calls.push(options);
        if (options.url.includes('fail')) throw new Error('cannot create');
        return { id: calls.length };
      },
    },
    windows: { getCurrent: async () => ({ id: 7 }) },
  };
  const result = await restoreSession(session([[0, 'https://good.example/'],
    [1, 'chrome://settings'], [2, 'https://fail.example/'], [3, 'https://later.example/']]),
  { target: 'current', skipDuplicates: false });
  assert.deepEqual(result, { opened: 2, failed: 1, skippedDuplicate: 0, skippedInvalid: 1 });
  assert.deepEqual(calls.map(({ url, index }) => [url, index]), [
    ['https://good.example/', 0], ['https://fail.example/', 1], ['https://later.example/', 1],
  ]);
  assert.equal(globalThis.chrome.tabs.remove, undefined);
});

test('new window starts with first eligible URL and preserves remaining order', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  const calls = [];
  globalThis.chrome = {
    tabs: { query: async () => [], create: async (options) => { calls.push(options); return { id: 1 }; } },
    windows: { create: async (options) => { calls.push(options); return { id: 9 }; } },
  };
  const result = await restoreSession(session([[0, 'https://first.example/'],
    [1, 'https://second.example/']]), { target: 'new', skipDuplicates: true });
  assert.deepEqual(result, { opened: 2, failed: 0, skippedDuplicate: 0, skippedInvalid: 0 });
  assert.deepEqual(calls, [
    { url: 'https://first.example/', focused: true },
    { windowId: 9, url: 'https://second.example/', index: 1, active: false },
  ]);
});
