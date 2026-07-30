import test from 'node:test';
import assert from 'node:assert/strict';

import { applyOrganizePlan, undoOrganize } from '../src/organizer.js';

function makeApi({ failUpdate = false, failOnCloseCall = 0 } = {}) {
  const calls = [];
  let nextGroupId = 100;
  let closeCalls = 0;
  return {
    calls,
    async groupTabs(tabIds) {
      calls.push(['group', tabIds]);
      return nextGroupId++;
    },
    async updateGroup(groupId, details) {
      calls.push(['update', groupId, details]);
      if (failUpdate) throw new Error('group update failed');
    },
    async closeTabs(tabIds) {
      calls.push(['close', tabIds]);
      closeCalls += 1;
      if (closeCalls === failOnCloseCall) throw new Error('close failed');
    },
    async ungroupTabs(tabIds) {
      calls.push(['ungroup', tabIds]);
    },
    async moveTabs(tabIds, moveProperties) {
      calls.push(['move', tabIds, moveProperties]);
    },
    async createTab(properties) {
      calls.push(['create', properties]);
    },
  };
}

const plan = {
  duplicateTabIds: [4],
  aiTabs: [
    { tabId: 1, title: 'One', domain: 'example.com', path: '/one' },
    { tabId: 2, title: 'Two', domain: 'example.com', path: '/two' },
    { tabId: 3, title: 'Three', domain: 'example.com', path: '/three' },
  ],
};

const tabs = [
  { id: 1, index: 0, windowId: 9, url: 'https://example.com/one', active: false },
  { id: 2, index: 1, windowId: 9, url: 'https://example.com/two', active: true },
  { id: 3, index: 2, windowId: 9, url: 'https://example.com/three', active: false },
  { id: 4, index: 3, windowId: 9, url: 'https://example.com/one?utm_source=x', active: false },
];

test('creates groups before closing duplicate tabs and records an undo snapshot', async () => {
  const api = makeApi();
  const result = await applyOrganizePlan(api, plan, [{ title: 'Research', tabIds: [1, 2, 3] }], tabs);

  assert.deepEqual(api.calls.map(([operation]) => operation), ['group', 'update', 'close']);
  assert.deepEqual(api.calls[1], ['update', 100, {
    title: 'Research',
    color: 'blue',
    collapsed: false,
  }]);
  assert.deepEqual(result, {
    groupCount: 1,
    groupedTabCount: 3,
    duplicateCount: 1,
    snapshot: {
      windowId: 9,
      groupedTabIds: [1, 2, 3],
      originalPositions: [
        { id: 1, index: 0 },
        { id: 2, index: 1 },
        { id: 3, index: 2 },
      ],
      closedTabs: [{ url: 'https://example.com/one?utm_source=x', index: 3, active: false }],
    },
  });
});

test('rolls back groups and never closes duplicates when group creation fails', async () => {
  const api = makeApi({ failUpdate: true });

  await assert.rejects(
    applyOrganizePlan(api, plan, [{ title: 'Research', tabIds: [1, 2, 3] }], tabs),
    /group update failed/,
  );

  assert.deepEqual(api.calls.map(([operation]) => operation), ['group', 'update', 'ungroup']);
});

test('reopens already-closed duplicates when closing a later duplicate fails', async () => {
  const api = makeApi({ failOnCloseCall: 2 });
  const tabsWithTwoDuplicates = [...tabs, {
    id: 5,
    index: 4,
    windowId: 9,
    url: 'https://example.com/one?fbclid=x',
    active: false,
  }];

  await assert.rejects(
    applyOrganizePlan(api, { ...plan, duplicateTabIds: [4, 5] }, [{ title: 'Research', tabIds: [1, 2, 3] }], tabsWithTwoDuplicates),
    /close failed/,
  );

  assert.deepEqual(api.calls.map(([operation]) => operation), ['group', 'update', 'close', 'close', 'ungroup', 'create']);
  assert.deepEqual(api.calls.at(-1), ['create', {
    url: 'https://example.com/one?utm_source=x',
    index: 3,
    active: false,
    windowId: 9,
  }]);
});

test('undoes groups, restores positions, then reopens duplicate URLs', async () => {
  const api = makeApi();
  const snapshot = {
    windowId: 9,
    groupedTabIds: [1, 2, 3],
    originalPositions: [{ id: 1, index: 0 }, { id: 2, index: 1 }, { id: 3, index: 2 }],
    closedTabs: [{ url: 'https://example.com/one?utm_source=x', index: 3, active: false }],
  };

  await undoOrganize(api, snapshot);

  assert.deepEqual(api.calls.map(([operation]) => operation), ['ungroup', 'move', 'move', 'move', 'create']);
  assert.deepEqual(api.calls.at(-1), ['create', {
    url: 'https://example.com/one?utm_source=x',
    index: 3,
    active: false,
    windowId: 9,
  }]);
});
