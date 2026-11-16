import { describe, expect, it } from "vitest";

import { INTRO_COPY } from "./copy";
import { END_SEC, SCENES, TOTAL_FRAMES, TOTAL_SEC } from "./story";

describe("intro narrative sequence", () => {
  it("takes the edited photo directly to its map story", () => {
    const ids = SCENES.map((scene) => scene.id);
    expect(ids.slice(0, 3)).toEqual(["capture", "edit", "map"]);
    expect(ids).not.toContain("publish");
    expect(SCENES.flatMap((scene) => scene.shots.map((shot) => shot.name))).not.toContain("preview");
  });

  it("continues from Ivy straight into Liar's Dice before mixing a drink", () => {
    const ids = SCENES.map((scene) => scene.id);
    expect(ids.slice(ids.indexOf("ivy"), ids.indexOf("ivy") + 3)).toEqual(["ivy", "dice", "cocktail"]);
  });

  it("keeps all three languages and accessible page copy in the same scene order", () => {
    for (const copy of Object.values(INTRO_COPY)) {
      expect(Object.keys(copy.scenes)).toEqual(SCENES.map((scene) => scene.id));
      expect(copy.scenes).not.toHaveProperty("publish");
    }
  });

  it("keeps the shortened timeline valid for every remaining screen and the ending", () => {
    expect(TOTAL_SEC).toBeCloseTo(110.7);
    expect(END_SEC).toBeCloseTo(103.7);
    expect(Number.isInteger(TOTAL_FRAMES)).toBe(true);
    for (const scene of SCENES) for (const shot of scene.shots) {
      expect(shot.at).toBeGreaterThanOrEqual(0);
      expect(shot.at).toBeLessThan(scene.dur);
    }
  });
});
