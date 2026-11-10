import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessTabs, createSession, deleteSession, getSessionById, getSessions,
  normalizeStoredSession, SESSION_KEY_PREFIX, SessionDataError,
} from '../src/services/sessionService.ts';

function mockChrome(t, { tabs = [], workspaces = [] } = {}) {
  const original = globalThis.chrome;
  const data = { workspaces: structuredClone(workspaces) };
  const calls = { queries: [], writes: [], removes: [] };
  globalThis.chrome = {
    tabs: { query: async (options) => { calls.queries.push(options); return structuredClone(tabs); } },
    storage: { local: {
      get: async (key) => {
        if (key === null) return structuredClone(data);
        if (typeof key === 'string') return key in data ? { [key]: structuredClone(data[key]) } : {};
        return structuredClone(data);
      },
      set: async (value) => { calls.writes.push(value); Object.assign(data, structuredClone(value)); },
      remove: async (key) => { calls.removes.push(key); delete data[key]; },
    } },
  };
  t.after(() => { globalThis.chrome = original; });
  return { data, calls };
}

const tab = (index, url, title) => ({ index, url, title, windowId: 7 });

test('captures actual tabs in index order and reads a versioned independent snapshot', async (t) => {
  const workspace = { id: 'w1', name: 'Research', pages: [], createdAt: 1, updatedAt: 1 };
  const { data, calls } = mockChrome(t, { workspaces: [workspace], tabs: [
    tab(2, 'https://third.example/', 'Third'),
    tab(0, 'https://first.example/', 'First'),
    tab(1, 'chrome://settings', 'Settings'),
  ] });
  const capture = await createSession('  Morning   work  ', 7, 'w1');
  assert.equal(capture.session.name, 'Morning work');
  assert.deepEqual(capture.session.pages.map(({ position, title }) => [position, title]),
    [[0, 'First'], [2, 'Third']]);
  assert.equal(capture.skipped['Unsupported or private URL'], 1);
  assert.equal(capture.totalTabs, 3);
  assert.deepEqual(calls.queries, [{ windowId: 7 }]);
  assert.equal(data.workspaces[0].pages.length, 0);
  const key = SESSION_KEY_PREFIX + capture.session.id;
  assert.equal(data[key].schemaVersion, 1);
  assert.deepEqual(await getSessionById(capture.session.id), capture.session);
  assert.deepEqual(await getSessions(), [capture.session]);
  assert.notEqual(capture.session.pages[0].id, capture.session.id);
});

test('reports missing and unsupported URLs before capture', () => {
  const result = assessTabs([tab(0, undefined), tab(1, 'chrome://settings'),
    tab(2, 'https://site.example/?token=secret'), tab(3, 'https://site.example/')]);
  assert.deepEqual(result, { eligible: 1,
    skipped: { 'Missing URL': 1, 'Unsupported or private URL': 2 } });
});

test('refuses an empty capture without writing storage', async (t) => {
  const { calls } = mockChrome(t, { tabs: [tab(0, 'chrome://settings')] });
  await assert.rejects(createSession('Empty', 7), /No supported pages/);
  assert.equal(calls.writes.length, 0);
});

test('deletes only the session record and preserves workspace data', async (t) => {
  const workspace = { id: 'w1', name: 'Work', pages: [], createdAt: 1, updatedAt: 1 };
  const { data, calls } = mockChrome(t, { workspaces: [workspace], tabs: [tab(0, 'https://example.com/')] });
  const { session } = await createSession('Today', 7, 'w1');
  await deleteSession(session.id);
  assert.equal(await getSessionById(session.id), null);
  assert.deepEqual(data.workspaces, [workspace]);
  assert.deepEqual(calls.removes, [SESSION_KEY_PREFIX + session.id]);
});

test('deleted workspace leaves historical link and snapshot intact', async (t) => {
  const workspace = { id: 'w1', name: 'Work', pages: [], createdAt: 1, updatedAt: 1 };
  const { data } = mockChrome(t, { workspaces: [workspace], tabs: [tab(0, 'https://example.com/')] });
  const { session } = await createSession('Today', 7, 'w1');
  data.workspaces = [];
  const saved = await getSessionById(session.id);
  assert.equal(saved.workspaceId, 'w1');
  assert.deepEqual(saved.pages, session.pages);
});

test('malformed schema is reported without deleting or rewriting storage', async (t) => {
  const { data, calls } = mockChrome(t);
  data[SESSION_KEY_PREFIX + 'bad'] = { schemaVersion: 2, session: { id: 'bad' } };
  await assert.rejects(getSessions(), SessionDataError);
  await assert.rejects(getSessionById('bad'), SessionDataError);
  assert.equal(calls.writes.length, 0);
  assert.equal(calls.removes.length, 0);
  assert.equal(data[SESSION_KEY_PREFIX + 'bad'].schemaVersion, 2);
  assert.throws(() => normalizeStoredSession({ schemaVersion: 1, session: { id: 'x', pages: [] } }, 'x'), SessionDataError);
  data[SESSION_KEY_PREFIX + 'unsafe'] = { schemaVersion: 1, session: {
    id: 'unsafe', name: 'Unsafe', createdAt: 1,
    pages: [{ id: 'p1', title: 'Settings', url: 'chrome://settings', position: 0 }],
  } };
  await assert.rejects(getSessionById('unsafe'), SessionDataError);
  assert.equal(calls.removes.length, 0);
});

test('storage errors propagate and leave unrelated data unchanged', async (t) => {
  const { data } = mockChrome(t, { tabs: [tab(0, 'https://example.com/')] });
  const originalSet = globalThis.chrome.storage.local.set;
  globalThis.chrome.storage.local.set = async () => { throw new Error('storage full'); };
  await assert.rejects(createSession('Today', 7), /storage full/);
  assert.deepEqual(await getSessions(), []);
  assert.deepEqual(data.workspaces, []);
  globalThis.chrome.storage.local.set = originalSet;
});

test('concurrent creates use separate keys and do not lose either session', async (t) => {
  const { data } = mockChrome(t, { tabs: [tab(0, 'https://example.com/')] });
  globalThis.chrome.storage.local.set = async (value) => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    Object.assign(data, structuredClone(value));
  };
  const [a, b] = await Promise.all([createSession('A', 7), createSession('B', 7)]);
  assert.notEqual(a.session.id, b.session.id);
  assert.deepEqual(new Set((await getSessions()).map(({ name }) => name)), new Set(['A', 'B']));
});
