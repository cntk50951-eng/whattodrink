import { describe, expect, it } from "vitest";

import { trailStops } from "./trail";

const RECORD = {
  beer: { id: "asahi", emoji: "🍺", name: "Asahi", category: "lager", tagline: "t" },
  at: 1_700_000_000_000,
  position: { lat: 22.28, lng: 114.15 },
  placeName: "中環",
};

describe("trailStops (UR3.4)", () => {
  it("returns no stops without my own check-ins (never invents)", () => {
    expect(trailStops([])).toEqual([]);
  });

  it("turns my want history into ordered stops", () => {
    const older = { ...RECORD, at: RECORD.at - 1000 };
    const stops = trailStops([RECORD, older]);
    expect(stops).toHaveLength(2);
    expect(stops[0]?.beerId).toBe("asahi");
    expect(stops[1]?.beerName).toBe("Asahi");
    expect(stops[0]?.at).toBeLessThan(stops[1]?.at ?? 0);
  });
});
