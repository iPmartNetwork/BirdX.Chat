import fs from 'node:fs'
import path from 'node:path'
import { LEGACY_DB_FILENAME, resolveDatabasePath } from '../lib/dataPaths.js'
import { dataDir, getCliArgs, hasForceYes, confirmAction } from './_cli.js'
import { runAdminActionViaServer } from './_db-admin.js'
const dbPath = resolveDatabasePath(dataDir, fs)
const legacyDbPath = path.join(dataDir, LEGACY_DB_FILENAME)
const uploadsDir = path.join(dataDir, 'uploads', 'messages')

const args = getCliArgs()
const hasForceFlag =
  hasForceYes(args) ||
  process.env.BIRDX_FORCE_DELETE === '1' ||
  process.env.SONGBIRD_FORCE_DELETE === '1'
const confirmed = await confirmAction({
  prompt: 'This will permanently delete database and uploaded message files. Continue?',
  force: hasForceFlag,
  forceHint: 'Refusing to delete database in non-interactive mode without -y/--yes. Run: npm run db:delete -- -y',
})
if (!confirmed) {
  console.log('Aborted.')
  process.exit(0)
}

const remoteResult = await runAdminActionViaServer('delete_db')
if (remoteResult) {
  console.log('Server mode: database content cleared while server is running.')
  console.log('Delete command completed.')
  process.exit(0)
}

let removedDb = false
let removedUploads = false

;[dbPath, legacyDbPath].forEach((targetPath) => {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { force: true })
    removedDb = true
  }
})

if (fs.existsSync(uploadsDir)) {
  fs.rmSync(uploadsDir, { recursive: true, force: true })
  removedUploads = true
}

console.log(`Data directory: ${dataDir}`)
console.log(`Database removed: ${removedDb ? 'yes' : 'no (not found)'}`)
console.log(`Message uploads removed: ${removedUploads ? 'yes' : 'no (not found)'}`)
console.log('Deletion complete. Start the server to recreate a fresh database.')
