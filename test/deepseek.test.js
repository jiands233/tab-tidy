import test from 'node:test';
import assert from 'node:assert/strict';

import { requestTabGroups } from '../src/deepseek.js';

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
