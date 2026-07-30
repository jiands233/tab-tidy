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
- 规范化 URL 后清理重复页面，优先保留当前激活标签
- 不改动固定标签或已经手工分组的标签
- 支持撤销最近一次整理操作
- 采用 Manifest V3，无自建服务器

### 隐私

- DeepSeek API Key 仅保存于当前设备的 `chrome.storage.local`
- 发送给 DeepSeek 的只有候选标签的标题、域名与不含查询参数的路径
- 不读取、不上传网页正文，也不使用自建中转服务

### 安装

1. 下载或克隆本仓库。
2. 打开 `chrome://extensions`，开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择本仓库根目录。
4. 点击工具栏中的 Tab Tidy 图标，首次输入 DeepSeek API Key。

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
- Removes duplicate pages after URL normalization, keeping the active tab first
- Never changes pinned tabs or existing manual tab groups
- Offers a one-time undo for the latest organization run
- Manifest V3 extension with no application backend

### Privacy

- Your DeepSeek API key stays in this Chrome profile's `chrome.storage.local`
- Only a candidate tab's title, domain, and query-free path are sent to DeepSeek
- The extension never reads or uploads page content and uses no proxy server

### Install

1. Download or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose this repository's root folder.
4. Open the Tab Tidy toolbar icon and enter your DeepSeek API key once.

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
- Entfernt doppelte Seiten nach URL-Normalisierung und behält bevorzugt den aktiven Tab
- Verändert weder angeheftete Tabs noch bereits manuell erstellte Gruppen
- Kann den letzten Sortiervorgang einmal rückgängig machen
- Manifest-V3-Erweiterung ohne eigenen Server

### Datenschutz

- Der DeepSeek API-Key bleibt im `chrome.storage.local` des aktuellen Chrome-Profils
- An DeepSeek gehen nur Titel, Domain und Pfad ohne Query-Parameter der Kandidaten-Tabs
- Die Erweiterung liest oder überträgt keine Seiteninhalte und verwendet keinen Proxy

### Installation

1. Dieses Repository herunterladen oder klonen.
2. `chrome://extensions` öffnen und den **Entwicklermodus** aktivieren.
3. **Entpackte Erweiterung laden** wählen und den Stammordner dieses Repositorys auswählen.
4. Das Tab-Tidy-Symbol in der Toolbar öffnen und den DeepSeek API-Key einmal eingeben.

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
