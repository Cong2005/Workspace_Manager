import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyGroupingPreview, buildGroupingPreview, groupSelectedTabs, matchesDomain,
} from '../src/services/tabGroupingService.ts';

const rule = (id, domain, groupTitle, color = 'blue', createdAt = 1) => ({
  id, name: id, domain, groupTitle, color, createdAt, updatedAt: createdAt,
});
const tab = (id, index, url, extra = {}) => ({ id, index, url, title: `Tab ${id}`,
  windowId: 7, groupId: -1, ...extra });

test('matches exact host and real subdomains only', () => {
  assert.equal(matchesDomain('github.com', 'github.com'), true);
  assert.equal(matchesDomain('docs.github.com', 'github.com'), true);
  assert.equal(matchesDomain('a.b.github.com', 'github.com'), true);
  assert.equal(matchesDomain('evilgithub.com', 'github.com'), false);
  assert.equal(matchesDomain('github.com.evil.test', 'github.com'), false);
});

test('older rule wins overlaps and controls shared group color regardless of tab order', () => {
  const preview = buildGroupingPreview([
    tab(1, 0, 'https://react.dev/'),
    tab(2, 1, 'https://docs.github.com/'),
    tab(3, 2, undefined),
    tab(4, 3, 'https://evilgithub.com/'),
    tab(5, 4, 'https://github.com/', { pinned: true }),
  ], [
    rule('newer', 'react.dev', 'Development', 'green', 3),
    rule('specific', 'docs.github.com', 'Other', 'red', 2),
    rule('older', 'github.com', 'Development', 'blue', 1),
  ]);
  assert.equal(preview.affectedTabs, 2);
  assert.equal(preview.matchingTabs, 2);
  assert.deepEqual(preview.groups.map((group) => [group.title, group.color]),
    [['Development', 'blue']]);
  assert.deepEqual(preview.groups[0].matches.map(({ tabId, ruleId }) => [tabId, ruleId]),
    [[1, 'newer'], [2, 'older']]);
});

test('preview distinguishes matching tabs already in the destination group', () => {
  const preview = buildGroupingPreview([
    tab(1, 0, 'https://github.com/', { groupId: 42 }),
    tab(2, 1, 'https://docs.github.com/'),
  ], [rule('r', 'github.com', 'Dev')], [{ id: 42, title: 'Dev', color: 'blue', windowId: 7 }]);
  assert.equal(preview.matchingTabs, 2);
  assert.equal(preview.affectedTabs, 1);
  assert.deepEqual(preview.groups[0].matches.map(({ willMove }) => willMove), [false, true]);
});

test('manual grouping uses only requested window and updates Chrome group metadata', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  const calls = { query: [], group: [], update: [] };
  globalThis.chrome = {
    tabs: {
      query: async (options) => { calls.query.push(options); return [tab(1, 0, 'https://a.test/'), tab(2, 1, 'https://b.test/')]; },
      group: async (options) => { calls.group.push(options); return 42; },
    },
    tabGroups: {
      query: async () => [],
      update: async (id, options) => { calls.update.push([id, options]); return { id, ...options, windowId: 7 }; },
    },
  };
  const result = await groupSelectedTabs(7, [1, 2], '  Project  ', 'blue');
  assert.deepEqual(result, { groupedTabs: 2, created: true });
  assert.deepEqual(calls.query, [{ windowId: 7 }]);
  assert.deepEqual(calls.group, [{ tabIds: [1, 2] }]);
  assert.deepEqual(calls.update, [[42, { title: 'Project', color: 'blue' }]]);
  await assert.rejects(groupSelectedTabs(7, [1, 99], 'Project', 'blue'), /no longer in this window/);
  assert.equal(calls.group.length, 1);
});

test('manual grouping reports a partial change when group metadata update fails', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  let groupCalls = 0;
  globalThis.chrome = {
    tabs: { query: async () => [tab(1, 0, 'https://a.test/')],
      group: async () => { groupCalls++; return 42; } },
    tabGroups: { query: async () => [],
      update: async () => { throw new Error('Chrome metadata error'); } },
  };
  await assert.rejects(groupSelectedTabs(7, [1], 'Project', 'blue'), /may have been grouped/);
  assert.equal(groupCalls, 1);
});

test('reuses matching group and avoids duplicate group or metadata update', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  let groupCalls = 0;
  let updateCalls = 0;
  globalThis.chrome = {
    tabs: { query: async () => [tab(1, 0, 'https://a.test/', { groupId: 42 })],
      group: async () => { groupCalls++; return 42; } },
    tabGroups: { query: async () => [{ id: 42, title: 'Project', color: 'blue', windowId: 7 }],
      update: async () => { updateCalls++; } },
  };
  assert.deepEqual(await groupSelectedTabs(7, [1], 'Project', 'blue'), { groupedTabs: 0, created: false });
  assert.equal(groupCalls, 0);
  assert.equal(updateCalls, 0);
});

test('Chrome grouping errors propagate and stale previews are rejected before mutation', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  let groupCalls = 0;
  globalThis.chrome = {
    tabs: { query: async () => [tab(1, 0, 'https://github.com/')],
      group: async () => { groupCalls++; throw new Error('Chrome failed'); } },
    tabGroups: { query: async () => [], update: async () => {} },
  };
  await assert.rejects(groupSelectedTabs(7, [1], 'Dev', 'blue'), /Chrome failed/);
  const initial = buildGroupingPreview([tab(2, 0, 'https://github.com/')], [rule('r', 'github.com', 'Dev')]);
  await assert.rejects(applyGroupingPreview(7, initial, [rule('r', 'github.com', 'Dev')]), /Preview grouping again/);
  assert.equal(groupCalls, 1);
});

test('rule application reports partial group failures without writing Storage', async (t) => {
  const original = globalThis.chrome;
  t.after(() => { globalThis.chrome = original; });
  const tabs = [tab(1, 0, 'https://github.com/'), tab(2, 1, 'https://youtube.com/')];
  const rules = [rule('a', 'github.com', 'Dev'), rule('b', 'youtube.com', 'Learning')];
  globalThis.chrome = {
    tabs: { query: async () => tabs,
      group: async ({ tabIds }) => { if (tabIds[0] === 2) throw new Error('Cannot group'); return 42; } },
    tabGroups: { query: async () => [],
      update: async (id, options) => ({ id, ...options, windowId: 7 }) },
  };
  const result = await applyGroupingPreview(7, buildGroupingPreview(tabs, rules), rules);
  assert.equal(result.groupedTabs, 1);
  assert.equal(result.failedGroups.length, 1);
  assert.equal(globalThis.chrome.storage, undefined);
});
