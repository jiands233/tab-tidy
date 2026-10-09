<p align="center">
  <img src="assets/icon-128.png" width="80" height="80" alt="Tab Tidy 图标">
</p>

<h1 align="center">Tab Tidy</h1>

<p align="center">把散乱的标签页，整理成清晰的主题分组。</p>

<p align="center">
  <strong>简体中文</strong> · <a href="README.en.md">English</a> · <a href="README.de.md">Deutsch</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-102%2B-4285F4?style=flat-square" alt="Chrome 102 或更高版本">
  <img src="https://img.shields.io/badge/Manifest-V3-5F6368?style=flat-square" alt="Manifest V3">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-181717?style=flat-square" alt="MIT 许可证"></a>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> · <a href="#分组偏好">分组偏好</a> · <a href="#隐私与权限">隐私与权限</a> · <a href="https://github.com/jiands233/tab-tidy/issues">问题反馈</a>
</p>

---

**Tab Tidy（标签页整理）** 是一个支持 DeepSeek、OpenAI 兼容接口和 Anthropic 接口的 Chrome 扩展：按主题归组当前窗口的网页，清理重复页面，并支持撤销。分组直接显示在 Chrome 原生标签栏中。

当前源码版本 **v1.4.1**。需要 **Chrome 102+** 和所选服务的 **API Key**；本机服务可不填 Key。扩展直接请求你配置的 API 地址，无自建中转服务器。

## 快速开始

1. [下载 v1.4.1 安装包](https://github.com/jiands233/tab-tidy/releases/download/v1.4.1/tab-tidy-v1.4.1.zip) 并解压，或克隆本仓库。
2. 打开 `chrome://extensions`，开启右上角的 **开发者模式**。
3. 点击 **加载已解压的扩展程序**，选择包含 `manifest.json` 的文件夹。
4. 在 Chrome 工具栏打开 Tab Tidy。使用默认 DeepSeek 时，输入 Key 并点击 **保存并开始使用**；使用其他服务时，点击 **选择其他 AI 服务** 完成配置。
5. 切换到想整理的窗口，点击 **开始整理**。

默认只整理当前窗口中**未固定、未分组的 HTTP/HTTPS 标签页**。固定标签、已有组和浏览器内部页面会保留。

## 配置 AI 服务

打开 **设置 → AI 服务**，选择 API 类型，填写 API 地址、模型名称和 Key，点击 **保存 API 配置**。

| API 类型 | API 地址示例 | 请求格式 |
| --- | --- | --- |
| DeepSeek（默认） | `https://api.deepseek.com` | Chat Completions，保留非思考模式 |
| OpenAI 兼容 | `https://api.openai.com/v1` 或兼容服务的地址 | `POST /chat/completions`，Bearer 认证 |
| Anthropic | `https://api.anthropic.com/v1` 或兼容服务的地址 | `POST /messages`，`x-api-key` 认证 |

模型名称必须填写该服务实际支持的名称，不会自动猜测或查询模型列表。API 地址可以包含 `/v1` 或网关路径前缀，也可粘贴完整请求地址；仅支持上述两个协议，不包括 OpenAI Responses API。

远程地址须使用 HTTPS。本机 `http://localhost:端口/v1` 或 `http://127.0.0.1:端口/v1` 可使用 HTTP，并可留空 Key。保存自定义地址时，Chrome 会按需申请访问该主机的权限；拒绝授权不会保存配置。Key 只在相同协议和地址下可留空保留，切换地址或协议须填写对应 Key。已有 DeepSeek 配置自动兼容。

## 能做什么

| 功能 | 使用体验 |
| --- | --- |
| 按主题归组 | 把同一任务的跨网站页面归到一起，用 Chrome 原生标签组呈现 |
| 清理重复页面 | 规范化 URL 后去重，优先保留当前激活标签 |
| 自定义组名 | 自动跟随内容语言，或指定八种语言之一；支持简短主题、主题层级与 emoji |
| 选择配色 | 十套配色方案，设置页可预览，新用户默认灰蓝双色 |
| 重整已有组 | 按需重新分类、拆分、合并和命名已有组；默认关闭 |
| 安全撤销 | 30 分钟内撤销最近一次整理，跳过之后手动修改的标签 |

分组名称示例：`🤖 AI · 安全研究`、`💻 开发 · Shell 入门`、`📚 学习 · 雅思`。实际结果由标签标题与路径推断，不读取网页正文。

## 分组偏好

点击弹窗右上角的 **设置**，调整偏好后点击 **保存分组规则**。

| 设置 | 可选项 |
| --- | --- |
| 命名语言 | 自动跟随内容、简体中文、繁體中文、English、日本語、한국어、Deutsch、Français、Español |
| 分组细致度 | **平衡**：减少过度拆分；**细致**：优先区分具体任务（默认） |
| 命名形式 | 简短主题、主题 · 子主题、Emoji + 主题（默认） |
| 标签组配色 | 克制双色（默认）、冷色系、石墨、森林、海洋、日落、莓果、暖灰、统一单色、按主题配色 |

自动命名时，使用每组标题的主要语言；语言占比相同时使用浏览器语言。产品名和技术名保留通用写法。每组至少两个标签，无法可靠归类的页面可以保持未分组。Chrome 原生标签组是平铺的，“主题 · 子主题”只体现在名称中。

<details>
<summary>查看十套配色</summary>

| 方案 | 配色 |
| --- | --- |
| 克制双色 | 灰 + 蓝 |
| 冷色系 | 蓝 + 青 + 紫 |
| 石墨 | 灰 + 紫 |
| 森林 | 灰 + 绿 |
| 海洋 | 蓝 + 青 |
| 日落 | 橙 + 黄 |
| 莓果 | 紫 + 粉 |
| 暖灰 | 灰 + 橙 |
| 统一单色 | 所有组使用选定的一种预设色 |
| 按主题配色 | 根据内容主题选择，如 AI 紫、开发蓝、学习绿 |

Chrome 原生标签组支持九种预设色，实际显示随浏览器主题变化，不支持任意十六进制色值。

</details>

**只改外观**：在设置页点击 **保存并更新上次分组的外观**，可在 30 分钟内更新最近一次整理生成的组，无需再次调用 AI；已手动改名、改色或改过成员的组会跳过。

**重新分类**：在弹窗开启 **重整已有标签组**，再点击 **开始整理**。已有组中的非固定网页也会参与去重和分类。开关默认关闭，仅对本次弹窗生效。

## 隐私与权限

- **本地保存**：API Key 和偏好保存在当前 Chrome 配置的 `chrome.storage.local`，不使用 Chrome 同步。
- **直接请求**：API Key 用于向你配置的服务认证；分类数据包括候选标签的数字 ID、标题、域名和路径，以及命名规则与浏览器语言。URL 查询参数和片段不发送给模型。使用第三方网关时，这些数据会发送至该网关。
- **不读取正文**：扩展不读取或上传网页正文，也不使用自建代理服务器。标签标题和路径本身仍可能包含敏感信息，整理前请留意。

<details>
<summary>为什么需要这些权限？</summary>

| 权限 | 用途 |
| --- | --- |
| `tabs` | 获取标签信息，移动、关闭重复标签，并在撤销时重开页面 |
| `tabGroups` | 创建和调整 Chrome 原生标签组 |
| `storage` | 保存 API Key、偏好和操作状态 |
| `https://api.deepseek.com/*` | 默认 DeepSeek 服务 |
| 可选的 API 主机权限 | 保存自定义服务时，仅申请你选择的主机，用于直接调用其 API |

</details>

## 常见问题

**如何撤销？** 整理后在弹窗点击 **撤销本次整理**，有效期为 30 分钟。撤销会恢复分组成员、名称、颜色、折叠状态，并重开本次关闭的重复页面；之后手动修改的标签会跳过。原组被删除时，恢复后的内部 ID 可能改变。

**请求失败会怎样？** AI 超时、结果无效或截断时不会应用整理；执行前也会检查标签状态变化，并阻止重复点击触发并发整理。DeepSeek 默认使用 `deepseek-flash` 非思考模式；其他服务使用所填模型。实际等待时间取决于网络、服务负载与标签数。

**怎样更新？** 更新原扩展文件夹的源码，在 `chrome://extensions` 点击扩展的重新加载按钮，再重新打开弹窗或设置页。同一 Chrome 配置中的 Key 和偏好会保留；卸载后重装不保证保留。源码和 Chrome Web Store 分别发布，GitHub 更新不会自动发布商店更新。

**三语文档代表三语界面吗？** 当前扩展界面为中文。顶部语言入口切换的是文档；设置中的“命名语言”控制的是生成的标签组名称。

## 开发与打包

使用支持 `node --test` 的 Node.js，无需安装 npm 依赖或构建，直接运行：

```bash
npm test
```

实现入口：[分组规则](src/settings.js) · [配色与外观](src/appearance.js) · [整理与撤销](src/organizer.js) · [API 配置](src/ai-config.js) · [模型请求](src/ai.js) · [测试](test/)。自动测试覆盖去重、响应校验、配色、重整、并发保护和撤销；模型响应使用模拟数据，不能据此判断真实 API 延迟或分类质量。

<details>
<summary>创建 Chrome Web Store 上传包</summary>

在仓库根目录运行，确保 ZIP 根目录直接包含 `manifest.json`：

```bash
zip -r tab-tidy.zip manifest.json popup.html popup.css popup.js options.html options.css options.js assets src
```

创建 ZIP 不会自动上传或发布到商店。

</details>

<details>
<summary>v1.4.1 更新说明</summary>

- 重绘弹窗与设置页，补充整理范围、结果统计和实时外观预览。
- 区分已保存与未保存状态，支持 Key 显隐和清除确认。
- 修复保存 API 配置时覆盖未保存分组偏好的问题。

</details>

<details>
<summary>v1.4.0 更新说明</summary>

- 新增 OpenAI Chat Completions 和 Anthropic Messages 接口，支持自定义地址与模型。
- 按主机申请可选权限，支持本机服务，兼容已有 DeepSeek Key。
- 保留响应校验、并发保护和安全撤销。

</details>

<details>
<summary>v1.3.2 更新说明</summary>

- 简化弹窗和设置页，保留操作、配色预览与状态反馈。
- 新增石墨、森林、海洋、日落、莓果、暖灰，总计十套配色。
- 保留已有偏好，以及多语言命名、emoji、可选重整和 30 分钟撤销。

</details>

## 许可证

[MIT](LICENSE) © 2026 jiands233
