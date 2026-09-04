/**
 * UR2.1–UR2.2 camera helpers — pure functions (browser API calls stay in the
 * component). Unit-test once vitest lands (see .harness/testing.md).
 */

/** Max voice note length in seconds (UR2.3 may refine; enforced in UI). */
export const MAX_VOICE_SECONDS = 60;

/** Max note text length in characters. */
export const MAX_NOTE_CHARS = 500;

/** Seconds → "m:ss" for recorder timers. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** How a getUserMedia failure should be presented. */
export type CameraErrorKind =
  | "denied-once"
  | "blocked"
  | "no-device"
  | "unknown";

/**
 * Maps a DOMException name from getUserMedia to a presentation bucket.
 * "blocked" (browser-level permanent denial) is detected separately via the
 * Permissions API — see the component — because NotAllowedError covers both
 * one-time dismissal and permanent blocks depending on browser.
 */
export function classifyGetUserMediaError(name: string): CameraErrorKind {
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "denied-once";
    case "NotFoundError":
    case "OverconstrainedError":
    case "DevicesNotFoundError":
      return "no-device";
    default:
      return "unknown";
  }
}

/** True when the environment can even attempt getUserMedia (AC4 gate). */
export function hasMediaDevices(
  nav?: Pick<Navigator, "mediaDevices">,
): boolean {
  const n = nav ?? (typeof navigator !== "undefined" ? navigator : undefined);
  return typeof n?.mediaDevices?.getUserMedia === "function";
}
