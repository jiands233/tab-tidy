<p align="center">
  <img src="assets/icon-128.png" width="80" height="80" alt="Tab Tidy icon">
</p>

<h1 align="center">Tab Tidy</h1>

<p align="center">Turn scattered tabs into clear topic groups.</p>

<p align="center">
  <a href="README.md">简体中文</a> · <strong>English</strong> · <a href="README.de.md">Deutsch</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-102%2B-4285F4?style=flat-square" alt="Chrome 102 or later">
  <img src="https://img.shields.io/badge/Manifest-V3-5F6368?style=flat-square" alt="Manifest V3">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-181717?style=flat-square" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> · <a href="#grouping-preferences">Preferences</a> · <a href="#privacy-and-permissions">Privacy</a> · <a href="https://github.com/jiands233/tab-tidy/issues">Report an issue</a>
</p>

---

**Tab Tidy** is a Chrome extension supporting DeepSeek, OpenAI-compatible APIs, and Anthropic APIs. It groups web tabs in your current window by topic, removes duplicate pages, and lets you undo the result. Groups appear directly in Chrome's native tab bar.

Current source version: **v1.4.0**. Requires **Chrome 102+** and an **API key for your chosen service**; local services can omit the key. The extension calls your configured API directly, with no application proxy server.

## Quick start

1. [Download the v1.4.0 extension ZIP](https://github.com/jiands233/tab-tidy/releases/download/v1.4.0/tab-tidy-v1.4.0.zip) and extract it, or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and choose the folder containing `manifest.json`.
4. Open Tab Tidy from the Chrome toolbar. For the default DeepSeek service, enter your key and click **保存并开始使用** (Save and get started). For another service, click **选择其他 AI 服务** (Choose another AI service).
5. Switch to the window you want to organize and click **开始整理** (Organize).

By default, only **unpinned, ungrouped HTTP/HTTPS tabs in the current window** are processed. Pinned tabs, existing groups, and internal browser pages are preserved.

## Configure an AI service

Open **设置 → AI 服务** (Settings → AI service), choose the API type, enter its base URL, model name, and key, then click **保存 API 配置** (Save API configuration).

| API type | Example base URL | Request format |
| --- | --- | --- |
| DeepSeek (default) | `https://api.deepseek.com` | Chat Completions with thinking disabled |
| OpenAI-compatible | `https://api.openai.com/v1` or a compatible service URL | `POST /chat/completions`, Bearer authentication |
| Anthropic | `https://api.anthropic.com/v1` or a compatible service URL | `POST /messages`, `x-api-key` authentication |

Enter a model name that your service supports; the extension does not guess or fetch model lists. The base URL can include `/v1` or a gateway path prefix; full endpoint URLs are also accepted. Only these two protocols are supported, not the OpenAI Responses API.

Remote URLs require HTTPS. Local services at `http://localhost:port/v1` or `http://127.0.0.1:port/v1` may use HTTP and omit the key. When saving a custom service, Chrome requests access to that host as needed; denying access leaves the configuration unchanged. A blank key retains the saved key only for the same protocol and base URL. Changing either requires the matching key. Existing DeepSeek settings remain compatible.

## What it does

| Feature | What to expect |
| --- | --- |
| Topic grouping | Brings pages for the same task together across websites in native Chrome groups |
| Duplicate cleanup | Normalizes URLs before deduplication, preferring the active tab |
| Custom names | Follows the content language or uses one of eight specified languages; supports concise, hierarchical, and emoji names |
| Color preferences | Ten palette options with a settings preview; grey and blue are the default for new users |
| Optional regrouping | Reclassifies, splits, merges, and renames existing groups; off by default |
| Safe undo | Undoes the most recent run within 30 minutes, skipping tabs you changed afterwards |

Example names: `🤖 AI · Safety Research`, `💻 Development · Shell Basics`, `📚 Learning · IELTS`. Actual topics are inferred from tab titles and paths, without reading page content.

## Grouping preferences

Open **设置** (Settings) at the top right of the popup, then click **保存分组规则** (Save grouping rules) after making changes.

| Setting | Options |
| --- | --- |
| Naming language | Automatic, Simplified Chinese, Traditional Chinese, English, Japanese, Korean, German, French, Spanish |
| Grouping detail | **Balanced**: avoids excessive splitting; **Detailed**: prioritizes specific tasks (default) |
| Naming style | Concise topic, Topic · Subtopic, Emoji + Topic (default) |
| Palette | Restrained (default), cool, graphite, forest, ocean, sunset, berry, warm grey, single color, theme-based |

Automatic naming follows the dominant language of each group's titles, falling back to the browser language on a tie. Familiar product and technology names are preserved. Each group needs at least two tabs; pages that cannot be reliably classified may remain ungrouped. Chrome groups are flat; `Topic · Subtopic` expresses hierarchy only in the name.

<details>
<summary>Explore the ten palettes</summary>

| Palette | Colors |
| --- | --- |
| Restrained | Grey + blue |
| Cool | Blue + cyan + purple |
| Graphite | Grey + purple |
| Forest | Grey + green |
| Ocean | Blue + cyan |
| Sunset | Orange + yellow |
| Berry | Purple + pink |
| Warm grey | Grey + orange |
| Single color | One selected preset for all groups |
| Theme-based | Colors by topic, such as purple for AI, blue for development, green for learning |

Chrome supports nine preset group colors. Their appearance depends on the browser theme; arbitrary hex colors are not supported.

</details>

**Update appearance only:** Click **保存并更新上次分组的外观** (Save and update the last run's appearance) in Settings within 30 minutes of a run. This updates the groups it created without another AI call. Groups whose names, colors, or members you changed manually are skipped.

**Reclassify existing groups:** Enable **重整已有标签组** (Regroup existing tab groups) in the popup before organizing. Unpinned web tabs in existing groups will also be deduplicated and classified. The switch is off by default and applies only to the current popup session.

## Privacy and permissions

- **Local storage:** Your API key and preferences are stored in the current Chrome profile's `chrome.storage.local`, without Chrome Sync.
- **Direct requests:** Your API key authenticates requests to your configured service. Classification data includes each candidate tab's numeric ID, title, domain, and path, along with naming instructions and browser language. URL query parameters and fragments are not sent to the model. If you use a third-party gateway, this data is sent to that gateway.
- **No page content access:** The extension neither reads nor uploads page bodies and uses no application proxy server. Titles and paths can still contain sensitive information; review your tabs before organizing.

<details>
<summary>Why does the extension need these permissions?</summary>

| Permission | Purpose |
| --- | --- |
| `tabs` | Read tab metadata, move tabs, close duplicates, and reopen pages during undo |
| `tabGroups` | Create and update native Chrome tab groups |
| `storage` | Save your API key, preferences, and operation state |
| `https://api.deepseek.com/*` | Default DeepSeek service |
| Optional API host access | Requested only for the host you select when saving a custom service |

</details>

## Frequently asked questions

**How do I undo?** Click **撤销本次整理** (Undo this run) in the popup within 30 minutes. Undo restores group members, names, colors, and collapsed states, and reopens duplicates closed by that run. Tabs changed manually afterwards are skipped. If an original group was deleted, its restored internal ID may differ.

**What if a request fails?** Organization is not applied when the AI service times out or returns invalid or truncated output. Tab-state changes are checked before applying a result, and repeated clicks cannot start concurrent runs. DeepSeek defaults to `deepseek-flash` with thinking disabled; other services use your configured model. Waiting time depends on the network, service load, and number of tabs.

**How do I update?** Update the source in the original extension folder, reload the extension at `chrome://extensions`, and reopen the popup or Settings. Your key and preferences remain in the same Chrome profile; uninstalling and reinstalling may remove them. Source and Chrome Web Store releases are separate: updating GitHub does not publish a store update.

**Is the interface available in three languages?** The current extension interface is Chinese. The language links above switch the documentation; the naming-language setting controls generated group names.

## Development and packaging

Use a Node.js version that supports `node --test`. No npm dependencies or build step are needed:

```bash
npm test
```

Entry points: [grouping rules](src/settings.js) · [appearance](src/appearance.js) · [organization and undo](src/organizer.js) · [API configuration](src/ai-config.js) · [model requests](src/ai.js) · [tests](test/). Automated tests cover deduplication, response validation, palettes, regrouping, concurrency protection, and undo. Model responses are mocked; these tests do not measure live API latency or classification quality.

<details>
<summary>Create a Chrome Web Store upload package</summary>

Run from the repository root. The ZIP root must contain `manifest.json` directly:

```bash
zip -r tab-tidy.zip manifest.json popup.html popup.css popup.js options.html options.css options.js assets src
```

Creating the ZIP does not upload or publish it to the store.

</details>

<details>
<summary>What's new in v1.4.0</summary>

- Added OpenAI Chat Completions and Anthropic Messages APIs with configurable URLs and models.
- Optional host access, local-service support, and compatibility with existing DeepSeek keys.
- Response validation, concurrency protection, and safe undo are preserved.

</details>

<details>
<summary>What's new in v1.3.2</summary>

- Simpler popup and Settings, retaining controls, color previews, and status feedback.
- Added graphite, forest, ocean, sunset, berry, and warm grey for a total of ten palettes.
- Preserved existing preferences, multilingual names, emoji, optional regrouping, and 30-minute undo.

</details>

## License

[MIT](LICENSE) © 2026 jiands233
