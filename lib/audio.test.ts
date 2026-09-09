import { describe, expect, it } from "vitest";

import { buildRecordingBlob } from "./audio";

describe("buildRecordingBlob", () => {
  it("空 chunks 回 null（錄到空包不給啞播放鈕）", () => {
    expect(buildRecordingBlob([], "audio/webm")).toBeNull();
  });

  it("全空 chunk 回 null", () => {
    expect(
      buildRecordingBlob(
        [new Blob([], { type: "audio/webm" })],
        "audio/webm",
      ),
    ).toBeNull();
  });

  it("丟掉空 chunk，有料就拼出可播 blob", () => {
    const blob = buildRecordingBlob(
      [new Blob([]), new Blob(["abc"], { type: "audio/webm" })],
      "audio/webm",
    );
    expect(blob).not.toBeNull();
    expect(blob?.size).toBeGreaterThan(0);
  });

  it("空 mimeType 退回 audio/webm", () => {
    const blob = buildRecordingBlob([new Blob(["x"])], "");
    expect(blob?.type).toBe("audio/webm");
  });
});
