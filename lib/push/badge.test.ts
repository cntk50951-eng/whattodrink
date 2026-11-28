import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeBadge } from "./badge";

type R = Record<string, unknown>;
function database(tables: Record<string, R[]>, queried: string[] = [], failTable?: string): SupabaseClient {
  class Query implements PromiseLike<{ data: unknown; count: number; error: unknown }> {
    filters: ((r: R) => boolean)[] = [];
    constructor(readonly table: string) {}
    select() { return this; }
    eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
    neq(k: string, v: unknown) { this.filters.push((r) => r[k] !== v); return this; }
    gt(k: string, v: string) { this.filters.push((r) => String(r[k]) > v); return this; }
    is(k: string, v: null) { this.filters.push((r) => (r[k] ?? null) === v); return this; }
    in(k: string, v: unknown[]) { this.filters.push((r) => v.includes(r[k])); return this; }
    or() { return this; }
    limit() { return this; }
    then<A = { data: unknown; count: number; error: unknown }, B = never>(
      ok?: ((v: { data: unknown; count: number; error: unknown }) => A | PromiseLike<A>) | null,
      bad?: ((e: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      queried.push(this.table);
      const rows = (tables[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
      const failed = this.table === failTable;
      return Promise.resolve({ data: failed ? null : rows, count: failed ? 0 : rows.length, error: failed ? { code: "unit" } : null }).then(ok, bad);
    }
  }
  return { from: (t: string) => new Query(t) } as unknown as SupabaseClient;
}

const past = "2026-11-01T00:00:00.000Z";
const later = "2026-11-02T00:00:00.000Z";
const future = "2999-01-01T00:00:00.000Z";
const msg = (conversation_id: string, over: R = {}): R => ({ conversation_id, sender_id: "peer", created_at: later, deleted_at: null, ...over });
function tables(): Record<string, R[]> {
  return {
    conversation_members: [
      { conversation_id: "live", user_id: "me", last_read_at: past },
      { conversation_id: "live", user_id: "peer", last_read_at: past },
    ],
    conversations: [{ id: "live", expires_at: future }],
    friendships: [{ user_id: "me", friend_id: "peer", status: "accepted" }],
    messages: [msg("live")],
  };
}

describe("computeBadge chat unread (DEF-20261127-038)", () => {
  it("counts an unread message from a friend", async () => {
    expect(await computeBadge(database(tables()), "me")).toMatchObject({ chat_unread: 1, stranger_unread: 0, badge: 1 });
  });
  it("ignores recalled messages", async () => {
    const t = tables();
    t.messages.push(msg("live", { deleted_at: later }));
    expect(await computeBadge(database(t), "me")).toMatchObject({ chat_unread: 1, badge: 1 });
    t.messages = [msg("live", { deleted_at: later })];
    expect(await computeBadge(database(t), "me")).toMatchObject({ chat_unread: 0, badge: 0 });
  });
  it("ignores expired conversations and does not count their messages at all", async () => {
    const t = tables();
    t.conversation_members.push({ conversation_id: "old", user_id: "me", last_read_at: past }, { conversation_id: "old", user_id: "peer", last_read_at: past });
    t.conversations.push({ id: "old", expires_at: past });
    t.messages.push(msg("old"), msg("old"));
    const queried: string[] = [];
    expect(await computeBadge(database(t, queried), "me")).toMatchObject({ chat_unread: 1, badge: 1 });
    expect(queried.filter((name) => name === "messages")).toHaveLength(1);
  });
  it("keeps counting when the expiry lookup fails instead of clearing every chat", async () => {
    expect(await computeBadge(database(tables(), [], "conversations"), "me")).toMatchObject({ chat_unread: 1 });
  });
  it("keeps stranger unread separate", async () => {
    const t = tables();
    t.friendships = [];
    expect(await computeBadge(database(t), "me")).toMatchObject({ chat_unread: 0, stranger_unread: 1, badge: 1 });
  });
});
