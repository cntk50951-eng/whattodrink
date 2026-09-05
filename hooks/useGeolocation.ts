import { useCallback, useEffect, useRef, useState } from "react";

import type { LatLng } from "@/lib/geo";
import { GEOLOCATION_MAX_AGE_MS, GEOLOCATION_TIMEOUT_MS } from "@/lib/geo";
import { startWatch } from "@/lib/geoWatch";

export type GeoStatus =
  | "idle"
  | "locating"
  | "success"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported";

export type GeoState = {
  status: GeoStatus;
  /** Last known fix — kept on watch errors so the dot freezes instead of vanishing. */
  position: LatLng | null;
  retry: () => void;
};

export type UseGeolocationOptions = {
  /**
   * UR1.2 live-follow: after the first fix, keep a watchPosition running so
   * the self dot follows the walk. Stopped on unmount and while the page is
   * hidden (battery). Watch errors are terminal — position keeps the last
   * fix and the UI falls back to the guide sheet + retry.
   */
  watch?: boolean;
};

/**
 * Browser geolocation state machine (UR1.1 task 1, UR1.2 live-follow).
 *
 * Requests once on mount; exposes retry() for the denied/timeout UI.
 * Distinguishes denied (user said no) from unavailable/timeout (hardware or
 * signal) so the UI can show the right guidance for each case.
 *
 * State starts at "idle" on both server and client (hydration-safe).
 * The mount request is kicked off from a microtask rather than the
 * synchronous effect body: react-hooks/set-state-in-effect only permits
 * setState from async continuations, and the idle → locating transition
 * legitimately happens on mount.
 */
export function useGeolocation(options?: UseGeolocationOptions): GeoState {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [position, setPosition] = useState<LatLng | null>(null);
  const attemptRef = useRef(0);
  const watchIdRef = useRef(0);
  const watchStopRef = useRef<(() => void) | null>(null);
  const watchEnabledRef = useRef(false);
  const statusRef = useRef<GeoStatus>("idle");

  // Refs mirror state for use inside listeners (no setState here — lint-clean).
  useEffect(() => {
    watchEnabledRef.current = options?.watch ?? false;
    statusRef.current = status;
  });

  const stopWatch = useCallback(() => {
    watchStopRef.current?.();
    watchStopRef.current = null;
  }, []);

  const beginWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    stopWatch();
    const wid = ++watchIdRef.current;
    watchStopRef.current = startWatch(
      navigator.geolocation,
      {
        onPosition: (point) => {
          if (watchIdRef.current !== wid) return;
          setPosition(point);
          setStatus("success");
        },
        onError: (code) => {
          if (watchIdRef.current !== wid) return;
          stopWatch();
          if (code === 1) setStatus("denied");
          else if (code === 2) setStatus("unavailable");
          else setStatus("timeout");
        },
      },
      GEOLOCATION_TIMEOUT_MS,
    );
  }, [stopWatch]);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    const attempt = ++attemptRef.current;
    setStatus("locating");
    // Async continuation (set-state-in-effect compliant): skip the real
    // request when permission is already denied — no prompt would show.
    void queryPermission().then((perm) => {
      if (attemptRef.current !== attempt) return;
      if (perm === "denied") {
        setStatus("denied");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (attemptRef.current !== attempt) return;
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setStatus("success");
          if (watchEnabledRef.current) beginWatch();
        },
        (err) => {
          if (attemptRef.current !== attempt) return;
          if (err.code === err.PERMISSION_DENIED) setStatus("denied");
          else if (err.code === err.POSITION_UNAVAILABLE)
            setStatus("unavailable");
          else setStatus("timeout");
        },
        {
          enableHighAccuracy: false,
          timeout: GEOLOCATION_TIMEOUT_MS,
          maximumAge: GEOLOCATION_MAX_AGE_MS,
        },
      );
    });
  }, [beginWatch]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) request();
    });
    return () => {
      cancelled = true;
      attemptRef.current += 1;
    };
  }, [request]);

  // Watch lifecycle: stop on unmount; pause while hidden, resume on visible.
  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") {
        stopWatch();
      } else if (
        watchEnabledRef.current &&
        statusRef.current === "success" &&
        watchStopRef.current === null
      ) {
        beginWatch();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopWatch();
    };
  }, [beginWatch, stopWatch]);

  return { status, position, retry: request };
}

/**
 * Permission pre-check via the Permissions API (where supported).
 * Returns "granted" | "denied" | "prompt", or null when the API is missing
 * (older Safari/Firefox) — callers fall back to a direct request.
 * Querying never triggers a browser prompt, so a remembered "denied" can
 * be surfaced straight to the settings guide instead of failing silently.
 */
async function queryPermission(): Promise<string | null> {
  try {
    if (
      typeof navigator === "undefined" ||
      navigator.permissions?.query === undefined
    ) {
      return null;
    }
    const res = await navigator.permissions.query({
      name: "geolocation",
    });
    return res.state;
  } catch {
    return null;
  }
}
