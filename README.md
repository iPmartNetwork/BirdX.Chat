<p align="center">
  <img src="client/public/icons/icon-512.png" alt="BirdX Chat" width="160" height="160" />
</p>

<p align="center">
  <strong>BirdX Chat</strong> — self-hosted secure messaging<br />
  <sub>Real-time chat · Voice & video · E2EE · Admin panel · English & Persian (RTL)</sub>
</p>

<p align="center">
  <a href="https://github.com/iPmartNetwork/BirdX.Chat/stargazers"><img src="https://img.shields.io/badge/version-1.0.3-10b981?style=for-the-badge" alt="Version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D24-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" /></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-screenshots">Screenshots</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-deployment">Deployment</a> ·
  <a href="./CHANGELOG.md">Changelog</a> ·
  <a href="./README.fa.md">فارسی</a>
</p>

---

## Overview

This repository is the **BirdX Chat application**: `client/` (React PWA) and `server/` (Node.js API). Deploy it on **your own domain** for your team or community.

The marketing site lives in a **separate repo**: [birdx-marketing](https://github.com/iPmartNetwork/birdx-marketing) ([birdx.chat](https://birdx.chat)). See [WORKSPACE.md](./WORKSPACE.md) for how to lay out both projects on disk.

Pre-built Windows/Android installers and iOS builds are part of the **hosted BirdX** product operated by [iPmart Network](https://github.com/iPmartNetwork). Self-hosters use the browser/PWA on their server URL.

### Hosted BirdX (official)

| Service | Description |
|---------|-------------|
| [birdx.chat](https://birdx.chat) | Official website, docs, downloads (private deployment) |
| [app.birdx.chat](https://app.birdx.chat) | Official web app for BirdX users |

### Custom work (on request)

We also ship, outside this public repo:

- Branded **marketing websites**
- **Windows / Android / iOS** shell apps pointing at a chosen URL
- Store-ready package IDs and icons

Contact [@birdx_app](https://t.me/birdx_app) or [GitHub Issues](https://github.com/iPmartNetwork/BirdX.Chat/issues) for dedicated builds.

---

## Screenshots

<p align="center">
  <img src="docs/screenshots/chat.png" alt="BirdX Chat — conversation UI" width="48%" />
  <img src="docs/screenshots/admin.png" alt="BirdX Chat — admin panel" width="48%" />
</p>
<p align="center">
  <img src="docs/screenshots/calls.png" alt="BirdX Chat — calls" width="48%" />
</p>

<sub>Add or replace images under <a href="./docs/screenshots/">docs/screenshots/</a> (see README there). Until files exist, GitHub may show broken image placeholders.</sub>

---

## Quick start

```bash
git clone https://github.com/iPmartNetwork/BirdX.Chat.git
cd BirdX.Chat
npm install
cp .env.example .env   # your domain, TURN, VAPID, keys
npm run build
npm start
```

Linux one-liner:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/iPmartNetwork/BirdX.Chat/master/scripts/install.sh)
```

Interactive **birdx-deploy** menu: install, update, `.env`, database, logs, and optional coturn TURN. Re-run anytime: `sudo birdx-deploy`.

Serve over **HTTPS** on your hostname (e.g. `https://chat.example.com`). Default bootstrap admin: `birdxchat` (`ADMIN_USERNAMES`).

### Development

**Git (optional):** To avoid `cursoragent` appearing as a GitHub contributor, turn off **Cursor Settings → Agents → Attribution**, then run `bash scripts/setup-git-hooks.sh` once per clone (strips `Co-authored-by: Cursor` from commit messages).

| Command | Description |
|---------|-------------|
| `npm run dev` | Client + API (local) |
| `npm run dev:stop` | Stop dev processes (Windows) |
| `npm run build` | Production client → `client/dist/` |
| `npm start` | API serves client + WebSocket |

---

## Features

### Messaging

- Direct messages, groups, channels, saved messages
- Reactions, reply, edit, delete, forward, read receipts
- DM privacy: exact username lookup, DM policy, conversation requests, block list
- Files, voice, polls, stickers, scheduled messages, archived chats

### Security

- E2EE for direct messages (X3DH + AES-256-GCM)
- TOTP 2FA and backup codes
- Encrypted storage at rest
- Rate limits and security event logging

### Calls

- WebRTC voice/video and screen share
- Call history tab, group calls (mesh or optional SFU)
- TURN/STUN via `.env`

### Admin (`/admin`)

- Role-based access (owner → user)
- Users, chats, files, audit, analytics, exports
- Broadcasts, moderation queue, server settings, DB backup UI
- Optional admin 2FA step-up

### Integrations

- Webhooks, bot API, remote channel mirroring
- Branding API, EN/FA + RTL

---

## Tech stack

React 19 · Vite 7 · Tailwind 3 · Express · Socket.IO · sql.js (SQLite) · WebRTC · PWA

---

## Project structure (this repository)

```
BirdX.Chat/
├── client/       React web app (PWA)
├── server/       API, Socket.IO, migrations
├── deploy/nginx/ Example reverse-proxy configs
├── docs/         Documentation assets (e.g. README screenshots)
├── data/         Runtime DB & uploads (local, not in git)
└── scripts/      Install helpers
```

---

## Configuration

Copy [`.env.example`](./.env.example) → `.env`. See comments for DM policy, uploads, retention, TURN, VAPID, and `STORAGE_ENCRYPTION_KEY` (do not change after first run).

**Voice/video calls:** set `APP_TURN_URLS` / `APP_TURN_USERNAME` / `APP_TURN_CREDENTIAL` for reliable audio on mobile and strict NATs. Group call behaviour is controlled by `GROUP_CALL_MODE` (`mesh` default, or `sfu`), `GROUP_CALL_MIN_MEMBERS`, and `GROUP_CALL_MAX_PARTICIPANTS`. If a reverse proxy or mobile (Capacitor) shell connects from a different origin, list allowed origins in `APP_ALLOWED_ORIGINS` (empty = allow any; session auth is always enforced).

Database tools: `npm --prefix server run db:help`

---

## Deployment

1. `npm install && npm run build`
2. Configure Nginx — [`deploy/README.md`](./deploy/README.md), [`deploy/nginx/`](./deploy/nginx/)
3. `npm start` or systemd
4. Point your domain with TLS; configure TURN for calls

Self-hosters do **not** need the BirdX marketing site or store installers unless they build their own landing page and native shells (custom project).

---

## Security

- Keep `.env` and backups private
- HTTPS only in production
- Enable 2FA for admins
- Plan TURN for NAT traversal

---

## Support

| | |
|---|---|
| Bugs & features | [GitHub Issues](https://github.com/iPmartNetwork/BirdX.Chat/issues) |
| BirdX announcements | [@birdx_app](https://t.me/birdx_app) |
| Custom site / mobile apps | Telegram or Issues (commercial / dedicated setup) |

---

## Credits

Developed by **[iPmart Network](https://github.com/iPmartNetwork)**.

Thanks to **Mr. Pouya Khalili** ([@bllackbull](https://github.com/bllackbull)) for the original open-source vision. BirdX Chat is an independent codebase.

---

## License

[MIT](./LICENSE)
