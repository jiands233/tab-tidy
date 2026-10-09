import test from 'node:test';
import assert from 'node:assert/strict';

import { requestTabGroups } from '../src/ai.js';
import { runOrganizeWorkflow } from '../src/workflow.js';

test('sends only the approved tab metadata to DeepSeek and parses JSON output', async () => {
  let request;
  const payload = await requestTabGroups({
    apiKey: 'secret-key',
    tabs: [{ tabId: 12, title: 'Project notes', domain: 'example.com', path: '/notes' }],
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"groups":[]}' } }],
      }), { status: 200 });
    },
  });

  assert.deepEqual(payload, { groups: [] });
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer secret-key');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'deepseek-flash');
  assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.equal(body.max_tokens, 552);
  assert.deepEqual(JSON.parse(body.messages[1].content).tabs, [
    { tabId: 12, title: 'Project notes', domain: 'example.com', path: '/notes' },
  ]);
});

test('builds detailed multilingual naming instructions', async () => {
  let request;
  await requestTabGroups({
    apiKey: 'secret-key',
    language: 'ja',
    detail: 'detailed',
    tabs: [
      { tabId: 1, title: 'AI safety research', domain: 'example.com', path: '/safety' },
      { tabId: 2, title: 'AI security notes', domain: 'example.com', path: '/security' },
    ],
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"groups":[{"title":"AI・安全研究","tabIds":[1,2]}]}' } }],
      }), { status: 200 });
    },
  });

  assert.match(request.messages[0].content, /日本語/);
  assert.match(request.messages[0].content, /主题 · 子主题/);
  assert.match(request.messages[0].content, /具体主题、项目或任务拆分/);
});

test('allocates enough JSON output for many detailed groups and refuses incomplete output', async () => {
  let budget;
  await assert.rejects(requestTabGroups({
    apiKey: 'test-key',
    tabs: Array.from({ length: 150 }, (_, i) => ({ tabId: i + 1, title: 'Notes', domain: 'example.com', path: '/notes' })),
    fetchImpl: async (_url, options) => {
      budget = JSON.parse(options.body).max_tokens;
      return new Response(JSON.stringify({
        choices: [{ finish_reason: 'length', message: { content: '{"groups":[]}' } }],
      }));
    },
  }), (error) => error.code === 'AI_INVALID_RESPONSE');
  assert.equal(budget, 6512);
});

test('surfaces a usable DeepSeek API error without exposing the API key', async () => {
  await assert.rejects(
    requestTabGroups({
      apiKey: 'secret-key',
      tabs: [],
      fetchImpl: async () => new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 }),
    }),
    (error) => error.code === 'AI_AUTH' && !error.message.includes('secret-key'),
  );
});

test('aborts a request that exceeds the timeout', async () => {
  let signal;
  await assert.rejects(
    requestTabGroups({
      apiKey: 'secret-key',
      tabs: [],
      timeoutMs: 5,
      fetchImpl: async (_url, options) => {
        signal = options.signal;
        return new Promise(() => {});
      },
    }),
    (error) => error.code === 'AI_TIMEOUT',
  );
  assert.equal(signal.aborted, true);
});

test('also times out while reading a stalled response body', async () => {
  await assert.rejects(
    requestTabGroups({
      apiKey: 'secret-key',
      tabs: [],
      timeoutMs: 5,
      fetchImpl: async () => ({
        ok: true,
        json: async () => new Promise(() => {}),
      }),
    }),
    (error) => error.code === 'AI_TIMEOUT',
  );
});

test('rejects invalid success responses as invalid AI output', async () => {
  for (const responseBody of ['not-json', JSON.stringify({ choices: [] })]) {
    await assert.rejects(
      requestTabGroups({
        apiKey: 'secret-key',
        tabs: [],
        fetchImpl: async () => new Response(responseBody, { status: 200 }),
      }),
      (error) => error.code === 'AI_INVALID_RESPONSE',
    );
  }
});

test('sends OpenAI-compatible requests without DeepSeek-only parameters', async () => {
  for (const baseUrl of ['https://api.openai.com/v1', 'https://gateway.example/v1']) {
    let request;
    await requestTabGroups({
      config: { provider: 'openai', baseUrl, model: 'example-model', apiKey: 'openai-test-key' },
      tabs: [{ tabId: 1, title: 'Notes', domain: 'example.com', path: '/notes' }],
      fetchImpl: async (url, options) => {
        request = { url, ...options, body: JSON.parse(options.body) };
        return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '```json\n{"groups":[]}\n```' } }] }));
      },
    });
    assert.equal(request.url, `${baseUrl}/chat/completions`);
    assert.equal(request.headers.Authorization, 'Bearer openai-test-key');
    assert.equal(request.body.model, 'example-model');
    assert.equal(request.body.thinking, undefined);
    assert.equal(request.body.temperature, undefined);
    assert.equal(request.body.response_format, undefined);
    const budgetKey = baseUrl.includes('api.openai.com') ? 'max_completion_tokens' : 'max_tokens';
    assert.equal(request.body[budgetKey], 552);
    assert.equal(request.redirect, 'error');
    assert.equal(request.credentials, 'omit');
  }
});

test('uses Anthropic authentication, system field, and text-block response format', async () => {
  let request;
  const payload = await requestTabGroups({
    config: { provider: 'anthropic', baseUrl: 'https://gateway.example/v1', model: 'claude-example', apiKey: 'anthropic-test-key' },
    language: 'de',
    tabs: [{ tabId: 1, title: 'Notes', domain: 'example.com', path: '/notes' }],
    fetchImpl: async (url, options) => {
      request = { url, ...options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"groups":' }, { type: 'text', text: '[]}' }] }));
    },
  });
  assert.deepEqual(payload, { groups: [] });
  assert.equal(request.url, 'https://gateway.example/v1/messages');
  assert.equal(request.headers['x-api-key'], 'anthropic-test-key');
  assert.equal(request.headers['anthropic-version'], '2023-06-01');
  assert.equal(request.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(request.headers.Authorization, undefined);
  assert.match(request.body.system, /Deutsch/);
  assert.equal(request.body.messages.length, 1);
  assert.equal(request.body.messages[0].role, 'user');
  assert.equal(request.body.max_tokens, 552);
  assert.equal(request.body.response_format, undefined);
});

test('local OpenAI-compatible endpoints do not require or send a dummy credential', async () => {
  let headers;
  await requestTabGroups({
    config: { provider: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'local-model' },
    tabs: [],
    fetchImpl: async (_url, options) => {
      headers = options.headers;
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"groups":[]}' } }] }));
    },
  });
  assert.equal(headers.Authorization, undefined);
});

test('rejects truncated and tool responses for both protocols before applying browser changes', async () => {
  const initialTabs = [1, 2].map((id, index) => ({ id, index, windowId: 1, url: `https://example.com/${id}`, title: 'Notes', pinned: false, groupId: -1 }));
  for (const [provider, response] of [
    ['anthropic', { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"groups":[]}' }] }],
    ['anthropic', { stop_reason: 'tool_use', content: [{ type: 'tool_use', input: {} }] }],
    ['anthropic', { stop_reason: 'end_turn', content: [] }],
    ['anthropic', { stop_reason: 'end_turn', content: [{ type: 'text', text: 'invalid JSON' }] }],
    ['openai', { choices: [{ finish_reason: 'length', message: { content: '{"groups":[]}' } }] }],
    ['openai', { choices: [{ finish_reason: 'tool_calls', message: { content: '{"groups":[]}' } }] }],
  ]) {
    let applied = false;
    await assert.rejects(runOrganizeWorkflow({
      initialTabs,
      getLiveTabs: async () => initialTabs,
      requestGroups: ({ tabs }) => requestTabGroups({
        config: { provider, model: 'example-model', apiKey: 'test-key' }, tabs,
        fetchImpl: async () => new Response(JSON.stringify(response)),
      }),
      apply: async () => { applied = true; },
    }), error => error.code === 'AI_INVALID_RESPONSE');
    assert.equal(applied, false);
  }
});

test('does not echo credentials or private server error content for any provider', async () => {
  for (const provider of ['deepseek', 'openai', 'anthropic']) {
    for (const status of [400, 401, 403, 429, 500]) {
      await assert.rejects(requestTabGroups({
        config: { provider, model: 'example-model', apiKey: 'secret-key' }, tabs: [],
        fetchImpl: async () => new Response(JSON.stringify({ error: { message: 'secret-key: private tab title' } }), { status }),
      }), error => !error.message.includes('secret-key') && !error.message.includes('private tab title'));
    }
  }
});

test('Anthropic requests time out while reading a stalled body and abort the request', async () => {
  let signal;
  await assert.rejects(requestTabGroups({
    config: { provider: 'anthropic', model: 'example-model', apiKey: 'test-key' }, tabs: [], timeoutMs: 5,
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      return { ok: true, json: () => new Promise(() => {}) };
    },
  }), error => error.code === 'AI_TIMEOUT');
  assert.equal(signal.aborted, true);
});
