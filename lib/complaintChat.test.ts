import { describe, expect, it } from "vitest";
import { buildChatEvidence, chatCandidateJson, parseChatMessageIds, parseStoredChatEvidence } from "./complaintChat";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const msg = (n: number, sender: string, over: Record<string, unknown> = {}) => ({
  id: U(n), sender_id: sender, kind: "text", body: `hi ${n}`, attachments: [], created_at: `2026-10-14T10:0${n}:00Z`, ...over,
});

describe("parseChatMessageIds", () => {
  it("defaults to empty", () => expect(parseChatMessageIds(undefined)).toEqual([]));
  it("rejects bad input", () => {
    expect(parseChatMessageIds("x")).toHaveProperty("error");
    expect(parseChatMessageIds(["nope"])).toHaveProperty("error");
    expect(parseChatMessageIds([U(1), U(1)])).toHaveProperty("error");
    expect(parseChatMessageIds(Array.from({ length: 21 }, (_, i) => U(i + 1)))).toHaveProperty("error");
  });
  it("accepts up to 20", () => expect(parseChatMessageIds(Array.from({ length: 20 }, (_, i) => U(i + 1)))).toHaveLength(20));
});

describe("buildChatEvidence", () => {
  const rows = [msg(1, "f"), msg(2, "t"), msg(3, "f", { kind: "image", body: null, attachments: [{ path: "f/a.jpg" }] }), msg(4, "f", { kind: "voice" })];
  it("snapshots text in time order with roles", () => {
    const r = buildChatEvidence([U(2), U(1)], rows, "f", "t");
    expect(Array.isArray(r) && r.map((x) => x.sender)).toEqual(["filer", "target"]);
  });
  it("rejects image messages (photos must be taken live)", () => {
    expect(buildChatEvidence([U(3)], rows, "f", "t")).toHaveProperty("error");
  });
  it("rejects foreign / unsupported messages", () => {
    expect(buildChatEvidence([U(9)], rows, "f", "t")).toHaveProperty("error");
    expect(buildChatEvidence([U(4)], rows, "f", "t")).toHaveProperty("error"); // 語音不可附
  });
});

describe("candidates & stored", () => {
  it("me/them view and skips junk", () => {
    expect(chatCandidateJson(msg(1, "f"), "f", "t")).toMatchObject({ from: "me", kind: "text" });
    expect(chatCandidateJson(msg(2, "t"), "f", "t")).toMatchObject({ from: "them" });
    expect(chatCandidateJson(msg(4, "f", { kind: "voice" }), "f", "t")).toBeNull();
  });
  it("drops bad stored elements", () => {
    expect(parseStoredChatEvidence([{ id: "a", at: "x", sender: "filer", kind: "text", body: "b" }, { id: 1 }, null])).toHaveLength(1);
    expect(parseStoredChatEvidence("x")).toEqual([]);
  });
});
