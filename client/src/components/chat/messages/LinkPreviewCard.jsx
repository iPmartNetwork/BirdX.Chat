import { useEffect, useState } from "react";
import { apiFetch } from "../../../api/chatApi.js";

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/;
const previewCache = new Map();

/**
 * Link Preview Card — fetches and displays OG metadata for the first URL in a message.
 */
export default function LinkPreviewCard({ body }) {
  const [preview, setPreview] = useState(null);

  const url = body ? String(body).match(URL_REGEX)?.[0] : null;

  useEffect(() => {
    if (!url) return;
    if (previewCache.has(url)) {
      setPreview(previewCache.get(url));
      return;
    }
    let active = true;
    apiFetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const p = data?.preview || null;
        previewCache.set(url, p);
        setPreview(p);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [url]);

  if (!preview || (!preview.title && !preview.image)) return null;

  return (
    <a
      href={preview.url || url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:shadow-md dark:border-white/10 dark:bg-slate-900"
    >
      {preview.image ? (
        <div className="h-32 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={preview.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
      ) : null}
      <div className="px-3 py-2">
        {preview.siteName ? (
          <p className="text-[10px] font-medium uppercase text-emerald-600 dark:text-emerald-400">
            {preview.siteName}
          </p>
        ) : null}
        {preview.title ? (
          <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
            {preview.title}
          </p>
        ) : null}
        {preview.description ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {preview.description}
          </p>
        ) : null}
      </div>
    </a>
  );
}
