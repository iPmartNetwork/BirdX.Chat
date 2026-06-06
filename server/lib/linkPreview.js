/**
 * Link Preview — extracts Open Graph metadata (title, description, image) from URLs.
 * Used to generate rich link previews in chat messages.
 */

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const OG_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 64 * 1024; // Only read first 64KB for og tags

/**
 * Extract the first URL from a message body.
 * @param {string} body
 * @returns {string|null}
 */
export function extractFirstUrl(body) {
  const match = String(body || "").match(URL_REGEX);
  return match?.[0] || null;
}

/**
 * Fetch Open Graph metadata from a URL.
 * @param {string} url
 * @returns {Promise<{title?: string, description?: string, image?: string, siteName?: string, url: string}|null>}
 */
export async function fetchLinkPreview(url) {
  if (!url) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OG_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BirdX-LinkPreview/1.0 (compatible; bot)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });

    clearTimeout(timer);

    if (!response.ok) return null;
    const contentType = String(response.headers.get("content-type") || "");
    if (!contentType.includes("text/html")) return null;

    // Read only first chunk
    const reader = response.body?.getReader();
    if (!reader) return null;

    let html = "";
    let bytesRead = 0;
    while (bytesRead < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      bytesRead += value.length;
    }
    reader.cancel().catch(() => {});

    return parseOgTags(html, url);
  } catch {
    return null;
  }
}

/**
 * Parse OG tags from HTML string.
 */
function parseOgTags(html, sourceUrl) {
  const getMetaContent = (property) => {
    const patterns = [
      new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, "i"),
      new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, "i"),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return "";
  };

  const title = getMetaContent("og:title") || getMetaContent("twitter:title") || extractHtmlTitle(html);
  const description = getMetaContent("og:description") || getMetaContent("twitter:description") || getMetaContent("description");
  const image = getMetaContent("og:image") || getMetaContent("twitter:image");
  const siteName = getMetaContent("og:site_name") || "";

  if (!title && !description && !image) return null;

  return {
    title: title?.slice(0, 200) || "",
    description: description?.slice(0, 300) || "",
    image: image || "",
    siteName,
    url: sourceUrl,
  };
}

function extractHtmlTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim()?.slice(0, 200) || "";
}
