const savedKey = document.querySelector('#savedKey');
const feedback = document.querySelector('#feedback');
const form = document.querySelector('#keyForm');

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || '操作失败，请重试。');
  return response.data;
}

function show(message = '') {
  feedback.textContent = message;
}

async function render() {
  const status = await request({ type: 'getStatus' });
  savedKey.textContent = status.hasApiKey ? `已保存：${status.maskedApiKey}` : '尚未保存 API Key。';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  show();
  try {
    await request({ type: 'saveApiKey', apiKey: document.querySelector('#apiKey').value });
    document.querySelector('#apiKey').value = '';
    await render();
  } catch (error) {
    show(error.message);
  }
});

document.querySelector('#clearKey').addEventListener('click', async () => {
  show();
  try {
    await request({ type: 'clearApiKey' });
    await render();
  } catch (error) {
    show(error.message);
  }
});

render().catch((error) => show(error.message));
