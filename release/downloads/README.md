# Release artifacts (local build output)

After `npm run build:desktop` or `npm run build:android`, installers are copied here:

- `birdx-setup.exe`
- `birdx.apk`

Upload to the **marketing** server (separate repo):

`/var/www/birdx-site/downloads/`

These files are not committed to BirdX.Chat (large binaries).
