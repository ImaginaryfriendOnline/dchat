# 💬 Daavy's Chat (Imaginaryfriend fork)

Improves the Foundry VTT chat log with tabs, message tools, and optional chat features.

This is Imaginaryfriend's personalized fork of [DaavyC/dchat](https://github.com/DaavyC/dchat), maintained independently at [ImaginaryfriendOnline/dchat](https://github.com/ImaginaryfriendOnline/dchat). All credit for the original module goes to [Daavy](https://github.com/DaavyC) — see [Changes in this fork](#-changes-in-this-fork) below for what's different here.

---

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/C1I7209LY1)

---

## ✨ Features

- **Chat tabs** — Separates Chat, Game, and Whispers.
- **Autocomplete** — Suggests users when typing `/w`, `/whisper`, or `@username`.
- **Message pins** — GMs can pin messages. Players can request pins for whispers.
- **User mentions** — Type `@username` to mention a user. Mentioned text uses that user's color, plays a notification sound, and highlights the message with a yellow border for one minute. Mentions are local to each user.
- **Message merge** — Consecutive Chat and Whisper messages from the same author are displayed as a compact group. Game messages and pinned messages always remain separate.
- **Images in chat** — Paste or drag and drop images into chat. Supported formats are `PNG`, `JPG/JPEG`, `WEBP`, and `GIF`.
- **Private roll protection** — Hides private rolls from users who cannot see them.

## ⚙️ Settings

### 🛠️ General

- **Cleaner Chat** — Hides avatars and usernames in chat headers.
- **Hide Chat Formatting** — Hides the ProseMirror formatting toolbar.
- **Collapsible Formula** — Hides dice formulas until clicked.
- **Hide Chat Initiative** — Prevents initiative roll messages from being created in chat.
- **Hide Private Messages** — Hides unauthorized private rolls.
- **Allow Player Media Uploads** — Allow or block player image uploads.
- **Split Chat & Game Tabs** *(this fork)* — On by default. Disable to merge dice rolls and other system messages into the Chat tab instead of keeping them in a separate Game tab.
- **Auto-Switch Active Tab** *(this fork)* — On by default. Disable to stop the chat log from automatically changing your active tab when you send a message or roll dice.

### 🎲 PF2e only

- **Hide Damage Buttons** — Hides damage buttons by default and adds a toggle for authorized users.
- **Hide Damage Traits** — Hides trait tags on damage rolls.
- **Trait Filter** — Filters low-impact traits and limits visible traits to three. Click the traits to expand them.

## 🧬 Changes in this fork

Everything above is upstream [DaavyC/dchat](https://github.com/DaavyC/dchat) functionality. On top of that, this fork adds:

- **Split Chat & Game Tabs setting** — Lets you turn off the Chat/Game tab split entirely and have dice rolls and system messages show up in the Chat tab instead of a separate Game tab.
- **Fixed automated messages jumping to the Whispers tab** — Private/blind system messages (e.g. PF2e damage-log entries) no longer force your active tab to switch to Whispers. Normal chat, rolls, and whispers you actually type still auto-switch as before.
- **Auto-Switch Active Tab setting** — A general on/off switch for the auto-tab-switching behavior itself, for anyone who'd rather their active tab never change automatically.
- **System-agnostic automated-message detection** — The logic behind the two items above no longer hardcodes PF2e; it checks the active game system's own message flags (`game.system.id`), so the fix and the setting work the same way for other systems (e.g. dnd5e), not just PF2e.

See [changelog.md](changelog.md) for the full version history.

## 📦 Installation

**Upstream (DaavyC's original):** In Foundry VTT, open **Add-on Modules**, choose **Install Module**, and enter the manifest URL:

<https://github.com/DaavyC/dchat/releases/latest/download/module.json>

**This fork:** No packaged release has been published yet. Until then, clone or download this repository into your Foundry `Data/modules/dchat` folder to use it.

## ✅ Compatibility

- **Foundry VTT:** Version 14
- **Systems:** System-agnostic, with optional PF2e features

## 📚 Credits

- **[Daavy](https://github.com/DaavyC)** — original author of [Daavy's Chat](https://github.com/DaavyC/dchat), which this fork is based on.
- **[Actually Private Messages](https://gitlab.com/koboldworks/agnostic/private-rolls)** by koboldworks — inspiration only.
- **[Autocomplete Whisper](https://github.com/orcnog/autocomplete-whisper/)** by orcnog — inspiration only.

> Built with AI-assisted development.