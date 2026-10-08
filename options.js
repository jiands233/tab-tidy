import { GROUPING_LANGUAGES, GROUPING_DETAILS, GROUPING_STYLES, normalizeGroupingSettings } from './src/settings.js';

const savedKey = document.querySelector('#savedKey');
const feedback = document.querySelector('#feedback');
const form = document.querySelector('#keyForm');
const groupingLanguage = document.querySelector('#groupingLanguage');
const groupingDetail = document.querySelector('#groupingDetail');
const groupingStyle = document.querySelector('#groupingStyle');
const savePreferences = document.querySelector('#savePreferences');
let runtimeReady = false;

for (const [select, choices] of [[groupingLanguage, GROUPING_LANGUAGES], [groupingDetail, GROUPING_DETAILS], [groupingStyle, GROUPING_STYLES]]) {
  for (const { value, label } of choices) select.add(new Option(label, value));
}

function renderExample() {
  const example = GROUPING_STYLES.find(({ value }) => value === groupingStyle.value)?.example;
  document.querySelector('#namingExample').textContent = `形式示例（中文）：${example || ''}`;
}

groupingStyle.addEventListener('change', renderExample);

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || '操作失败，请重试。');
  return response.data;
}

function show(message = '') {
  feedback.textContent = message;
}

async function render({ updatePreferences = false } = {}) {
  const status = await request({ type: 'getStatus' });
  savedKey.textContent = status.hasApiKey ? `已保存：${status.maskedApiKey}` : '尚未保存 API Key。';
  runtimeReady = status.runtimeVersion === chrome.runtime.getManifest().version;
  savePreferences.disabled = !runtimeReady;
  if (updatePreferences) {
    const settings = normalizeGroupingSettings(status);
    groupingLanguage.value = settings.groupingLanguage;
    groupingDetail.value = settings.groupingDetail;
    groupingStyle.value = settings.groupingStyle;
    renderExample();
  }
  if (!runtimeReady) show('请在扩展管理页重新加载后再保存分组规则。');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  show();
  try {
    await request({ type: 'saveApiKey', apiKey: document.querySelector('#apiKey').value });
    document.querySelector('#apiKey').value = '';
    await render();
  } catch (error) {
    show(error.message);
  }
});

savePreferences.addEventListener('click', async () => {
  if (!runtimeReady) return;
  show();
  savePreferences.disabled = true;
  try {
    await request({
      type: 'savePreferences',
      groupingLanguage: groupingLanguage.value,
      groupingDetail: groupingDetail.value,
      groupingStyle: groupingStyle.value,
    });
    show('分组规则已保存。');
  } catch (error) {
    show(error.message);
  } finally {
    savePreferences.disabled = !runtimeReady;
  }
});

document.querySelector('#clearKey').addEventListener('click', async () => {
  show();
  try {
    await request({ type: 'clearApiKey' });
    await render();
  } catch (error) {
    show(error.message);
  }
});

render({ updatePreferences: true }).catch((error) => show(error.message));
