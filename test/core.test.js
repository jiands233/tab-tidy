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
        { title: 'Research', tabIds: [11, 12, 99] },
        { title: 'Single', tabIds: [13] },
        { title: 'Repeated', tabIds: [12, 14] },
      ],
    },
    new Set([11, 12, 13, 14]),
  );

  assert.deepEqual(groups, [{ title: 'Research', tabIds: [11, 12] }]);
});
