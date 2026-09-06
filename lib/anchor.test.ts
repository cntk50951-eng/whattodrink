import { describe, expect, it } from "vitest";

import { anchorPanel } from "./anchor";

const W = 400;
const H = 600;
const PANEL_W = 300;
const PANEL_H = 200;

describe("anchorPanel", () => {
  it("sits above a centered pin, centered on it", () => {
    const p = anchorPanel(200, 400, PANEL_W, PANEL_H, W, H);
    expect(p.below).toBe(false);
    expect(p.left).toBe(50);
    expect(p.top).toBe(400 - 12 - PANEL_H);
    expect(p.tailX).toBe(150);
  });

  it("flips below a pin crowded against the top", () => {
    const p = anchorPanel(200, 60, PANEL_W, PANEL_H, W, H);
    expect(p.below).toBe(true);
    expect(p.top).toBe(60 + 12);
  });

  it("clamps into the left edge and drags the tail along", () => {
    const p = anchorPanel(10, 400, PANEL_W, PANEL_H, W, H);
    expect(p.left).toBe(12);
    expect(p.tailX).toBeGreaterThanOrEqual(18);
  });

  it("clamps into the right edge", () => {
    const p = anchorPanel(395, 400, PANEL_W, PANEL_H, W, H);
    expect(p.left).toBe(W - PANEL_W - 12);
    expect(p.tailX).toBeLessThanOrEqual(PANEL_W - 18);
  });

  it("clamps a taller-than-room panel to the top edge", () => {
    const p = anchorPanel(200, 590, PANEL_W, 580, W, H);
    expect(p.top).toBe(12);
  });
});
