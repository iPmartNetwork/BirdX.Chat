const helpText = `
BirdX DB Commands

Core:
  npm run db:help
  npm run db:backup
  npm run db:restore -- -y
  npm run db:migrate
  npm run db:vacuum -- -y
  npm run db:inspect
  npm run db:chat:inspect
  npm run db:user:inspect
  npm run db:file:inspect

Reset/Delete:
  npm run db:reset -- -y
  npm run db:delete -- -y
  npm run db:chat:delete -- --all -y
  npm run db:user:delete -- --all -y
  npm run db:file:delete -- -y

Users:
  npm run db:user:create -- --nickname "BirdX Sage" --username birdx.sage --password "12345678"
  npm run db:user:create -- "BirdX Sage" birdx.sage "12345678"
  npm run db:user:generate -- --count=50 --password="12345678"
  npm run db:user:edit -- birdx.sage --nickname "BirdX Sage" --color "#ff6b6b"
  npm run db:user:ban -- birdx.sage -y

Chats:
  npm run db:chat:create -- --type group --name "Core Team" --owner birdx.sage --username core.team
  npm run db:chat:add -- core.team --all
  npm run db:chat:edit -- core.team --name "Core Team HQ" --owner birdx.sage2

Messages:
  npm run db:message:generate -- 1 birdx.sage birdx.sage2 300 7

Notes:
  - Use "--" before flags when running through npm.
  - Destructive/safety-sensitive commands support -y and --yes.
  - db:user:ban is a toggle: run it again to unban the user.
  - db:backup creates an encrypted zip containing .env and data/ (birdx.db).
  - db:restore accepts birdx-backup-*.zip and legacy songbird-backup-*.zip archives.
`;

console.log(helpText.trim());
