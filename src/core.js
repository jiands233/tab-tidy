import { OrganizerError } from './errors.js';

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

function isEligible(tab, includeGrouped = false) {
  return tab &&
    Number.isInteger(tab.id) &&
    !tab.pinned &&
    (includeGrouped || tab.groupId === -1 || tab.groupId === undefined) &&
    Boolean(parseHttpUrl(tab.url));
}

function preferredTab(left, right) {
  if (left.active !== right.active) return left.active ? left : right;
  return left.index <= right.index ? left : right;
}

export function buildOrganizePlan(tabs, { includeGrouped = false } = {}) {
  const eligibleTabs = tabs.filter(tab => isEligible(tab, includeGrouped));
  const untouchedTabIds = tabs
    .filter((tab) => !isEligible(tab, includeGrouped) && Number.isInteger(tab?.id))
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

export function validateModelGroups(payload, knownTabIds, { style = 'hierarchical' } = {}) {
  const invalid = () => {
    throw new OrganizerError('AI_INVALID_RESPONSE', 'DeepSeek 返回的分组结果无效，本次未修改标签页。');
  };

  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.groups)) {
    return invalid();
  }

  const claimedTabIds = new Set();
  const validGroups = [];
  for (const candidate of payload.groups) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
      typeof candidate.title !== 'string' || !Array.isArray(candidate.tabIds)) {
      return invalid();
    }

    const title = candidate.title.replace(/\s+/g, ' ').trim();
    if (!title) return invalid();
    if (candidate.category !== undefined &&
      (typeof candidate.category !== 'string' || !Object.hasOwn(GROUP_THEMES, candidate.category))) return invalid();
    if (!formatGroupTitle(title, candidate.category, 'concise')) return invalid();

    for (const tabId of candidate.tabIds) {
      if (!Number.isInteger(tabId) || !knownTabIds.has(tabId) || claimedTabIds.has(tabId)) {
        return invalid();
      }
      claimedTabIds.add(tabId);
    }

    const tabIds = [...candidate.tabIds];
    if (tabIds.length < 2) continue;

    const group = { title: formatGroupTitle(title, candidate.category, style), tabIds };
    if (candidate.category !== undefined) group.category = candidate.category;
    validGroups.push(group);
  }
  return validGroups;
}

export function formatGroupTitle(title, category, style) {
  const parts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(String(title).trim())];
  // Replace existing emoji prefixes rather than stacking them on each update.
  while (parts.length && (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(parts[0].segment) || /^\s+$/.test(parts[0].segment))) parts.shift();
  const baseTitle = parts.map(({ segment }) => segment).join('').trim();
  const icon = style === 'icon' ? `${(GROUP_THEMES[category] || GROUP_THEMES.general).icon} ` : '';
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(`${icon}${baseTitle}`)]
    .slice(0, GROUP_TITLE_MAX_LENGTH).map(({ segment }) => segment).join('').trim();
}

export const GROUP_TITLE_MAX_LENGTH = 40;
export const GROUP_COLORS = ['blue', 'green', 'purple', 'cyan', 'orange', 'pink'];
export const GROUP_THEMES = {
  ai: { color: 'purple', icon: '🤖' },
  development: { color: 'blue', icon: '💻' },
  learning: { color: 'green', icon: '📚' },
  research: { color: 'cyan', icon: '🔬' },
  work: { color: 'orange', icon: '💼' },
  media: { color: 'red', icon: '🎬' },
  social: { color: 'pink', icon: '💬' },
  shopping: { color: 'yellow', icon: '🛍️' },
  general: { color: 'grey', icon: '📁' },
};
