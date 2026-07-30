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
    /DeepSeek 请求失败：Invalid API key/,
  );
});
