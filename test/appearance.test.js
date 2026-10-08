import test from 'node:test';
import assert from 'node:assert/strict';
import { groupColor, restyleOwnedGroups } from '../src/appearance.js';
import { formatGroupTitle } from '../src/core.js';

test('limits the default palette to two colors and supports one chosen native color', () => {
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => groupColor('ai', i)), ['grey', 'blue', 'grey', 'blue', 'grey', 'blue']);
  for (const category of ['ai', 'development', 'media']) {
    assert.equal(groupColor(category, 7, { groupingPalette: 'single', groupingColor: 'green' }), 'green');
  }
  assert.equal(groupColor('ai', 0, { groupingPalette: 'theme' }), 'purple');
});

test('keeps exactly one emoji prefix when applying appearance repeatedly', () => {
  const title = formatGroupTitle('🤖 🤖 AI · Safety', 'ai', 'icon');
  assert.equal(title, '🤖 AI · Safety');
  assert.equal(formatGroupTitle(title, 'ai', 'icon'), title);
  assert.equal(formatGroupTitle(title, 'ai', 'hierarchical'), 'AI · Safety');
});

function fixture() {
  const tabs = [1, 2].map(id => ({ id, windowId: 9, groupId: 100, url: `https://example.com/${id}`, pinned: false }));
  const entry = { groupId: 100, tabIds: [1, 2], title: 'AI · Safety', color: 'purple', category: 'ai' };
  const snapshot = { windowId: 9, organizedPositions: tabs, createdGroups: [entry] };
  const live = { id: 100, windowId: 9, title: entry.title, color: entry.color };
  const calls = [];
  const api = { getGroup: async () => live, getGroupTabs: async () => tabs,
    updateGroup: async (id, details) => { calls.push([id, details]); Object.assign(live, details); } };
  return { tabs, live, calls, api, snapshot };
}

test('updates only appearance and records new ownership metadata for future updates', async () => {
  const { api, snapshot, calls } = fixture();
  const result = await restyleOwnedGroups(api, snapshot, { groupingPalette: 'single', groupingColor: 'blue', groupingStyle: 'icon' });
  assert.deepEqual(calls, [[100, { title: '🤖 AI · Safety', color: 'blue' }]]);
  assert.equal(result.updatedGroups, 1);
  assert.equal(result.snapshot.createdGroups[0].title, '🤖 AI · Safety');
  assert.equal(snapshot.createdGroups[0].title, 'AI · Safety');
});

test('does not overwrite a renamed group or changed group membership', async () => {
  for (const change of ['name', 'membership']) {
    const { api, snapshot, live, tabs, calls } = fixture();
    if (change === 'name') live.title = 'My manual title';
    else tabs.push({ ...tabs[0], id: 3 });
    const result = await restyleOwnedGroups(api, snapshot, {});
    assert.equal(result.updatedGroups, 0);
    assert.equal(result.skippedGroups, 1);
    assert.deepEqual(calls, []);
  }
});
