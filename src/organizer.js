import { normalizeUrl } from './core.js';
import { groupColor } from './appearance.js';

function originalPositionsFor(tabIds, tabs) {
  const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
  return tabIds
    .map((tabId) => tabById.get(tabId))
    .filter(Boolean)
    .map((tab) => ({ id: tab.id, index: tab.index, url: tab.url }));
}

function closedTabsFor(tabIds, tabs, includeGrouped = false) {
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
      ...(includeGrouped ? { originalId: tab.id } : {}),
    }));
}

function duplicateEntriesFor(tabIds, tabs) {
  const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
  return tabIds
    .map((tabId) => tabById.get(tabId))
    .filter(Boolean)
    .map((tab) => ({ id: tab.id, url: tab.url, index: tab.index, active: Boolean(tab.active) }));
}

export async function applyOrganizePlan(api, plan, groups, tabs, preferences = {}, { originalGroups = [], includeGrouped = false } = {}) {
  const groupedTabIds = [];
  const survivorIds = (plan.aiTabs || []).map(tab => tab.tabId);
  const targetIds = new Set([...survivorIds, ...plan.duplicateTabIds]);
  const affectedTabIds = includeGrouped ? survivorIds : groupedTabIds;
  const createdGroups = [];
  const duplicateEntries = duplicateEntriesFor(plan.duplicateTabIds, tabs);
  const closedEntries = [];
  try {
    if (includeGrouped) {
      const previouslyGrouped = tabs.filter(tab => targetIds.has(tab.id) && tab.groupId !== -1).map(tab => tab.id);
      if (previouslyGrouped.length) await api.ungroupTabs(previouslyGrouped);
    }
    for (const [index, group] of groups.entries()) {
      const groupId = await api.groupTabs(group.tabIds);
      groupedTabIds.push(...group.tabIds);
      const color = groupColor(group.category, index, preferences);
      createdGroups.push({ groupId, tabIds: [...group.tabIds], title: group.title, color, category: group.category || 'general' });
      await api.updateGroup(groupId, {
        title: group.title,
        color,
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
    const restoredIds = new Map(tabs.map(tab => [tab.id, tab.id]));
    for (const closed of closedEntries.sort((left, right) => left.index - right.index)) {
      try {
        const reopened = await api.createTab({
          url: closed.url,
          index: closed.index,
          active: closed.active,
          windowId: tabs.find((tab) => tab.windowId !== undefined)?.windowId,
        });
        if (reopened?.id !== undefined) restoredIds.set(closed.id, reopened.id);
      } catch {
        // Preserve the original error; a reopened tab is best effort when Chrome itself failed mid-operation.
      }
    }
    if (includeGrouped) {
      for (const tab of tabs) {
        if (!targetIds.has(tab.id) || !restoredIds.has(tab.id) || tab.pinned) continue;
        try { await api.moveTabs([restoredIds.get(tab.id)], { windowId: tab.windowId, index: tab.index }); } catch { /* Best effort. */ }
      }
      await restoreOriginalGroups(api, originalGroups, restoredIds).catch(() => {});
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
      groupedTabIds: [...affectedTabIds],
      createdGroups,
      originalPositions: originalPositionsFor(affectedTabIds, tabs),
      closedTabs: closedTabsFor(plan.duplicateTabIds, tabs, includeGrouped),
      ...(includeGrouped ? { originalGroups } : {}),
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
    const expectedGroupId = expectedGroupById.get(tabId) ?? -1;
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
  const restoredIds = new Map(liveTabs.filter(tab => !snapshot.groupedTabIds.includes(tab.id) || safeIdSet.has(tab.id)).map(tab => [tab.id, tab.id]));
  // Non-web members were never reorganized. Do not pull them back out of a group the user moved them to.
  for (const originalGroup of snapshot.originalGroups || []) {
    for (const id of originalGroup.tabIds) {
      if (snapshot.groupedTabIds.includes(id)) continue;
      const live = liveTabs.find(tab => tab.id === id);
      const original = originalGroup.originalTabs?.find(tab => tab.id === id);
      if (!live || live.groupId !== originalGroup.groupId ||
        (original && (live.url !== original.url || live.windowId !== original.windowId))) restoredIds.delete(id);
    }
  }
  const currentlyGroupedIds = safeIds.filter(id => liveTabs.find(tab => tab.id === id)?.groupId !== -1);
  if (currentlyGroupedIds.length > 0) {
    await api.ungroupTabs(currentlyGroupedIds);
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
    const reopened = await api.createTab({
      url: tab.url,
      index: tab.index,
      active: tab.active,
      windowId: snapshot.windowId,
    });
    if (Number.isInteger(tab.originalId) && reopened?.id !== undefined) restoredIds.set(tab.originalId, reopened.id);
    openUrlCounts.set(normalized, openCount + 1);
    reopenedTabs += 1;
  }

  const skippedOriginalTabs = await restoreOriginalGroups(api, snapshot.originalGroups || [], restoredIds);

  return {
    restoredTabs: safeIds.length,
    reopenedTabs,
    skippedTabs: changedGroupedTabs + duplicateSkips + skippedOriginalTabs,
  };
}

async function restoreOriginalGroups(api, originalGroups, restoredIds) {
  let skippedTabs = 0;
  for (const original of originalGroups) {
    const tabIds = original.tabIds.filter(id => restoredIds.has(id)).map(id => restoredIds.get(id));
    if (!tabIds.length) continue;
    let current;
    try { current = await api.getGroup(original.groupId); } catch { /* Chrome removed an emptied group. */ }
    if (current) {
      const members = await api.getGroupTabs(original.groupId);
      if ((current.title || '') !== original.title || current.color !== original.color ||
        current.collapsed !== original.collapsed || members.some(tab => !tabIds.includes(tab.id))) {
        skippedTabs += tabIds.length;
        continue;
      }
    }
    const groupId = await api.groupTabs(tabIds, current?.id);
    await api.updateGroup(groupId, { title: original.title, color: original.color, collapsed: original.collapsed });
  }
  return skippedTabs;
}
