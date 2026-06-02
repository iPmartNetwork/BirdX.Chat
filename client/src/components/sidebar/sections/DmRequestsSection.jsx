import Avatar from "../../common/Avatar.jsx";
import { getAvatarInitials } from "../../../utils/avatarInitials.js";
import { hasPersian } from "../../../utils/fontUtils.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";

export default function DmRequestsSection({
  requests,
  loading,
  onAccept,
  onReject,
  onOpenRequest,
}) {
  const { t } = useLanguage();
  if (!loading && (!Array.isArray(requests) || requests.length === 0)) {
    return null;
  }

  return (
    <div className="mb-3 space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
        {t("chat.dmRequests")}
      </p>
      {loading ? (
        <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
          {t("chat.searching")}
        </p>
      ) : null}
      {(requests || []).map((request) => {
        const from = request.from || {};
        const label = from.nickname || from.username || "?";
        const initials = getAvatarInitials(label);
        return (
          <div
            key={`dm-request-${request.chatId}`}
            className="rounded-2xl border border-emerald-100/80 bg-white/90 p-3 dark:border-emerald-500/25 dark:bg-slate-950/70"
          >
            <button
              type="button"
              onClick={() => onOpenRequest?.(request)}
              className="flex w-full items-center gap-3 text-start"
            >
              <Avatar
                src={from.avatarUrl}
                alt={label}
                name={label}
                color={from.color || "#10b981"}
                initials={initials}
                className="h-9 w-9 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-semibold text-slate-800 dark:text-slate-100 ${hasPersian(label) ? "font-fa" : ""}`}
                  dir="auto"
                >
                  {label}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                  @{from.username}
                </p>
                {request.previewBody ? (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                    {request.previewBody}
                  </p>
                ) : null}
              </div>
            </button>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onAccept?.(request)}
                className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
              >
                {t("chat.dmRequestAccept")}
              </button>
              <button
                type="button"
                onClick={() => onReject?.(request)}
                className="flex-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
              >
                {t("chat.dmRequestReject")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
