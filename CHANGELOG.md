# Changelog

All notable changes to the **BirdX Chat** application (`client/` + `server/`) in this repository are documented here.

Persian notes: [`CHANGELOG.fa.md`](./CHANGELOG.fa.md).

**Scope:** This file covers the self-hosted chat platform published on GitHub. The official [birdx.chat](https://birdx.chat) website, Windows/Android installers, and iOS app are separate BirdX product deliverables (custom deployments available on request — see [README.md](./README.md)).

Format: [Keep a Changelog](https://keepachangelog.com/).

---

## v1.0.1 - 2026-06-02

### Added

- Archived chats section with unarchive from the sidebar.
- Scheduled messages (composer + server processor).
- Do-not-disturb and notification pause in settings.
- Admin panel TOTP step-up (`POST /api/admin/verify-2fa`, `ADMIN_REQUIRE_2FA`).
- Public branding endpoint `GET /api/branding` and per-user accent color in settings.
- Group E2EE API (`/api/e2ee/group/:chatId/*`) and client group crypto helpers.
- Expanded webhook events (calls, reactions, archive, schedule, and more).
- Group voice/video calls with improved multi-participant socket signaling (10–20 participants, mesh or SFU).
- **Calls tab** (Telegram/WhatsApp-style): global call history, **contacts** with friend requests (send/accept/cancel/remove), contact-request privacy, push + PWA badge, in-call presence on avatars, EN/FA.
- **Polls** in chats (create, vote, live results) and **emoji stickers** in composer.
- **SFU group calls**: automatic reconnect after socket/transport drops.
- **Admin panel redesign**: grouped sidebar (dashboard / people / content / system), RTL layout, toast notifications, dashboard alerts and quick actions.
- **Admin calls tab**: paginated call history with search and status filters.
- **Admin moderation queue**: review or dismiss user message reports (`POST /api/messages/report`, migration 042).
- **Admin moderation actions**: ban author, delete message, or both from the report queue (`POST /api/admin/moderation/reports/:id/action`).
- **Report message UI**: reason picker modal (spam/abuse/illegal/other) instead of instant alert.
- **Admin server settings**: runtime maintenance mode, account registration, and file upload flags (`GET/PATCH /api/admin/server-settings`).

### Changed

- Admin analytics charts use shared bar chart component; overview shows today stats and recent audit.
- Admin panel legacy tabs and drawers fully localized (EN/FA) via `adminTranslations`.
- Default bootstrap admin account: **`birdxchat`** (`ADMIN_USERNAMES`, migration 040).
- Admin panel entry in settings/sidebar: highlighted button + quick access in desktop footer.
- `db:user:edit` supports `--role owner|admin|moderator|support|user`.
- **Privacy**: blocked-users list with unblock; block removes contacts and pending requests.
- Dev UI stays on port 5173 (`strictPort`); use `npm run dev:stop` before restart.
- WebRTC offer/answer/ICE payloads include `fromSocketId` for mesh-friendly routing.
- Group call limits: `GROUP_CALL_MIN_MEMBERS` (default 10), `GROUP_CALL_MAX_PARTICIPANTS` (default 20).
- Optional mediasoup SFU for group calls (`GROUP_CALL_MODE=sfu`).
- Admin analytics: calls/files trends, storage summary, CSV export, auto-load.
- Admin panel and call UI i18n (EN/FA).
- Group call push notifications for groups/channels (not only DMs).
- Group E2EE: keyed members can wrap keys for new/offline members.

### Fixed

- Blank page after login (missing lucide icon exports).
- Blank page after creating a group (sidebar list render typo).

### BirdX official product (not in this repository)

The following were produced for the hosted **BirdX** service and are **not** distributed via this GitHub repo:

- Marketing website at **birdx.chat** (FA/EN, FAQ, legal pages, docs).
- Windows desktop installer and Android APK published on the official download page.
- iOS remains planned for the official product line.

Organizations that self-host this codebase may request **custom** branded sites and native shells separately.

---

## v1.0.0 - 2026-06-02

First public release of **BirdX Chat** (application server + web client) by [iPmart Network](https://github.com/iPmartNetwork).

### Platform

- Self-hosted chat server (Node.js, SQLite `data/birdx.db`, file uploads, encrypted storage).
- React PWA served by the same Node process (installable; push via VAPID).
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
- PWA install guidance for mobile browsers.
