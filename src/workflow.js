import { buildOrganizePlan, validateModelGroups } from './core.js';
import { OrganizerError } from './errors.js';

export function assertTargetsUnchanged(originalTabs, liveTabs, targetIds, { includeGrouped = false } = {}) {
  const originalById = new Map(originalTabs.map((tab) => [tab.id, tab]));
  const liveById = new Map(liveTabs.map((tab) => [tab.id, tab]));
  for (const tabId of targetIds) {
    const original = originalById.get(tabId);
    const live = liveById.get(tabId);
    if (!original || !live || live.pinned || live.groupId !== (includeGrouped ? original.groupId : -1) || live.active !== original.active ||
      live.windowId !== original.windowId || live.index !== original.index ||
      live.url !== original.url) {
      throw new OrganizerError('TAB_STATE_CHANGED', '整理期间标签页已发生变化，本次未修改标签页。');
    }
  }
}

export async function runOrganizeWorkflow({ initialTabs, getLiveTabs, requestGroups, apply, style = 'hierarchical', includeGrouped = false }) {

  const plan = buildOrganizePlan(initialTabs, { includeGrouped });
  if (plan.aiTabs.length === 0 && plan.duplicateTabIds.length === 0) {
    return { groupCount: 0, groupedTabCount: 0, duplicateCount: 0, snapshot: null, message: includeGrouped ? '当前窗口没有可整理的网页标签。' : '当前窗口没有可整理的未分组网页标签。' };
  }

  let groups = [];
  if (plan.aiTabs.length >= 2) {
    const modelPayload = await requestGroups({ tabs: plan.aiTabs });
    groups = validateModelGroups(modelPayload, new Set(plan.aiTabs.map((tab) => tab.tabId)), { style });
  }
  if (groups.length === 0 && plan.duplicateTabIds.length === 0) {
    return { groupCount: 0, groupedTabCount: 0, duplicateCount: 0, snapshot: null, message: '没有发现可自动归组的标签。' };
  }

  const liveTabs = await getLiveTabs();
  const targetIds = [...plan.aiTabs.map((tab) => tab.tabId), ...plan.duplicateTabIds];
  assertTargetsUnchanged(initialTabs, liveTabs, targetIds, { includeGrouped });

  const applied = await apply({ plan, groups, tabs: liveTabs });
  return {
    ...applied,
    message: '整理完成。',
  };
}
