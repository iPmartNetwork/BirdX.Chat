# Changelog

All notable changes to **BirdX Chat** are documented in this file.

New entries are added at the top. Each release describes what that version **includes** or **adds** — not internal renames or prior version numbers.

Persian release notes live in `CHANGELOG.fa.md` (same version headings).

Format: [Keep a Changelog](https://keepachangelog.com/) — `Added`, `Changed`, `Fixed`, `Removed` (when needed).

---

## v1.0.0 - 2026-06-02

First public release of **BirdX Chat** by [iPmart Network](https://github.com/iPmartNetwork).

### Platform

- Self-hosted chat server (Node.js, SQLite `data/birdx.db`, file uploads, encrypted storage).
- Marketing site at **birdx.chat** (Persian default, English at `/en`, light theme).
- Web app / PWA at **web.birdx.chat** (English default UI; Persian in settings).
- Mobile entry point **app.birdx.chat** (download / app links).
- Example Nginx configs in `deploy/nginx/`.

### Messaging

- Direct messages, groups, channels, and saved messages.
- DM privacy: exact-username lookup (no global user search), per-user “who can message me” (nobody / acquaintances / everyone), conversation requests with accept/decline, one message while pending, shared-group shortcut for acquaintances.
- Block users from the profile/context menu; server rate limits and rejection cooldown for new requests.
- Text, files, voice messages, video transcoding.
- Reply, edit, delete (for me / for everyone), forward, reactions, read receipts.
- Typing indicators, presence, search, public groups, invite links.
- Optional message and file retention policies.

### Calls

- WebRTC voice and video calls (peer-to-peer).
- Screen share, TURN/STUN configuration, call logs, incoming-call push and ringtone.

### Security

- End-to-end encryption for DMs (X3DH + AES-256-GCM).
- DM policy env vars: `DM_DISCOVERY_MODE`, `DM_MAX_POLICY`, `DM_REQUESTS_PER_DAY`, `DM_REJECT_COOLDOWN_DAYS`; admin-visible `security_events` for DM actions.
- Two-factor authentication (TOTP + backup codes).
- Session-based auth, user bans, storage encryption at rest.

### Admin panel

- Dashboard, user and chat management, file management, audit logs.
- Roles (owner, admin, moderator, support, user).
- Broadcast messaging, bulk actions, data export (CSV/JSON).
- Analytics, custom branding, database backup from UI.
- Required channels, per-user upload policies.

### Integrations

- Webhooks with event subscriptions.
- Bot API (token-based): send messages, list chats, read messages, list users.
- Remote channels (Telegram mirror into public channels).

### Client experience

- React PWA with dark/light mode.
- English and Persian UI with RTL support.
- IndexedDB chat cache and offline-friendly app shell.
- Android PWA install guidance.

---

<!-- Future releases example:
## v1.0.1 - YYYY-MM-DD
### Added
- ...
### Fixed
- ...
-->
