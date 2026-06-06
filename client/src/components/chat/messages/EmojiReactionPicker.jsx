import { useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const EMOJI_CATEGORIES = [
  { label: "Smileys", emojis: ["😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","🥰","😘","😗","😙","😚","🙂","🤗","🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","🥱","😴","😌","😛","😜","🤪","😝","🤑","🤭","🤫","🤥","😬","😲","🙃","😇","🥲","🥹"] },
  { label: "Gestures", emojis: ["👍","👎","👊","✊","🤛","🤜","👏","🙌","🤝","👐","🤲","🙏","✌️","🤟","🤘","👌","🤌","🤏","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤙","💪","🦾"] },
  { label: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","💕","💞","💓","💗","💖","💘","💝","💟","♥️","❣️","💌"] },
  { label: "Objects", emojis: ["🎉","🎊","🎈","🎁","🏆","🥇","⭐","🌟","💡","🔥","💯","✅","❌","⚡","💎","🎯","🚀","💻","📱","🎵","🎶","📷","🎬","🎮","⚽","🏀"] },
  { label: "Nature", emojis: ["🌸","🌹","🌺","🌻","🌼","🌷","🌱","🌿","☘️","🍀","🌳","🌲","🐶","🐱","🐭","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐸","🐵","🐧","🐦","🦋","🐝"] },
];

/**
 * Emoji Reaction Picker — allows selecting any emoji for message reactions.
 * Shows quick reactions first, then expandable full picker with categories.
 */
export default function EmojiReactionPicker({ onSelect, onClose }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  const handleSelect = (emoji) => {
    onSelect?.(emoji);
    onClose?.();
  };

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 w-72 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-950" onClick={(e) => e.stopPropagation()}>
      {/* Quick reactions */}
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-white/10">
        <div className="flex gap-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSelect(emoji)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-slate-100 hover:scale-125 dark:hover:bg-white/10"
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          aria-label="More emojis"
        >
          {expanded ? "−" : "+"}
        </button>
      </div>

      {/* Expanded picker */}
      {expanded ? (
        <div className="max-h-[240px] overflow-hidden">
          {/* Category tabs */}
          <div className="flex border-b border-slate-100 px-2 dark:border-white/10">
            {EMOJI_CATEGORIES.map((cat, idx) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setActiveCategory(idx)}
                className={`flex-1 py-1.5 text-[10px] font-medium transition ${
                  activeCategory === idx
                    ? "border-b-2 border-emerald-500 text-emerald-600"
                    : "text-slate-400"
                }`}
              >
                {cat.emojis[0]}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="h-[180px] overflow-y-auto p-2">
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-lg transition hover:bg-slate-100 hover:scale-110 dark:hover:bg-white/10"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
