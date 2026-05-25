<p align="center">
  <img src="client/public/birdx-logo.svg" alt="BirdX Logo" width="80" height="80" />
</p>

<h1 align="center">BirdX</h1>

<p align="center">
  <strong>Modern self-hosted chat platform for private communities and teams</strong>
</p>

<p align="center">
  <a href="./VERSION"><img src="https://img.shields.io/badge/version-2.5.3--rc3-10b981?style=for-the-badge" alt="Version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D24.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" /></a>
</p>

<p align="center">
  <a href="https://github.com/iPmartNetwork/BirdX/stargazers"><img src="https://img.shields.io/github/stars/iPmartNetwork/BirdX?style=for-the-badge&color=f59e0b" alt="Stars" /></a>
  <a href="https://github.com/iPmartNetwork/BirdX/network/members"><img src="https://img.shields.io/github/forks/iPmartNetwork/BirdX?style=for-the-badge&color=8b5cf6" alt="Forks" /></a>
  <a href="https://github.com/iPmartNetwork/BirdX/issues"><img src="https://img.shields.io/github/issues/iPmartNetwork/BirdX?style=for-the-badge&color=ef4444" alt="Issues" /></a>
  <a href="https://github.com/iPmartNetwork/BirdX"><img src="https://img.shields.io/github/repo-size/iPmartNetwork/BirdX?style=for-the-badge&color=06b6d4" alt="Repo Size" /></a>
</p>

<p align="center">
  <a href="https://github.com/iPmartNetwork/BirdX/releases"><img src="https://img.shields.io/github/downloads/iPmartNetwork/BirdX/total?style=for-the-badge&color=22c55e&label=Downloads" alt="Downloads" /></a>
  <a href="https://github.com/iPmartNetwork/BirdX/commits/master"><img src="https://img.shields.io/github/last-commit/iPmartNetwork/BirdX?style=for-the-badge&color=6366f1" alt="Last Commit" /></a>
  <a href="https://github.com/iPmartNetwork/BirdX/graphs/contributors"><img src="https://img.shields.io/github/contributors/iPmartNetwork/BirdX?style=for-the-badge&color=ec4899" alt="Contributors" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#admin-panel">Admin Panel</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#deployment">Deployment</a> •
  <a href="./CHANGELOG.md">Changelog</a>
</p>

---

## 📋 Overview

BirdX is a feature-rich, self-hosted messaging platform built for teams and private communities. It combines real-time chat, voice/video calls, end-to-end encryption, file sharing, and a powerful admin panel into a single deployable application.

Based on the original [Songbird](https://github.com/bllackbull/Songbird) project by Mr. Pouya Khalili.

---

## ⚡ Quick Start

```bash
git clone https://github.com/iPmartNetwork/BirdX.git
cd BirdX
npm install
npm run build
npm start
```

Or use the one-line installer:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/iPmartNetwork/BirdX/master/scripts/install.sh)
```

---

## ✨ Features

### 💬 Messaging

| Feature | Description |
|---------|-------------|
| Real-time chat | DMs, groups, channels, saved messages |
| Rich actions | Edit, delete, forward, reply, read receipts |
| Reactions | Live emoji reactions via SSE |
| Presence | Typing indicators, online status |
| Discovery | Search, public groups, invite links |
| Media | Voice messages, file sharing, video transcoding |
| Permissions | Channel posting for owner/admin/moderator |

### 🔐 End-to-End Encryption

| Feature | Description |
|---------|-------------|
| Protocol | X3DH key agreement + AES-256-GCM |
| Key exchange | ECDH P-256 with HKDF derivation |
| Storage | Dedicated IndexedDB key store |
| UX | Green lock indicator for active E2EE |
| Automation | Auto session establishment, prekey replenishment |

### 📞 Voice & Video Calls

| Feature | Description |
|---------|-------------|
| WebRTC | Peer-to-peer voice and video |
| Signaling | Socket.IO lifecycle management |
| UI | Professional call screen, draggable mini card |
| Controls | Mute, camera, screen share, device select |
| Reliability | TURN/STUN, wake lock, reconnect grace |
| History | Per-chat call logs |
| Notifications | Push + in-app ringtone |

### 🌐 Multilingual

- English and Persian language support
- Full RTL layout for Persian
- Per-device language persistence

### 📱 PWA

- Installable on Android, iOS, and desktop
- Service worker with cache management
- Web Push notifications with VAPID
- Offline-ready app shell

---

## 🛡️ Admin Panel

Full admin workspace at `/admin` with role-based access control.

### Roles & Security

- **Roles:** Owner → Admin → Moderator → Support → User
- **Bootstrap:** `ADMIN_USERNAMES` env variable
- **Auth:** Password re-confirmation for all sensitive actions
- **Audit:** Full audit trail with IP, user-agent, success/failure

### Dashboard & Monitoring

- Real-time metrics: users, chats, messages, files, sessions, storage
- System health: CPU, memory, disk, runtime, services status
- Security summary: failed logins, banned attempts, top IPs, admin sessions

### User Management

- Search, filter, sort, paginate users
- Role changes, ban/unban, password reset, deletion
- User detail: stats, chats, files, sessions, IP/device info
- **Enhanced activity view:** recent messages, devices, login history
- Per-user upload policy (enable/disable, custom max size)
- **Bulk actions:** multi-select with batch ban/unban/delete

### Chat Management

- Search, filter by type/visibility, sort, paginate
- Group/channel detail: visibility, username, invite links, members
- Member management: add/remove, role changes
- **Bulk actions:** multi-select with batch delete

### 📢 Broadcast

- Send messages to all users, online users, or by role
- Delivered to Saved Messages
- Delivery count confirmation

### 📦 Data Export

- Export users, chats, files, audit logs
- CSV and JSON format
- One-click download

### Maintenance

- Required channels management
- Database backup: create, download, list, delete
- File management with owner, type, size controls

---

## 🛠️ Tech Stack

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socket.io&logoColor=white" />
  <img src="https://img.shields.io/badge/WebRTC-Enabled-333333?style=flat-square&logo=webrtc&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-sql.js-003B57?style=flat-square&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white" />
</p>

---

## 📋 Requirements

| Requirement | Minimum |
|-------------|---------|
| Node.js | `24+` |
| npm | `11+` |
| Protocol | HTTPS in production |
| Domain | Public domain for PWA/Push/WebRTC |
| TURN | Recommended for reliable calls |

---

## 🚀 Deployment

### Production Deploy

```bash
git pull origin master
npm install
npm run build
npm start
```

### With Process Manager

```bash
# PM2
pm2 restart all

# systemd
sudo systemctl restart birdx
```

### Server Update (Quick)

```bash
cd /opt/birdx
git fetch origin && git reset --hard origin/master
npm --prefix server install
npm --prefix client install
npm --prefix client run build
systemctl restart birdx
```

---

## ⚙️ Configuration

Create `.env` from `.env.example`:

```env
# Server
SERVER_PORT=5174
CLIENT_PORT=443
APP_ENV=production

# Auth
ACCOUNT_CREATION=true
ADMIN_USERNAMES=admin

# Upload
FILE_UPLOAD=true
FILE_UPLOAD_MAX_SIZE=26214400
FILE_UPLOAD_MAX_FILES=10

# Messages
MESSAGE_MAX_CHARS=4000
MESSAGE_FILE_RETENTION=7

# Voice Calls
APP_TURN_URLS=turn:turn.example.com:3478?transport=udp
APP_TURN_USERNAME=birdx
APP_TURN_CREDENTIAL=your_turn_password

# Security
STORAGE_ENCRYPTION_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
```

> ⚠️ Do not change `STORAGE_ENCRYPTION_KEY` after first run.

---

## 👤 Admin Setup

```env
ADMIN_USERNAMES=admin,admin2
```

Restart the server, then open:

```
https://your-domain.com/admin
```

---

## 📞 TURN Configuration

```env
APP_TURN_URLS=turn:turn.example.com:3478?transport=udp turn:turn.example.com:3478?transport=tcp
APP_TURN_USERNAME=birdx
APP_TURN_CREDENTIAL=your_turn_password
```

Required firewall ports: `3478 TCP/UDP`, `49152-65535 UDP`

---

## 💾 Database & Backups

```bash
npm --prefix server run db:help      # Show all commands
npm --prefix server run db:backup    # Create backup
npm --prefix server run db:restore   # Restore backup
npm --prefix server run db:migrate   # Run migrations
npm --prefix server run db:vacuum    # Optimize database
```

Backups are also available from the Admin Panel Maintenance tab.

---

## 📁 Project Structure

```
├── client/          React + Vite + Tailwind (PWA)
│   ├── src/
│   │   ├── api/         API client functions
│   │   ├── components/  UI components
│   │   ├── pages/       App pages (Chat, Admin, Auth)
│   │   └── hooks/       Custom React hooks
│   └── public/          Static assets, SW, manifest
├── server/          Express + Socket.IO + sql.js
│   ├── api/             Route handlers
│   ├── lib/             Utilities and services
│   ├── migrations/      Database migrations
│   └── scripts/         CLI tools
├── data/            Runtime (DB, uploads, backups)
└── scripts/         Install and ops scripts
```

---

## 🗺️ Roadmap

- [ ] Admin 2FA authentication
- [ ] Advanced analytics dashboards
- [ ] Group calls with SFU
- [ ] E2EE for group chats
- [ ] More languages and full localization
- [ ] Webhook integrations and bot API
- [ ] Message scheduling
- [ ] Custom themes and branding

---

## 🔒 Security

- Keep `.env` private and out of Git
- Use HTTPS in production
- Configure TURN for reliable calls
- Protect database backups
- Restrict admin access to trusted users
- Rotate credentials if exposed

---

## 🙏 Credits

BirdX is developed by **[iPmart Network](https://github.com/iPmartNetwork)** and is based on the original open-source Songbird project:

🔗 **Original Project:** [https://github.com/bllackbull/Songbird](https://github.com/bllackbull/Songbird)

Special thanks to **Mr. Pouya Khalili** for the original Songbird project and the foundation that made BirdX possible.

---

## 📄 License

[MIT](./LICENSE)

---

<p align="center">
  <sub>Made with ❤️ by <a href="https://github.com/iPmartNetwork">iPmart Network</a></sub>
</p>
