import { GROUP_THEMES, formatGroupTitle } from './core.js';
import { GROUPING_PALETTES, normalizeGroupingSettings } from './settings.js';

export function groupColor(category, index, preferences = {}) {
  const settings = normalizeGroupingSettings(preferences);
  if (settings.groupingPalette === 'single') return settings.groupingColor;
  if (settings.groupingPalette === 'theme') return (GROUP_THEMES[category] || GROUP_THEMES.general).color;
  const palette = GROUPING_PALETTES.find(({ value }) => value === settings.groupingPalette);
  return palette.colors[index % palette.colors.length];
}

export function canRestyleSnapshot(snapshot) {
  return Boolean(snapshot?.createdGroups?.some(group => typeof group.title === 'string' && typeof group.color === 'string'));
}

export async function restyleOwnedGroups(api, snapshot, preferences) {
  const settings = normalizeGroupingSettings(preferences);
  const originals = new Map(snapshot.organizedPositions.map(tab => [tab.id, tab]));
  const createdGroups = snapshot.createdGroups.map(group => ({ ...group }));
  const changed = [];
  let skippedGroups = 0;
  try {
    for (const [index, entry] of createdGroups.entries()) {
      if (typeof entry.title !== 'string' || typeof entry.color !== 'string') { skippedGroups++; continue; }
      let current;
      let tabs;
      try {
        current = await api.getGroup(entry.groupId);
        tabs = await api.getGroupTabs(entry.groupId);
      } catch { skippedGroups++; continue; }
      const safe = current.windowId === snapshot.windowId && current.title === entry.title && current.color === entry.color &&
        tabs.length === entry.tabIds.length && tabs.every(tab => {
          const original = originals.get(tab.id);
          return entry.tabIds.includes(tab.id) && original && !tab.pinned &&
            tab.windowId === original.windowId && tab.groupId === original.groupId && tab.url === original.url;
        });
      if (!safe) { skippedGroups++; continue; }
      const next = {
        title: formatGroupTitle(entry.title, entry.category, settings.groupingStyle),
        color: groupColor(entry.category, index, settings),
      };
      await api.updateGroup(entry.groupId, next);
      changed.push({ groupId: entry.groupId, old: { title: current.title, color: current.color }, next });
      Object.assign(entry, next);
    }
  } catch (error) {
    for (const change of changed.reverse()) {
      try {
        const current = await api.getGroup(change.groupId);
        if (current.title === change.next.title && current.color === change.next.color) {
          await api.updateGroup(change.groupId, change.old);
        }
      } catch { /* Best effort rollback if Chrome cannot update a group. */ }
    }
    throw error;
  }
  return { updatedGroups: changed.length, skippedGroups, snapshot: { ...snapshot, createdGroups } };
}
