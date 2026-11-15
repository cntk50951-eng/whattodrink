import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type Capture = { file: string; sha256: string; width: number; height: number };
const base = new URL("../../public/intro-next/captures/", import.meta.url);
const manifest: Capture[] = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8"));

describe("actual app capture integrity", () => {
  for (const capture of manifest) {
    it(`${capture.file} retains the approved original screenshot bytes and dimensions`, () => {
      const png = readFileSync(new URL(capture.file, base));
      expect(createHash("sha256").update(png).digest("hex")).toBe(capture.sha256);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect(png.readUInt32BE(16)).toBe(capture.width);
      expect(png.readUInt32BE(20)).toBe(capture.height);
    });
  }
});
