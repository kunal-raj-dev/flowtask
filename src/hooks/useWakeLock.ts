import { useCallback, useEffect, useRef, useState } from "react";

export interface UseWakeLockResult {
  isSupported: boolean;
  isActive: boolean;
  error: Error | null;
  request: () => Promise<void>;
  release: () => Promise<void>;
}

/** One in-flight request per owner. Late grants are released after pause/unmount. */
export function useWakeLock(enabled = true): UseWakeLockResult {
  const isSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.wakeLock?.request === "function";
  const [hasLock, setHasLock] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const sentinel = useRef<WakeLockSentinel | null>(null);
  const lifecycle = useRef({ active: false, generation: 0 });
  const pending = useRef<{ generation: number; promise: Promise<void> } | null>(
    null,
  );

  const release = useCallback(async () => {
    lifecycle.current.generation++;
    pending.current = null;
    const held = sentinel.current;
    sentinel.current = null;
    setHasLock(false);
    try {
      await held?.release();
    } catch {
      /* Already released by the platform. */
    }
  }, []);

  const request = useCallback((): Promise<void> => {
    if (
      !isSupported ||
      !enabled ||
      !lifecycle.current.active ||
      document.visibilityState !== "visible"
    )
      return Promise.resolve();
    if (sentinel.current && !sentinel.current.released)
      return Promise.resolve();
    const generation = lifecycle.current.generation;
    if (pending.current?.generation === generation)
      return pending.current.promise;
    const promise = (async () => {
      try {
        const granted = await navigator.wakeLock.request("screen");
        if (
          !lifecycle.current.active ||
          lifecycle.current.generation !== generation ||
          document.visibilityState !== "visible"
        ) {
          await granted.release();
          return;
        }
        sentinel.current = granted;
        setHasLock(true);
        setError(null);
        granted.addEventListener(
          "release",
          () => {
            if (sentinel.current === granted) {
              sentinel.current = null;
              setHasLock(false);
            }
          },
          { once: true },
        );
      } catch (reason) {
        if (
          lifecycle.current.active &&
          lifecycle.current.generation === generation
        ) {
          setError(
            reason instanceof Error ? reason : new Error(String(reason)),
          );
          setHasLock(false);
          console.debug(
            "[WakeLock] Request denied or failed:",
            reason instanceof Error ? reason.message : String(reason),
          );
        }
      } finally {
        if (pending.current?.generation === generation) pending.current = null;
      }
    })();
    pending.current = { generation, promise };
    return promise;
  }, [enabled, isSupported]);

  useEffect(() => {
    if (!enabled || !isSupported) return;
    const owner = lifecycle.current;
    owner.active = true;
    void request();
    const visibility = () => {
      if (document.visibilityState === "visible") void request();
      else void release();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      owner.active = false;
      document.removeEventListener("visibilitychange", visibility);
      void release();
    };
  }, [enabled, isSupported, request, release]);

  return {
    isSupported,
    isActive: enabled && isSupported && hasLock,
    error,
    request,
    release,
  };
}
