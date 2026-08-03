import { requestTabGroups } from './deepseek.js';
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

const STORAGE_KEYS = {
  apiKey: 'deepseekApiKey',
  snapshot: 'lastOrganizeSnapshot',
  result: 'lastOrganizeResult',
};

function chromeApi() {
  return {
    groupTabs: (tabIds) => chrome.tabs.group({ tabIds }),
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

async function currentWindowTabs() {
  const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
  if (tabs.length === 0) throw new Error('没有可整理的浏览器窗口。');
  return tabs;
}

async function organizeCurrentWindow() {
  const lockToken = await acquireOrganizeLock(chrome.storage.session);
  try {
    const { [STORAGE_KEYS.apiKey]: apiKey } = await chrome.storage.local.get(STORAGE_KEYS.apiKey);
    const initialTabs = await currentWindowTabs();
    const windowId = initialTabs[0].windowId;
    const applied = await runOrganizeWorkflow({
      apiKey,
      initialTabs,
      getLiveTabs: () => chrome.tabs.query({ windowId }),
      requestGroups: requestTabGroups,
      apply: ({ plan, groups, tabs }) => applyOrganizePlan(chromeApi(), plan, groups, tabs),
    });
    if (!applied.snapshot) return applied;

    const completedAt = Date.now();
    const result = {
      groupCount: applied.groupCount,
      groupedTabCount: applied.groupedTabCount,
      duplicateCount: applied.duplicateCount,
      completedAt,
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
    STORAGE_KEYS.apiKey,
    STORAGE_KEYS.snapshot,
    STORAGE_KEYS.result,
  ]);
  let snapshot = values[STORAGE_KEYS.snapshot];
  if (snapshot && !isUndoSnapshotActive(snapshot)) {
    await chrome.storage.local.remove(STORAGE_KEYS.snapshot);
    snapshot = null;
  }
  return {
    hasApiKey: Boolean(values[STORAGE_KEYS.apiKey]),
    maskedApiKey: values[STORAGE_KEYS.apiKey] ? maskKey(values[STORAGE_KEYS.apiKey]) : null,
    undoAvailable: Boolean(snapshot),
    undoExpiresAt: snapshot?.expiresAt || null,
    isOrganizing: await isOrganizeLocked(chrome.storage.session),
    lastResult: values[STORAGE_KEYS.result] || null,
  };
}

async function handleMessage(message) {
  switch (message?.type) {
    case 'getStatus':
      return getStatus();
    case 'saveApiKey': {
      const apiKey = String(message.apiKey || '').trim();
      if (!apiKey) throw new Error('请输入 DeepSeek API Key。');
      await chrome.storage.local.set({ [STORAGE_KEYS.apiKey]: apiKey });
      return getStatus();
    }
    case 'clearApiKey':
      await chrome.storage.local.remove(STORAGE_KEYS.apiKey);
      return getStatus();
    case 'organize':
      return organizeCurrentWindow();
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
