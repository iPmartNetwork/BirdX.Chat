# BirdX workspace layout

This repository (**BirdX.Chat**) is **only the chat application**:

- `client/` — React PWA  
- `server/` — Node API + Socket.IO  
- `apps/` — optional Windows/Android shells (local, gitignored)  
- `scripts/` — self-host installer  

It does **not** include the marketing website.

## Separate repos

| Repo | Purpose | Deploy path (official) |
|------|---------|-------------------------|
| [BirdX.Chat](https://github.com/iPmartNetwork/BirdX.Chat) | Chat + API | `/opt/birdx` → `app.birdx.chat` |
| [birdx-marketing](https://github.com/iPmartNetwork/birdx-marketing) | `birdx.chat` site | `/var/www/birdx-site` |

## Recommended folder on your PC

```
birdx-full/                 # optional parent folder (not a git repo)
├── birdx/                  # clone BirdX.Chat  ← this repo
└── birdx-marketing/        # clone birdx-marketing
```

You can delete any old `birdx/site/` copy inside the chat repo — it is not used anymore.

## Installers (exe / apk)

Built from `birdx` and copied to `release/downloads/`. Upload those files to the marketing server:

`/var/www/birdx-site/downloads/`

## Updates on the production VPS

Chat and marketing are deployed separately on the server:

```bash
# Chat (app.birdx.chat)
cd /opt/birdx && git pull && npm --prefix server install && npm --prefix client run build
systemctl restart birdx

# Marketing (birdx.chat) — path may vary; often a git clone + build → /var/www/birdx-site
```

Public self-hosters use `scripts/install.sh` (chat only, one domain).
