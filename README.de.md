<p align="center">
  <img src="assets/icon-128.png" width="80" height="80" alt="Tab-Tidy-Symbol">
</p>

<h1 align="center">Tab Tidy</h1>

<p align="center">Aus verstreuten Tabs werden übersichtliche Themengruppen.</p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <strong>Deutsch</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-102%2B-4285F4?style=flat-square" alt="Chrome 102 oder neuer">
  <img src="https://img.shields.io/badge/Manifest-V3-5F6368?style=flat-square" alt="Manifest V3">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-181717?style=flat-square" alt="MIT-Lizenz"></a>
</p>

<p align="center">
  <a href="#schnellstart">Schnellstart</a> · <a href="#gruppierungseinstellungen">Einstellungen</a> · <a href="#datenschutz-und-berechtigungen">Datenschutz</a> · <a href="https://github.com/jiands233/tab-tidy/issues">Problem melden</a>
</p>

---

**Tab Tidy** ist eine Chrome-Erweiterung mit DeepSeek. Sie gruppiert Web-Tabs im aktuellen Fenster nach Themen, entfernt doppelte Seiten und ermöglicht das Rückgängigmachen. Die Gruppen erscheinen direkt in der nativen Tab-Leiste von Chrome.

Aktuelle Quellcodeversion: **v1.3.2**. Erforderlich sind **Chrome 102+** und ein eigener **DeepSeek API-Key**. Die KI-Klassifizierung benötigt eine Internetverbindung; die Erweiterung ruft DeepSeek direkt auf, ohne eigenen Proxyserver.

## Schnellstart

1. [Quellcode als ZIP herunterladen](https://github.com/jiands233/tab-tidy/archive/refs/heads/main.zip) und entpacken oder dieses Repository klonen.
2. `chrome://extensions` öffnen und den **Entwicklermodus** aktivieren.
3. **Entpackte Erweiterung laden** wählen und den Ordner mit `manifest.json` auswählen.
4. Tab Tidy über die Chrome-Symbolleiste öffnen, den DeepSeek API-Key eingeben und auf **保存并开始使用** (Speichern und starten) klicken.
5. Zum gewünschten Fenster wechseln und auf **开始整理** (Tabs ordnen) klicken.

Standardmäßig werden nur **nicht angeheftete, noch nicht gruppierte HTTP/HTTPS-Tabs im aktuellen Fenster** verarbeitet. Angeheftete Tabs, bestehende Gruppen und interne Browserseiten bleiben erhalten.

## Funktionen

| Funktion | Verhalten |
| --- | --- |
| Thematisch gruppieren | Seiten zur gleichen Aufgabe werden websiteübergreifend in nativen Chrome-Gruppen zusammengeführt |
| Duplikate entfernen | URLs werden vor dem Vergleich normalisiert; der aktive Tab wird bevorzugt behalten |
| Namen anpassen | Automatische Sprachwahl nach Inhalt oder eine von acht festgelegten Sprachen; kurze Namen, Themenhierarchie und Emoji möglich |
| Farben wählen | Zehn Farbschemata mit Vorschau; für neue Nutzer sind Grau und Blau voreingestellt |
| Bestehende Gruppen neu ordnen | Gruppen erneut klassifizieren, aufteilen, zusammenführen und benennen; standardmäßig deaktiviert |
| Sicher rückgängig machen | Letzten Vorgang innerhalb von 30 Minuten rückgängig machen; später manuell geänderte Tabs werden übersprungen |

Beispielnamen: `🤖 KI · Sicherheitsforschung`, `💻 Entwicklung · Shell-Grundlagen`, `📚 Lernen · IELTS`. Die tatsächlichen Themen werden aus Tab-Titeln und URL-Pfaden abgeleitet, ohne Seiteninhalte zu lesen.

## Gruppierungseinstellungen

Oben rechts im Popup **设置** (Einstellungen) öffnen. Änderungen mit **保存分组规则** (Gruppierungsregeln speichern) bestätigen.

| Einstellung | Auswahl |
| --- | --- |
| Sprache der Gruppennamen | Automatisch, vereinfachtes Chinesisch, traditionelles Chinesisch, Englisch, Japanisch, Koreanisch, Deutsch, Französisch, Spanisch |
| Detailgrad | **Ausgewogen**: vermeidet zu viele Unterteilungen; **Detailliert**: unterscheidet konkrete Aufgaben (Standard) |
| Namensstil | Kurzes Thema, Thema · Unterthema, Emoji + Thema (Standard) |
| Farbschema | Dezent (Standard), kühl, Graphit, Wald, Ozean, Sonnenuntergang, Beere, warmes Grau, einfarbig, nach Thema |

Bei automatischer Benennung bestimmt die vorherrschende Sprache der Titel einer Gruppe den Namen; bei Gleichstand gilt die Browsersprache. Übliche Produkt- und Techniknamen bleiben erhalten. Jede Gruppe enthält mindestens zwei Tabs; nicht zuverlässig zuordenbare Seiten können ungruppiert bleiben. Chrome-Gruppen sind flach: `Thema · Unterthema` beschreibt eine Hierarchie nur im Namen.

<details>
<summary>Alle zehn Farbschemata anzeigen</summary>

| Farbschema | Farben |
| --- | --- |
| Dezent | Grau + Blau |
| Kühl | Blau + Cyan + Violett |
| Graphit | Grau + Violett |
| Wald | Grau + Grün |
| Ozean | Blau + Cyan |
| Sonnenuntergang | Orange + Gelb |
| Beere | Violett + Rosa |
| Warmes Grau | Grau + Orange |
| Einfarbig | Eine gewählte Standardfarbe für alle Gruppen |
| Nach Thema | Zum Beispiel Violett für KI, Blau für Entwicklung, Grün fürs Lernen |

Chrome unterstützt neun vordefinierte Gruppenfarben. Ihr Aussehen hängt vom Browserdesign ab; beliebige Hex-Farbwerte werden nicht unterstützt.

</details>

**Nur das Aussehen ändern:** Innerhalb von 30 Minuten nach einem Vorgang in den Einstellungen auf **保存并更新上次分组的外观** (Speichern und Aussehen der zuletzt erstellten Gruppen aktualisieren) klicken. Dafür ist kein weiterer KI-Aufruf nötig. Gruppen mit manuell geänderten Namen, Farben oder Mitgliedern werden übersprungen.

**Bestehende Gruppen neu klassifizieren:** Vor dem Ordnen im Popup **重整已有标签组** (Bestehende Tabgruppen neu ordnen) aktivieren. Dann werden auch nicht angeheftete Web-Tabs bestehender Gruppen auf Duplikate geprüft und klassifiziert. Die Option ist standardmäßig deaktiviert und gilt nur für die aktuelle Popup-Sitzung.

## Datenschutz und Berechtigungen

- **Lokale Speicherung:** API-Key und Einstellungen liegen im `chrome.storage.local` des aktuellen Chrome-Profils, ohne Chrome Sync.
- **Direkte Anfragen:** Der API-Key authentifiziert Anfragen an DeepSeek. Zur Klassifizierung werden die numerische ID, der Titel, die Domain und der Pfad jedes infrage kommenden Tabs sowie Namensregeln und Browsersprache übertragen. Query-Parameter und URL-Fragmente werden nicht an das Modell gesendet.
- **Kein Zugriff auf Seiteninhalte:** Die Erweiterung liest oder überträgt keine Seiteninhalte und nutzt keinen eigenen Proxyserver. Titel und Pfade können dennoch sensible Informationen enthalten; prüfen Sie Ihre Tabs vor dem Ordnen.

<details>
<summary>Warum werden diese Berechtigungen benötigt?</summary>

| Berechtigung | Zweck |
| --- | --- |
| `tabs` | Tabinformationen lesen, Tabs verschieben, Duplikate schließen und beim Rückgängigmachen Seiten wieder öffnen |
| `tabGroups` | Native Chrome-Tabgruppen erstellen und ändern |
| `storage` | API-Key, Einstellungen und Vorgangsstatus speichern |
| `https://api.deepseek.com/*` | DeepSeek API direkt aufrufen |

</details>

## Häufige Fragen

**Wie mache ich einen Vorgang rückgängig?** Innerhalb von 30 Minuten im Popup auf **撤销本次整理** (Letzten Vorgang rückgängig machen) klicken. Gruppenmitglieder, Namen, Farben und eingeklappte Zustände werden wiederhergestellt; während dieses Vorgangs geschlossene Duplikate werden erneut geöffnet. Später manuell geänderte Tabs werden übersprungen. Wurde eine ursprüngliche Gruppe gelöscht, kann sich ihre interne ID bei der Wiederherstellung ändern.

**Was passiert bei einem Fehler?** Bei einem DeepSeek-Timeout oder ungültigen bzw. abgeschnittenen Antworten wird die Neuordnung nicht angewendet. Vor der Ausführung werden Änderungen am Tabzustand geprüft; wiederholte Klicks starten keine parallelen Vorgänge. Aktuell wird `deepseek-flash` mit deaktiviertem Denkmodus verwendet. Die Wartezeit hängt von Netzwerk, Dienstauslastung und Tabanzahl ab.

**Wie aktualisiere ich die Erweiterung?** Den Quellcode im ursprünglichen Erweiterungsordner aktualisieren, die Erweiterung unter `chrome://extensions` neu laden und Popup oder Einstellungen erneut öffnen. Key und Einstellungen bleiben im selben Chrome-Profil erhalten; bei Deinstallation und Neuinstallation ist das nicht garantiert. Quellcode und Chrome Web Store werden getrennt veröffentlicht: Ein GitHub-Update veröffentlicht kein Store-Update.

**Ist die Oberfläche dreisprachig?** Die aktuelle Oberfläche ist Chinesisch. Die Sprachlinks oben wechseln die Dokumentation; die Einstellung für die Namenssprache steuert die erzeugten Gruppennamen.

## Entwicklung und Paketierung

Eine Node.js-Version mit Unterstützung für `node --test` verwenden. npm-Abhängigkeiten und ein Build-Schritt sind nicht erforderlich:

```bash
npm test
```

Einstiegspunkte: [Gruppierungsregeln](src/settings.js) · [Aussehen](src/appearance.js) · [Ordnen und Rückgängigmachen](src/organizer.js) · [Modellanfragen](src/deepseek.js) · [Tests](test/). Automatisierte Tests decken Duplikaterkennung, Antwortvalidierung, Farbschemata, Neuordnung, Schutz vor parallelen Vorgängen und Rückgängigmachen ab. Modellantworten werden simuliert; reale API-Latenz und Klassifizierungsqualität werden damit nicht gemessen.

<details>
<summary>Upload-Paket für den Chrome Web Store erstellen</summary>

Im Stammverzeichnis des Repositorys ausführen. `manifest.json` muss direkt im Stammverzeichnis der ZIP-Datei liegen:

```bash
zip -r tab-tidy.zip manifest.json popup.html popup.css popup.js options.html options.css options.js assets src
```

Das Erstellen der ZIP-Datei lädt sie nicht automatisch in den Store hoch und veröffentlicht sie nicht.

</details>

<details>
<summary>Neu in v1.3.2</summary>

- Vereinfachtes Popup und Einstellungen mit Bedienelementen, Farbvorschau und Statusmeldungen.
- Graphit, Wald, Ozean, Sonnenuntergang, Beere und warmes Grau ergänzt; insgesamt zehn Farbschemata.
- Bestehende Einstellungen, mehrsprachige Namen, Emoji, optionale Neuordnung und 30 Minuten zum Rückgängigmachen bleiben erhalten.

</details>

## Lizenz

[MIT](LICENSE) © 2026 jiands233
