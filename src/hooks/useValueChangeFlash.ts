import { useEffect, useRef, useState } from "react";

/**
 * Returns `true` for a short window right after `value` changes, then
 * settles back to `false`. Used to trigger a subtle one-off animation
 * (e.g. a brief pulse on a number that just updated) without touching
 * layout — the caller conditionally adds an animation class.
 */
export function useValueChangeFlash(value: string | number, durationMs = 700): boolean {
  const previousValueRef = useRef(value);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (previousValueRef.current === value) return;
    previousValueRef.current = value;
    setIsFlashing(true);
    const timeout = setTimeout(() => setIsFlashing(false), durationMs);
    return () => clearTimeout(timeout);
  }, [value, durationMs]);

  return isFlashing;
}
