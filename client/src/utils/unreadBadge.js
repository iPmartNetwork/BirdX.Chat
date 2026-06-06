/**
 * Unread Badge Utility — updates the page title and favicon with unread count.
 * Shows "(3) BirdX" in tab title and a red dot badge on the favicon.
 */

const ORIGINAL_TITLE = "BirdX";
let currentFavicon = null;
let badgeFavicon = null;

/**
 * Update the document title with unread count.
 * @param {number} count
 */
export function updateUnreadBadge(count) {
  const n = Math.max(0, Number(count || 0));
  if (typeof document === "undefined") return;

  // Update tab title
  document.title = n > 0 ? `(${n > 99 ? "99+" : n}) ${ORIGINAL_TITLE}` : ORIGINAL_TITLE;

  // Update favicon with badge
  updateFaviconBadge(n);
}

function updateFaviconBadge(count) {
  if (typeof document === "undefined") return;
  const link = document.querySelector("link[rel='icon']");
  if (!link) return;

  if (count <= 0) {
    // Restore original favicon
    if (currentFavicon) {
      link.href = currentFavicon;
    }
    return;
  }

  // Save original
  if (!currentFavicon) {
    currentFavicon = link.href;
  }

  // Create badge favicon
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 32, 32);

    // Draw red badge circle
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(24, 8, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw count text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count > 9 ? "9+" : String(count), 24, 8);

    link.href = canvas.toDataURL("image/png");
  };
  img.src = currentFavicon;
}

/**
 * Reset badge (clear unread indicator).
 */
export function clearUnreadBadge() {
  updateUnreadBadge(0);
}
