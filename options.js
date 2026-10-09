import { GROUPING_LANGUAGES, GROUPING_DETAILS, GROUPING_STYLES, GROUPING_PALETTES, GROUPING_COLORS, normalizeGroupingSettings } from './src/settings.js';
import { groupColor } from './src/appearance.js';
import { formatGroupTitle } from './src/core.js';
import { API_PROVIDERS, normalizeApiConfig, sameApiTarget, isLocalApi, apiPermissionOrigin } from './src/ai-config.js';

const savedKey = document.querySelector('#savedKey');
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
const clearKey = document.querySelector('#clearKey');
const rulesControls = [groupingLanguage, groupingDetail, groupingStyle, groupingPalette, groupingColor];
let savedApiStatus = null;
let runtimeReady = false;
let canRestyle = false;
let pending = false;
let confirmClear = false;
let renderSequence = 0;
let hydrateApi = false;
let hydratePreferences = false;

for (const [select, choices] of [[apiProvider, API_PROVIDERS], [groupingLanguage, GROUPING_LANGUAGES], [groupingDetail, GROUPING_DETAILS], [groupingStyle, GROUPING_STYLES], [groupingPalette, GROUPING_PALETTES], [groupingColor, GROUPING_COLORS]]) {
  for (const { value, label } of choices) select.add(new Option(label, value));
}
document.querySelector('#version').textContent = `v${chrome.runtime.getManifest().version}`;

function selectTab(id, focus = false) {
  for (const tab of document.querySelectorAll('[role=tab]')) {
    const selected = tab.id === id;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    if (selected && focus) tab.focus();
    if (selected && id === 'rulesTab') concealKey();
  }
}
for (const tab of document.querySelectorAll('[role=tab]')) {
  tab.addEventListener('click', () => selectTab(tab.id));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    selectTab(event.key === 'Home' ? 'apiTab' : event.key === 'End' ? 'rulesTab' : tab.id === 'apiTab' ? 'rulesTab' : 'apiTab', true);
  });
}
document.querySelector('#nextStep').addEventListener('click', () => selectTab('rulesTab', true));

function selectedApiConfig() {
  return { provider: apiProvider.value, baseUrl: apiBaseUrl.value, model: apiModel.value, apiKey: apiKeyInput.value };
}
function selectedPreferences() {
  return { groupingLanguage: groupingLanguage.value, groupingDetail: groupingDetail.value, groupingStyle: groupingStyle.value, groupingPalette: groupingPalette.value, groupingColor: groupingColor.value };
}
function badge(id, text, state) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.dataset.state = state;
}
function show(message = '', tone = 'error', scope = 'api') {
  const element = document.getElementById(scope === 'global' ? 'feedback' : `${scope}Feedback`);
  element.textContent = message;
  element.hidden = !message;
  element.dataset.tone = tone;
}
function concealKey() {
  apiKeyInput.type = 'password';
  const button = document.querySelector('#toggleKey');
  button.textContent = '显示';
  button.setAttribute('aria-label', '显示 API Key');
  button.setAttribute('aria-pressed', 'false');
}
document.querySelector('#toggleKey').addEventListener('click', () => {
  if (apiKeyInput.type === 'text') return concealKey();
  apiKeyInput.type = 'text';
  document.querySelector('#toggleKey').textContent = '隐藏';
  document.querySelector('#toggleKey').setAttribute('aria-label', '隐藏 API Key');
  document.querySelector('#toggleKey').setAttribute('aria-pressed', 'true');
});

function updateState() {
  let config;
  try { config = normalizeApiConfig(selectedApiConfig()); } catch { /* Keep invalid drafts editable. */ }
  const canReuseKey = config && savedApiStatus?.hasApiKey && sameApiTarget(config, savedApiStatus.apiConfig);
  const optional = config && isLocalApi(config.baseUrl);
  apiKeyInput.required = !canReuseKey && !optional;
  apiKeyInput.placeholder = canReuseKey ? '留空保留已保存的 Key' : optional ? '本地服务可留空' : '填写此服务的 API Key';
  savedKey.textContent = canReuseKey ? savedApiStatus.maskedApiKey === '已保存' ? 'Key 已保存' : `已保存：${savedApiStatus.maskedApiKey}` : optional ? '本地服务 · Key 可选' : '尚未保存 Key';
  document.querySelector('#keyHint').textContent = canReuseKey ? '留空会继续使用已保存的 Key。' : optional ? '本机服务不要求 Key 时，可直接留空。' : 'Key 仅保存在当前设备，切换服务需使用对应的 Key。';
  document.querySelector('#endpointHint').textContent = apiProvider.value === 'deepseek' ? '使用默认地址，或填写兼容网关地址。' : '可使用官方地址、兼容网关或本机服务地址。';
  document.querySelector('#modelHint').textContent = apiProvider.value === 'deepseek' ? '可使用 deepseek-flash，或该服务支持的模型。' : '模型名称可在服务商的 API 文档中找到。';
  const apiDirty = savedApiStatus && (!config || !sameApiTarget(config, savedApiStatus.apiConfig) || config.model !== savedApiStatus.apiConfig.model || Boolean(config.apiKey));
  badge('apiState', apiDirty ? '未保存' : savedApiStatus?.isConfigured ? '已保存' : '待配置', apiDirty ? 'dirty' : savedApiStatus?.isConfigured ? 'saved' : 'empty');
  const settings = normalizeGroupingSettings(savedApiStatus || {});
  const rulesDirty = savedApiStatus && Object.entries(selectedPreferences()).some(([key, value]) => settings[key] !== value);
  badge('rulesState', rulesDirty ? '未保存' : '已保存', rulesDirty ? 'dirty' : 'saved');
  for (const control of [apiProvider, apiBaseUrl, apiModel, apiKeyInput, ...rulesControls, document.querySelector('#toggleKey')]) control.disabled = !runtimeReady || pending;
  saveApi.disabled = !runtimeReady || pending;
  savePreferences.disabled = !runtimeReady || pending;
  clearKey.disabled = !runtimeReady || pending || !canReuseKey;
  clearKey.textContent = confirmClear ? '确认清除' : '清除 Key';
  restyleGroups.disabled = !runtimeReady || pending || !canRestyle;
  document.querySelector('#restyleHint').textContent = savedApiStatus?.isOrganizing ? '整理进行中，完成后可更新外观。' : canRestyle ? '只更新名字和颜色，不再调用 AI。手动修改的组会保留。' : '暂无可更新的分组。先整理一次，30 分钟内可在这里更新外观。';
  document.querySelector('#nextStep').hidden = !savedApiStatus?.isConfigured || apiDirty;
}

apiProvider.addEventListener('change', () => {
  const preset = API_PROVIDERS.find(choice => choice.value === apiProvider.value);
  apiBaseUrl.value = preset.baseUrl;
  apiModel.value = preset.model;
  apiKeyInput.value = '';
  concealKey();
  confirmClear = false;
  show();
  updateState();
});
apiBaseUrl.addEventListener('input', () => {
  apiKeyInput.value = '';
  concealKey();
  confirmClear = false;
  show();
  updateState();
});
for (const input of [apiModel, apiKeyInput]) input.addEventListener('input', () => { confirmClear = false; show(); updateState(); });

function renderExample() {
  document.querySelector('#singleColorRow').hidden = groupingPalette.value !== 'single';
  const preview = document.querySelector('#groupPreview');
  preview.replaceChildren();
  const samples = {
    'en': ['AI · Safety research', 'Development · Shell', 'Learning · IELTS'],
    'de': ['KI · Sicherheit', 'Entwicklung · Shell', 'Lernen · IELTS'],
    'ja': ['AI · 安全性研究', '開発 · Shell', '学習 · IELTS'],
    'ko': ['AI · 안전 연구', '개발 · Shell', '학습 · IELTS'],
    'fr': ['IA · Sécurité', 'Développement · Shell', 'Apprentissage · IELTS'],
    'es': ['IA · Seguridad', 'Desarrollo · Shell', 'Aprendizaje · IELTS'],
    'zh-TW': ['AI · 安全研究', '開發 · Shell', '學習 · 雅思'],
  };
  const titles = samples[groupingLanguage.value] || ['AI · 安全研究', '开发 · Shell', '学习 · 雅思'];
  for (const [index, category] of ['ai', 'development', 'learning'].entries()) {
    const color = groupColor(category, index, selectedPreferences());
    const chip = document.createElement('span');
    chip.className = 'preview-group';
    const hex = GROUPING_COLORS.find(choice => choice.value === color).hex;
    // Chrome's native group chips are shown as tinted labels in this preview.
    chip.style.backgroundColor = `${hex}16`;
    chip.style.color = ['yellow', 'orange'].includes(color) ? '#8b4d00' : hex;
    chip.style.boxShadow = `inset 0 0 0 1px ${hex}35`;
    chip.textContent = formatGroupTitle(groupingStyle.value === 'concise' ? titles[index].split(' · ')[1] : titles[index], category, groupingStyle.value);
    preview.append(chip);
  }
}
for (const control of rulesControls) control.addEventListener('change', () => { show('', 'neutral', 'rules'); renderExample(); updateState(); });

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || '操作失败，请重试。');
  return response.data;
}
async function saveRules() { return request({ type: 'savePreferences', ...selectedPreferences() }); }
async function render({ updateApi = false, updatePreferences = false } = {}) {
  hydrateApi ||= updateApi;
  hydratePreferences ||= updatePreferences;
  const sequence = ++renderSequence;
  const status = await request({ type: 'getStatus' });
  if (sequence !== renderSequence) return;
  runtimeReady = status.runtimeVersion === chrome.runtime.getManifest().version;
  savedApiStatus = { ...status, apiConfig: status.apiConfig || normalizeApiConfig() };
  canRestyle = status.canRestyle && !status.isOrganizing;
  if (hydrateApi) {
    apiProvider.value = savedApiStatus.apiConfig.provider;
    apiBaseUrl.value = savedApiStatus.apiConfig.baseUrl;
    apiModel.value = savedApiStatus.apiConfig.model;
  }
  if (hydratePreferences) {
    const settings = normalizeGroupingSettings(status);
    for (const control of rulesControls) control.value = settings[control.id];
    renderExample();
  }
  hydrateApi = false;
  hydratePreferences = false;
  updateState();
  if (!runtimeReady) show('请在扩展管理页重新加载后再保存设置。', 'error', 'global');
}
function begin(button, text) {
  pending = true;
  updateState();
  button.textContent = text;
  form.setAttribute('aria-busy', 'true');
}
async function finish(button, text) {
  pending = false;
  button.textContent = text;
  form.setAttribute('aria-busy', 'false');
  await render().catch(error => show(error.message, 'error', 'global'));
  updateState();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!runtimeReady || pending) return;
  show();
  begin(saveApi, '正在保存…');
  try {
    const config = normalizeApiConfig(selectedApiConfig());
    if (!config.model) throw new Error('请输入该服务支持的模型名称。');
    const granted = await chrome.permissions.request({ origins: [apiPermissionOrigin(config)] });
    if (!granted) throw new Error('未获得该 API 地址的访问权限，配置未保存。');
    await request({ type: 'saveApiConfig', config });
    apiKeyInput.value = '';
    concealKey();
    confirmClear = false;
    await render({ updateApi: true });
    show('API 配置已保存。', 'success');
  } catch (error) { show(error.message); }
  finally { await finish(saveApi, '保存 API 配置'); }
});
savePreferences.addEventListener('click', async () => {
  if (!runtimeReady || pending) return;
  show('', 'neutral', 'rules');
  begin(savePreferences, '正在保存…');
  try { await saveRules(); show('分组规则已保存。', 'success', 'rules'); }
  catch (error) { show(error.message, 'error', 'rules'); }
  finally { await finish(savePreferences, '保存分组规则'); }
});
restyleGroups.addEventListener('click', async () => {
  if (!runtimeReady || !canRestyle || pending) return;
  show('', 'neutral', 'rules');
  begin(restyleGroups, '正在更新…');
  try {
    await saveRules();
    const outcome = await request({ type: 'restyleLastGroups' });
    show(`外观已更新 ${outcome.updatedGroups} 组 · 跳过 ${outcome.skippedGroups} 组。`, 'success', 'rules');
  } catch (error) { show(error.message, 'error', 'rules'); }
  finally { await finish(restyleGroups, '保存并更新上次分组的外观'); }
});
clearKey.addEventListener('click', async () => {
  if (pending || clearKey.disabled) return;
  if (!confirmClear) { confirmClear = true; updateState(); return; }
  show();
  begin(clearKey, '正在清除…');
  try {
    await request({ type: 'clearApiKey' });
    apiKeyInput.value = '';
    concealKey();
    show('Key 已清除。', 'success');
  } catch (error) { show(error.message); }
  finally { confirmClear = false; await finish(clearKey, '清除 Key'); }
});
chrome.storage.onChanged.addListener((_changes, area) => { if (['local', 'session'].includes(area)) render().catch(() => {}); });
window.addEventListener('focus', () => render().catch(() => {}));
render({ updateApi: true, updatePreferences: true }).catch(error => show(error.message, 'error', 'global'));
