const setup = document.querySelector('#setup');
const ready = document.querySelector('#ready');
const feedback = document.querySelector('#feedback');
const result = document.querySelector('#result');
const organizeButton = document.querySelector('#organize');
const keyForm = document.querySelector('#keyForm');

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || '操作失败，请重试。');
  return response.data;
}

function setFeedback(message = '') {
  feedback.textContent = message;
}

function renderResult(lastResult, undoAvailable) {
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
  if (undoAvailable) {
    const undo = document.createElement('button');
    undo.className = 'secondary';
    undo.type = 'button';
    undo.textContent = '撤销本次整理';
    undo.addEventListener('click', undoLastOperation);
    result.append(undo);
  }
}

async function render() {
  const status = await request({ type: 'getStatus' });
  setup.hidden = status.hasApiKey;
  ready.hidden = !status.hasApiKey;
  renderResult(status.lastResult, status.undoAvailable);
}

async function organize() {
  setFeedback();
  organizeButton.disabled = true;
  organizeButton.querySelector('span').textContent = '正在整理…';
  organizeButton.querySelector('b').hidden = true;
  try {
    const operation = await request({ type: 'organize' });
    if (operation.groupCount === 0 && operation.duplicateCount === 0) {
      result.hidden = true;
      setFeedback(operation.message);
    } else {
      await render();
    }
  } catch (error) {
    setFeedback(error.message);
  } finally {
    organizeButton.disabled = false;
    organizeButton.querySelector('span').textContent = '开始整理';
    organizeButton.querySelector('b').hidden = false;
  }
}

async function undoLastOperation() {
  setFeedback();
  try {
    await request({ type: 'undo' });
    await render();
  } catch (error) {
    setFeedback(error.message);
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
render().catch((error) => setFeedback(error.message));
