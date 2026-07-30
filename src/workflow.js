import { buildOrganizePlan, normalizeUrl, validateModelGroups } from './core.js';

export function assertTargetsUnchanged(originalTabs, liveTabs, targetIds) {
  const originalById = new Map(originalTabs.map((tab) => [tab.id, tab]));
  const liveById = new Map(liveTabs.map((tab) => [tab.id, tab]));
  for (const tabId of targetIds) {
    const original = originalById.get(tabId);
    const live = liveById.get(tabId);
    if (!original || !live || live.pinned || live.groupId !== -1 || normalizeUrl(original.url) !== normalizeUrl(live.url)) {
      throw new Error('整理期间标签页已被关闭、固定、分组或跳转，本次未修改标签页。');
    }
  }
}

export async function runOrganizeWorkflow({ apiKey, initialTabs, getLiveTabs, requestGroups, apply }) {
  if (!apiKey) throw new Error('请先保存 DeepSeek API Key。');

  const plan = buildOrganizePlan(initialTabs);
  if (plan.aiTabs.length === 0 && plan.duplicateTabIds.length === 0) {
    return { groupCount: 0, groupedTabCount: 0, duplicateCount: 0, snapshot: null, message: '当前窗口没有可整理的未分组网页标签。' };
  }

  let groups = [];
  if (plan.aiTabs.length >= 2) {
    const modelPayload = await requestGroups({ apiKey, tabs: plan.aiTabs });
    groups = validateModelGroups(modelPayload, new Set(plan.aiTabs.map((tab) => tab.tabId)));
  }
  if (groups.length === 0 && plan.duplicateTabIds.length === 0) {
    return { groupCount: 0, groupedTabCount: 0, duplicateCount: 0, snapshot: null, message: '没有发现可自动归组的标签。' };
  }

  const liveTabs = await getLiveTabs();
  const targetIds = [...plan.aiTabs.map((tab) => tab.tabId), ...plan.duplicateTabIds];
  assertTargetsUnchanged(initialTabs, liveTabs, targetIds);

  const applied = await apply({ plan, groups, tabs: liveTabs });
  return {
    ...applied,
    message: '整理完成。',
  };
}
