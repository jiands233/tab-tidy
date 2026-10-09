import { buildOrganizePlan } from './src/core.js';
import { API_PROVIDERS } from './src/ai-config.js';

const setup = document.querySelector('#setup');
const ready = document.querySelector('#ready');
const feedback = document.querySelector('#feedback');
const result = document.querySelector('#result');
const organizeButton = document.querySelector('#organize');
const keyForm = document.querySelector('#keyForm');
const includeGrouped = document.querySelector('#includeGrouped');
let status = null;
let pending = false;
let renderSequence = 0;
let resultSignature = '';

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) {
    const error = new Error(response?.error || '操作失败，请重试。');
    error.code = response?.code;
    throw error;
  }
  return response.data;
}

function setFeedback(message = '', tone = 'error') {
  feedback.textContent = message;
  feedback.hidden = !message;
  feedback.dataset.tone = tone;
}

function renderResult(lastResult, undoAvailable, isOrganizing, undoExpiresAt) {
  const remaining = Math.max(1, Math.ceil((undoExpiresAt - Date.now()) / 60000));
  const signature = JSON.stringify([lastResult, undoAvailable, isOrganizing, undoAvailable ? remaining : null]);
  if (signature === resultSignature) return;
  resultSignature = signature;
  result.replaceChildren();
  result.hidden = !lastResult;
  if (!lastResult) return;
  const heading = document.createElement('div');
  heading.className = 'result-heading';
  const title = document.createElement('strong');
  title.textContent = lastResult.message || '最近一次整理';
  heading.append(title);
  if (lastResult.completedAt) {
    const time = document.createElement('span');
    time.className = 'result-time';
    time.textContent = new Date(lastResult.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    heading.append(time);
  }
  result.append(heading);
  const stats = document.createElement('div');
  stats.className = 'result-stats';
  for (const [value, label] of [[lastResult.groupCount, '主题分组'], [lastResult.groupedTabCount, '已归组标签'], [lastResult.duplicateCount, '重复页面已清理']]) {
    const item = document.createElement('div');
    const count = document.createElement('b');
    count.textContent = Number.isInteger(value) ? value : '—';
    item.append(count, label);
    stats.append(item);
  }
  result.append(stats);
  if (undoAvailable) {
    const footer = document.createElement('div');
    footer.className = 'result-footer';
    const hint = document.createElement('span');
    hint.className = 'undo-hint';
    hint.textContent = `${remaining} 分钟内可撤销`;
    const undo = document.createElement('button');
    undo.className = 'secondary';
    undo.type = 'button';
    undo.textContent = '撤销本次整理';
    undo.disabled = isOrganizing;
    undo.addEventListener('click', undoLastOperation);
    footer.append(hint, undo);
    result.append(footer);
  }
}

async function render() {
  const sequence = ++renderSequence;
  const [nextStatus, tabs] = await Promise.all([
    request({ type: 'getStatus' }), chrome.tabs.query({ lastFocusedWindow: true }),
  ]);
  if (sequence !== renderSequence) return;
  status = nextStatus;
  const runtimeReady = status.runtimeVersion === chrome.runtime.getManifest().version;
  const busy = pending || status.isOrganizing;
  const provider = API_PROVIDERS.find(entry => entry.value === status.apiConfig?.provider) || API_PROVIDERS[0];
  const isConfigured = status.isConfigured ?? status.hasApiKey;
  const plan = buildOrganizePlan(tabs, { includeGrouped: includeGrouped.checked });
  const count = plan.aiTabs.length + plan.duplicateTabIds.length;
  document.querySelector('.panel').setAttribute('aria-busy', String(busy));
  document.querySelector('#loading').hidden = true;
  document.querySelector('#heading').textContent = isConfigured ? '整理标签页' : '先连接一个 AI 服务';
  document.querySelector('#subtitle').textContent = isConfigured ? '把当前窗口，留给正在做的事。' : provider.value === 'deepseek' ? '默认使用 DeepSeek，也可以选择其他服务。' : `使用 ${provider.label}，完成配置后即可整理。`;
  document.querySelector('#apiKeyLabel').textContent = `${provider.label} API Key`;
  document.querySelector('#setupHint').textContent = `${provider.label} · Key 保存在当前设备。`;
  const quickSetupAvailable = Boolean(status.apiConfig?.model || provider.model);
  keyForm.hidden = !quickSetupAvailable;
  keyForm.querySelector('button').disabled = busy || !runtimeReady;
  document.querySelector('#configureApi').textContent = quickSetupAvailable ? '选择其他 AI 服务 ↗' : '配置 AI 服务 →';
  setup.hidden = isConfigured;
  ready.hidden = !isConfigured;
  organizeButton.disabled = busy || !runtimeReady || count === 0;
  includeGrouped.disabled = busy || !runtimeReady;
  organizeButton.querySelector('span').textContent = status.isOrganizing ? '正在整理…' : count === 0 ? '暂无可整理的标签' : '开始整理';
  organizeButton.querySelector('b').hidden = busy || !runtimeReady || count === 0;
  document.querySelector('#tabCount').textContent = `${count} 个可整理`;
  document.querySelector('#scopeHint').textContent = status.isOrganizing ? '正在分析主题，请稍候。' : count === 0 ? '打开网页，或开启已有组重整。' : includeGrouped.checked ? '包含已有组 · 固定标签仍保留' : '保留固定标签和已有分组';
  document.querySelector('#serviceName').textContent = provider.label;
  document.querySelector('#serviceModel').textContent = status.apiConfig?.model || '';
  renderResult(status.lastResult, status.undoAvailable, busy || !runtimeReady, status.undoExpiresAt);
  if (!runtimeReady) setFeedback('请在扩展管理页重新加载后再试。');
}

async function organize() {
  if (pending || status?.isOrganizing) return;
  pending = true;
  setFeedback();
  organizeButton.disabled = true;
  includeGrouped.disabled = true;
  organizeButton.querySelector('span').textContent = '正在整理…';
  organizeButton.querySelector('b').hidden = true;
  try {
    const operation = await request({ type: 'organize', includeGrouped: includeGrouped.checked });
    if (operation.groupCount === 0 && operation.duplicateCount === 0) setFeedback(operation.message, 'neutral');
    else if (operation.undoUnavailable) setFeedback(operation.message);
  } catch (error) {
    setFeedback(error.code === 'BUSY' ? '正在整理，请稍候。' : error.message);
  } finally {
    pending = false;
    await render().catch(error => setFeedback(error.message));
  }
}

async function undoLastOperation() {
  if (pending || status?.isOrganizing) return;
  pending = true;
  setFeedback();
  const undoButton = result.querySelector('.secondary');
  if (undoButton) undoButton.disabled = true;
  organizeButton.disabled = true;
  includeGrouped.disabled = true;
  try {
    const operation = await request({ type: 'undo' });
    const detailed = [operation.restoredTabs, operation.reopenedTabs, operation.skippedTabs].every(Number.isInteger);
    setFeedback(detailed ? `已恢复 ${operation.restoredTabs} 个 · 重开 ${operation.reopenedTabs} 个 · 跳过 ${operation.skippedTabs} 个` : operation.message || '已撤销本次整理。', 'success');
  } catch (error) {
    setFeedback(error.code === 'BUSY' ? '正在整理，请稍候。' : error.message);
  } finally {
    pending = false;
    await render().catch(error => setFeedback(error.message));
  }
}

keyForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending) return;
  pending = true;
  setFeedback();
  keyForm.querySelector('button').disabled = true;
  try {
    await request({ type: 'saveApiKey', apiKey: document.querySelector('#apiKey').value });
    document.querySelector('#apiKey').value = '';
  } catch (error) { setFeedback(error.message); }
  finally { pending = false; await render().catch(error => setFeedback(error.message)); }
});

organizeButton.addEventListener('click', organize);
includeGrouped.addEventListener('change', () => { setFeedback(); render().catch(error => setFeedback(error.message)); });
for (const id of ['openSettings', 'configureApi', 'configureReady']) document.querySelector(`#${id}`).addEventListener('click', () => chrome.runtime.openOptionsPage());
chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === 'local' || areaName === 'session') render().catch(() => {});
});
for (const event of [chrome.tabs.onCreated, chrome.tabs.onRemoved, chrome.tabs.onUpdated, chrome.tabs.onActivated, chrome.tabs.onAttached, chrome.tabs.onDetached]) {
  event.addListener(() => render().catch(() => {}));
}
setInterval(() => render().catch(() => {}), 30000);
render().catch(error => { document.querySelector('#loading').hidden = true; setFeedback(error.message); });
