import test from 'node:test';
import assert from 'node:assert/strict';

import { applyOrganizePlan, finalizeUndoSnapshot, undoOrganize } from '../src/organizer.js';

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

test('uses the same theme color regardless of the order of groups', async () => {
  const api = makeApi();
  await applyOrganizePlan(api, { duplicateTabIds: [] }, [
    { title: '开发 · Shell', category: 'development', tabIds: [1, 2] },
    { title: 'AI · 安全研究', category: 'ai', tabIds: [3, 4] },
  ], tabs);
  assert.deepEqual(api.calls.filter(([op]) => op === 'update').map(([, , details]) => details.color), ['blue', 'purple']);
});

function completeSnapshot() {
  return {
    windowId: 9,
    groupedTabIds: [1, 2, 3],
    createdGroups: [{ groupId: 100, tabIds: [1, 2, 3] }],
    originalPositions: tabs.slice(0, 3).map((tab) => ({ id: tab.id, index: tab.index, url: tab.url })),
    organizedPositions: tabs.slice(0, 3).map((tab) => ({
      id: tab.id,
      index: tab.index,
      windowId: 9,
      groupId: 100,
      url: tab.url,
    })),
    closedTabs: [{ url: 'https://example.com/one?utm_source=x', index: 3, active: false, desiredCount: 2 }],
  };
}

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
      createdGroups: [{ groupId: 100, tabIds: [1, 2, 3] }],
      originalPositions: [
        { id: 1, index: 0, url: 'https://example.com/one' },
        { id: 2, index: 1, url: 'https://example.com/two' },
        { id: 3, index: 2, url: 'https://example.com/three' },
      ],
      closedTabs: [{ url: 'https://example.com/one?utm_source=x', index: 3, active: false, desiredCount: 2 }],
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

test('undoes owned groups, restores positions, and replenishes the original duplicate count', async () => {
  const api = makeApi();
  const liveTabs = tabs.slice(0, 3).map((tab) => ({ ...tab, groupId: 100, pinned: false }));

  const result = await undoOrganize(api, completeSnapshot(), liveTabs);

  assert.deepEqual(api.calls.map(([operation]) => operation), ['ungroup', 'move', 'move', 'move', 'create']);
  assert.deepEqual(api.calls.at(-1), ['create', {
    url: 'https://example.com/one?utm_source=x',
    index: 3,
    active: false,
    windowId: 9,
  }]);
  assert.deepEqual(result, { restoredTabs: 3, reopenedTabs: 1, skippedTabs: 0 });
});

test('only restores tabs that still match the created group state', async () => {
  const api = makeApi();
  const liveTabs = [
    { ...tabs[0], groupId: 100, pinned: false },
    { ...tabs[1], groupId: 200, pinned: false },
    { ...tabs[2], groupId: 100, pinned: false, url: 'https://example.com/three#changed' },
  ];

  const result = await undoOrganize(api, completeSnapshot(), liveTabs);

  assert.deepEqual(api.calls[0], ['ungroup', [1]]);
  assert.deepEqual(result, { restoredTabs: 1, reopenedTabs: 1, skippedTabs: 2 });
});

test('does not reopen duplicates beyond their pre-organize count', async () => {
  const api = makeApi();
  const snapshot = {
    windowId: 9,
    groupedTabIds: [],
    createdGroups: [],
    originalPositions: [],
    organizedPositions: [],
    closedTabs: [{ url: 'https://example.com/one?utm_source=x', index: 3, active: false, desiredCount: 2 }],
  };
  const liveTabs = [
    { ...tabs[0], groupId: -1, pinned: false },
    { id: 8, index: 1, windowId: 9, url: 'https://example.com/one?fbclid=manual', groupId: -1, pinned: false },
  ];

  const result = await undoOrganize(api, snapshot, liveTabs);

  assert.equal(api.calls.length, 0);
  assert.deepEqual(result, { restoredTabs: 0, reopenedTabs: 0, skippedTabs: 1 });
});

test('records the exact post-organize state used by safe undo', () => {
  const snapshot = {
    groupedTabIds: [1, 2],
    createdGroups: [{ groupId: 100, tabIds: [1, 2] }],
  };
  const finalized = finalizeUndoSnapshot(snapshot, [
    { id: 1, index: 4, windowId: 9, groupId: 100, url: 'https://example.com/one' },
    { id: 2, index: 5, windowId: 9, groupId: 100, url: 'https://example.com/two' },
  ]);

  assert.deepEqual(finalized.organizedPositions, [
    { id: 1, index: 4, windowId: 9, groupId: 100, url: 'https://example.com/one' },
    { id: 2, index: 5, windowId: 9, groupId: 100, url: 'https://example.com/two' },
  ]);
});
