import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalDuplicateUrl, chooseDefaultKeeper, findDuplicateGroups,
} from '../src/sidepanel/duplicates/duplicateDetection.ts';
import { makeCleanupPreview } from '../src/sidepanel/duplicates/duplicateCleanup.ts';

const tab = (id, index, url, extra = {}) => ({ id, index, url, title: `Tab ${id}`,
  windowId: 7, pinned: false, active: false, audible: false, ...extra });

test('URL equivalence uses parser normalization but preserves path, query and fragment', () => {
  assert.equal(canonicalDuplicateUrl('HTTPS://EXAMPLE.COM:443/a?x=1#top'),
    canonicalDuplicateUrl('https://example.com/a?x=1#top'));
  assert.equal(canonicalDuplicateUrl('http://EXAMPLE.COM:80/a'), 'http://example.com/a');
  assert.notEqual(canonicalDuplicateUrl('https://example.com/a'), canonicalDuplicateUrl('http://example.com/a'));
  assert.notEqual(canonicalDuplicateUrl('https://example.com/a'), canonicalDuplicateUrl('https://example.com/b'));
  assert.notEqual(canonicalDuplicateUrl('https://example.com/a?x=1'), canonicalDuplicateUrl('https://example.com/a?x=2'));
  assert.notEqual(canonicalDuplicateUrl('https://example.com/a#one'), canonicalDuplicateUrl('https://example.com/a#two'));
  assert.notEqual(canonicalDuplicateUrl('https://example.com/?utm_source=one'),
    canonicalDuplicateUrl('https://example.com/?utm_source=two'));
});

test('ignores invalid, missing and internal URLs; does not use title or domain alone', () => {
  assert.equal(canonicalDuplicateUrl('chrome://settings'), null);
  assert.equal(canonicalDuplicateUrl('not a URL'), null);
  assert.equal(canonicalDuplicateUrl(), null);
  const groups = findDuplicateGroups([
    tab(1, 0, 'https://example.com/a', { title: 'Same' }),
    tab(2, 1, 'https://example.com/b', { title: 'Same' }),
    tab(3, 2, 'chrome://settings'), tab(4, 3, 'chrome://settings'),
  ]);
  assert.deepEqual(groups, []);
});

test('default keeper prefers pinned, then active, then first position', () => {
  const tabs = [tab(1, 0, 'https://a.test/', { active: true }),
    tab(2, 2, 'https://a.test/', { pinned: true }),
    tab(3, 1, 'https://a.test/', { pinned: true, active: true })];
  assert.equal(chooseDefaultKeeper(tabs).id, 3);
  assert.equal(chooseDefaultKeeper(tabs.slice(0, 2)).id, 2);
  assert.equal(chooseDefaultKeeper([tab(1, 1, 'x'), tab(2, 0, 'x')]).id, 2);
});

test('pinned duplicates are not selected to close by default', () => {
  const groups = findDuplicateGroups([
    tab(1, 0, 'https://a.test/', { pinned: true }),
    tab(2, 1, 'https://a.test/', { pinned: true }),
    tab(3, 2, 'https://a.test/'),
  ]);
  const safe = makeCleanupPreview(7, groups, { [groups[0].url]: 3 });
  assert.deepEqual(safe.groups[0].toClose.map(({ id }) => id), []);
  const explicit = makeCleanupPreview(7, groups, { [groups[0].url]: 3 }, true);
  assert.deepEqual(explicit.groups[0].toClose.map(({ id }) => id), [1, 2]);
  assert.equal(explicit.groups[0].keeper.id, 3);
});
