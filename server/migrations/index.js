import { migration001InitialSchema } from "./001-initial-schema.js";
import { migration002LegacyChatRename } from "./002-legacy-chat-rename.js";
import { migration003MessageFiles } from "./003-message-files.js";
import { migration004MessageFileMetadata } from "./004-message-file-metadata.js";
import { migration005DmDefaultName } from "./005-dm-default-name.js";
import { migration006MessageFileExpiry } from "./006-message-file-expiry.js";
import { migration007MessageReplies } from "./007-message-replies.js";
import { migration008GroupInvites } from "./008-group-invites.js";
import { migration009GroupColor } from "./009-group-color.js";
import { migration010GroupSettings } from "./010-group-settings.js";
import { migration011ChatMutes } from "./011-chat-mutes.js";
import { migration012GroupRemovedMembers } from "./012-group-removed-members.js";
import { migration013MessageReads } from "./013-message-reads.js";
import { migration as migration014PushSubscriptions } from "./014-push-subscriptions.js";
import { migration015RemoveIdleStatus } from "./015-remove-idle-status.js";
import { migration016UserBans } from "./016-user-bans.js";
import { migration017MessageEditsAndHides } from "./017-message-edits-and-hides.js";
import { migration018MessageForwarding } from "./018-message-forwarding.js";
import { migration019MessageForwardOriginUsers } from "./019-message-forward-origin-users.js";
import { migration020ChatMessageExpiry } from "./020-chat-message-expiry.js";
import { migration021ChatQueryIndexes } from "./021-chat-query-indexes.js";
import { migration022MessageClientRequestId } from "./022-message-client-request-id.js";
import { migration023ChatLeftMembers } from "./023-chat-left-members.js";
import * as migration024MessageReactions from "./024-message-reactions.js";
import { migration025AdminPanel } from "./025-admin-panel.js";
import { migration026AdminSecurity } from "./026-admin-security.js";
import { migration027SecurityEvents } from "./027-security-events.js";
import { migration028CallLogs } from "./028-call-logs.js";
import { migration029RemoteChannelQueue } from "./029-remote-channel-queue.js";
import { migration030RequiredChannels } from "./030-required-channels.js";
import { migration031UserUploadPolicy } from "./031-user-upload-policy.js";
import { migration032E2eeKeys } from "./032-e2ee-keys.js";
import { migration033DmPrivacy } from "./033-dm-privacy.js";
import { migration034UserChatSettings } from "./034-user-chat-settings.js";
import { migration035UserNotificationPrefs } from "./035-user-notification-prefs.js";
import { migration036V2Platform } from "./036-v2-platform.js";
import { migration037UserContacts } from "./037-user-contacts.js";
import { migration038ContactRequestPolicy } from "./038-contact-request-policy.js";
import { migration039MessagePolls } from "./039-message-polls.js";
import { migration040BirdxchatOwner } from "./040-birdxchat-owner.js";
import { migration041UserTotp } from "./041-user-totp.js";
import { migration042MessageReports } from "./042-message-reports.js";
import { migration043DeviceTokens } from "./043-device-tokens.js";
import { migration044MessagePinning } from "./044-message-pinning.js";
import { migration045MessageThreads } from "./045-message-threads.js";
import { migration046Stories } from "./046-stories.js";
import { migration047ChatFolders } from "./047-chat-folders.js";
import { migration048AnonymousAdmin } from "./048-anonymous-admin.js";
import { migration049ChatWallpaper } from "./049-chat-wallpaper.js";

export const migrations = [
  migration001InitialSchema,
  migration002LegacyChatRename,
  migration003MessageFiles,
  migration004MessageFileMetadata,
  migration005DmDefaultName,
  migration006MessageFileExpiry,
  migration007MessageReplies,
  migration008GroupInvites,
  migration009GroupColor,
  migration010GroupSettings,
  migration011ChatMutes,
  migration012GroupRemovedMembers,
  migration013MessageReads,
  migration014PushSubscriptions,
  migration015RemoveIdleStatus,
  migration016UserBans,
  migration017MessageEditsAndHides,
  migration018MessageForwarding,
  migration019MessageForwardOriginUsers,
  migration020ChatMessageExpiry,
  migration021ChatQueryIndexes,
  migration022MessageClientRequestId,
  migration023ChatLeftMembers,
  migration024MessageReactions,
  migration025AdminPanel,
  migration026AdminSecurity,
  migration027SecurityEvents,
  migration028CallLogs,
  migration029RemoteChannelQueue,
  migration030RequiredChannels,
  migration031UserUploadPolicy,
  migration032E2eeKeys,
  migration033DmPrivacy,
  migration034UserChatSettings,
  migration035UserNotificationPrefs,
  migration036V2Platform,
  migration037UserContacts,
  migration038ContactRequestPolicy,
  migration039MessagePolls,
  migration040BirdxchatOwner,
  migration041UserTotp,
  migration042MessageReports,
  migration043DeviceTokens,
  migration044MessagePinning,
  migration045MessageThreads,
  migration046Stories,
  migration047ChatFolders,
  migration048AnonymousAdmin,
  migration049ChatWallpaper,
];
