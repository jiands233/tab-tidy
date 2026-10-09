export const API_CONFIG_KEY = 'aiConfig';
export const LEGACY_API_KEY = 'deepseekApiKey';

export const API_PROVIDERS = [
  { value: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' },
  { value: 'openai', label: 'OpenAI 兼容', baseUrl: 'https://api.openai.com/v1', model: '' },
  { value: 'anthropic', label: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', model: '' },
];

export function isLocalApi(baseUrl) {
  return ['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname);
}

export function normalizeApiConfig(values = {}) {
  const provider = values.provider ?? 'deepseek';
  const preset = API_PROVIDERS.find(choice => choice.value === provider);
  if (!preset) throw new Error('请选择支持的 API 类型。');

  let url;
  try { url = new URL(String(values.baseUrl ?? preset.baseUrl).trim()); }
  catch { throw new Error('请输入有效的 API 地址。'); }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('API 地址不能包含账号、密码、查询参数或片段。');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalApi(url.href))) {
    throw new Error('API 地址须使用 HTTPS；本机 localhost 或 127.0.0.1 可使用 HTTP。');
  }

  let path = url.pathname.replace(/\/+$/, '');
  const suffix = provider === 'anthropic' ? '/messages' : '/chat/completions';
  if (path.endsWith(suffix)) path = path.slice(0, -suffix.length);
  else if (/\/(messages|chat\/completions)$/.test(path)) {
    throw new Error('API 地址与所选协议不匹配。');
  }
  const model = String(values.model ?? preset.model).trim();
  if (model.length > 200 || /[\r\n]/.test(model)) throw new Error('模型名称无效。');
  const apiKey = String(values.apiKey ?? '').trim();
  if (/[\r\n]/.test(apiKey)) throw new Error('API Key 不能包含换行。');
  return { provider, baseUrl: `${url.origin}${path}`, model, apiKey };
}

export function readApiConfig(values = {}) {
  return normalizeApiConfig(values[API_CONFIG_KEY] ?? { apiKey: values[LEGACY_API_KEY] || '' });
}

export function sameApiTarget(left, right) {
  return left.provider === right.provider && left.baseUrl === right.baseUrl;
}

export function isApiConfigured(config) {
  return Boolean(config.model && (config.apiKey || isLocalApi(config.baseUrl)));
}

export function validateApiConfig(config) {
  const normalized = normalizeApiConfig(config);
  if (!normalized.model) throw new Error('请输入该服务支持的模型名称。');
  if (!normalized.apiKey && !isLocalApi(normalized.baseUrl)) throw new Error('请输入此 API 地址对应的 API Key。');
  return normalized;
}

export function prepareApiConfig(input, previous) {
  const config = normalizeApiConfig(input);
  if (!config.apiKey && sameApiTarget(config, previous)) config.apiKey = previous.apiKey;
  return validateApiConfig(config);
}

export function apiEndpoint(config) {
  return `${config.baseUrl}${config.provider === 'anthropic' ? '/messages' : '/chat/completions'}`;
}

export function apiPermissionOrigin(config) {
  const url = new URL(config.baseUrl);
  // Chrome host permissions match all ports on the selected host.
  return `${url.protocol}//${url.hostname}/*`;
}
