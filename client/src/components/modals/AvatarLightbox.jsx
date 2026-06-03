import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Close } from "../../icons/lucide.js";

export default function AvatarLightbox({ open, src, alt, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !src || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/85 p-6"
      onClick={() => onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Profile photo"}
    >
      <button
        type="button"
        onClick={() => onClose?.()}
        className="absolute end-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white transition hover:bg-black/60"
        aria-label="Close"
      >
        <Close size={20} />
      </button>
      <img
        src={src}
        alt={alt || ""}
        className="max-h-[min(85dvh,720px)] max-w-full rounded-2xl object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
