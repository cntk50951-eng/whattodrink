import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import backup from "../../docs/intro-backup-2026-11-14.json";

describe("original intro backup", () => {
  it("preserves the original renderer and every original image byte for byte", () => {
    expect(backup.files.length).toBeGreaterThan(20);
    for (const file of [...backup.files, backup.backupPage]) {
      const bytes = readFileSync(resolve(process.cwd(), file.path));
      expect(createHash("sha256").update(bytes).digest("hex"), file.path).toBe(file.sha256);
    }
  });
  it("keeps the backup on the old renderer rather than showing the replacement", () => {
    const page = readFileSync(resolve(process.cwd(), backup.backupPage.path), "utf8");
    expect(page).toContain('@/components/intro/IntroClient');
    expect(page).not.toContain('@/components/intro-next/IntroClient');
    expect(page).toContain('index: false');
    expect(backup.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
  });
});
