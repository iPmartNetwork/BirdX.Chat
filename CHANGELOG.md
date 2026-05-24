# Changelog

All notable changes to BirdX are documented in this file.

## v2.5.3-rc2 - 2026-05-20

### Added

- Added End-to-End Encryption (E2EE) foundation for DM chats using X3DH key agreement and AES-256-GCM symmetric encryption.
- Added E2EE key generation, upload, and bundle fetch API endpoints (`/api/e2ee/keys/*`).
- Added database migration `031-e2ee-keys` for identity keys, signed prekeys, one-time prekeys, and session storage.
- Added client-side E2EE crypto module with ECDH P-256 key exchange, HKDF key derivation, and AES-256-GCM message encryption.
- Added client-side E2EE key store using a dedicated IndexedDB database (`birdx-e2ee-keys`).
- Added `useE2ee` hook for automatic session establishment, message encryption/decryption, and prekey replenishment.
- Added green lock indicator in the chat header when E2EE is active between both DM participants.
- Added automatic E2EE message decryption for incoming messages via SSE events.

### Changed

- Messages in E2EE-enabled DM chats are encrypted client-side before sending; the server only stores ciphertext.
- Bumped service-worker cache version to `v2.5.3-rc2`.

## v2.5.3-rc1 - 2026-05-20

### Added

- Added draggable minimized call card so users can reposition the floating call widget by touch or mouse drag.

### Fixed

- Fixed API rate limiter not being applied in production due to incorrect middleware ordering (registered after routes instead of before).
- Fixed channel posting permissions to allow owner, admin, and moderator roles to send messages, matching the documented behavior from v2.4.2.
- Fixed message reactions not appearing in real-time for other chat participants without a page refresh.
- Fixed install bar not hiding on mobile when opening a chat due to event name mismatch between `ChatPage` and `App` (`songbird-*` vs `birdx-*`).
- Fixed push notification click not opening the correct chat due to `OPEN_CHAT_ID_KEY` mismatch between `App.jsx` and `chatPageConstants.js`.
- Fixed `socket.io` missing from `server/package.json` dependencies (was only in root).

### Changed

- Added Socket.IO session authentication middleware so only authenticated users can connect to the call signaling service.
- Restricted Socket.IO CORS to same-origin in production mode for improved security.
- Updated `NOTIFICATIONS_ENABLED_KEY` and `OPEN_CHAT_ID_KEY` constants to use `birdx-` prefix.
- Bumped app, server, client, service-worker cache, and documentation versions to `2.5.3-rc1`.

## v2.5.2 - 2026-05-18

### Added

- Added minimized call mode with a wider floating call card.
- Added compact video-call controls for microphone, camera, camera switching, device selection, reconnect, and desktop screen sharing.
- Added automatic video-call control hiding after 3 seconds with tap or click to reveal.
- Added connection quality feedback for active calls.

### Changed

- Refined video-call toolbar styling and hid screen sharing on mobile.
- Improved active-call cleanup and recovery for camera, screen share, and ICE reconnect handling.
- Bumped app, server, client, service-worker cache, and documentation versions to `2.5.2`.

## v2.5.1 - 2026-05-18

### Added

- Added the first multilingual interface foundation with English and Persian language support.
- Added a Language settings panel that persists the selected language on each device.
- Added global `lang` and `dir` handling so Persian switches the app shell into RTL layout.

### Changed

- Localized the Settings, Data, Language, Notifications, and About surfaces as the first translated UI pass.
- Bumped app, server, client, service-worker cache, and documentation versions to `2.5.1`.

## v2.5.0 - 2026-05-09

### Added

- Started the call experience upgrade with persistent call history foundations.
- Added database migration `028-call-logs` for call logs and call participants.
- Added `GET /api/chats/:chatId/calls` for per-chat call history.
- Added a Call history section to chat profiles.
- Ported Songbird `v0.10.0` Remote Channel foundations with Telegram source settings for channels.
- Added database migration `029-remote-channel-queue` for remote channel sources and queue state.

### Changed

- Voice-call socket events now record started, accepted, rejected, ended, and disconnect-timeout call outcomes.
- Adopted Songbird `v0.9.2`/`v0.10.0` compatibility updates for invite token generation and remote-channel message ownership.

## v2.4.2 - 2026-05-09

### Added

- Added owner-controlled group/channel role management from the chat profile member list.
- Added `owner`, `admin`, `moderator`, and `member` role selection for group/channel members.
- Added a call resume signal and server-side disconnect grace period so brief mobile screen-lock or background reconnects do not immediately end active calls.
- Added best-effort Screen Wake Lock support while a voice call is active.

### Changed

- Channel posting permissions now include group/channel owners, admins, and moderators.
- Voice calls now try to reacquire wake lock and replay remote audio after page focus, pageshow, or visibility changes.

### Fixed

- Fixed a white-screen crash risk when opening group/channel chats with incomplete or non-array member payloads after the role-management UI was added.
- Fixed stale cached chat payloads by normalizing chat IDs, member lists, and member roles before rendering group/channel conversations.
- Fixed group/channel edit opening by loading the edit modal with the main chat page instead of a separate lazy chunk, and added a local modal error boundary so editor failures do not blank the whole app.
- Fixed group/channel profile opening by loading the profile modal with the main chat page instead of a separate lazy chunk, preventing a stale modal chunk from blanking the app when tapping a group/channel name.
- Hardened the group/channel edit click handler and modal props so stale or partially migrated chat state cannot crash the chat page while opening the editor.
- Rebuilt the production client bundle and bumped the service-worker cache version so deployed/PWA clients stop serving the older broken group/channel editor assets.
- Reduced cases where mobile voice calls immediately end when the browser socket briefly disconnects.

## v2.4.0 - 2026-05-09

### Added

- Added an Admin Panel Monitor tab with CPU, memory, disk, runtime, database, upload, backup, push, TURN, and storage-encryption health data.
- Added security event logging for failed and banned login attempts.
- Added Admin Panel security summary cards for failed logins, banned logins, failed admin re-authentication, sensitive actions, active admin sessions, top source IPs, recent security events, and recent sensitive actions.
- Added group/channel detail administration from the Admin Panel, including visibility, public username, invite-link settings, member listing, member add/remove, and member role management.
- Added database migration `027-security-events` for persistent security event tracking.

### Changed

- Expanded chat filtering with public/private visibility filters in the Admin Panel.

### Fixed

- Finished wiring the Admin Panel Monitor and group/channel detail UI to the new admin API routes.

## v2.3.0 - 2026-05-09

### Added

- Added multi-level admin roles: owner, admin, moderator, support, and user.
- Added permission checks for sensitive admin API routes.
- Added admin password re-authentication before role changes, bans, password resets, session revokes, destructive deletes, and backup operations.
- Added session IP address and user-agent tracking for new logins.
- Added audit log IP address, user-agent, and success/failure tracking.
- Added active session device/network details in the admin user detail drawer.

### Changed

- Promoted `ADMIN_USERNAMES` bootstrap accounts to owner-level access.
- Hardened Admin Panel actions so the UI sends password confirmation with sensitive requests.
- Updated Admin Panel role filters and role selectors for the expanded role model.

### Fixed

- Fixed a remaining Admin Panel 500 risk by including `ACCOUNT_CREATION` in the admin settings route dependencies.

## v2.2.0 - 2026-05-08

### Added

- Added advanced admin pagination and filtering for users, chats, files, and audit logs.
- Added user detail drawer with profile metadata, statistics, recent chats, files, and active sessions.
- Added session management for admins, including revoking one session or logging out all sessions for a user.
- Added professional action confirmation modals for destructive and sensitive admin actions.
- Added database backup creation, listing, download, and deletion from the admin maintenance tab.
- Added stronger admin audit filters by action, actor, and target type.

### Changed

- Redesigned the Admin Panel into a more production-oriented workspace.
- Replaced browser prompt/confirm flows with in-app modal workflows.
- Improved admin list APIs with server-side pagination, sorting, and filtering.

## v2.1.0 - 2026-05-08

### Added

- Added the first BirdX Admin Panel at `/admin`.
- Added admin/user roles with database migration support.
- Added secure session-based `/api/admin/*` endpoints.
- Added admin dashboard metrics for users, chats, messages, files, sessions, and storage usage.
- Added user management for role changes, bans, password resets, and deletion.
- Added chat management with search, type filtering, and deletion.
- Added uploaded file management with owner, size, type, and deletion controls.
- Added admin audit logs for sensitive actions.
- Added `ADMIN_USERNAMES` bootstrap support in `.env.example`.
- Added an Admin Panel entry in settings for admin users.

## v2.0.0 - 2026-05-07

### Added

- Added WebRTC voice calls for direct messages.
- Added Socket.IO call signaling for call start, accept, reject, end, offer, answer, and ICE candidate events.
- Added TURN/STUN configuration through environment variables for more reliable mobile audio.
- Added a redesigned professional call screen with call state, duration, mute, audio retry, accept, reject, and end controls.
- Added incoming call ringtone while the web app is open.
- Added incoming call push notifications for installed/running PWA clients.
- Added notification click routing to open the related chat.
- Added Android PWA install fallback flow and improved install guide text.
- Added complete message reaction toggling with server persistence and live updates.
- Added reaction hydration when loading messages.
- Added `.env.example` TURN variables.

### Changed

- Improved call room joining so users can receive call signaling even when they are not currently viewing that chat.
- Improved remote audio playback handling for mobile browsers and autoplay restrictions.
- Improved service worker cache versioning and cache cleanup.
- Improved PWA manifest metadata for Android installation.
- Updated the README for the 2.0.0 release.

### Fixed

- Fixed post/message reactions not being applied or displayed after selecting an emoji.
- Fixed missing reaction data in loaded message payloads.
- Fixed several call edge cases where signaling could be missed by users outside the active chat view.
- Fixed PWA installation reliability issues on some Android browsers.

## v1.0.0

- Initial BirdX release.
- Forked from Songbird.
- Added BirdX branding and authentication UI updates.
- Added install script.
