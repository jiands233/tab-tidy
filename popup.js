import { GROUPING_LANGUAGES, GROUPING_STYLES, GROUPING_PALETTES, normalizeGroupingSettings } from './src/settings.js';

const setup = document.querySelector('#setup');
const ready = document.querySelector('#ready');
const feedback = document.querySelector('#feedback');
const result = document.querySelector('#result');
const organizeButton = document.querySelector('#organize');
const keyForm = document.querySelector('#keyForm');
const includeGrouped = document.querySelector('#includeGrouped');

includeGrouped.addEventListener('change', () => {
  document.querySelector('#regroupHelp').textContent = includeGrouped.checked
    ? '开启后重新分配当前窗口的已有组并改名；固定标签保留，支持撤销。'
    : '关闭时保留已有组，只整理未分组标签。';
});

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) {
    const error = new Error(response?.error || '操作失败，请重试。');
    error.code = response?.code;
    throw error;
  }
  return response.data;
}

function setFeedback(message = '') {
  feedback.textContent = message;
}

function renderResult(lastResult, undoAvailable, isOrganizing) {
  if (!lastResult) {
    result.hidden = true;
    result.replaceChildren();
    return;
  }
  result.hidden = false;
  result.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = lastResult.message || '最近一次整理';
  const stats = document.createElement('div');
  stats.className = 'stats';
  stats.textContent = `新建 ${lastResult.groupCount ?? 0} 组 · 归组 ${lastResult.groupedTabCount ?? 0} 个 · 去重 ${lastResult.duplicateCount ?? 0} 个`;
  result.append(title, stats);
  if (Number.isFinite(lastResult.elapsedMs)) {
    const timing = document.createElement('div');
    timing.className = 'timing';
    timing.textContent = `用时 ${(lastResult.elapsedMs / 1000).toFixed(1)} 秒`;
    result.append(timing);
  }
  if (undoAvailable) {
    const undo = document.createElement('button');
    undo.className = 'secondary';
    undo.type = 'button';
    undo.textContent = '撤销本次整理';
    undo.disabled = isOrganizing;
    undo.addEventListener('click', undoLastOperation);
    result.append(undo);
  }
}

async function render() {
  const status = await request({ type: 'getStatus' });
  const runtimeReady = status.runtimeVersion === chrome.runtime.getManifest().version;
  const settings = normalizeGroupingSettings(status);
  const language = GROUPING_LANGUAGES.find(({ value }) => value === settings.groupingLanguage).label;
  const style = GROUPING_STYLES.find(({ value }) => value === settings.groupingStyle).label;
  const palette = GROUPING_PALETTES.find(({ value }) => value === settings.groupingPalette).label;
  document.querySelector('#ruleSummary').textContent = `${settings.groupingDetail === 'detailed' ? '细致' : '平衡'}分组 / ${style} / ${language} / ${palette}`;
  setup.hidden = status.hasApiKey;
  ready.hidden = !status.hasApiKey;
  organizeButton.disabled = status.isOrganizing || !runtimeReady;
  includeGrouped.disabled = status.isOrganizing || !runtimeReady;
  organizeButton.querySelector('span').textContent = status.isOrganizing ? '正在整理…' : '开始整理';
  organizeButton.querySelector('b').hidden = status.isOrganizing || !runtimeReady;
  renderResult(status.lastResult, status.undoAvailable, status.isOrganizing || !runtimeReady);
  if (!runtimeReady) setFeedback('请在扩展管理页重新加载后再试。');
}

async function organize() {
  setFeedback();
  organizeButton.disabled = true;
  organizeButton.querySelector('span').textContent = '正在整理…';
  organizeButton.querySelector('b').hidden = true;
  try {
    const operation = await request({ type: 'organize', includeGrouped: includeGrouped.checked });
    if (operation.groupCount === 0 && operation.duplicateCount === 0) {
      result.hidden = true;
      setFeedback(operation.message);
    } else {
      await render();
      if (operation.undoUnavailable) setFeedback(operation.message);
    }
  } catch (error) {
    setFeedback(error.code === 'BUSY' ? '正在整理，请稍候。' : error.message);
  } finally {
    await render().catch(() => {
      organizeButton.disabled = false;
      organizeButton.querySelector('span').textContent = '开始整理';
      organizeButton.querySelector('b').hidden = false;
    });
  }
}

async function undoLastOperation() {
  setFeedback();
  const undoButton = result.querySelector('.secondary');
  if (undoButton) undoButton.disabled = true;
  try {
    const operation = await request({ type: 'undo' });
    await render();
    const hasDetailedResult = [operation.restoredTabs, operation.reopenedTabs, operation.skippedTabs]
      .every(Number.isInteger);
    setFeedback(hasDetailedResult
      ? `已恢复 ${operation.restoredTabs} 个 · 重开 ${operation.reopenedTabs} 个 · 跳过 ${operation.skippedTabs} 个`
      : operation.message || '已撤销本次整理。');
  } catch (error) {
    setFeedback(error.code === 'BUSY' ? '正在整理，请稍候。' : error.message);
    if (undoButton) undoButton.disabled = false;
  }
}

keyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setFeedback();
  const submit = keyForm.querySelector('button');
  submit.disabled = true;
  try {
    await request({ type: 'saveApiKey', apiKey: document.querySelector('#apiKey').value });
    document.querySelector('#apiKey').value = '';
    await render();
  } catch (error) {
    setFeedback(error.message);
  } finally {
    submit.disabled = false;
  }
});

organizeButton.addEventListener('click', organize);
document.querySelector('#openSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === 'local' || areaName === 'session') render().catch(() => {});
});
render().catch((error) => setFeedback(error.message));
