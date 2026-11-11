import assert from 'node:assert/strict';
import test from 'node:test';
import { findDuplicateGroups } from '../src/sidepanel/duplicates/duplicateDetection.ts';
import { cleanupDuplicates, makeCleanupPreview } from '../src/sidepanel/duplicates/duplicateCleanup.ts';

const tab = (id, index, url = 'https://a.test/', extra = {}) => ({ id, index, url,
  title: `Tab ${id}`, windowId: 7, pinned: false, active: false, audible: false, ...extra });
const previewFor = (tabs, keeperId = 1) => {
  const groups = findDuplicateGroups(tabs);
  return makeCleanupPreview(7, groups, { [groups[0].url]: keeperId });
};

function mockTabs(t, initial, removeImpl) {
  const original = globalThis.chrome;
  const state = { tabs: [...initial], removed: [] };
  globalThis.chrome = { tabs: {
    query: async ({ windowId }) => state.tabs.filter((item) => item.windowId === windowId),
    remove: async (id) => {
      state.removed.push(id);
      if (removeImpl) return removeImpl(id, state);
      state.tabs = state.tabs.filter((item) => item.id !== id);
    },
  } };
  t.after(() => { globalThis.chrome = original; });
  return state;
}

test('skips closure if a tab vanished, moved windows or changed URL after preview', async (t) => {
  const initial = [tab(1, 0), tab(2, 1)];
  const state = mockTabs(t, initial);
  const preview = previewFor(initial);
  state.tabs = [initial[0]];
  assert.deepEqual(await cleanupDuplicates(preview),
    { closed: 0, failed: 0, skipped: 1, needsRepreview: true, errors: [] });
  state.tabs = [initial[0], { ...initial[1], windowId: 8 }];
  assert.equal((await cleanupDuplicates(preview)).skipped, 1);
  state.tabs = [initial[0], { ...initial[1], url: 'https://b.test/' }];
  assert.equal((await cleanupDuplicates(preview)).skipped, 1);
  assert.deepEqual(state.removed, []);
});

test('skips when keeper disappears or protective status changes', async (t) => {
  const initial = [tab(1, 0), tab(2, 1)];
  const state = mockTabs(t, initial);
  const preview = previewFor(initial);
  state.tabs = [initial[1]];
  assert.equal((await cleanupDuplicates(preview)).skipped, 1);
  state.tabs = [initial[0], { ...initial[1], audible: true }];
  assert.equal((await cleanupDuplicates(preview)).skipped, 1);
  state.tabs = [{ ...initial[0], active: true }, initial[1]];
  assert.equal((await cleanupDuplicates(preview)).skipped, 1);
  assert.deepEqual(state.removed, []);
});

test('closes individually and reports partial Chrome API failure', async (t) => {
  const initial = [tab(1, 0), tab(2, 1), tab(3, 2)];
  const state = mockTabs(t, initial, (id, current) => {
    if (id === 2) throw new Error('Chrome refused');
    current.tabs = current.tabs.filter((item) => item.id !== id);
  });
  const result = await cleanupDuplicates(previewFor(initial));
  assert.equal(result.closed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.skipped, 0);
  assert.deepEqual(state.removed, [2, 3]);
  assert.deepEqual(state.tabs.map(({ id }) => id), [1, 2]);
});

test('stops remaining closures when duplicate membership changes mid-cleanup', async (t) => {
  const initial = [tab(1, 0), tab(2, 1), tab(3, 2)];
  const state = mockTabs(t, initial, (id, current) => {
    current.tabs = current.tabs.filter((item) => item.id !== id);
    current.tabs.push(tab(4, 3));
  });
  const result = await cleanupDuplicates(previewFor(initial));
  assert.deepEqual([result.closed, result.skipped, result.needsRepreview], [1, 1, true]);
  assert.deepEqual(state.removed, [2]);
});

test('concurrent confirmation is locked and does not remove twice', async (t) => {
  const initial = [tab(1, 0), tab(2, 1)];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const state = mockTabs(t, initial, async (id, current) => {
    await gate;
    current.tabs = current.tabs.filter((item) => item.id !== id);
  });
  const preview = previewFor(initial);
  const first = cleanupDuplicates(preview);
  await assert.rejects(cleanupDuplicates(preview), /already running/);
  release();
  assert.equal((await first).closed, 1);
  assert.deepEqual(state.removed, [2]);
});
