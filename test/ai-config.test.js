import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiConfig, readApiConfig, prepareApiConfig, validateApiConfig,
  apiEndpoint, apiPermissionOrigin, isApiConfigured } from '../src/ai-config.js';

test('loads legacy DeepSeek credentials without using them for another provider', () => {
  const old = readApiConfig({ deepseekApiKey: 'legacy-key' });
  assert.equal(old.apiKey, 'legacy-key');
  assert.equal(old.provider, 'deepseek');
  assert.equal(old.model, 'deepseek-flash');
  assert.throws(() => prepareApiConfig({ provider: 'openai', model: 'example-model' }, old), /API Key/);
  const active = readApiConfig({ deepseekApiKey: 'legacy-key', aiConfig: {
    provider: 'openai', model: 'example-model', apiKey: 'new-key',
  } });
  assert.equal(active.apiKey, 'new-key');
});

test('keeps a key only for the exact saved protocol and base URL', () => {
  const previous = normalizeApiConfig({ apiKey: 'saved-key' });
  assert.equal(prepareApiConfig({ ...previous, apiKey: '', model: 'another-model' }, previous).apiKey, 'saved-key');
  for (const changed of [
    { ...previous, baseUrl: 'https://gateway.example/v1' },
    { ...previous, baseUrl: 'https://api.deepseek.com/v1' },
    { ...previous, provider: 'openai' },
  ]) {
    assert.throws(() => prepareApiConfig({ ...changed, apiKey: '' }, previous), /API Key/);
  }
});

test('normalizes trailing slashes and full endpoint URLs without duplicating endpoints', () => {
  for (const [provider, input, expected] of [
    ['openai', 'https://gateway.example/prefix/v1///', 'https://gateway.example/prefix/v1/chat/completions'],
    ['openai', 'https://api.openai.com/v1/chat/completions/', 'https://api.openai.com/v1/chat/completions'],
    ['anthropic', 'https://api.anthropic.com/v1/messages', 'https://api.anthropic.com/v1/messages'],
    ['deepseek', 'https://api.deepseek.com/', 'https://api.deepseek.com/chat/completions'],
  ]) {
    const config = normalizeApiConfig({ provider, baseUrl: input });
    assert.equal(apiEndpoint(config), expected);
  }
  assert.throws(() => normalizeApiConfig({ provider: 'openai', baseUrl: 'https://api.example/v1/messages' }), /不匹配/);
});

test('rejects insecure remote URLs, embedded credentials, query strings and unsupported protocols', () => {
  for (const baseUrl of [
    'http://api.example/v1', 'https://user:password@api.example/v1',
    'https://api.example/v1?key=secret', 'https://api.example/v1#secret',
    'file:///tmp/api', 'not a URL', 'https://localhost.evil.example/v1?key=secret',
  ]) assert.throws(() => normalizeApiConfig({ baseUrl }));
  assert.throws(() => normalizeApiConfig({ provider: 'unsupported' }));
  assert.throws(() => normalizeApiConfig({ apiKey: 'key\ninjected-header' }));
});

test('allows loopback services without credentials but requires a model and remote key', () => {
  for (const baseUrl of ['http://localhost:11434/v1', 'http://127.0.0.1:1234/v1']) {
    const config = validateApiConfig({ provider: 'openai', baseUrl, model: 'local-model' });
    assert.equal(isApiConfigured(config), true);
    assert.equal(config.apiKey, '');
    assert.match(apiPermissionOrigin(config), /^http:\/\/(localhost|127\.0\.0\.1)\/\*$/);
  }
  assert.throws(() => validateApiConfig({ provider: 'openai', apiKey: 'key' }), /模型/);
  assert.throws(() => validateApiConfig({ provider: 'openai', model: 'example-model' }), /API Key/);
  assert.equal(isApiConfigured(normalizeApiConfig()), false);
  assert.equal(apiPermissionOrigin(normalizeApiConfig({ baseUrl: 'https://gateway.example:8443/prefix/v1' })), 'https://gateway.example/*');
});
