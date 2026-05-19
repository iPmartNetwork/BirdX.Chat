# BirdX

[![Version](https://img.shields.io/badge/version-2.5.3--rc1-10b981)](./VERSION)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24.0.0-339933)](https://nodejs.org/)

BirdX is a modern self-hosted chat, voice call, file sharing, and administration platform for private communities and teams. It is built with React, Vite, Express, Socket.IO, WebRTC, Web Push, and PWA support.

Repository: https://github.com/iPmartNetwork/BirdX

BirdX is based on the original Songbird project:

```text
https://github.com/bllackbull/Songbird
```

## Current Release

`2.5.3-rc1`

This release fixes critical security and stability bugs, improves real-time reaction updates, and adds a draggable minimized call card.

## What BirdX Includes

### Messaging

- Real-time direct messages, groups, channels, and saved messages
- Message edit, delete, forward, reply, and read receipts
- Message reactions with live real-time updates via SSE
- Typing indicators and user presence
- Chat search, discovery, public groups/channels, and invite links
- Channel posting for owner, admin, and moderator roles
- Voice messages with waveform support
- File sharing with size, count, retention, and transcoding controls

### Multilingual

- English and Persian language support
- RTL layout for Persian
- Language settings panel with per-device persistence

### Voice & Video Calls

- WebRTC voice and video calls for direct messages
- Socket.IO signaling for call lifecycle, SDP, and ICE candidates
- Professional incoming/outgoing call screen
- Minimized call mode with a draggable floating card (repositionable by touch or mouse)
- Compact video-call controls with auto-hide after 3 seconds
- Mute, camera toggle, screen sharing (desktop), device selection, and reconnect controls
- Connection quality feedback for active calls
- Per-chat call history for accepted, rejected, ended, and missed/disconnected calls
- Incoming call ringtone while the app is open
- Push notifications for incoming calls in PWA/background mode
- TURN/STUN configuration for reliable audio on mobile carriers and restricted networks
- Best-effort screen wake lock and reconnect grace handling to reduce mobile screen-lock call drops
- Socket.IO session authentication for secure call signaling

### PWA

- Installable Progressive Web App
- Android install fallback flow
- iOS and desktop installation guidance
- Service worker cache management
- App shell update recovery
- Web Push notifications with VAPID support

### Admin Panel

BirdX includes a real admin workspace at:

```text
/admin
```

Admin capabilities:

- Owner, admin, moderator, support, and user roles
- Bootstrap admins with `ADMIN_USERNAMES`
- Password re-authentication before sensitive admin actions
- Dashboard metrics for users, chats, messages, files, sessions, and storage
- User management with role changes, ban/unban, password reset, and deletion
- User detail drawer with profile metadata, stats, chats, files, active sessions, IP addresses, and user-agent data
- Session management with single-session revoke and logout-all
- Chat management with search, filtering, sorting, pagination, and deletion
- Group/channel detail drawer with visibility, public username, invite-link, member, and manager controls
- Owner-controlled group/channel member role management with owner, admin, moderator, and member roles
- Public/private chat visibility filtering
- File management with owner, type, size, pagination, and deletion
- Audit logs with filters by action, actor, and target type, plus IP address, user-agent, and success/failure visibility
- Monitor tab with CPU, memory, disk, runtime, database, uploads, backups, push, TURN, and storage-encryption status
- Security summary with failed login tracking, banned login attempts, failed admin re-authentication, sensitive admin actions, active admin sessions, top source IPs, and recent security activity
- Maintenance tab for database backup creation, download, listing, and deletion
- Professional in-app confirmation modals for sensitive actions

## Tech Stack

- React 19
- Vite 7
- Tailwind CSS
- Express 4
- Socket.IO 4
- WebRTC
- Web Push
- sql.js
- PWA manifest and service worker

## Requirements

- Node.js `24+`
- npm `11+`
- HTTPS in production
- A public domain for PWA, push notifications, and WebRTC permissions
- A TURN server such as `coturn` for reliable voice calls across strict NAT and mobile networks

## Quick Start

```bash
git clone https://github.com/iPmartNetwork/BirdX.git
cd BirdX
npm install
npm run build
npm start
```

The production server serves the built client from the Express backend.

## Development

```bash
npm install
npm run dev
```

The root `dev` script starts the client and server together.

## One-Line Install

If you use the bundled install script:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/iPmartNetwork/BirdX/master/scripts/install.sh)
```

Review the script before running it on a production server.

## Environment Configuration

Create a `.env` file in the project root. Use `.env.example` as the template.

Recommended production baseline:

```env
# Server
SERVER_PORT=5174
CLIENT_PORT=443

# App
APP_ENV=production
APP_DEBUG=false

# Auth
ACCOUNT_CREATION=true
ADMIN_USERNAMES=ipmart

# File Upload
FILE_UPLOAD=true
FILE_UPLOAD_MAX_SIZE=26214400
FILE_UPLOAD_MAX_TOTAL_SIZE=78643200
FILE_UPLOAD_MAX_FILES=10
FILE_UPLOAD_TRANSCODE_VIDEOS=true

# Message Limits
MESSAGE_MAX_CHARS=4000

# Retention
MESSAGE_FILE_RETENTION=7
MESSAGE_TEXT_RETENTION=0

# Chat Performance
CHAT_MESSAGE_FETCH_LIMIT=300
CHAT_MESSAGE_PAGE_SIZE=60
CHAT_LIST_REFRESH_INTERVAL=20000
CHAT_PRESENCE_PING_INTERVAL=5000

# Voice Calls / TURN
APP_TURN_URLS=turn:turn.example.com:3478?transport=udp turn:turn.example.com:3478?transport=tcp
APP_TURN_USERNAME=birdx
APP_TURN_CREDENTIAL=your_turn_password

# Security
STORAGE_ENCRYPTION_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
```

Important:

- Do not change `STORAGE_ENCRYPTION_KEY` after first run.
- Use `.env` in production, not `.env.example`.
- Keep `.env` out of Git.
- Set `ADMIN_USERNAMES` to the username that should become the first owner/admin.
- Restart the server after changing `.env`.

## Admin Setup

To make an existing user the bootstrap owner, add the username to `.env`:

```env
ADMIN_USERNAMES=admin
```

Then restart the server. On startup, BirdX will bootstrap matching users as owners and unban them if needed.

You can add multiple bootstrap owners:

```env
ADMIN_USERNAMES=admin,admin2,admin3
```

After login, open:

```text
https://your-domain.com/admin
```

Admin users also see an Admin Panel entry inside the settings menu.

## Voice Call Reliability

BirdX has built-in public STUN fallback, but production voice calls should use TURN.

Example:

```env
APP_TURN_URLS=turn:turn.example.com:3478?transport=udp turn:turn.example.com:3478?transport=tcp
APP_TURN_USERNAME=birdx
APP_TURN_CREDENTIAL=your_turn_password
```

Recommended TURN firewall ports:

```text
3478 TCP
3478 UDP
49152-65535 UDP
```

Without TURN, calls may work on normal networks but fail on some mobile carriers, corporate Wi-Fi, or strict NAT connections.

## PWA And Push Notifications

For installable Android/iOS/Desktop PWA behavior:

- Serve BirdX over HTTPS
- Keep `/manifest.webmanifest` available
- Keep `/sw.js` available
- Configure valid VAPID keys
- Ask users to enable notifications
- Rebuild and redeploy the client after changing client-side env values

Incoming calls use Web Push when the app is installed or running in the background. When the app is open, BirdX also displays the incoming call screen and plays an in-app ringtone when the browser allows audio playback.

## Database And Backups

BirdX stores application data under the local `data` directory. The Admin Panel Maintenance tab can create, list, download, and delete database backups.

Server-side helper scripts are also available:

```bash
npm --prefix server run db:help
npm --prefix server run db:backup
npm --prefix server run db:restore
npm --prefix server run db:migrate
npm --prefix server run db:vacuum
```

Always create a backup before upgrading production.

## Build And Deploy

Typical production flow:

```bash
git pull origin master
npm install
npm run build
npm start
```

If you use a process manager:

```bash
pm2 restart all
```

or:

```bash
sudo systemctl restart birdx
```

## Upgrade Notes

When upgrading from older BirdX versions:

1. Back up the database.
2. Pull the latest code.
3. Update `.env` with new keys such as `ADMIN_USERNAMES` and TURN settings.
4. Run `npm install`.
5. Run `npm run build`.
6. Restart the server.
7. Log in with the bootstrap admin and open `/admin`.

Database migrations run automatically at startup.

## Repository Structure

```text
client/        React, Vite, PWA, UI components
server/        Express API, Socket.IO, migrations, database helpers
scripts/       Install and operational scripts
data/          Runtime database, uploads, backups
```

## Roadmap

Planned areas for future releases:

- Fine-grained admin permissions
- Admin 2FA
- Advanced analytics charts
- Group calls with SFU support
- End-to-end encryption improvements
- More languages and full UI localization

## Credits

BirdX is developed by iPmart Network and is based on the original open-source Songbird project:

[https://github.com/bllackbull/Songbird](https://github.com/bllackbull/Songbird)

Special thanks to Mr. Pouya Khalili for the original Songbird project and the foundation that made BirdX possible.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).

## Security Notes

- Keep `.env` private.
- Use HTTPS in production.
- Configure TURN for reliable calls.
- Keep backups protected.
- Give admin access only to trusted users.
- Rotate VAPID, TURN, and admin credentials if exposed.

## License

MIT
