const setup = document.querySelector('#setup');
const ready = document.querySelector('#ready');
const feedback = document.querySelector('#feedback');
const result = document.querySelector('#result');
const organizeButton = document.querySelector('#organize');
const keyForm = document.querySelector('#keyForm');
const includeGrouped = document.querySelector('#includeGrouped');

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
  result.append(title);
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
  document.querySelector('#apiKeyLabel').textContent = (status.apiConfig?.provider || 'deepseek') === 'deepseek' ? 'DeepSeek API Key' : 'API Key';
  const isConfigured = status.isConfigured ?? status.hasApiKey;
  document.querySelector('#configureApi').hidden = isConfigured;
  setup.hidden = isConfigured;
  ready.hidden = !isConfigured;
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

document.querySelector('#configureApi').addEventListener('click', () => chrome.runtime.openOptionsPage());
