# Deploying BirdX Chat (self-hosted)

This guide covers hosting the **application** from this repository (`client/` + `server/`) on your own server and domain.

It does **not** cover the official [birdx.chat](https://birdx.chat) marketing site or BirdX store installers. For those, contact iPmart Network ([@birdx_app](https://t.me/birdx_app)).

## Build

```bash
npm install
npm run build
```

## Run

```bash
npm start
# or systemd → node server/index.js
```

## Automated install (Linux)

Recommended for production on Ubuntu/Debian:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/iPmartNetwork/BirdX.Chat/master/scripts/install.sh)
```

The interactive **birdx-deploy** console installs `server/` + `client/`, configures Nginx, TLS, systemd, and optional coturn. It does **not** deploy the marketing site or native app installers.

## Nginx

Use examples in [`deploy/nginx/`](./nginx/) — typically one HTTPS vhost for your chat hostname (e.g. `chat.example.com`) proxying to `SERVER_PORT` (default `5174`).

Set `client_max_body_size` to at least **`150m`** (or `157286400` bytes) so it matches `FILE_UPLOAD_MAX_TOTAL_SIZE` in `.env` (default `157286400`).

### Example `.env`

```env
SERVER_PORT=5174
CLIENT_PORT=443
APP_ENV=production

APP_TURN_URLS=turn:turn.example.com:3478?transport=udp
APP_TURN_USERNAME=birdx
APP_TURN_CREDENTIAL=your_turn_password

VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com

ADMIN_USERNAMES=birdxchat
```

Full list: [`.env.example`](../.env.example)

## TLS & WebRTC

- Terminate HTTPS at Nginx; enable WebSocket upgrade to Node.
- Open TURN ports for reliable calls behind NAT.

## Database

- Runtime: `data/birdx.db`
- Backups: `npm --prefix server run db:backup` or Admin → Maintenance

## Optional: custom native apps

Self-hosters normally use the **PWA in the browser**. Branded Windows/Android/iOS shells that load your URL are a **separate custom project** (not built from this public repo’s release process). Mention your domain when requesting a quote.

## Related

- [README.md](../README.md)
- [CHANGELOG.md](../CHANGELOG.md)
