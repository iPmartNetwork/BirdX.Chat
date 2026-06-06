import { useState } from "react";
import { Download, Eye, EyeOff, FileText } from "../../../icons/lucide.js";

const PDF_MIME = "application/pdf";

function isPdfFile(file) {
  const mime = String(file?.mimeType || "").toLowerCase();
  const name = String(file?.name || file?.originalName || "").toLowerCase();
  return mime === PDF_MIME || name.endsWith(".pdf");
}

/**
 * Inline file preview for PDF documents.
 * Shows a preview button that expands to an iframe viewer.
 * Non-PDF documents show a styled download card.
 */
export default function FilePreview({ file, downloadUrl }) {
  const [expanded, setExpanded] = useState(false);
  const url = downloadUrl || file?.url || "";
  const name = file?.originalName || file?.name || "Document";
  const size = file?.size || file?.sizeBytes || 0;
  const sizeLabel = size > 0
    ? size > 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(size / 1024)} KB`
    : "";

  if (!url) return null;

  const canPreview = isPdfFile(file);

  return (
    <div className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
      {/* File header */}
      <div className="flex items-center gap-3 px-3 py-2">
        <FileText size={20} className="shrink-0 text-emerald-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
            {name}
          </p>
          {sizeLabel ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{sizeLabel}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {canPreview ? (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
              title={expanded ? "Close preview" : "Preview"}
              aria-label={expanded ? "Close preview" : "Preview PDF"}
            >
              {expanded ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          ) : null}
          <a
            href={url}
            download={name}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
            title="Download"
            aria-label="Download file"
          >
            <Download size={16} />
          </a>
        </div>
      </div>

      {/* PDF preview iframe */}
      {canPreview && expanded ? (
        <div className="border-t border-slate-200 dark:border-white/10">
          <iframe
            src={`${url}#toolbar=0&navpanes=0`}
            title={`Preview: ${name}`}
            className="h-[400px] w-full bg-white"
            loading="lazy"
          />
        </div>
      ) : null}
    </div>
  );
}
