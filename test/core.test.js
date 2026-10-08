import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOrganizePlan,
  normalizeUrl,
  validateModelGroups,
} from '../src/core.js';

test('normalizes tracking parameters while preserving business query parameters', () => {
  assert.equal(
    normalizeUrl('https://example.com/report/?b=2&utm_source=newsletter&a=1#summary'),
    'https://example.com/report?a=1&b=2',
  );
});

test('builds a plan that leaves pinned and existing groups untouched', () => {
  const plan = buildOrganizePlan([
    { id: 1, index: 0, url: 'https://docs.example.com/a?utm_source=x', title: 'A', active: false, pinned: false, groupId: -1 },
    { id: 2, index: 1, url: 'https://docs.example.com/a', title: 'A duplicate', active: true, pinned: false, groupId: -1 },
    { id: 3, index: 2, url: 'https://docs.example.com/pinned', title: 'Pinned', active: false, pinned: true, groupId: -1 },
    { id: 4, index: 3, url: 'https://docs.example.com/grouped', title: 'Grouped', active: false, pinned: false, groupId: 8 },
  ]);

  assert.deepEqual(plan.duplicateTabIds, [1]);
  assert.deepEqual(plan.aiTabs.map((tab) => tab.tabId), [2]);
  assert.deepEqual(plan.untouchedTabIds, [3, 4]);
});

test('keeps the active tab when normalized URLs are duplicates', () => {
  const plan = buildOrganizePlan([
    { id: 7, index: 0, url: 'https://example.com/?gclid=abc', title: 'Earlier', active: false, pinned: false, groupId: -1 },
    { id: 8, index: 1, url: 'https://example.com/', title: 'Active', active: true, pinned: false, groupId: -1 },
  ]);

  assert.deepEqual(plan.duplicateTabIds, [7]);
  assert.deepEqual(plan.aiTabs.map((tab) => tab.tabId), [8]);
});

test('validates model groups against known tab IDs and ignores singleton groups', () => {
  const groups = validateModelGroups(
    {
      groups: [
        { title: 'Research', tabIds: [11, 12] },
        { title: 'Single', tabIds: [13] },
      ],
    },
    new Set([11, 12, 13, 14]),
  );

  assert.deepEqual(groups, [{ title: 'Research', tabIds: [11, 12] }]);
});

test('rejects malformed model groups instead of silently filtering them', () => {
  const knownIds = new Set([1, 2, 3]);
  const invalidPayloads = [
    null,
    { groups: 'not-an-array' },
    { groups: [null] },
    { groups: [{ title: 42, tabIds: [1, 2] }] },
    { groups: [{ title: '   ', tabIds: [1, 2] }] },
    { groups: [{ title: 'Work', tabIds: '1,2' }] },
    { groups: [{ title: 'Work', tabIds: [1, 2.5] }] },
    { groups: [{ title: 'Work', tabIds: [1, 9] }] },
    { groups: [{ title: 'Work', tabIds: [1, 1] }] },
    { groups: [{ title: 'One', tabIds: [1] }, { title: 'Two', tabIds: [1, 2] }] },
  ];

  for (const payload of invalidPayloads) {
    assert.throws(
      () => validateModelGroups(payload, knownIds),
      (error) => error.code === 'AI_INVALID_RESPONSE',
    );
  }
});

test('keeps an English theme and subtopic without the old twelve-character cutoff', () => {
  const groups = validateModelGroups(
    { groups: [{ title: 'AI · Safety Research', tabIds: [21, 22] }] },
    new Set([21, 22]),
  );

  assert.deepEqual(groups, [{ title: 'AI · Safety Research', tabIds: [21, 22] }]);
});

test('caps multilingual titles at forty graphemes without splitting emoji', () => {
  const groups = validateModelGroups(
    { groups: [{ title: `${'x'.repeat(39)}👩‍💻more`, tabIds: [1, 2] }] },
    new Set([1, 2]),
  );
  assert.equal(groups[0].title, `${'x'.repeat(39)}👩‍💻`);
});

test('adds a consistent theme icon and rejects unsupported theme categories', () => {
  assert.deepEqual(validateModelGroups(
    { groups: [{ title: 'AI · 安全研究', category: 'ai', tabIds: [1, 2] }] },
    new Set([1, 2]),
    { style: 'icon' },
  ), [{ title: '🤖 AI · 安全研究', category: 'ai', tabIds: [1, 2] }]);
  assert.throws(() => validateModelGroups(
    { groups: [{ title: 'Work', category: '__proto__', tabIds: [1, 2] }] },
    new Set([1, 2]),
  ), (error) => error.code === 'AI_INVALID_RESPONSE');
});
