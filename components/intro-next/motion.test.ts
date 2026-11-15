import { describe, expect, it } from "vitest";

import { cameraAt, phraseAt, screenAt, smoothProgress } from "./motion";

const target = { x: 50, y: 89, zoom: 1.6 };
describe("task-focused camera choreography", () => {
  it("establishes context, pushes to the control, and returns to context before the cut", () => {
    const start = cameraAt(0, 8, target, 1, false);
    const focus = cameraAt(4, 8, target, 1, false);
    const end = cameraAt(8, 8, target, 1, false);
    expect(start.zoom).toBe(1);
    expect(focus.zoom).toBeCloseTo(1.5);
    expect(focus.y).toBe(89);
    expect(end.zoom).toBe(1);
    expect(end.imageY).toBeCloseTo(0);
    expect(end.y).toBe(50);
    expect(start.yaw).toBeGreaterThan(focus.yaw);
  });
  it("mirrors left/right entrances without changing the screen target", () => {
    const a = cameraAt(0.4, 8, target, 1, false);
    const b = cameraAt(0.4, 8, target, -1, false);
    expect(a.slide).toBe(-b.slide);
    expect(a.yaw).toBe(-b.yaw);
    expect(a.roll).toBe(-b.roll);
    expect(a.zoom).toBe(b.zoom);
  });
  it("bounds portrait zoom and travel for narrow screens", () => {
    const phone = cameraAt(4, 8, target, 1, true);
    const desktop = cameraAt(4, 8, target, 1, false);
    expect(phone.zoom).toBeLessThanOrEqual(1.24);
    expect(phone.scale).toBeLessThan(desktop.scale);
    for (const time of [-1, 0, 1, 4, 7, 8, 30]) {
      const pose = cameraAt(time, 8, target, 1, true);
      expect(Object.values(pose).every(Number.isFinite)).toBe(true);
      expect(pose.focus).toBeGreaterThanOrEqual(0);
      expect(pose.focus).toBeLessThanOrEqual(1);
    }
  });
  it("releases focus for a page handoff without flashing the ambient light", () => {
    const rest = cameraAt(5, 13, target, 1, false);
    const handoff = cameraAt(5, 13, target, 1, false, [0, 5]);
    const settled = cameraAt(7, 13, target, 1, false, [0, 5]);
    expect(handoff.zoom).toBeLessThan(rest.zoom);
    expect(handoff.light).toBe(rest.light);
    expect(settled.zoom).toBeCloseTo(rest.zoom);
  });
  it("keeps the scaled image covering the viewport for off-center focus targets", () => {
    for (const x of [-20, 0, 50, 100, 120]) for (const y of [-20, 0, 50, 100, 120]) {
      const pose = cameraAt(4, 9, { x, y, zoom: 1.5 }, 1, false);
      const padding = (pose.zoom - 1) * 50;
      expect(Math.abs(pose.imageX)).toBeLessThanOrEqual(padding + 1e-8);
      expect(Math.abs(pose.imageY)).toBeLessThanOrEqual(padding + 1e-8);
    }
  });
  it("starts and stops focus with near-zero velocity rather than an ease-out kick", () => {
    const dt = 0.001;
    expect(smoothProgress(-1, 0, 1)).toBe(0);
    expect(smoothProgress(2, 0, 1)).toBe(1);
    expect(smoothProgress(dt, 0, 1) / dt).toBeLessThan(0.0001);
    expect((1 - smoothProgress(1 - dt, 0, 1)) / dt).toBeLessThan(0.0001);
  });
});

describe("narrative page handoffs", () => {
  const times = [0, 2.6, 5.8, 9.5];
  it("keeps an opaque image beneath incoming pages and never shows more than two pages", () => {
    for (let t = 0; t < 13; t += 1 / 60) {
      const pages = times.map((at, i) => screenAt(t, at, times[i + 1], i === 0, 1, "lift"));
      expect(pages.some((page) => page.opacity === 1)).toBe(true);
      expect(pages.filter((page) => page.opacity > 0).length).toBeLessThanOrEqual(2);
    }
  });
  it("settles incoming UI pages at their exact original geometry", () => {
    for (const kind of ["slide", "lift", "dissolve"] as const) {
      const pose = screenAt(5, 2.6, undefined, false, 1, kind);
      expect(pose).toEqual({ opacity: 1, x: 0, y: 0, scale: 1 });
    }
  });
  it("hands emphasis to the next phrase at the same cut without a new numbered progress bar", () => {
    expect(phraseAt(1, 0, 4, 13, times)).toBe(1);
    expect(phraseAt(7, 2, 4, 13, times)).toBe(1);
    expect(phraseAt(7, 0, 4, 13, times)).toBe(0);
    for (const t of [0, 2.7, 6, 10, 13]) {
      const weights = times.map((_, i) => phraseAt(t, i, 4, 13, times));
      expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
    }
  });
});
