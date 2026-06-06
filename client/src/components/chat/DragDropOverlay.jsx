import { useState, useCallback, useEffect } from "react";
import { Upload } from "../../icons/lucide.js";

/**
 * Drag & Drop File Upload Overlay.
 * Wraps the chat area and shows an overlay when files are dragged over.
 */
export default function DragDropOverlay({ onFilesDropped, children }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => c + 1);
    if (e.dataTransfer?.types?.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => {
      const next = c - 1;
      if (next <= 0) setIsDragging(false);
      return Math.max(0, next);
    });
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      onFilesDropped?.(files);
    }
  }, [onFilesDropped]);

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {isDragging ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-emerald-500/10 backdrop-blur-sm border-2 border-dashed border-emerald-400 rounded-xl m-2">
          <div className="flex flex-col items-center gap-2">
            <Upload size={48} className="text-emerald-500" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Drop files to send
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
