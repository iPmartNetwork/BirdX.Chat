import { useState, useRef, useCallback } from "react";
import { Close, Check } from "../../icons/lucide.js";

/**
 * Image Editor — crop and rotate images before sending.
 * Shows a fullscreen overlay with the image and editing controls.
 */
export default function ImageEditor({ imageUrl, imageName, open, onClose, onSave }) {
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  if (!open || !imageUrl) return null;

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) {
      onSave?.(imageUrl);
      return;
    }

    const ctx = canvas.getContext("2d");
    const { naturalWidth: w, naturalHeight: h } = img;

    // Handle rotation
    const isRotated = rotation === 90 || rotation === 270;
    canvas.width = isRotated ? h : w;
    canvas.height = isRotated ? w : h;

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], imageName || "edited-image.jpg", { type: "image/jpeg" });
        onSave?.(URL.createObjectURL(blob), file);
      } else {
        onSave?.(imageUrl);
      }
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/20"
          aria-label="Cancel"
        >
          <Close size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white">Edit Image</h3>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
          aria-label="Save"
        >
          <Check size={20} />
        </button>
      </div>

      {/* Image preview */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Edit preview"
          className="max-h-full max-w-full object-contain transition-transform duration-200"
          style={{
            transform: `rotate(${rotation}deg)`,
            filter: `brightness(${brightness}%) contrast(${contrast}%)`,
          }}
          crossOrigin="anonymous"
        />
      </div>

      {/* Controls */}
      <div className="border-t border-white/10 px-4 py-4">
        <div className="mx-auto flex max-w-md items-center justify-center gap-4">
          {/* Rotate */}
          <button
            type="button"
            onClick={handleRotate}
            className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-white transition hover:bg-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.4 2.6"/><path d="M21 3v6h-6"/></svg>
            <span className="text-[10px]">Rotate</span>
          </button>

          {/* Brightness */}
          <label className="flex flex-col items-center gap-1 text-white">
            <span className="text-[10px]">Brightness</span>
            <input
              type="range"
              min="50"
              max="150"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="h-1 w-20 accent-emerald-500"
            />
          </label>

          {/* Contrast */}
          <label className="flex flex-col items-center gap-1 text-white">
            <span className="text-[10px]">Contrast</span>
            <input
              type="range"
              min="50"
              max="150"
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="h-1 w-20 accent-emerald-500"
            />
          </label>
        </div>
      </div>

      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
