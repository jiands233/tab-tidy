import test from 'node:test';
import assert from 'node:assert/strict';

import { runOrganizeWorkflow } from '../src/workflow.js';

const tabs = [
  { id: 1, index: 0, windowId: 5, url: 'https://example.com/a', title: 'A', active: true, pinned: false, groupId: -1 },
  { id: 2, index: 1, windowId: 5, url: 'https://example.com/b', title: 'B', active: false, pinned: false, groupId: -1 },
];

test('does not call the browser executor when the AI request fails', async () => {
  let applied = false;

  await assert.rejects(
    runOrganizeWorkflow({
      apiKey: 'key',
      initialTabs: tabs,
      getLiveTabs: async () => tabs,
      requestGroups: async () => { throw new Error('network down'); },
      apply: async () => { applied = true; },
    }),
    /network down/,
  );

  assert.equal(applied, false);
});

test('does not call the browser executor when a candidate becomes pinned before apply', async () => {
  let applied = false;
  const changedTabs = [{ ...tabs[0], pinned: true }, tabs[1]];

  await assert.rejects(
    runOrganizeWorkflow({
      apiKey: 'key',
      initialTabs: tabs,
      getLiveTabs: async () => changedTabs,
      requestGroups: async () => ({ groups: [{ title: 'Work', tabIds: [1, 2] }] }),
      apply: async () => { applied = true; },
    }),
    (error) => error.code === 'TAB_STATE_CHANGED',
  );

  assert.equal(applied, false);
});

test('does not apply when a target moves, becomes active, or changes its exact URL', async () => {
  const changedTabsList = [
    [{ ...tabs[0], index: 1 }, { ...tabs[1], index: 0 }],
    [{ ...tabs[0], active: false }, { ...tabs[1], active: true }],
    [{ ...tabs[0], url: 'https://example.com/a#changed' }, tabs[1]],
    [{ ...tabs[0], windowId: 6 }, tabs[1]],
  ];

  for (const changedTabs of changedTabsList) {
    let applied = false;
    await assert.rejects(
      runOrganizeWorkflow({
        apiKey: 'key',
        initialTabs: tabs,
        getLiveTabs: async () => changedTabs,
        requestGroups: async () => ({ groups: [{ title: 'Work', tabIds: [1, 2] }] }),
        apply: async () => { applied = true; },
      }),
      (error) => error.code === 'TAB_STATE_CHANGED',
    );
    assert.equal(applied, false);
  }
});

test('does not apply when model output contains an unknown tab ID', async () => {
  let applied = false;
  await assert.rejects(
    runOrganizeWorkflow({
      apiKey: 'key',
      initialTabs: tabs,
      getLiveTabs: async () => tabs,
      requestGroups: async () => ({ groups: [{ title: 'Work', tabIds: [1, 99] }] }),
      apply: async () => { applied = true; },
    }),
    (error) => error.code === 'AI_INVALID_RESPONSE',
  );
  assert.equal(applied, false);
});
