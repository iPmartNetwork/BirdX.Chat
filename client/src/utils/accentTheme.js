export const DEFAULT_ACCENT = "#10b981";
export const ACCENT_CSS_VAR = "var(--birdx-accent)";
const DEFAULT_ACCENT_RGB = "16 185 129";
const STORAGE_KEY = "birdx-ui-accent";
const STYLE_ID = "birdx-accent-runtime";

export function hexToRgbParts(hex) {
  const normalized = String(hex || "")
    .trim()
    .replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const toByte = (value) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

function mixHex(hex, targetRgb, amount) {
  const src = hexToRgbParts(hex);
  if (!src) return hex;
  const ratio = Math.max(0, Math.min(1, Number(amount) || 0));
  return rgbToHex({
    r: src.r * (1 - ratio) + targetRgb.r * ratio,
    g: src.g * (1 - ratio) + targetRgb.g * ratio,
    b: src.b * (1 - ratio) + targetRgb.b * ratio,
  });
}

function hexToRgba(hex, alpha) {
  const parts = hexToRgbParts(hex);
  if (!parts) return `rgba(16, 185, 129, ${alpha})`;
  return `rgba(${parts.r}, ${parts.g}, ${parts.b}, ${alpha})`;
}

function buildAccentShades(hex) {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  return {
    50: mixHex(hex, white, 0.88),
    100: mixHex(hex, white, 0.78),
    200: mixHex(hex, white, 0.62),
    300: mixHex(hex, white, 0.48),
    400: mixHex(hex, white, 0.32),
    500: hex,
    600: mixHex(hex, black, 0.12),
    700: mixHex(hex, black, 0.28),
    800: mixHex(hex, black, 0.42),
    900: mixHex(hex, black, 0.52),
    950: mixHex(hex, black, 0.62),
    light: mixHex(hex, white, 0.65),
    deep: mixHex(hex, black, 0.22),
    chatBg: mixHex(hex, white, 0.84),
    chatBgMid: mixHex(hex, white, 0.76),
  };
}

function buildChatBgImageLight(shades) {
  const accent = shades[500];
  return [
    `radial-gradient(ellipse 130% 90% at 8% -8%, ${hexToRgba(accent, 0.16)}, transparent 58%)`,
    `radial-gradient(ellipse 95% 75% at 96% 12%, ${hexToRgba(accent, 0.11)}, transparent 52%)`,
    `radial-gradient(ellipse 85% 65% at 48% 108%, ${hexToRgba(accent, 0.09)}, transparent 48%)`,
    `linear-gradient(158deg, #ffffff 0%, ${shades.chatBg} 24%, ${shades[50]} 48%, ${shades.chatBgMid} 72%, ${shades[100]} 100%)`,
  ].join(", ");
}

function buildChatBgImageDark(shades) {
  const accent = shades[500];
  const deep = "#070d18";
  return [
    `radial-gradient(ellipse 120% 85% at 12% -5%, ${hexToRgba(accent, 0.28)}, transparent 55%)`,
    `radial-gradient(ellipse 90% 70% at 92% 18%, ${hexToRgba(accent, 0.22)}, transparent 50%)`,
    `radial-gradient(ellipse 80% 60% at 50% 105%, ${hexToRgba(accent, 0.18)}, transparent 46%)`,
    `linear-gradient(165deg, ${deep} 0%, #0b1320 35%, ${mixHex(accent, { r: 11, g: 19, b: 32 }, 0.08)} 68%, #0f172a 100%)`,
  ].join(", ");
}

function buildRuntimeCss(shades) {
  const s50 = shades[50];
  const s500 = shades[500];
  const s950 = shades[950];

  const bg = (selector, shade) =>
    `${selector}{background-color:${shades[shade]}!important}`;
  const text = (selector, shade) => `${selector}{color:${shades[shade]}!important}`;
  const border = (selector, shade) =>
    `${selector}{border-color:${shades[shade]}!important}`;
  const ring = (selector, shade) =>
    `${selector}{--tw-ring-color:${shades[shade]}!important}`;
  const rgbaBg = (selector, shade, alpha) =>
    `${selector}{background-color:${hexToRgba(shades[shade], alpha)}!important}`;
  const rgbaBorder = (selector, shade, alpha) =>
    `${selector}{border-color:${hexToRgba(shades[shade], alpha)}!important}`;
  const rgbaText = (selector, shade, alpha) =>
    `${selector}{color:${hexToRgba(shades[shade], alpha)}!important}`;

  const rules = [
    bg(".bg-emerald-50", "50"),
    bg(".bg-emerald-100", "100"),
    bg(".bg-emerald-400", "400"),
    bg(".bg-emerald-500", "500"),
    bg(".bg-emerald-600", "600"),
    bg(".hover\\:bg-emerald-50:hover", "50"),
    bg(".hover\\:bg-emerald-100:hover", "100"),
    bg(".hover\\:bg-emerald-400:hover", "400"),
    bg(".hover\\:bg-emerald-600:hover", "600"),
    rgbaBg(".bg-emerald-500\\/10", "500", 0.1),
    rgbaBg(".bg-emerald-500\\/15", "500", 0.15),
    rgbaBg(".bg-emerald-500\\/20", "500", 0.2),
    rgbaBg(".bg-emerald-400\\/20", "400", 0.2),
    rgbaBg(".dark .dark\\:bg-emerald-500\\/10", "500", 0.1),
    rgbaBg(".dark .dark\\:bg-emerald-500\\/15", "500", 0.15),
    rgbaBg(".dark .dark\\:hover\\:bg-emerald-500\\/10:hover", "500", 0.1),
    rgbaBg(".dark .dark\\:hover\\:bg-emerald-500\\/20:hover", "500", 0.2),
    rgbaBg(".dark .dark\\:bg-emerald-900\\/40", "900", 0.4),
    rgbaBg(".bg-emerald-50\\/50", "50", 0.5),
    rgbaBg(".bg-emerald-50\\/70", "50", 0.7),
    text(".text-emerald-500", "500"),
    text(".text-emerald-600", "600"),
    text(".text-emerald-700", "700"),
    text(".text-emerald-800", "800"),
    text(".text-emerald-900", "900"),
    text(".hover\\:text-emerald-600:hover", "600"),
    text(".hover\\:text-emerald-700:hover", "700"),
    text(".group:hover .group-hover\\:text-emerald-600", "600"),
    text(".group:hover .group-hover\\:text-emerald-300", "300"),
    text(".dark .dark\\:text-emerald-100", "light"),
    text(".dark .dark\\:text-emerald-200", "light"),
    text(".dark .dark\\:text-emerald-300", "300"),
    text(".dark .group:hover .dark\\:group-hover\\:text-emerald-300", "300"),
    text(".dark .hover\\:dark\\:text-emerald-100:hover", "light"),
    text(".dark .hover\\:text-emerald-300:hover", "300"),
    border(".border-emerald-100", "100"),
    border(".border-emerald-200", "200"),
    border(".border-emerald-300", "300"),
    border(".border-emerald-400", "400"),
    border(".hover\\:border-emerald-300:hover", "300"),
    border(".hover\\:border-emerald-400:hover", "400"),
    border(".focus\\:border-emerald-400:focus", "400"),
    border(".focus-visible\\:border-emerald-300:focus-visible", "300"),
    rgbaBorder(".border-emerald-100\\/70", "100", 0.7),
    rgbaBorder(".border-emerald-100\\/80", "100", 0.8),
    rgbaBorder(".border-emerald-200\\/60", "200", 0.6),
    rgbaBorder(".border-emerald-200\\/70", "200", 0.7),
    rgbaBorder(".border-emerald-200\\/80", "200", 0.8),
    rgbaBorder(".border-emerald-300\\/70", "300", 0.7),
    rgbaBorder(".border-emerald-500\\/20", "500", 0.2),
    rgbaBorder(".border-emerald-500\\/30", "500", 0.3),
    rgbaBorder(".dark .dark\\:border-emerald-500\\/20", "500", 0.2),
    rgbaBorder(".dark .dark\\:border-emerald-500\\/30", "500", 0.3),
    rgbaBorder(".dark .dark\\:hover\\:border-emerald-500\\/40:hover", "500", 0.4),
    rgbaBorder(".dark .dark\\:hover\\:border-emerald-500\\/50:hover", "500", 0.5),
    ring(".focus\\:ring-emerald-300:focus", "300"),
    ring(".focus-visible\\:ring-emerald-300:focus-visible", "300"),
    ring(".focus\\:ring-emerald-300\\/60:focus", "300"),
    ring(".group:hover .group-hover\\:ring-emerald-300", "300"),
    ring(".hover\\:ring-emerald-300:hover", "300"),
    rgbaText(".text-emerald-500\\/80", "500", 0.8),
    `.from-emerald-950{--tw-gradient-from:${s950} var(--tw-gradient-from-position);--tw-gradient-to:rgb(255 255 255 / 0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}`,
    `.via-emerald-50\\/70{--tw-gradient-to:rgb(255 255 255 / 0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),${hexToRgba(s50, 0.7)},var(--tw-gradient-to)}`,
    `.birdx-auth-shell{background-image:linear-gradient(to bottom,#ffffff,${hexToRgba(s50, 0.7)},#ffffff)!important}`,
    `html.dark .birdx-auth-shell{background-image:linear-gradient(to bottom,${s950},#020617,#0f172a)!important}`,
    `.birdx-chat-scroll-bg{background-color:var(--birdx-chat-bg-light)!important;background-image:var(--birdx-chat-bg-image-light)!important;background-size:var(--birdx-chat-bg-size)!important}`,
    `html.dark .birdx-chat-scroll-bg{background-color:var(--birdx-chat-bg-dark)!important;background-image:var(--birdx-chat-bg-image-dark)!important;background-size:var(--birdx-chat-bg-size)!important}`,
    `.birdx-accent-icon{background:var(--birdx-accent-icon-bg)!important;color:#fff!important;box-shadow:var(--birdx-accent-icon-shadow)!important}`,
    `.hover\\:birdx-accent-glow-shadow:hover{box-shadow:0 0 16px var(--birdx-glow)!important}`,
    `.focus-visible\\:birdx-accent-glow-shadow-sm:focus-visible{box-shadow:0 0 20px var(--birdx-glow-sm)!important}`,
    `.birdx-edit-chat-glow{box-shadow:0 0 0 1px var(--birdx-glow),0 0 16px var(--birdx-glow-sm)!important}`,
    `.shadow-emerald-500\\/10{box-shadow:0 12px 28px -14px ${hexToRgba(s500, 0.12)}!important}`,
    `.shadow-emerald-500\\/15{box-shadow:0 16px 32px -14px ${hexToRgba(s500, 0.15)}!important}`,
    `.shadow-emerald-500\\/20{box-shadow:0 16px 32px -12px ${hexToRgba(s500, 0.2)}!important}`,
    `.shadow-emerald-500\\/25{box-shadow:0 16px 32px -12px ${hexToRgba(s500, 0.25)}!important}`,
    `.shadow-emerald-500\\/30{box-shadow:0 16px 32px -12px ${hexToRgba(s500, 0.3)}!important}`,
    rgbaBg(".bg-emerald-300\\/70", "300", 0.7),
    rgbaBg(".dark .dark\\:bg-emerald-700\\/60", "700", 0.6),
  ];

  return rules.join("");
}

function applyCssVariables(shades, rgb) {
  const root = document.documentElement;
  root.style.setProperty("--birdx-accent", shades[500]);
  root.style.setProperty(
    "--birdx-accent-rgb",
    rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : DEFAULT_ACCENT_RGB,
  );
  root.style.setProperty("--birdx-glow", hexToRgba(shades[500], 0.22));
  root.style.setProperty("--birdx-glow-sm", hexToRgba(shades[500], 0.18));
  root.style.setProperty("--birdx-accent-light", shades[300]);
  root.style.setProperty("--birdx-accent-deep", shades.deep);
  root.style.setProperty(
    "--birdx-accent-icon-bg",
    `linear-gradient(145deg, ${shades[400]} 0%, ${shades[500]} 52%, ${shades[600]} 100%)`,
  );
  root.style.setProperty(
    "--birdx-accent-icon-shadow",
    `0 4px 14px -3px ${hexToRgba(shades[500], 0.45)}, inset 0 1px 0 rgba(255,255,255,0.28)`,
  );
  root.style.setProperty("--birdx-chat-bg-light", shades.chatBg);
  root.style.setProperty("--birdx-chat-bg-dark", "#0b1320");
  root.style.setProperty("--birdx-chat-bg-image-light", buildChatBgImageLight(shades));
  root.style.setProperty("--birdx-chat-bg-image-dark", buildChatBgImageDark(shades));
  root.style.setProperty(
    "--birdx-chat-bg-size",
    "100% 100%, 100% 100%, 100% 100%, 100% 100%",
  );
}

function updateRuntimeStylesheet(css) {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.append(style);
  }
  style.textContent = css;
}

export function loadStoredAccent() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && hexToRgbParts(value)) return value;
  } catch {
    // ignore
  }
  return null;
}

export function persistAccent(hex) {
  try {
    if (hex && hexToRgbParts(hex)) {
      localStorage.setItem(STORAGE_KEY, hex);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Apply user/branding accent across the UI (CSS variables + runtime overrides). */
export function applyAccentTheme(
  userAccent,
  brandingAccent = DEFAULT_ACCENT,
  options = {},
) {
  if (typeof document === "undefined") return;

  const { persist = true, preview = false } = options;
  const stored = loadStoredAccent();
  const resolvedUser =
    userAccent === null || userAccent === undefined
      ? null
      : String(userAccent || "").trim() || null;
  const base = String(
    preview && resolvedUser
      ? resolvedUser
      : resolvedUser || stored || brandingAccent || DEFAULT_ACCENT,
  ).trim();
  const rgb = hexToRgbParts(base) || hexToRgbParts(DEFAULT_ACCENT);

  applyCssVariables(buildAccentShades(base), rgb);
  document.documentElement.dataset.accentCustom =
    resolvedUser || stored ? "1" : "0";

  if (persist) {
    if (resolvedUser) {
      persistAccent(resolvedUser);
    } else if (userAccent === null) {
      persistAccent(null);
    }
  }

  const shades = buildAccentShades(base);
  updateRuntimeStylesheet(buildRuntimeCss(shades));
}

export function previewAccentTheme(hex) {
  applyAccentTheme(hex || null, DEFAULT_ACCENT, { persist: false, preview: true });
}
