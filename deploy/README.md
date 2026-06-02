# BirdX production deploy

## Build

```bash
npm install
npm run build:all
```

## Static site (`birdx.chat`)

```bash
rsync -av site/dist/ server:/var/www/birdx-site/
```

Enable `deploy/nginx/birdx.chat.conf`.

## Web app (`web.birdx.chat`)

```bash
npm start
# or systemd: birdx.service → node server/index.js
```

Enable `deploy/nginx/web.birdx.chat.conf`.

Set in `.env`:

```env
SERVER_PORT=5174
APP_TURN_URLS=turn:turn.birdx.chat:3478?transport=udp
BIRDX_SERVICE_NAME=birdx.service
```

## Mobile landing (`app.birdx.chat`)

Point to a simple static page or future app-store redirects until native apps ship.

## Database

Runtime file: `data/birdx.db` (legacy `songbird.db` is migrated automatically on first start).

Backups: `data/backups/birdx-backup-*.zip`
