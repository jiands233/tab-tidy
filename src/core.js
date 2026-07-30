const TRACKING_PARAMETER = /^(utm_[^=]*|gclid|dclid|fbclid|msclkid|mc_[^=]*)$/i;

function parseHttpUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function normalizeUrl(rawUrl) {
  const url = parseHttpUrl(rawUrl);
  if (!url) return null;

  const parameters = [...url.searchParams.entries()]
    .filter(([name]) => !TRACKING_PARAMETER.test(name))
    .sort(([leftName, leftValue], [rightName, rightValue]) =>
      leftName.localeCompare(rightName) || leftValue.localeCompare(rightValue),
    );
  const search = new URLSearchParams(parameters).toString();
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : '';

  return `${url.origin}${pathname}${search ? `?${search}` : ''}`;
}

function toAiTab(tab) {
  const url = parseHttpUrl(tab.url);
  return {
    tabId: tab.id,
    title: String(tab.title || '').trim().slice(0, 240),
    domain: url.hostname,
    path: url.pathname || '/',
  };
}

function isEligible(tab) {
  return tab &&
    Number.isInteger(tab.id) &&
    !tab.pinned &&
    (tab.groupId === -1 || tab.groupId === undefined) &&
    Boolean(parseHttpUrl(tab.url));
}

function preferredTab(left, right) {
  if (left.active !== right.active) return left.active ? left : right;
  return left.index <= right.index ? left : right;
}

export function buildOrganizePlan(tabs) {
  const eligibleTabs = tabs.filter(isEligible);
  const untouchedTabIds = tabs
    .filter((tab) => !isEligible(tab) && Number.isInteger(tab?.id))
    .map((tab) => tab.id);
  const survivorsByUrl = new Map();

  for (const tab of eligibleTabs) {
    const key = normalizeUrl(tab.url);
    const existing = survivorsByUrl.get(key);
    survivorsByUrl.set(key, existing ? preferredTab(existing, tab) : tab);
  }

  const survivorIds = new Set([...survivorsByUrl.values()].map((tab) => tab.id));
  const duplicateTabIds = eligibleTabs
    .filter((tab) => !survivorIds.has(tab.id))
    .sort((left, right) => left.index - right.index)
    .map((tab) => tab.id);
  const survivors = [...survivorsByUrl.values()].sort((left, right) => left.index - right.index);

  return {
    aiTabs: survivors.map(toAiTab),
    duplicateTabIds,
    untouchedTabIds,
  };
}

export function validateModelGroups(payload, knownTabIds) {
  if (!payload || !Array.isArray(payload.groups)) return [];

  const claimedTabIds = new Set();
  const validGroups = [];
  for (const candidate of payload.groups) {
    if (!candidate || !Array.isArray(candidate.tabIds)) continue;
    const tabIds = candidate.tabIds.filter((tabId) =>
      Number.isInteger(tabId) && knownTabIds.has(tabId) && !claimedTabIds.has(tabId),
    );
    if (tabIds.length < 2) continue;

    tabIds.forEach((tabId) => claimedTabIds.add(tabId));
    const title = String(candidate.title || '').replace(/\s+/g, ' ').trim().slice(0, 12);
    validGroups.push({ title: title || '未命名分组', tabIds });
  }
  return validGroups;
}

export const GROUP_COLORS = ['blue', 'green', 'purple', 'cyan', 'orange', 'pink'];
