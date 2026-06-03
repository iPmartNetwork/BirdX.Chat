import { LayoutDashboard, Settings } from "../../../icons/lucide.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import Avatar from "../../common/Avatar.jsx";
import { hasPersian } from "../../../utils/fontUtils.js";
import { userHasAdminAccess } from "../../../utils/adminAccess.js";

export default function SidebarFooter({
  user,
  displayName,
  displayInitials,
  statusDotClass,
  statusValue,
  userColor,
  onOpenSettings,
  onOpenOwnProfile,
  onOpenAdmin,
  showAdminPanel = false,
  settingsButtonRef,
}) {
  const { t } = useLanguage();
  const adminAccess = showAdminPanel || userHasAdminAccess(user);
  const roleLabel = String(user?.role || "").toLowerCase();
  const showRoleBadge =
    adminAccess && ["owner", "admin", "moderator", "support"].includes(roleLabel);

  return (
    <div className="hidden h-[88px] border-t border-slate-300/80 bg-white px-6 py-4 dark:border-emerald-500/20 dark:bg-slate-900 md:absolute md:bottom-0 md:left-0 md:right-0 md:block">
      <div className="flex h-full items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenOwnProfile}
          className="group min-w-0 flex-1 flex items-center gap-3 text-left"
        >
          <Avatar
            src={user.avatarUrl}
            alt={displayName}
            name={displayName}
            color={userColor}
            initials={displayInitials}
            className="h-10 w-10 transition group-hover:ring-2 group-hover:ring-emerald-300"
          />
          <div className="min-w-0">
            <p
              className={`truncate text-sm font-semibold text-emerald-700 transition group-hover:text-emerald-600 dark:text-emerald-200 dark:group-hover:text-emerald-300 ${hasPersian(displayName) ? "font-fa" : ""}`}
              dir="auto"
              style={{ unicodeBidi: "plaintext" }}
              title={displayName}
            >
              {displayName}
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass}`} />
              <span
                className={`truncate ${hasPersian(statusValue) ? "font-fa sb-fa-baseline-fix" : ""}`}
                dir="auto"
                style={{ unicodeBidi: "plaintext" }}
              >
                {statusValue}
              </span>
              {showRoleBadge ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                  {roleLabel}
                </span>
              ) : null}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {adminAccess ? (
            <button
              type="button"
              onClick={() => onOpenAdmin?.()}
              className="flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 p-2 text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
              aria-label={t("settings.adminPanel")}
              title={t("settings.adminPanel")}
            >
              <LayoutDashboard size={18} className="icon-anim-sway" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center justify-center rounded-full border border-emerald-200 bg-white/80 p-2 text-emerald-700 transition hover:border-emerald-300 hover:birdx-accent-glow-shadow dark:border-emerald-500/30 dark:bg-slate-950 dark:text-emerald-200"
            aria-label="Open settings"
            ref={settingsButtonRef}
          >
            <Settings size={18} className="icon-anim-spin-dir" />
          </button>
        </div>
      </div>
    </div>
  );
}
