const ENDPOINT = 'https://api.deepseek.com/chat/completions';

function parseModelContent(content) {
  const normalized = String(content || '').trim().replace(/^```json\s*|^```\s*|\s*```$/g, '');
  try {
    return JSON.parse(normalized);
  } catch {
    throw new Error('DeepSeek 返回的分组结果无效，本次未修改标签页。');
  }
}

export async function requestTabGroups({ apiKey, tabs, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('请先保存 DeepSeek API Key。');

  let response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
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
            content: '你是浏览器标签页整理助手。按主题或工作任务分组，只输出 JSON 对象：{"groups":[{"title":"不超过40字的中文标题","tabIds":[1,2]}]}。每个 tabId 最多出现一次；每组至少两个 tabId；无法归类的标签不要输出；绝不编造 tabId，也不要输出解释。',
          },
          { role: 'user', content: JSON.stringify({ tabs }) },
        ],
      }),
    });
  } catch {
    throw new Error('无法连接 DeepSeek，请检查网络后重试。');
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body?.error?.message || message;
    } catch {
      // Keep the HTTP status when the response is not JSON.
    }
    throw new Error(`DeepSeek 请求失败：${message}`);
  }

  const body = await response.json();
  return parseModelContent(body?.choices?.[0]?.message?.content);
}
