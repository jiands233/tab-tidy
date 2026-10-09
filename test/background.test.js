import test from 'node:test';
import assert from 'node:assert/strict';

let listener;
let values;
let permissions;
let tabQueries;
function storage() {
  return {
    get: async keys => Object.fromEntries((typeof keys === 'string' ? [keys] : keys).map(key => [key, values[key]])),
    set: async updates => Object.assign(values, updates),
    remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; },
  };
}
globalThis.chrome = {
  runtime: { getManifest: () => ({ version: '1.4.0' }), onMessage: { addListener: fn => { listener = fn; } } },
  storage: { local: storage(), session: storage() },
  permissions: { contains: async ({ origins }) => origins.every(origin => permissions.has(origin)) },
  tabs: { query: async () => { tabQueries++; return []; } },
};
await import('../src/background.js');
function reset(initial = {}) {
  values = structuredClone(initial);
  permissions = new Set(['https://api.deepseek.com/*']);
  tabQueries = 0;
}
function message(input) {
  return new Promise(resolve => listener(input, {}, resolve));
}

test('status reads legacy credentials without returning the secret', async () => {
  reset({ deepseekApiKey: 'legacy-secret-key' });
  const response = await message({ type: 'getStatus' });
  assert.equal(response.ok, true);
  assert.equal(response.data.isConfigured, true);
  assert.equal(response.data.apiConfig.provider, 'deepseek');
  assert.equal(response.data.apiConfig.apiKey, undefined);
  assert.equal(JSON.stringify(response).includes('legacy-secret-key'), false);
});

test('saving an API config migrates the legacy key and preserves grouping preferences', async () => {
  reset({ deepseekApiKey: 'legacy-secret-key', groupingPalette: 'forest', lastOrganizeResult: { message: 'done' } });
  const response = await message({ type: 'saveApiConfig', config: {
    provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', apiKey: '',
  } });
  assert.equal(response.ok, true);
  assert.equal(values.aiConfig.apiKey, 'legacy-secret-key');
  assert.equal(values.deepseekApiKey, undefined);
  assert.equal(values.groupingPalette, 'forest');
  assert.deepEqual(values.lastOrganizeResult, { message: 'done' });
});

test('changing provider requires its own key and host permission before saving', async () => {
  reset({ deepseekApiKey: 'legacy-secret-key' });
  const config = { provider: 'anthropic', model: 'example-model' };
  assert.equal((await message({ type: 'saveApiConfig', config })).ok, false);
  assert.equal(values.aiConfig, undefined);
  const denied = await message({ type: 'saveApiConfig', config: { ...config, apiKey: 'new-secret-key' } });
  assert.equal(denied.code, 'API_PERMISSION');
  assert.equal(values.deepseekApiKey, 'legacy-secret-key');
  permissions.add('https://api.anthropic.com/*');
  const response = await message({ type: 'saveApiConfig', config: { ...config, apiKey: 'new-secret-key' } });
  assert.equal(response.ok, true);
  assert.equal(values.aiConfig.provider, 'anthropic');
  assert.equal(values.aiConfig.apiKey, 'new-secret-key');
  assert.equal(values.deepseekApiKey, undefined);
  assert.equal(JSON.stringify(response).includes('new-secret-key'), false);
});

test('clearing the key cannot resurrect the legacy DeepSeek credential', async () => {
  reset({ deepseekApiKey: 'legacy-secret-key' });
  const response = await message({ type: 'clearApiKey' });
  assert.equal(response.ok, true);
  assert.equal(response.data.isConfigured, false);
  assert.equal(values.deepseekApiKey, undefined);
  assert.equal(values.aiConfig.apiKey, '');
});

test('revoked host permission blocks organization before tab access', async () => {
  reset({ aiConfig: { provider: 'openai', baseUrl: 'https://gateway.example/v1', model: 'example-model', apiKey: 'secret' } });
  const response = await message({ type: 'organize' });
  assert.equal(response.code, 'API_PERMISSION');
  assert.equal(tabQueries, 0);
  assert.equal(values.activeOrganizeOperation, undefined);
});

test('local models without a key are configured and keep their selected provider in the popup', async () => {
  reset();
  permissions.add('http://127.0.0.1/*');
  const response = await message({ type: 'saveApiConfig', config: {
    provider: 'openai', baseUrl: 'http://127.0.0.1:1234/v1', model: 'local-model', apiKey: '',
  } });
  assert.equal(response.ok, true);
  assert.equal(response.data.isConfigured, true);
  assert.equal(response.data.hasApiKey, false);
  assert.equal(response.data.apiKeyOptional, true);
});
