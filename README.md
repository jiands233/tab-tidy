# Tab Tidy

<p align="center">
  <img src="assets/icon-128.png" width="96" alt="Tab Tidy icon">
</p>

<p align="center">A local-first Chrome extension that turns a crowded browser window into native tab groups with DeepSeek.</p>

---

## 中文

**Tab Tidy（标签页整理）** 是一个本地优先的 Chrome 扩展。点击插件栏图标后，它会使用 DeepSeek 按主题整理当前窗口中尚未分组的网页标签，并清理重复页面。

### 功能

- 使用 DeepSeek 自动生成 Chrome 原生标签页分组
- 使用快速非思考模式并限制结构化输出长度，减少等待时间
- 支持自动跟随内容、简体中文、繁體中文、English、日本語、한국어、Deutsch、Français、Español 的分组命名
- 支持平衡和细致两种分组策略，优先使用“主题 · 子主题”突出具体任务
- 支持简短主题、主题层级、图标主题三种命名形式，同类主题保持一致颜色
- 弹窗显示当前规则和最近一次整理的实际耗时
- 规范化 URL 后清理重复页面，优先保留当前激活标签
- 不改动固定标签或已经手工分组的标签
- DeepSeek 超时、异常输出或标签状态变化时保持浏览器原状
- 防止重复点击并发执行同一次整理
- 支持在 30 分钟内安全撤销；不会覆盖整理后手动修改的标签
- 采用 Manifest V3，无自建服务器

### 隐私

- DeepSeek API Key 仅保存于当前设备的 `chrome.storage.local`
- 发送给 DeepSeek 的标签信息只有候选标签的标题、域名与不含查询参数的路径；还会发送所选命名规则和浏览器语言
- 不读取、不上传网页正文，也不使用自建中转服务

### 分组命名规则

- **自动跟随内容**：按每个分组中标题的主要语言命名，保留简体或繁体习惯；语言占比相同时使用浏览器语言。
- **指定语言**：所有分组统一使用所选语言，产品名和技术名保留通用写法。
- **细致模式**：先识别大主题，再拆分为具体任务，例如 `AI · 安全研究`、`开发 · Shell`；不会为了凑数创建只有一个标签的分组。
- **平衡模式**：只保留边界清晰、共同目标明确的主题，减少过度拆分。
- **命名形式**：简短主题如 `Shell 入门`；主题层级如 `开发 · Shell 入门`；图标主题如 `💻 开发 · Shell 入门`。Chrome 原生分组是平铺的，层级仅体现在组名中。
- **主题颜色**：AI 为紫色、开发为蓝色、学习为绿色、研究为青色、工作为橙色、影音为红色、社交为粉色、购物为黄色。颜色和图标按内容主题设置，不按网站或排列顺序轮换。

命名要求使用自然的短名词片语，保留 PyTorch、ChatGPT、Shell 等产品或技术名，不使用“其他”“资料”等笼统标签。例如，同一组 AI 安全研究页面可命名为：

| 语言 | 主题层级示例 | 规则 |
| --- | --- | --- |
| 简体中文 | AI · 安全研究 | 简洁的中文名词短语 |
| 繁體中文 | AI · 安全研究 | 使用自然的繁體中文詞彙 |
| English | AI · Safety Research | Concise Title Case noun phrases |
| 日本語 | AI · 安全性研究 | 自然な短い名詞句 |
| 한국어 | AI · 안전성 연구 | 자연스럽고 짧은 명사구 |
| Deutsch | KI · Sicherheitsforschung | Kurze, natürliche Substantivgruppen |
| Français | IA · Recherche en sécurité | Groupes nominaux courts et naturels |
| Español | IA · Investigación de seguridad | Frases nominales breves y naturales |

这些是规则示例，实际主题由标题和路径推断，不读取网页正文。已有手工分组不会被改名；规则作用于下一次整理的未分组标签。

### v1.2.0 速度优化

使用 `deepseek-flash` 并明确设置 `thinking: disabled`，避免为标签分类生成思考过程；仍只进行一次模型请求。输出预算随标签数增长，模型结果被截断时不修改标签页。改用新模型名本身不代表提速，因为旧别名也指向当前模型。实际等待时间还受网络、服务负载和标签数影响，弹窗耗时可用于本机对比。

### 安装

1. 下载或克隆本仓库。
2. 打开 `chrome://extensions`，开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择本仓库根目录。
4. 点击工具栏中的 Tab Tidy 图标，首次输入 DeepSeek API Key。

需要 Chrome 102 或更高版本。

### 打包

Chrome Web Store 上传包的根目录必须直接包含 `manifest.json`。可运行：

```bash
zip -r tab-tidy.zip manifest.json popup.html popup.css popup.js options.html options.css options.js assets src
```

### 开发

```bash
npm test
```

---

## English

**Tab Tidy** is a local-first Chrome extension for turning the ungrouped web tabs in your current window into native Chrome tab groups with DeepSeek.

### Features

- Uses DeepSeek to propose semantic native Chrome tab groups
- Uses fast non-thinking mode with a bounded JSON response to reduce waiting time
- Supports automatic, Simplified/Traditional Chinese, English, Japanese, Korean, German, French, and Spanish group naming
- Supports balanced and detailed grouping, preferring `Theme · Subtopic` names
- Offers concise, hierarchical, and icon naming styles with consistent theme colors
- Shows the active rules and measured organization time in the popup
- Removes duplicate pages after URL normalization, keeping the active tab first
- Never changes pinned tabs or existing manual tab groups
- Keeps the browser unchanged on DeepSeek timeouts, invalid output, or tab-state changes
- Prevents concurrent organization runs caused by repeated clicks
- Offers a safe 30-minute undo without overwriting tabs changed afterwards
- Manifest V3 extension with no application backend

### Privacy

- Your DeepSeek API key stays in this Chrome profile's `chrome.storage.local`
- Only a candidate tab's title, domain, and query-free path are sent as tab data; naming preferences and browser language are also sent
- The extension never reads or uploads page content and uses no proxy server

### Install

1. Download or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose this repository's root folder.
4. Open the Tab Tidy toolbar icon and enter your DeepSeek API key once.

Chrome 102 or later is required.

### Package

The root of a Chrome Web Store ZIP must contain `manifest.json` directly:

```bash
zip -r tab-tidy.zip manifest.json popup.html popup.css popup.js options.html options.css options.js assets src
```

### Development

```bash
npm test
```

---

## Deutsch

**Tab Tidy** ist eine lokale Chrome-Erweiterung. Sie ordnet die noch nicht gruppierten Web-Tabs des aktuellen Fensters mit DeepSeek in native Chrome-Tabgruppen ein.

### Funktionen

- Erstellt mit DeepSeek thematische, native Chrome-Tabgruppen
- Verwendet den Nicht-Denkmodus und zeigt die gemessene Bearbeitungszeit an
- Bietet mehrsprachige Namen, zwei Detailstufen und drei Namensstile mit konsistenten Themenfarben
- Entfernt doppelte Seiten nach URL-Normalisierung und behält bevorzugt den aktiven Tab
- Verändert weder angeheftete Tabs noch bereits manuell erstellte Gruppen
- Lässt den Browser bei DeepSeek-Timeouts, ungültigen Antworten oder geänderten Tabs unverändert
- Verhindert parallele Sortiervorgänge durch wiederholte Klicks
- Bietet 30 Minuten lang ein sicheres Rückgängigmachen, ohne spätere manuelle Änderungen zu überschreiben
- Manifest-V3-Erweiterung ohne eigenen Server

### Datenschutz

- Der DeepSeek API-Key bleibt im `chrome.storage.local` des aktuellen Chrome-Profils
- Als Tabdaten gehen nur Titel, Domain und Pfad ohne Query-Parameter an DeepSeek; Namensregeln und Browsersprache werden ebenfalls übermittelt
- Die Erweiterung liest oder überträgt keine Seiteninhalte und verwendet keinen Proxy

### Installation

1. Dieses Repository herunterladen oder klonen.
2. `chrome://extensions` öffnen und den **Entwicklermodus** aktivieren.
3. **Entpackte Erweiterung laden** wählen und den Stammordner dieses Repositorys auswählen.
4. Das Tab-Tidy-Symbol in der Toolbar öffnen und den DeepSeek API-Key einmal eingeben.

Chrome 102 oder neuer ist erforderlich.

### Paket erstellen

In einem Chrome-Web-Store-ZIP muss `manifest.json` direkt im Stammverzeichnis liegen:

```bash
zip -r tab-tidy.zip manifest.json popup.html popup.css popup.js options.html options.css options.js assets src
```

### Entwicklung

```bash
npm test
```

## License

[MIT](LICENSE) © 2026 jiands233
