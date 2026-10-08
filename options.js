import { GROUPING_LANGUAGES, GROUPING_DETAILS, GROUPING_STYLES, GROUPING_PALETTES, GROUPING_COLORS, normalizeGroupingSettings } from './src/settings.js';
import { groupColor } from './src/appearance.js';
import { formatGroupTitle } from './src/core.js';

const savedKey = document.querySelector('#savedKey');
const feedback = document.querySelector('#feedback');
const form = document.querySelector('#keyForm');
const groupingLanguage = document.querySelector('#groupingLanguage');
const groupingDetail = document.querySelector('#groupingDetail');
const groupingStyle = document.querySelector('#groupingStyle');
const savePreferences = document.querySelector('#savePreferences');
const groupingPalette = document.querySelector('#groupingPalette');
const groupingColor = document.querySelector('#groupingColor');
const restyleGroups = document.querySelector('#restyleGroups');
let runtimeReady = false;
let canRestyle = false;

for (const [select, choices] of [[groupingLanguage, GROUPING_LANGUAGES], [groupingDetail, GROUPING_DETAILS], [groupingStyle, GROUPING_STYLES], [groupingPalette, GROUPING_PALETTES], [groupingColor, GROUPING_COLORS]]) {
  for (const { value, label } of choices) select.add(new Option(label, value));
}

function renderExample() {
  const example = GROUPING_STYLES.find(({ value }) => value === groupingStyle.value)?.example;
  document.querySelector('#namingExample').textContent = `形式示例（中文）：${example || ''}`;
  document.querySelector('#singleColorRow').hidden = groupingPalette.value !== 'single';
  const preview = document.querySelector('#groupPreview');
  preview.replaceChildren();
  for (const [index, entry] of [{ title: 'AI · 安全研究', category: 'ai' }, { title: '开发 · Shell', category: 'development' }, { title: '学习 · 雅思', category: 'learning' }].entries()) {
    const color = groupColor(entry.category, index, selectedPreferences());
    const chip = document.createElement('span');
    chip.className = 'preview-group';
    chip.style.backgroundColor = GROUPING_COLORS.find(choice => choice.value === color).hex;
    chip.style.color = ['yellow', 'orange', 'cyan'].includes(color) ? '#111' : '#fff';
    chip.textContent = formatGroupTitle(groupingStyle.value === 'concise' ? entry.title.split(' · ')[1] : entry.title, entry.category, groupingStyle.value);
    preview.append(chip);
  }
}

for (const control of [groupingStyle, groupingPalette, groupingColor]) control.addEventListener('change', renderExample);

function selectedPreferences() {
  return { groupingLanguage: groupingLanguage.value, groupingDetail: groupingDetail.value,
    groupingStyle: groupingStyle.value, groupingPalette: groupingPalette.value, groupingColor: groupingColor.value };
}

async function saveRules() {
  return request({ type: 'savePreferences', ...selectedPreferences() });
}

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
  canRestyle = status.canRestyle && !status.isOrganizing;
  restyleGroups.disabled = !runtimeReady || !canRestyle;
  if (updatePreferences) {
    const settings = normalizeGroupingSettings(status);
    groupingLanguage.value = settings.groupingLanguage;
    groupingDetail.value = settings.groupingDetail;
    groupingStyle.value = settings.groupingStyle;
    groupingPalette.value = settings.groupingPalette;
    groupingColor.value = settings.groupingColor;
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
    await saveRules();
    show('分组规则已保存。');
  } catch (error) {
    show(error.message);
  } finally {
    savePreferences.disabled = !runtimeReady;
  }
});

restyleGroups.addEventListener('click', async () => {
  if (!runtimeReady || !canRestyle) return;
  restyleGroups.disabled = true;
  savePreferences.disabled = true;
  show();
  try {
    await saveRules();
    const result = await request({ type: 'restyleLastGroups' });
    show(`外观已更新 ${result.updatedGroups} 组 · 跳过 ${result.skippedGroups} 组。`);
  } catch (error) { show(error.message); }
  finally { await render().catch(() => {}); }
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
