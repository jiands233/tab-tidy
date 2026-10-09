import { GROUPING_LANGUAGES, GROUPING_DETAILS, GROUPING_STYLES, GROUPING_PALETTES, GROUPING_COLORS, normalizeGroupingSettings } from './src/settings.js';
import { groupColor } from './src/appearance.js';
import { formatGroupTitle } from './src/core.js';
import { API_PROVIDERS, normalizeApiConfig, sameApiTarget, isLocalApi, apiPermissionOrigin } from './src/ai-config.js';

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
const apiProvider = document.querySelector('#apiProvider');
const apiBaseUrl = document.querySelector('#apiBaseUrl');
const apiModel = document.querySelector('#apiModel');
const apiKeyInput = document.querySelector('#apiKey');
const saveApi = document.querySelector('#saveApi');
let savedApiStatus = null;
let runtimeReady = false;
let canRestyle = false;

for (const [select, choices] of [[apiProvider, API_PROVIDERS], [groupingLanguage, GROUPING_LANGUAGES], [groupingDetail, GROUPING_DETAILS], [groupingStyle, GROUPING_STYLES], [groupingPalette, GROUPING_PALETTES], [groupingColor, GROUPING_COLORS]]) {
  for (const { value, label } of choices) select.add(new Option(label, value));
}

function selectedApiConfig() {
  return { provider: apiProvider.value, baseUrl: apiBaseUrl.value, model: apiModel.value, apiKey: apiKeyInput.value };
}

function updateApiKeyHint() {
  let config;
  try { config = normalizeApiConfig(selectedApiConfig()); } catch { /* Keep invalid drafts editable. */ }
  const canReuseKey = config && savedApiStatus?.hasApiKey && sameApiTarget(config, savedApiStatus.apiConfig);
  const optional = config && isLocalApi(config.baseUrl);
  apiKeyInput.required = !canReuseKey && !optional;
  apiKeyInput.placeholder = canReuseKey ? '留空保留已保存的 Key' : optional ? '本地服务可留空' : '填写此服务的 API Key';
  savedKey.textContent = canReuseKey ? `已保存：${savedApiStatus.maskedApiKey}` : optional ? '本地服务 · Key 可选' : '需要对应服务的 Key';
  document.querySelector('#clearKey').disabled = !runtimeReady || !canReuseKey;
}

apiProvider.addEventListener('change', () => {
  const preset = API_PROVIDERS.find(choice => choice.value === apiProvider.value);
  apiBaseUrl.value = preset.baseUrl;
  apiModel.value = preset.model;
  apiKeyInput.value = '';
  show();
  updateApiKeyHint();
});
apiBaseUrl.addEventListener('input', () => {
  // A key entered for one endpoint must not follow edits to another endpoint.
  apiKeyInput.value = '';
  updateApiKeyHint();
});

function renderExample() {
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
  runtimeReady = status.runtimeVersion === chrome.runtime.getManifest().version;
  savedApiStatus = { ...status, apiConfig: status.apiConfig || normalizeApiConfig() };
  if (updatePreferences) {
    apiProvider.value = savedApiStatus.apiConfig.provider;
    apiBaseUrl.value = savedApiStatus.apiConfig.baseUrl;
    apiModel.value = savedApiStatus.apiConfig.model;
  }
  updateApiKeyHint();
  saveApi.disabled = !runtimeReady;
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
  if (!runtimeReady) show('请在扩展管理页重新加载后再保存设置。');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!runtimeReady) return;
  show();
  saveApi.disabled = true;
  try {
    const config = normalizeApiConfig(selectedApiConfig());
    if (!config.model) throw new Error('请输入该服务支持的模型名称。');
    // Request only the selected host, directly from this user gesture.
    const granted = await chrome.permissions.request({ origins: [apiPermissionOrigin(config)] });
    if (!granted) throw new Error('未获得该 API 地址的访问权限，配置未保存。');
    await request({ type: 'saveApiConfig', config });
    apiKeyInput.value = '';
    await render({ updatePreferences: true });
    show('API 配置已保存。');
  } catch (error) {
    show(error.message);
  } finally {
    saveApi.disabled = !runtimeReady;
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
    apiKeyInput.value = '';
    await render();
  } catch (error) {
    show(error.message);
  }
});

render({ updatePreferences: true }).catch((error) => show(error.message));
