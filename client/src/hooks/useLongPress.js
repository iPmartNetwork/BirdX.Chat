import { useCallback, useRef } from "react";

export function useLongPress({ onLongPress, delayMs = 450, disabled = false } = {}) {
  const timerRef = useRef(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (event) => {
      if (disabled || !onLongPress) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      clear();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onLongPress(event);
      }, delayMs);
    },
    [clear, delayMs, disabled, onLongPress],
  );

  return {
    onPointerDown,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}
