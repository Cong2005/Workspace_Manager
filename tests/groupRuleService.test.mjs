import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGroupRule, deleteGroupRule, getGroupRules, GROUP_RULE_KEY_PREFIX,
  GroupRuleDataError, normalizeDomain, updateGroupRule,
} from '../src/services/groupRuleService.ts';

const input = (domain = 'github.com') => ({ name: 'Development', groupTitle: 'Dev', domain, color: 'blue' });

function storage(t) {
  const original = globalThis.chrome;
  const data = { workspaces: [{ id: 'keep' }], 'sessions:v1:keep': { schemaVersion: 1 } };
  const calls = { writes: [], removes: [] };
  globalThis.chrome = { storage: { local: {
    get: async (key) => key === null ? structuredClone(data) : key in data ? { [key]: structuredClone(data[key]) } : {},
    set: async (value) => { calls.writes.push(value); Object.assign(data, structuredClone(value)); },
    remove: async (key) => { calls.removes.push(key); delete data[key]; },
  } } };
  t.after(() => { globalThis.chrome = original; });
  return { data, calls };
}

test('normalizes domain and rejects URL syntax', () => {
  assert.equal(normalizeDomain(' GitHub.COM. '), 'github.com');
  assert.throws(() => normalizeDomain('https://github.com/path'), /domain only/);
  assert.throws(() => normalizeDomain('*.github.com'), /domain only/);
});

test('creates, updates and deletes a versioned rule without touching Workspace or Session', async (t) => {
  const { data, calls } = storage(t);
  const [created] = await createGroupRule(input());
  assert.equal(data[GROUP_RULE_KEY_PREFIX + created.id].schemaVersion, 1);
  assert.equal(created.domain, 'github.com');
  const [updated] = await updateGroupRule(created.id, { ...input(), groupTitle: 'Engineering', color: 'green' });
  assert.equal(updated.groupTitle, 'Engineering');
  assert.equal(updated.color, 'green');
  assert.deepEqual(await deleteGroupRule(created.id), []);
  assert.equal(calls.removes[0], GROUP_RULE_KEY_PREFIX + created.id);
  assert.deepEqual(data.workspaces, [{ id: 'keep' }]);
  assert.deepEqual(data['sessions:v1:keep'], { schemaVersion: 1 });
  assert.equal(Object.keys(calls.writes[0])[0].startsWith(GROUP_RULE_KEY_PREFIX), true);
});

test('invalid rule schema is reported without deletion or rewrite', async (t) => {
  const { data, calls } = storage(t);
  data[GROUP_RULE_KEY_PREFIX + 'bad'] = { schemaVersion: 99, rule: { id: 'bad' } };
  await assert.rejects(getGroupRules(), GroupRuleDataError);
  await assert.rejects(updateGroupRule('bad', input()), GroupRuleDataError);
  await assert.rejects(deleteGroupRule('bad'), GroupRuleDataError);
  assert.equal(calls.writes.length, 0);
  assert.equal(calls.removes.length, 0);
});

test('concurrent creates write separate keys', async (t) => {
  const { data } = storage(t);
  globalThis.chrome.storage.local.set = async (value) => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    Object.assign(data, structuredClone(value));
  };
  await Promise.all([createGroupRule(input('github.com')), createGroupRule(input('react.dev'))]);
  assert.deepEqual(new Set((await getGroupRules()).map((rule) => rule.domain)),
    new Set(['github.com', 'react.dev']));
});
