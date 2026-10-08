import test from 'node:test';
import assert from 'node:assert/strict';
import { undoOrganize, finalizeUndoSnapshot } from '../src/organizer.js';

test('undo reconstructs emptied old groups with original names, colors and reopened duplicate members', async () => {
  const live = [1, 2].map((id, index) => ({ id, index, windowId: 9, groupId: 100, url: `https://example.com/${id}`, pinned: false }));
  const calls = [];
  const snapshot = {
    windowId: 9, groupedTabIds: [1, 2],
    originalPositions: live.map(tab => ({ id: tab.id, index: tab.index, url: tab.url })),
    organizedPositions: live,
    createdGroups: [{ groupId: 100, tabIds: [1, 2] }],
    closedTabs: [{ url: 'https://example.com/1?utm_source=x', index: 2, active: false, desiredCount: 2, originalId: 3 }],
    originalGroups: [{ groupId: 42, tabIds: [1, 2, 3], title: 'Original mixed group', color: 'pink', collapsed: true }],
  };
  const api = {
    ungroupTabs: async ids => calls.push(['ungroup', ids]),
    moveTabs: async (ids, props) => calls.push(['move', ids, props]),
    createTab: async props => { calls.push(['create', props]); return { id: 99 }; },
    getGroup: async () => { throw new Error('Group was emptied'); },
    groupTabs: async (ids, oldId) => { calls.push(['group', ids, oldId]); return 200; },
    updateGroup: async (id, props) => calls.push(['update', id, props]),
  };
  const outcome = await undoOrganize(api, snapshot, live);
  assert.deepEqual(outcome, { restoredTabs: 2, reopenedTabs: 1, skippedTabs: 0 });
  assert.deepEqual(calls.slice(-2), [
    ['group', [1, 2, 99], undefined],
    ['update', 200, { title: 'Original mixed group', color: 'pink', collapsed: true }],
  ]);
});

test('ungrouped leftovers in a full regroup remain eligible for undo without an unnecessary ungroup call', async () => {
  const tab = { id: 7, index: 0, windowId: 9, groupId: -1, url: 'https://example.com/7', pinned: false };
  const snapshot = finalizeUndoSnapshot({
    windowId: 9, groupedTabIds: [7], createdGroups: [],
    originalPositions: [{ id: 7, index: 0, url: tab.url }], closedTabs: [],
  }, [tab]);
  assert.equal(snapshot.organizedPositions[0].groupId, -1);
  let moved = false;
  const outcome = await undoOrganize({
    ungroupTabs: async () => assert.fail('Already ungrouped'),
    moveTabs: async () => { moved = true; },
  }, snapshot, [tab]);
  assert.equal(outcome.restoredTabs, 1);
  assert.equal(moved, true);
});

test('undo leaves a non-web member in the different group the user moved it to', async () => {
  const web = { id: 1, index: 0, windowId: 9, groupId: 100, url: 'https://example.com/1', pinned: false };
  const internal = { id: 9, index: 1, windowId: 9, groupId: 333, url: 'chrome://settings', pinned: false };
  const snapshot = { windowId: 9, groupedTabIds: [1], createdGroups: [{ groupId: 100, tabIds: [1] }],
    originalPositions: [{ id: 1, index: 0, url: web.url }], organizedPositions: [web], closedTabs: [],
    originalGroups: [{ groupId: 42, tabIds: [1, 9], title: 'Old group', color: 'blue', collapsed: false,
      originalTabs: [{ id: 9, url: internal.url, windowId: 9 }] }] };
  let grouped;
  await undoOrganize({ ungroupTabs: async () => {}, moveTabs: async () => {},
    getGroup: async () => { throw new Error('Old group no longer exists'); },
    groupTabs: async ids => { grouped = ids; return 200; }, updateGroup: async () => {},
  }, snapshot, [web, internal]);
  assert.deepEqual(grouped, [1]);
});
