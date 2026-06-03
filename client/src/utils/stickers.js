export const DEFAULT_STICKER_PACK = {
  id: "default",
  label: "BirdX",
  stickers: [
    { id: "wave", emoji: "👋", label: "Wave" },
    { id: "thumbs_up", emoji: "👍", label: "Thumbs up" },
    { id: "heart", emoji: "❤️", label: "Heart" },
    { id: "fire", emoji: "🔥", label: "Fire" },
    { id: "party", emoji: "🎉", label: "Party" },
    { id: "laugh", emoji: "😂", label: "Laugh" },
    { id: "think", emoji: "🤔", label: "Think" },
    { id: "clap", emoji: "👏", label: "Clap" },
    { id: "bird", emoji: "🐦", label: "Bird" },
    { id: "star", emoji: "⭐", label: "Star" },
    { id: "ok", emoji: "👌", label: "OK" },
    { id: "cool", emoji: "😎", label: "Cool" },
  ],
};

export const STICKER_PACKS = [DEFAULT_STICKER_PACK];

export function buildStickerBody(packId, stickerId) {
  return `[[sticker:${String(packId || "default")}:${String(stickerId || "")}]]`;
}

export function parseStickerBody(body) {
  const text = String(body || "").trim();
  const match = text.match(/^\[\[sticker:([^:\]]+):([^\]]+)\]\]$/i);
  if (!match) return null;
  const packId = match[1];
  const stickerId = match[2];
  const pack = STICKER_PACKS.find((item) => item.id === packId) || DEFAULT_STICKER_PACK;
  const sticker =
    pack.stickers.find((item) => item.id === stickerId) ||
    pack.stickers.find((item) => item.emoji === stickerId);
  if (!sticker) {
    return { packId, stickerId, emoji: stickerId, label: stickerId };
  }
  return { packId, stickerId: sticker.id, emoji: sticker.emoji, label: sticker.label };
}

export function isStickerBody(body) {
  return /^\[\[sticker:[^:\]]+:[^\]]+\]\]$/i.test(String(body || "").trim());
}

export function isPollBody(body) {
  return String(body || "").trim() === "[[poll]]";
}
