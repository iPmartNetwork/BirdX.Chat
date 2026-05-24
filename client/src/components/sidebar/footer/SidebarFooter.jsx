import { Settings } from "../../../icons/lucide.js";
import Avatar from "../../common/Avatar.jsx";
import { hasPersian } from "../../../utils/fontUtils.js";

export default function SidebarFooter({
  user,
  displayName,
  displayInitials,
  statusDotClass,
  statusValue,
  userColor,
  onOpenSettings,
  onOpenOwnProfile,
  settingsButtonRef,
}) {
  return (
    <div className="hidden h-[88px] border-t border-slate-300/80 bg-white px-6 py-4 dark:border-primary-500/20 dark:bg-slate-900 md:absolute md:bottom-0 md:left-0 md:right-0 md:block">
      <div className="flex h-full items-center justify-between">
        <button
          type="button"
          onClick={onOpenOwnProfile}
          className="group flex items-center gap-3 text-left"
        >
          <Avatar
            src={user.avatarUrl}
            alt={displayName}
            name={displayName}
            color={userColor}
            initials={displayInitials}
            className="h-10 w-10 transition group-hover:ring-2 group-hover:ring-primary-300"
          />
          <div className="min-w-0">
            <p
              className={`truncate text-sm font-semibold text-primary-700 transition group-hover:text-primary-600 dark:text-primary-200 dark:group-hover:text-primary-300 ${hasPersian(displayName) ? "font-fa" : ""}`}
              dir="auto"
              style={{ unicodeBidi: "plaintext" }}
              title={displayName}
            >
              {displayName}
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
              {statusValue}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center justify-center rounded-full border border-primary-200 bg-white/80 p-2 text-primary-700 transition hover:border-primary-300 hover:shadow-[0_0_16px_rgba(59,130,246,0.22)] dark:border-primary-500/30 dark:bg-slate-950 dark:text-primary-200"
          aria-label="Open settings"
          ref={settingsButtonRef}
        >
          <Settings size={18} className="icon-anim-spin-dir" />
        </button>
      </div>
    </div>
  );
}
