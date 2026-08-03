import { GROUP_COLORS, normalizeUrl } from './core.js';

function originalPositionsFor(tabIds, tabs) {
  const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
  return tabIds
    .map((tabId) => tabById.get(tabId))
    .filter(Boolean)
    .map((tab) => ({ id: tab.id, index: tab.index, url: tab.url }));
}

function closedTabsFor(tabIds, tabs) {
  const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
  const countsByUrl = new Map();
  for (const tab of tabs) {
    const normalized = normalizeUrl(tab.url);
    if (normalized) countsByUrl.set(normalized, (countsByUrl.get(normalized) || 0) + 1);
  }
  return tabIds
    .map((tabId) => tabById.get(tabId))
    .filter(Boolean)
    .map((tab) => ({
      url: tab.url,
      index: tab.index,
      active: Boolean(tab.active),
      desiredCount: countsByUrl.get(normalizeUrl(tab.url)) || 1,
    }));
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
  const createdGroups = [];
  const duplicateEntries = duplicateEntriesFor(plan.duplicateTabIds, tabs);
  const closedEntries = [];
  try {
    for (const [index, group] of groups.entries()) {
      const groupId = await api.groupTabs(group.tabIds);
      groupedTabIds.push(...group.tabIds);
      createdGroups.push({ groupId, tabIds: [...group.tabIds] });
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
      createdGroups,
      originalPositions: originalPositionsFor(groupedTabIds, tabs),
      closedTabs: closedTabsFor(plan.duplicateTabIds, tabs),
    },
  };
}

export function finalizeUndoSnapshot(snapshot, organizedTabs) {
  const tabById = new Map(organizedTabs.map((tab) => [tab.id, tab]));
  const expectedGroupById = new Map(
    snapshot.createdGroups.flatMap(({ groupId, tabIds }) => tabIds.map((tabId) => [tabId, groupId])),
  );
  const organizedPositions = snapshot.groupedTabIds.map((tabId) => {
    const tab = tabById.get(tabId);
    const expectedGroupId = expectedGroupById.get(tabId);
    if (!tab || tab.groupId !== expectedGroupId) {
      throw new Error('无法保存安全撤销状态。');
    }
    return {
      id: tab.id,
      index: tab.index,
      windowId: tab.windowId,
      groupId: tab.groupId,
      url: tab.url,
    };
  });
  return { ...snapshot, organizedPositions };
}

function safeGroupedTabs(snapshot, liveTabs) {
  const liveById = new Map(liveTabs.map((tab) => [tab.id, tab]));
  const originalById = new Map(snapshot.originalPositions.map((position) => [position.id, position]));
  const organizedById = new Map(snapshot.organizedPositions.map((position) => [position.id, position]));

  const safeIds = [];
  let skippedTabs = 0;
  for (const tabId of snapshot.groupedTabIds) {
    const live = liveById.get(tabId);
    const original = originalById.get(tabId);
    const organized = organizedById.get(tabId);
    if (!live || !original || !organized || live.windowId !== organized.windowId || live.index !== organized.index ||
      live.pinned || live.groupId !== organized.groupId || live.url !== organized.url) {
      skippedTabs += 1;
      continue;
    }
    safeIds.push(tabId);
  }
  return { safeIds, skippedTabs };
}

export async function undoOrganize(api, snapshot, liveTabs) {
  if (!snapshot) throw new Error('没有可撤销的整理操作。');

  const { safeIds, skippedTabs: changedGroupedTabs } = safeGroupedTabs(snapshot, liveTabs);
  const safeIdSet = new Set(safeIds);
  if (safeIds.length > 0) {
    await api.ungroupTabs(safeIds);
  }
  for (const position of snapshot.originalPositions.filter(({ id }) => safeIdSet.has(id))) {
    await api.moveTabs([position.id], { windowId: snapshot.windowId, index: position.index });
  }

  const openUrlCounts = new Map();
  for (const tab of liveTabs) {
    const normalized = normalizeUrl(tab.url);
    if (normalized) openUrlCounts.set(normalized, (openUrlCounts.get(normalized) || 0) + 1);
  }
  let reopenedTabs = 0;
  let duplicateSkips = 0;
  for (const tab of snapshot.closedTabs) {
    const normalized = normalizeUrl(tab.url);
    const openCount = openUrlCounts.get(normalized) || 0;
    const desiredCount = Number.isInteger(tab.desiredCount) ? tab.desiredCount : 1;
    if (!normalized || openCount >= desiredCount) {
      duplicateSkips += 1;
      continue;
    }
    await api.createTab({
      url: tab.url,
      index: tab.index,
      active: tab.active,
      windowId: snapshot.windowId,
    });
    openUrlCounts.set(normalized, openCount + 1);
    reopenedTabs += 1;
  }

  return {
    restoredTabs: safeIds.length,
    reopenedTabs,
    skippedTabs: changedGroupedTabs + duplicateSkips,
  };
}
