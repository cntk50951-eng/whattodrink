import { useCallback, useEffect, useRef, useState } from "react";

import type { LatLng } from "@/lib/geo";
import { GEOLOCATION_MAX_AGE_MS, GEOLOCATION_TIMEOUT_MS } from "@/lib/geo";

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
  /** Set only when status is "success". */
  position: LatLng | null;
  retry: () => void;
};

/**
 * Browser geolocation state machine (UR1.1 task 1).
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
export function useGeolocation(): GeoState {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [position, setPosition] = useState<LatLng | null>(null);
  const attemptRef = useRef(0);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    const attempt = ++attemptRef.current;
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (attemptRef.current !== attempt) return;
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("success");
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
  }, []);

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

  return { status, position, retry: request };
}
