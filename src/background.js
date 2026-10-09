import { requestTabGroups } from './ai.js';
import { OrganizerError } from './errors.js';
import { applyOrganizePlan, finalizeUndoSnapshot, undoOrganize } from './organizer.js';
import {
  acquireOrganizeLock,
  isOrganizeLocked,
  isUndoSnapshotActive,
  releaseOrganizeLock,
  stampUndoSnapshot,
} from './state.js';
import { runOrganizeWorkflow } from './workflow.js';
import { normalizeGroupingSettings } from './settings.js';
import { canRestyleSnapshot, restyleOwnedGroups } from './appearance.js';
import { API_CONFIG_KEY, LEGACY_API_KEY, readApiConfig, prepareApiConfig, validateApiConfig, isApiConfigured, isLocalApi, apiPermissionOrigin } from './ai-config.js';

const STORAGE_KEYS = {
  apiConfig: API_CONFIG_KEY,
  legacyApiKey: LEGACY_API_KEY,
  snapshot: 'lastOrganizeSnapshot',
  result: 'lastOrganizeResult',
  groupingLanguage: 'groupingLanguage',
  groupingDetail: 'groupingDetail',
  groupingStyle: 'groupingStyle',
  groupingPalette: 'groupingPalette',
  groupingColor: 'groupingColor',
};

function chromeApi() {
  return {
    groupTabs: (tabIds, groupId) => chrome.tabs.group({ tabIds, ...(Number.isInteger(groupId) ? { groupId } : {}) }),
    getGroup: (groupId) => chrome.tabGroups.get(groupId),
    getGroupTabs: (groupId) => chrome.tabs.query({ groupId }),
    updateGroup: (groupId, details) => chrome.tabGroups.update(groupId, details),
    closeTabs: (tabIds) => chrome.tabs.remove(tabIds),
    ungroupTabs: (tabIds) => chrome.tabs.ungroup(tabIds),
    moveTabs: (tabIds, properties) => chrome.tabs.move(tabIds, properties),
    createTab: (properties) => chrome.tabs.create(properties),
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : '操作失败，请重试。';
}

function errorCode(error) {
  return error instanceof OrganizerError ? error.code : 'UNKNOWN';
}

function maskKey(key) {
  return key.length <= 8 ? '已保存' : `${key.slice(0, 4)}…${key.slice(-4)}`;
}

async function requireApiPermission(config) {
  if (!await chrome.permissions.contains({ origins: [apiPermissionOrigin(config)] })) {
    throw new OrganizerError('API_PERMISSION', '请在设置页保存 API 配置，并允许访问该服务地址。');
  }
}

async function currentWindowTabs() {
  const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
  if (tabs.length === 0) throw new Error('没有可整理的浏览器窗口。');
  return tabs;
}

async function organizeCurrentWindow({ includeGrouped = false } = {}) {
  const lockToken = await acquireOrganizeLock(chrome.storage.session);
  const startedAt = Date.now();
  try {
    const config = validateApiConfig(readApiConfig(await chrome.storage.local.get([API_CONFIG_KEY, LEGACY_API_KEY])));
    await requireApiPermission(config);
    const settings = normalizeGroupingSettings(await chrome.storage.local.get([
      STORAGE_KEYS.groupingLanguage,
      STORAGE_KEYS.groupingDetail,
      STORAGE_KEYS.groupingStyle,
      STORAGE_KEYS.groupingPalette,
      STORAGE_KEYS.groupingColor,
    ]));
    const initialTabs = await currentWindowTabs();
    const windowId = initialTabs[0].windowId;
    const originalGroupIds = new Set(includeGrouped ? initialTabs.filter(tab =>
      !tab.pinned && tab.groupId !== -1 && /^https?:/.test(tab.url || ''),
    ).map(tab => tab.groupId) : []);
    const originalGroups = originalGroupIds.size ? (await chrome.tabGroups.query({ windowId }))
      .filter(group => originalGroupIds.has(group.id))
      .map(group => ({ groupId: group.id, title: group.title || '', color: group.color, collapsed: group.collapsed,
        tabIds: initialTabs.filter(tab => tab.groupId === group.id).map(tab => tab.id),
        originalTabs: initialTabs.filter(tab => tab.groupId === group.id).map(tab => ({ id: tab.id, url: tab.url, windowId: tab.windowId })) })) : [];
    const applied = await runOrganizeWorkflow({
      initialTabs,
      getLiveTabs: async () => {
        const liveTabs = await chrome.tabs.query({ windowId });
        if (originalGroups.length) {
          const liveGroups = await chrome.tabGroups.query({ windowId });
          if (originalGroups.some(original => {
            const live = liveGroups.find(group => group.id === original.groupId);
            const members = liveTabs.filter(tab => tab.groupId === original.groupId).map(tab => tab.id);
            return !live || (live.title || '') !== original.title || live.color !== original.color ||
              live.collapsed !== original.collapsed || members.length !== original.tabIds.length ||
              members.some(id => !original.tabIds.includes(id));
          })) throw new OrganizerError('TAB_STATE_CHANGED', '整理期间已有标签组发生变化，本次未修改标签页。');
        }
        return liveTabs;
      },
      requestGroups: ({ tabs }) => requestTabGroups({
        config,
        tabs,
        language: settings.groupingLanguage,
        detail: settings.groupingDetail,
        style: settings.groupingStyle,
        browserLanguage: chrome.i18n.getUILanguage(),
      }),
      style: settings.groupingStyle,
      includeGrouped,
      apply: ({ plan, groups, tabs }) => applyOrganizePlan(chromeApi(), plan, groups, tabs, settings, { includeGrouped, originalGroups }),
    });
    if (!applied.snapshot) return applied;

    const completedAt = Date.now();
    const result = {
      groupCount: applied.groupCount,
      groupedTabCount: applied.groupedTabCount,
      duplicateCount: applied.duplicateCount,
      completedAt,
      elapsedMs: completedAt - startedAt,
      message: applied.groupCount === 0 && applied.duplicateCount === 0
        ? '没有发现可自动归组的标签。'
        : '整理完成。',
    };
    try {
      const organizedTabs = await chrome.tabs.query({ windowId });
      const snapshot = stampUndoSnapshot(finalizeUndoSnapshot(applied.snapshot, organizedTabs), { now: completedAt });
      await chrome.storage.local.set({
        [STORAGE_KEYS.snapshot]: snapshot,
        [STORAGE_KEYS.result]: result,
      });
    } catch {
      await chrome.storage.local.remove(STORAGE_KEYS.snapshot).catch(() => {});
      result.message = '整理完成，但撤销记录保存失败。';
      result.undoUnavailable = true;
    }
    return result;
  } finally {
    await releaseOrganizeLock(chrome.storage.session, lockToken).catch(() => {});
  }
}

async function restyleLastGroups() {
  const lockToken = await acquireOrganizeLock(chrome.storage.session);
  try {
    const values = await chrome.storage.local.get([STORAGE_KEYS.snapshot, STORAGE_KEYS.groupingLanguage,
      STORAGE_KEYS.groupingDetail, STORAGE_KEYS.groupingStyle, STORAGE_KEYS.groupingPalette, STORAGE_KEYS.groupingColor]);
    const snapshot = values[STORAGE_KEYS.snapshot];
    if (!isUndoSnapshotActive(snapshot) || !canRestyleSnapshot(snapshot)) {
      throw new Error('没有可更新外观的分组，请先整理一次。');
    }
    const outcome = await restyleOwnedGroups(chromeApi(), snapshot, values);
    await chrome.storage.local.set({ [STORAGE_KEYS.snapshot]: outcome.snapshot });
    return { updatedGroups: outcome.updatedGroups, skippedGroups: outcome.skippedGroups };
  } finally {
    await releaseOrganizeLock(chrome.storage.session, lockToken).catch(() => {});
  }
}

async function undoLastOrganize() {
  const lockToken = await acquireOrganizeLock(chrome.storage.session);
  try {
    const { [STORAGE_KEYS.snapshot]: snapshot } = await chrome.storage.local.get(STORAGE_KEYS.snapshot);
    if (!snapshot) throw new Error('没有可撤销的整理操作。');

    if (!isUndoSnapshotActive(snapshot)) {
      await chrome.storage.local.remove(STORAGE_KEYS.snapshot);
      throw new Error('本次撤销已过期。');
    }

    await chrome.storage.local.remove(STORAGE_KEYS.snapshot);
    await chrome.storage.local.set({ [STORAGE_KEYS.result]: null });
    const liveTabs = await chrome.tabs.query({ windowId: snapshot.windowId });
    const outcome = await undoOrganize(chromeApi(), snapshot, liveTabs);
    return { ...outcome, message: '已撤销本次整理。' };
  } finally {
    await releaseOrganizeLock(chrome.storage.session, lockToken).catch(() => {});
  }
}

async function getStatus() {
  const values = await chrome.storage.local.get([
    STORAGE_KEYS.apiConfig,
    STORAGE_KEYS.legacyApiKey,
    STORAGE_KEYS.snapshot,
    STORAGE_KEYS.result,
    STORAGE_KEYS.groupingLanguage,
    STORAGE_KEYS.groupingDetail,
    STORAGE_KEYS.groupingStyle,
    STORAGE_KEYS.groupingPalette,
    STORAGE_KEYS.groupingColor,
  ]);
  let snapshot = values[STORAGE_KEYS.snapshot];
  if (snapshot && !isUndoSnapshotActive(snapshot)) {
    await chrome.storage.local.remove(STORAGE_KEYS.snapshot);
    snapshot = null;
  }
  const config = readApiConfig(values);
  return {
    runtimeVersion: chrome.runtime.getManifest().version,
    apiConfig: { provider: config.provider, baseUrl: config.baseUrl, model: config.model },
    isConfigured: isApiConfigured(config),
    apiKeyOptional: isLocalApi(config.baseUrl),
    hasApiKey: Boolean(config.apiKey),
    maskedApiKey: config.apiKey ? maskKey(config.apiKey) : null,
    undoAvailable: Boolean(snapshot),
    canRestyle: isUndoSnapshotActive(snapshot) && canRestyleSnapshot(snapshot),
    undoExpiresAt: snapshot?.expiresAt || null,
    isOrganizing: await isOrganizeLocked(chrome.storage.session),
    lastResult: values[STORAGE_KEYS.result] || null,
    ...normalizeGroupingSettings(values),
  };
}

async function handleMessage(message) {
  switch (message?.type) {
    case 'getStatus':
      return getStatus();
    case 'saveApiConfig': {
      const previous = readApiConfig(await chrome.storage.local.get([API_CONFIG_KEY, LEGACY_API_KEY]));
      const config = prepareApiConfig(message.config, previous);
      await requireApiPermission(config);
      await chrome.storage.local.set({ [API_CONFIG_KEY]: config });
      await chrome.storage.local.remove(LEGACY_API_KEY);
      return getStatus();
    }
    case 'saveApiKey': {
      const previous = readApiConfig(await chrome.storage.local.get([API_CONFIG_KEY, LEGACY_API_KEY]));
      const apiKey = String(message.apiKey || '').trim();
      if (!apiKey) throw new Error('请输入 API Key。');
      const config = validateApiConfig({ ...previous, apiKey });
      await requireApiPermission(config);
      await chrome.storage.local.set({ [API_CONFIG_KEY]: config });
      await chrome.storage.local.remove(LEGACY_API_KEY);
      return getStatus();
    }
    case 'clearApiKey': {
      const previous = readApiConfig(await chrome.storage.local.get([API_CONFIG_KEY, LEGACY_API_KEY]));
      await chrome.storage.local.set({ [API_CONFIG_KEY]: { ...previous, apiKey: '' } });
      await chrome.storage.local.remove(LEGACY_API_KEY);
      return getStatus();
    }
    case 'savePreferences': {
      const settings = normalizeGroupingSettings({
        groupingLanguage: message.groupingLanguage,
        groupingDetail: message.groupingDetail,
        groupingStyle: message.groupingStyle,
        groupingPalette: message.groupingPalette,
        groupingColor: message.groupingColor,
      });
      await chrome.storage.local.set({
        [STORAGE_KEYS.groupingLanguage]: settings.groupingLanguage,
        [STORAGE_KEYS.groupingDetail]: settings.groupingDetail,
        [STORAGE_KEYS.groupingStyle]: settings.groupingStyle,
        [STORAGE_KEYS.groupingPalette]: settings.groupingPalette,
        [STORAGE_KEYS.groupingColor]: settings.groupingColor,
      });
      return getStatus();
    }
    case 'organize':
      return organizeCurrentWindow({ includeGrouped: message.includeGrouped === true });
    case 'restyleLastGroups':
      return restyleLastGroups();
    case 'undo':
      return undoLastOrganize();
    default:
      throw new Error('未知操作。');
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: errorMessage(error), code: errorCode(error) }));
  return true;
});
