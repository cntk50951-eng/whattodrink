import type { LatLng } from "./geo";

/**
 * Watch-position plumbing for UR1.2 live-follow (extracted pure so it is
 * unit testable — pass the real `navigator.geolocation` in prod, a fake
 * source in tests).
 */

export type WatchCallbacks = {
  onPosition: (point: LatLng) => void;
  /** Raw GeolocationPositionError code (1 denied / 2 unavailable / 3 timeout). */
  onError: (code: number) => void;
};

/** Minimal surface the watcher needs — matches Geolocation. */
export type WatchSource = {
  watchPosition: (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ) => number;
  clearWatch: (id: number) => void;
};

/**
 * Starts a position watch. Returns an idempotent stop function.
 * maximumAge 0 forces fresh fixes so the dot actually follows the walk.
 */
export function startWatch(
  source: WatchSource,
  callbacks: WatchCallbacks,
  timeoutMs: number,
): () => void {
  const id = source.watchPosition(
    (pos) => {
      callbacks.onPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    },
    (err) => {
      callbacks.onError(err.code);
    },
    { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 0 },
  );
  let stopped = false;
  return () => {
    if (!stopped) {
      stopped = true;
      source.clearWatch(id);
    }
  };
}
