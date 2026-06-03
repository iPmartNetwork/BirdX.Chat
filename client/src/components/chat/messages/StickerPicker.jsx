import { Close } from "../../../icons/lucide.js";
import { DEFAULT_STICKER_PACK } from "../../../utils/stickers.js";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";

export default function StickerPicker({ open, onClose, onSelect }) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <div className="absolute bottom-full start-0 z-30 mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-emerald-200/80 bg-white p-3 shadow-xl dark:border-emerald-500/25 dark:bg-slate-950">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">
          {t("chat.stickers.title")}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Close"
        >
          <Close size={14} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {DEFAULT_STICKER_PACK.stickers.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            title={sticker.label}
            onClick={() => {
              onSelect?.(DEFAULT_STICKER_PACK.id, sticker.id);
              onClose?.();
            }}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-emerald-100/80 bg-emerald-50/50 text-2xl transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10"
          >
            {sticker.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
