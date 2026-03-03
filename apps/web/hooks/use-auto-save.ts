"use client";

import { useRef, useEffect, useState } from "react";

type SaveStatus = "idle" | "saving" | "saved";

/**
 * Auto-save hook for debounced saves.
 *
 * Watches a value and calls the save function after a debounce period.
 * Returns a status: "idle" | "saving" | "saved".
 *
 * @param value - The value to watch for changes
 * @param saveFn - Async function called with the value when it changes
 * @param debounceMs - Debounce delay in milliseconds
 * @param initialized - Whether initial values have been loaded (skip saving until true)
 */
export function useAutoSave<T>(
  value: T,
  saveFn: (value: T) => Promise<void> | void,
  debounceMs = 500,
  initialized = true
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initialRef = useRef(true);
  const prevValueRef = useRef<string>("");

  useEffect(() => {
    // Skip the very first render (initial mount)
    if (initialRef.current) {
      initialRef.current = false;
      prevValueRef.current = JSON.stringify(value);
      return;
    }

    // Skip until initialized
    if (!initialized) return;

    // Skip if value hasn't changed
    const serialized = JSON.stringify(value);
    if (serialized === prevValueRef.current) return;
    prevValueRef.current = serialized;

    if (timerRef.current) clearTimeout(timerRef.current);

    setStatus("saving");
    timerRef.current = setTimeout(async () => {
      try {
        await saveFn(value);
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1500);
      } catch {
        setStatus("idle");
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, saveFn, debounceMs, initialized]);

  return status;
}
