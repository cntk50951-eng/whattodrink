import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type Reference = { file: string; sha256: string; source: string; note: string };
const root = new URL("../../public/intro-next/", import.meta.url);
const references: Reference[] = JSON.parse(readFileSync(new URL("references/manifest.json", root), "utf8"));

describe("cocktail and map replay reference provenance", () => {
  for (const reference of references) {
    it(`preserves the untouched source ${reference.file}`, () => {
      const bytes = readFileSync(new URL(`references/${reference.file}`, root));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(reference.sha256);
      expect(reference.source.length).toBeGreaterThan(0);
    });
  }
  it("records the recipe screenshot limitation rather than treating it as a successful flow", () => {
    expect(references.find((entry) => entry.file === "cocktail-recipe-attempt-report.jpg")?.note).toContain("remains on the cocktail book");
  });
  it("explains translations for labels hardcoded in the original Swift view", () => {
    const labels: Record<string, unknown> = JSON.parse(readFileSync(new URL("ios-ui-copy.json", root), "utf8"));
    const provenance: Record<string, { source: string; localization: string }> = JSON.parse(readFileSync(new URL("ui-copy-provenance.json", root), "utf8"));
    const derived = Object.keys(labels).filter((key) => key.startsWith("intro.trail."));
    expect(derived.length).toBeGreaterThan(0);
    for (const key of derived) {
      expect(provenance[key]?.source).toContain("TrailMapView.swift");
      expect(provenance[key]?.localization).toContain("translated");
    }
  });
});
