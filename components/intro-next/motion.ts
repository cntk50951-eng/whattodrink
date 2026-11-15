import { interpolate } from "remotion";

export type CameraTarget = { x: number; y: number; zoom: number };
export type CameraPath = "glide" | "arc" | "lift";
export type ScreenTransition = "slide" | "lift" | "dissolve";
export type CameraPose = {
  zoom: number; x: number; y: number; imageX: number; imageY: number;
  scale: number; slide: number; rise: number; yaw: number; roll: number;
  focus: number; light: number; lightX: number; lightY: number; sheen: number;
};
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Zero velocity and acceleration at either end, avoiding a sudden focus kick. */
export function smoothProgress(time: number, from: number, to: number): number {
  const p = Math.max(0, Math.min(1, (time - from) / (to - from)));
  return p * p * p * (p * (p * 6 - 15) + 10);
}

/** Pull focus slightly before each UI handoff, then settle into the next task. */
export function cameraAt(time: number, duration: number, target: CameraTarget, side: -1 | 1, portrait: boolean, cuts: readonly number[] = [], path: CameraPath = "glide"): CameraPose {
  const enter = smoothProgress(time, 0, 1.65);
  const pull = smoothProgress(time, duration - 2.15, duration - 0.8);
  let focus = smoothProgress(time, 1.45, 3.9) * (1 - pull);
  for (const cut of cuts) {
    if (cut <= 0) continue;
    const release = smoothProgress(time, cut - 0.8, cut + 0.05);
    const settle = smoothProgress(time, cut + 0.25, cut + 1.55);
    focus *= 1 - 0.62 * release * (1 - settle);
  }
  const exit = smoothProgress(time, duration - 0.9, duration);
  const drift = smoothProgress(time, 1.65, duration - 1.6);
  const arc = Math.sin(drift * Math.PI) * enter * (1 - exit);
  const maxZoom = Math.max(1, Math.min(target.zoom, portrait ? 1.24 : 1.5));
  // Equal changes in visible area feel steadier than linear CSS scale values.
  const zoom = interpolate(focus, [0, 1], [1, maxZoom], { ...clamp, output: "perceptual-scale" });
  const x = Math.max(0, Math.min(100, target.x));
  const y = Math.max(0, Math.min(100, target.y));
  const light = smoothProgress(time, 0.8, 4.6) * (1 - smoothProgress(time, duration - 2.8, duration - 0.2));
  const travel = portrait ? 0.35 : 0.85;
  return {
    zoom,
    x: 50 + (x - 50) * focus,
    y: 50 + (y - 50) * focus,
    // Fixed center plus affine translation: the scale pivot no longer wanders.
    imageX: (50 - x) * (zoom - 1),
    imageY: (50 - y) * (zoom - 1),
    scale: 0.91 + enter * 0.09 + focus * (portrait ? 0.015 : 0.045) - exit * 0.025,
    slide: side * ((1 - enter) * (portrait ? 12 : 18) - focus * 0.75 + exit * 4 + (path === "arc" ? arc * travel : (drift - 0.5) * travel * enter * (1 - exit))),
    rise: (1 - enter) * 8 + exit * 1.5 - (path === "lift" ? arc * travel : 0),
    yaw: side * ((1 - enter) * 17 + (1 - focus) * 2.5 + (path === "arc" ? arc * 1.4 : 0)),
    roll: side * ((1 - enter) * 4 + (1 - focus) * 0.8 + (path === "arc" ? arc * 0.35 : 0)),
    focus, light,
    lightX: side * (drift - 0.5) * 3,
    lightY: (y - 50) * 0.04 * light,
    sheen: -10 + drift * 20,
  };
}

/** Two overlapping layers retain an opaque backing throughout the page change. */
export function screenAt(time: number, at: number, nextAt: number | undefined, first: boolean, side: -1 | 1, transition: ScreenTransition): { opacity: number; x: number; y: number; scale: number } {
  const enter = first ? 1 : smoothProgress(time, at, at + 0.95);
  const exit = nextAt === undefined ? 0 : smoothProgress(time, nextAt, nextAt + 0.95);
  const offset = (1 - enter) * 2.6 - exit * 0.6;
  return {
    opacity: exit === 1 ? 0 : enter,
    x: transition === "slide" ? side * offset : 0,
    y: transition === "lift" ? offset : 0,
    scale: 1 + (1 - enter) * (transition === "dissolve" ? 0.012 : 0.022),
  };
}

/** Emphasise the current phrase within the existing narrative, without a player bar. */
export function phraseAt(time: number, index: number, count: number, duration: number, cuts: readonly number[]): number {
  const starts = cuts.length === count ? cuts : Array.from({ length: count }, (_, i) => i * (duration - 1.3) / count);
  const enter = index === 0 ? 1 : smoothProgress(time, starts[index] - 0.1, starts[index] + 0.85);
  const exit = index === count - 1 ? 0 : smoothProgress(time, starts[index + 1] - 0.1, starts[index + 1] + 0.85);
  return enter * (1 - exit);
}
