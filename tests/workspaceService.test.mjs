import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addPageToWorkspace,
  createWorkspace,
  deleteWorkspace,
  getWorkspaces,
  normalizePageUrl,
  normalizeStoredWorkspaces,
  removePageFromWorkspace,
  renameWorkspace,
  WorkspaceDataError,
} from '../src/services/workspaceService.ts';

function mockStorage(t, initial) {
  const original = globalThis.chrome;
  const data = initial === undefined ? {} : { workspaces: structuredClone(initial) };
  let writes = 0;
  globalThis.chrome = {
    storage: { local: {
      get: async () => structuredClone(data),
      set: async (value) => { writes++; Object.assign(data, structuredClone(value)); },
    } },
  };
  t.after(() => { globalThis.chrome = original; });
  return { data, get writes() { return writes; } };
}

test('creates a workspace with normalized name and independent UUID', async (t) => {
  const storage = mockStorage(t);
  const [workspace] = await createWorkspace('  Research   Notes  ');
  assert.equal(workspace.name, 'Research Notes');
  assert.match(workspace.id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[\da-f]{4}-[\da-f]{12}$/i);
  assert.deepEqual(workspace.pages, []);
  assert.deepEqual(await getWorkspaces(), [workspace]);
  assert.equal(storage.writes, 1);
  await assert.rejects(createWorkspace('   '), /name must be/);
  assert.equal(storage.writes, 1);
});

test('renames and deletes only the selected workspace', async (t) => {
  mockStorage(t);
  const first = (await createWorkspace('First'))[0];
  const second = (await createWorkspace('Second'))[1];
  const renamed = await renameWorkspace(first.id, '  Updated  ');
  assert.equal(renamed[0].name, 'Updated');
  assert.equal(renamed[1].name, second.name);
  const remaining = await deleteWorkspace(first.id);
  assert.deepEqual(remaining.map(({ id }) => id), [second.id]);
  await assert.rejects(deleteWorkspace(first.id), /no longer exists/);
});

test('adds and removes saved pages without Chrome tab IDs', async (t) => {
  mockStorage(t);
  const workspaceId = (await createWorkspace('Reading'))[0].id;
  const added = await addPageToWorkspace(workspaceId, {
    title: '  Guide  ', url: 'https://example.com/guide', faviconUrl: 'chrome://favicon',
  });
  const page = added[0].pages[0];
  assert.equal(page.title, 'Guide');
  assert.equal(page.url, 'https://example.com/guide');
  assert.equal(page.faviconUrl, undefined);
  assert.notEqual(page.id, workspaceId);
  const removed = await removePageFromWorkspace(workspaceId, page.id);
  assert.deepEqual(removed[0].pages, []);
});

test('prevents duplicate URLs inside one workspace but permits another workspace', async (t) => {
  mockStorage(t);
  const [first, second] = await createWorkspace('One').then(() => createWorkspace('Two'));
  await addPageToWorkspace(first.id, { url: 'https://EXAMPLE.com/a' });
  await assert.rejects(addPageToWorkspace(first.id, { url: 'https://example.com/a' }), /already saved/);
  const result = await addPageToWorkspace(second.id, { url: 'https://example.com/a' });
  assert.equal(result[0].pages.length, 1);
  assert.equal(result[1].pages.length, 1);
});

test('rejects unsupported URLs and embedded credentials', () => {
  assert.throws(() => normalizePageUrl('chrome://settings'), /HTTP or HTTPS/);
  assert.throws(() => normalizePageUrl('not a URL'), /HTTP or HTTPS/);
  assert.throws(() => normalizePageUrl('https://user:password@example.com/'), /credentials/);
  assert.throws(() => normalizePageUrl('https://example.com/?access_token=secret'), /token parameter/);
  assert.throws(() => normalizePageUrl('https://example.com/#refresh_token=secret'), /token parameter/);
});

test('invalid storage is reported and never overwritten', async (t) => {
  const storage = mockStorage(t, [{ id: 'broken', name: 'Bad', pages: 'not an array' }]);
  await assert.rejects(getWorkspaces(), WorkspaceDataError);
  await assert.rejects(createWorkspace('Safe'), WorkspaceDataError);
  assert.equal(storage.writes, 0);
  assert.equal(storage.data.workspaces[0].pages, 'not an array');
  assert.throws(() => normalizeStoredWorkspaces({}), WorkspaceDataError);
});

test('stored pages with invalid metadata are preserved instead of silently rewritten', async (t) => {
  const storage = mockStorage(t, [{
    id: 'w1', name: 'Saved', pages: [{
      id: 'p1', title: 'Page', url: 'https://example.com/',
      faviconUrl: 'chrome://favicon', addedAt: 1,
    }], createdAt: 1, updatedAt: 1,
  }]);
  await assert.rejects(renameWorkspace('w1', 'New name'), WorkspaceDataError);
  assert.equal(storage.writes, 0);
  assert.equal(storage.data.workspaces[0].pages[0].faviconUrl, 'chrome://favicon');
});

test('storage read and write failures propagate; queue remains usable', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  let failRead = true;
  let failWrite = true;
  const data = {};
  globalThis.chrome = { storage: { local: {
    get: async () => { if (failRead) throw new Error('read failed'); return data; },
    set: async (value) => { if (failWrite) throw new Error('write failed'); Object.assign(data, value); },
  } } };
  await assert.rejects(getWorkspaces(), /read failed/);
  failRead = false;
  await assert.rejects(createWorkspace('One'), /write failed/);
  failWrite = false;
  assert.equal((await createWorkspace('Two')).length, 1);
});

test('concurrent writes are serialized without losing updates', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  const data = {};
  globalThis.chrome = { storage: { local: {
    get: async () => { await new Promise((resolve) => setTimeout(resolve, 2)); return structuredClone(data); },
    set: async (value) => { await new Promise((resolve) => setTimeout(resolve, 2)); Object.assign(data, structuredClone(value)); },
  } } };
  await Promise.all([createWorkspace('A'), createWorkspace('B'), createWorkspace('C')]);
  assert.deepEqual((await getWorkspaces()).map(({ name }) => name), ['A', 'B', 'C']);
});

test('concurrent duplicate page additions save only one copy', async (t) => {
  mockStorage(t);
  const id = (await createWorkspace('Reading'))[0].id;
  const results = await Promise.allSettled([
    addPageToWorkspace(id, { url: 'https://example.com/' }),
    addPageToWorkspace(id, { url: 'https://EXAMPLE.com/' }),
  ]);
  assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'rejected']);
  assert.equal((await getWorkspaces())[0].pages.length, 1);
});
