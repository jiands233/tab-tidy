import { GROUP_COLORS } from './core.js';

function originalPositionsFor(tabIds, tabs) {
  const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
  return tabIds
    .map((tabId) => tabById.get(tabId))
    .filter(Boolean)
    .map((tab) => ({ id: tab.id, index: tab.index }));
}

function closedTabsFor(tabIds, tabs) {
  const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
  return tabIds
    .map((tabId) => tabById.get(tabId))
    .filter(Boolean)
    .map((tab) => ({ url: tab.url, index: tab.index, active: Boolean(tab.active) }));
}

function duplicateEntriesFor(tabIds, tabs) {
  const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
  return tabIds
    .map((tabId) => tabById.get(tabId))
    .filter(Boolean)
    .map((tab) => ({ id: tab.id, url: tab.url, index: tab.index, active: Boolean(tab.active) }));
}

export async function applyOrganizePlan(api, plan, groups, tabs) {
  const groupedTabIds = [];
  const duplicateEntries = duplicateEntriesFor(plan.duplicateTabIds, tabs);
  const closedEntries = [];
  try {
    for (const [index, group] of groups.entries()) {
      const groupId = await api.groupTabs(group.tabIds);
      groupedTabIds.push(...group.tabIds);
      await api.updateGroup(groupId, {
        title: group.title,
        color: GROUP_COLORS[index % GROUP_COLORS.length],
        collapsed: false,
      });
    }
    for (const duplicate of duplicateEntries) {
      await api.closeTabs([duplicate.id]);
      closedEntries.push(duplicate);
    }
  } catch (error) {
    if (groupedTabIds.length > 0) {
      try {
        await api.ungroupTabs(groupedTabIds);
      } catch {
        // Preserve the original error; the caller can notify the user that Chrome could not fully roll back.
      }
    }
    for (const closed of closedEntries.sort((left, right) => left.index - right.index)) {
      try {
        await api.createTab({
          url: closed.url,
          index: closed.index,
          active: closed.active,
          windowId: tabs.find((tab) => tab.windowId !== undefined)?.windowId,
        });
      } catch {
        // Preserve the original error; a reopened tab is best effort when Chrome itself failed mid-operation.
      }
    }
    throw error;
  }

  const windowId = tabs.find((tab) => tab.windowId !== undefined)?.windowId;
  return {
    groupCount: groups.length,
    groupedTabCount: groupedTabIds.length,
    duplicateCount: plan.duplicateTabIds.length,
    snapshot: {
      windowId,
      groupedTabIds,
      originalPositions: originalPositionsFor(groupedTabIds, tabs),
      closedTabs: closedTabsFor(plan.duplicateTabIds, tabs),
    },
  };
}

export async function undoOrganize(api, snapshot) {
  if (!snapshot) throw new Error('没有可撤销的整理操作。');

  if (snapshot.groupedTabIds.length > 0) {
    await api.ungroupTabs(snapshot.groupedTabIds);
  }
  for (const position of snapshot.originalPositions) {
    await api.moveTabs([position.id], { windowId: snapshot.windowId, index: position.index });
  }
  for (const tab of snapshot.closedTabs) {
    await api.createTab({ ...tab, windowId: snapshot.windowId });
  }
}
