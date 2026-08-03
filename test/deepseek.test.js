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
  assert.equal(body.model, 'deepseek-v4-flash');
  assert.deepEqual(JSON.parse(body.messages[1].content).tabs, [
    { tabId: 12, title: 'Project notes', domain: 'example.com', path: '/notes' },
  ]);
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
