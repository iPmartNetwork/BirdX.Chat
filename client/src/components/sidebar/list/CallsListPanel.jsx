import { useMemo, useState } from "react";
import Avatar from "../../common/Avatar.jsx";
import {
  ArrowDownLeft,
  ArrowUpRight,
  LoaderCircle,
  Phone,
  PhoneMissed,
  Search,
  Users,
  Video,
  Close,
} from "../../../icons/lucide.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";

function formatCallDuration(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  if (!total) return "";
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}:${String(remMins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatCallListTime(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(locale === "fa" ? "fa-IR" : undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(locale === "fa" ? "fa-IR" : undefined, {
    month: "short",
    day: "numeric",
  });
}

function DirectionIcon({ direction, callType }) {
  const isVideo = String(callType || "").toLowerCase() === "video";
  const Icon = direction === "missed" ? PhoneMissed : isVideo ? Video : Phone;
  const colorClass =
    direction === "missed"
      ? "text-rose-500 dark:text-rose-300"
      : direction === "outgoing"
        ? "text-sky-600 dark:text-sky-300"
        : "text-emerald-600 dark:text-emerald-300";
  return (
    <span className={`inline-flex items-center gap-0.5 ${colorClass}`}>
      {direction === "outgoing" ? (
        <ArrowUpRight size={12} className="shrink-0" />
      ) : (
        <ArrowDownLeft size={12} className="shrink-0" />
      )}
      <Icon size={13} className="shrink-0" />
    </span>
  );
}

function CallActionButtons({ chatId, call, onStartVoiceCall, onStartVideoCall, t }) {
  return (
    <div className="flex shrink-0 items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100">
      <button
        type="button"
        onClick={() => onStartVoiceCall?.(chatId, call)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
        aria-label={t("calls.callVoice")}
      >
        <Phone size={16} />
      </button>
      <button
        type="button"
        onClick={() => onStartVideoCall?.(chatId, call)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
        aria-label={t("calls.callVideo")}
      >
        <Video size={16} />
      </button>
    </div>
  );
}

function RecentCallsList({ calls, language, t, onOpenCall, onStartVoiceCall, onStartVideoCall }) {
  if (!calls.length) {
    return (
      <div className="rounded-2xl border border-dashed border-emerald-200 px-4 py-8 text-center dark:border-emerald-500/30">
        <Phone className="mx-auto mb-2 h-7 w-7 text-emerald-500/70" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t("calls.emptyTitle")}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t("calls.emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {calls.map((call) => {
        const chatId = Number(call?.chatId || 0);
        const isVideo = String(call?.type || "").toLowerCase() === "video";
        const direction = String(call?.direction || "incoming");
        const duration = formatCallDuration(call?.durationSeconds);
        const peer = call?.displayPeer;
        const isGroup =
          String(call?.chatType || "").toLowerCase() === "group" ||
          String(call?.chatType || "").toLowerCase() === "channel";
        const avatarSrc = isGroup
          ? call?.chatAvatarUrl || ""
          : peer?.avatar_url || "";
        const avatarColor = isGroup
          ? call?.chatColor || "var(--birdx-accent)"
          : peer?.color || "var(--birdx-accent)";
        const avatarName = call?.displayName || t("chat.unnamed");
        const directionLabel =
          direction === "outgoing"
            ? t("calls.outgoing")
            : direction === "missed"
              ? t("calls.missed")
              : t("calls.incoming");
        const typeLabel = isVideo ? t("calls.video") : t("calls.voice");
        const subtitle = [directionLabel, typeLabel, duration].filter(Boolean).join(" · ");

        return (
          <li key={`call-${call?.id}`}>
            <div className="group flex items-center gap-3 rounded-2xl border border-transparent px-2 py-2 transition hover:border-emerald-200/80 hover:bg-emerald-50/60 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/5">
              <button
                type="button"
                onClick={() => onOpenCall?.(call)}
                className="flex min-w-0 flex-1 items-center gap-3 text-start"
              >
                <Avatar
                  src={avatarSrc}
                  name={avatarName}
                  color={avatarColor}
                  className="h-12 w-12 shrink-0 text-sm font-bold"
                  useAccentColor={!avatarSrc}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                      {avatarName}
                    </p>
                    <span className="shrink-0 text-[11px] font-medium text-slate-400">
                      {formatCallListTime(call?.startedAt, language)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <DirectionIcon direction={direction} callType={call?.type} />
                    <span className="truncate">{subtitle}</span>
                  </div>
                </div>
              </button>
              <CallActionButtons
                chatId={chatId}
                call={call}
                onStartVoiceCall={onStartVoiceCall}
                onStartVideoCall={onStartVideoCall}
                t={t}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ContactsList({
  contacts,
  contactsQuery,
  loading = false,
  t,
  onOpenContact,
  onStartVoiceCall,
  onStartVideoCall,
}) {
  if (loading && !contacts.length) {
    return (
      <div className="flex justify-center py-8">
        <LoaderCircle className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }
  if (!contacts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-emerald-200 px-4 py-8 text-center dark:border-emerald-500/30">
        <Users className="mx-auto mb-2 h-7 w-7 text-emerald-500/70" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {contactsQuery ? t("calls.contactsNoResults") : t("calls.contactsEmpty")}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t("calls.contactsHint")}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {contacts.map((contact) => {
        const chatId = Number(contact?.chatId || 0);
        const isOnline = String(contact?.status || "").toLowerCase() === "online";
        const isInCall = Boolean(contact?.inCall);
        const displayName = contact?.nickname || contact?.username || t("chat.unnamed");

        return (
          <li key={`contact-${contact?.username || contact?.id}`}>
            <div className="group flex items-center gap-3 rounded-2xl border border-transparent px-2 py-2 transition hover:border-emerald-200/80 hover:bg-emerald-50/60 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/5">
              <button
                type="button"
                onClick={() => onOpenContact?.(contact)}
                className="flex min-w-0 flex-1 items-center gap-3 text-start"
              >
                <div className="relative shrink-0">
                  <Avatar
                    src={contact?.avatar_url || ""}
                    name={displayName}
                    color={contact?.color || "var(--birdx-accent)"}
                    className="h-12 w-12 text-sm font-bold"
                    useAccentColor={!contact?.avatar_url}
                  />
                  <span
                    className={`absolute bottom-0 end-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                      isInCall
                        ? "bg-sky-400"
                        : isOnline
                          ? "bg-emerald-400"
                          : "bg-slate-300 dark:bg-slate-600"
                    }`}
                    aria-hidden="true"
                  />
                  {isInCall ? (
                    <span className="absolute -top-1 -end-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-white">
                      <Phone size={10} />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                    {displayName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    @{contact?.username}
                    <span className="mx-1">·</span>
                    {isInCall ? t("calls.inCall") : isOnline ? t("chat.online") : t("calls.offline")}
                  </p>
                </div>
              </button>
              <CallActionButtons
                chatId={chatId}
                call={{ chatId }}
                onStartVoiceCall={onStartVoiceCall}
                onStartVideoCall={onStartVideoCall}
                t={t}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function OutgoingRequestsBlock({ requests, t, onCancel, onOpen }) {
  if (!requests?.length) return null;
  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t("contacts.outgoing")}
      </p>
      {requests.map((request) => {
        const to = request.to || {};
        const label = to.nickname || to.username || "?";
        return (
          <div
            key={`outgoing-contact-${request.id}`}
            className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-600/40 dark:bg-slate-950/70"
          >
            <button
              type="button"
              onClick={() => onOpen?.(request)}
              className="flex w-full items-center gap-3 text-start"
            >
              <Avatar
                src={to.avatar_url}
                name={label}
                color={to.color || "var(--birdx-accent)"}
                className="h-9 w-9 shrink-0"
                useAccentColor={!to.avatar_url}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {label}
                </p>
                <p className="truncate text-xs text-slate-500" dir="ltr">
                  @{to.username}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onCancel?.(request)}
              className="mt-2 w-full rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:text-rose-200"
            >
              {t("contacts.banner.cancel")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ContactRequestsBlock({
  requests,
  loading,
  t,
  onAccept,
  onReject,
  onOpen,
}) {
  if (!loading && (!requests?.length)) return null;
  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
        {t("contacts.requests")}
      </p>
      {loading ? (
        <p className="px-1 text-xs text-slate-500">{t("calls.loading")}</p>
      ) : null}
      {(requests || []).map((request) => {
        const from = request.from || {};
        const label = from.nickname || from.username || "?";
        return (
          <div
            key={`contact-request-${request.id}`}
            className="rounded-2xl border border-emerald-100/80 bg-white/90 p-3 dark:border-emerald-500/25 dark:bg-slate-950/70"
          >
            <button
              type="button"
              onClick={() => onOpen?.(request)}
              className="flex w-full items-center gap-3 text-start"
            >
              <Avatar
                src={from.avatar_url}
                name={label}
                color={from.color || "var(--birdx-accent)"}
                className="h-9 w-9 shrink-0"
                useAccentColor={!from.avatar_url}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {label}
                </p>
                <p className="truncate text-xs text-slate-500" dir="ltr">
                  @{from.username}
                </p>
              </div>
            </button>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onAccept?.(request)}
                className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
              >
                {t("contacts.accept")}
              </button>
              <button
                type="button"
                onClick={() => onReject?.(request)}
                className="flex-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:text-rose-200"
              >
                {t("contacts.decline")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CallsListPanel({
  loading = false,
  loadingContacts = false,
  calls = [],
  contacts = [],
  contactRequests = [],
  outgoingContactRequests = [],
  loadingContactRequests = false,
  onOpenCall,
  onOpenContact,
  onStartVoiceCall,
  onStartVideoCall,
  onAcceptContactRequest,
  onRejectContactRequest,
  onCancelContactRequest,
  onOpenContactRequest,
  onOpenOutgoingContactRequest,
}) {
  const { t, language } = useLanguage();
  const [section, setSection] = useState("recent");
  const [contactsQuery, setContactsQuery] = useState("");

  const filteredContacts = useMemo(() => {
    const query = String(contactsQuery || "").trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => {
      const nickname = String(contact?.nickname || "").toLowerCase();
      const username = String(contact?.username || "").toLowerCase();
      return nickname.includes(query) || username.includes(query);
    });
  }, [contacts, contactsQuery]);

  const tabClass = (active) =>
    `flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
      active
        ? "bg-emerald-500 text-white shadow-sm"
        : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
    }`;

  if (loading && section === "recent" && !calls.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400">
        <LoaderCircle className="h-6 w-6 animate-spin text-emerald-500" />
        {t("calls.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-2xl border border-emerald-200/80 bg-white/80 p-1 dark:border-emerald-500/25 dark:bg-slate-950/60">
        <button type="button" className={tabClass(section === "recent")} onClick={() => setSection("recent")}>
          {t("calls.recent")}
        </button>
        <button
          type="button"
          className={tabClass(section === "contacts")}
          onClick={() => setSection("contacts")}
        >
          {t("calls.contacts")}
          {contacts.length ? (
            <span className="ms-1 opacity-80">({contacts.length})</span>
          ) : null}
        </button>
      </div>

      {section === "contacts" ? (
        <>
          <ContactRequestsBlock
            requests={contactRequests}
            loading={loadingContactRequests}
            t={t}
            onAccept={onAcceptContactRequest}
            onReject={onRejectContactRequest}
            onOpen={onOpenContactRequest}
          />
          <OutgoingRequestsBlock
            requests={outgoingContactRequests}
            t={t}
            onCancel={onCancelContactRequest}
            onOpen={onOpenOutgoingContactRequest}
          />
          <label className="relative block">
            <Search
              size={14}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-300"
            />
            <input
              value={contactsQuery}
              onChange={(event) => setContactsQuery(event.target.value)}
              placeholder={t("calls.searchContacts")}
              className="h-10 w-full rounded-2xl border border-emerald-200 bg-white ps-9 pe-9 text-sm outline-none focus:border-emerald-400 dark:border-emerald-500/30 dark:bg-slate-900"
            />
            {contactsQuery ? (
              <button
                type="button"
                onClick={() => setContactsQuery("")}
                className="absolute end-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                aria-label={t("calls.clearSearch")}
              >
                <Close size={14} />
              </button>
            ) : null}
          </label>
          <ContactsList
            contacts={filteredContacts}
            contactsQuery={contactsQuery}
            loading={loadingContacts}
            t={t}
            onOpenContact={onOpenContact}
            onStartVoiceCall={onStartVoiceCall}
            onStartVideoCall={onStartVideoCall}
          />
        </>
      ) : (
        <RecentCallsList
          calls={calls}
          language={language}
          t={t}
          onOpenCall={onOpenCall}
          onStartVoiceCall={onStartVoiceCall}
          onStartVideoCall={onStartVideoCall}
        />
      )}
    </div>
  );
}
