import { getAvatarInitials } from "../../utils/avatarInitials.js";
import { Mic, MicOff, PhoneOff, Video } from "../../icons/lucide.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

function ParticipantTile({ participant, isVideoCall, isLocal, compact = false }) {
  const name = participant?.name || "Participant";
  const stream = participant?.stream;
  const hasVideo =
    isVideoCall &&
    stream?.getVideoTracks?.().some((track) => track.readyState === "live");
  const avatarSize = compact ? "h-11 w-11 text-sm" : "h-16 w-16 text-xl";
  const minHeight = compact ? "min-h-[96px]" : "min-h-[140px]";

  return (
    <div
      className={`relative flex ${minHeight} flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-lg`}
    >
      {hasVideo ? (
        <video
          autoPlay
          playsInline
          muted={isLocal}
          ref={(node) => {
            if (node && stream && node.srcObject !== stream) {
              node.srcObject = stream;
            }
          }}
          className={`absolute inset-0 h-full w-full object-cover ${isLocal ? "scale-x-[-1]" : ""}`}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
          <div
            className={`birdx-accent-icon flex items-center justify-center rounded-full font-bold text-white ${avatarSize}`}
          >
            {getAvatarInitials(name)}
          </div>
        </div>
      )}
      <div className="relative mt-auto bg-gradient-to-t from-black/75 to-transparent px-3 py-2">
        <p className="truncate text-xs font-semibold text-white">
          {isLocal ? t("call.group.you") : name}
        </p>
      </div>
    </div>
  );
}

function resolveGridClass(tileCount) {
  if (tileCount <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (tileCount <= 4) return "grid-cols-2";
  if (tileCount <= 9) return "grid-cols-2 sm:grid-cols-3";
  if (tileCount <= 16) return "grid-cols-3 sm:grid-cols-4";
  return "grid-cols-4 sm:grid-cols-5";
}

export default function GroupCallOverlay({
  callState,
  participants = [],
  localStream,
  callStatusLabel,
  callDurationLabel,
  callMuted,
  callIsVideo,
  participantCount = 0,
  maxParticipants = 20,
  onToggleMute,
  onToggleVideo,
  onEndCall,
}) {
  const { t } = useLanguage();
  const tiles = [
    {
      id: "local",
      name: t("call.group.you"),
      stream: localStream,
      isLocal: true,
    },
    ...participants.map((participant) => ({
      id: participant.socketId,
      name: participant.name || "Participant",
      stream: participant.stream,
      isLocal: false,
    })),
  ];

  const gridClass = resolveGridClass(tiles.length);
  const compactTiles = tiles.length > 6;
  const countLabel = t("call.group.participants")
    .replace("{count}", String(participantCount || tiles.length))
    .replace("{max}", String(maxParticipants));

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-slate-950 text-white">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-lg font-bold">{t("call.group.title")}</h2>
        <p className="text-xs font-semibold text-slate-300">
          {callStatusLabel}
          {callDurationLabel ? ` · ${callDurationLabel}` : ""}
          {callState?.status === "connected" ? (
            <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          ) : null}
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-400">{countLabel}</p>
      </div>

      <div className={`grid flex-1 gap-2 overflow-y-auto p-3 sm:gap-3 sm:p-4 ${gridClass}`}>
        {tiles.map((tile) => (
          <ParticipantTile
            key={tile.id}
            participant={tile}
            isVideoCall={callIsVideo}
            isLocal={tile.isLocal}
            compact={compactTiles}
          />
        ))}
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="mx-auto flex max-w-md items-center justify-center gap-3">
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 transition hover:bg-white/20"
            aria-label={callMuted ? "Unmute" : "Mute"}
          >
            {callMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          {callIsVideo ? (
            <button
              type="button"
              onClick={onToggleVideo}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 transition hover:bg-white/20"
              aria-label="Toggle camera"
            >
              <Video size={20} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onEndCall}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500 transition hover:bg-rose-400"
            aria-label="End call"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
