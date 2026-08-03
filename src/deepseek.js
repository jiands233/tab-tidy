import { OrganizerError, toOrganizerError } from './errors.js';

const ENDPOINT = 'https://api.deepseek.com/chat/completions';
export const DEEPSEEK_TIMEOUT_MS = 30_000;

function parseModelContent(content) {
  const normalized = String(content || '').trim().replace(/^```json\s*|^```\s*|\s*```$/g, '');
  try {
    return JSON.parse(normalized);
  } catch {
    throw new OrganizerError('AI_INVALID_RESPONSE', 'DeepSeek 返回的分组结果无效，本次未修改标签页。');
  }
}

export async function requestTabGroups({
  apiKey,
  tabs,
  fetchImpl = fetch,
  timeoutMs = DEEPSEEK_TIMEOUT_MS,
  abortController = new AbortController(),
}) {
  if (!apiKey) throw new Error('请先保存 DeepSeek API Key。');

  let timeoutId;
  try {
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        reject(new OrganizerError('AI_TIMEOUT', 'DeepSeek 响应超时，本次未修改标签页。'));
      }, timeoutMs);
    });
    const request = (async () => {
      const response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: '你是浏览器标签页整理助手。按主题或工作任务分组，只输出 JSON 对象：{"groups":[{"title":"不超过12字的简短中文主题词","tabIds":[1,2]}]}。标题只用核心名词，不写句子、说明或标点。每个 tabId 最多出现一次；每组至少两个 tabId；无法归类的标签不要输出；绝不编造 tabId，也不要输出解释。',
            },
            { role: 'user', content: JSON.stringify({ tabs }) },
          ],
        }),
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const body = await response.json();
          message = body?.error?.message || message;
        } catch {
          // Keep the HTTP status when the response is not JSON.
        }
        if (response.status === 401 || response.status === 403) {
          throw new OrganizerError('AI_AUTH', 'DeepSeek API Key 无效，请前往设置检查。');
        }
        if (response.status === 429) {
          throw new OrganizerError('AI_RATE_LIMIT', 'DeepSeek 请求过于频繁，请稍后重试。');
        }
        throw new OrganizerError('DEEPSEEK_REQUEST_FAILED', `DeepSeek 请求失败：${message}`);
      }

      let body;
      try {
        body = await response.json();
      } catch (error) {
        throw toOrganizerError(error, 'AI_INVALID_RESPONSE', 'DeepSeek 返回的分组结果无效，本次未修改标签页。');
      }
      return parseModelContent(body?.choices?.[0]?.message?.content);
    })();

    return await Promise.race([request, timeout]);
  } catch (error) {
    if (error instanceof OrganizerError) throw error;
    if (abortController.signal.aborted) {
      throw new OrganizerError('AI_TIMEOUT', 'DeepSeek 响应超时，本次未修改标签页。');
    }
    throw toOrganizerError(error, 'DEEPSEEK_REQUEST_FAILED', '无法连接 DeepSeek，请检查网络后重试。');
  } finally {
    clearTimeout(timeoutId);
  }
}
