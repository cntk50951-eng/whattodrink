import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as CHEER } from "../../app/api/v1/cheers/route";
import { POST as CHECKIN } from "../../app/api/v1/checkins/route";
import { POST as CHAT } from "../../app/api/v1/conversations/route";
import { PATCH as FRIEND_REPLY } from "../../app/api/v1/friends/requests/[id]/route";
import { POST as FRIEND_ADD } from "../../app/api/v1/friends/route";
import { POST as INVITE } from "../../app/api/v1/invites/route";
import { POST as GAME_JOIN } from "../../app/api/v1/games/rooms/join/route";
import { PATCH as PATCH_ME } from "../../app/api/v1/me/route";
import { POST as PARTY_JOIN } from "../../app/api/v1/parties/[id]/joins/route";
import { hasBlockOrMute } from "../games/rooms";

/**
 * DEF-20261128-014：用來決定放不放行的 `users` 讀取出錯時，路由必須回 503 且不寫任何資料。
 * 假資料庫裡其他表都給「本來會成功」的資料，拿掉檢查這些測試就會失敗。
 */
const server = vi.hoisted(() => ({ authed: vi.fn(), service: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getAuthedClient: server.authed, createServiceClient: server.service }));
// vitest 沒有 `@/` 別名：用到的 lib 以相對路徑接上，本測試走不到的整包替身
vi.mock("@/lib/api/envelope", () => import("./envelope"));
vi.mock("@/lib/api/userRead", () => import("./userRead"));
vi.mock("@/lib/api/blocks", () => import("./blocks"));
vi.mock("@/lib/api/cheers", () => import("./cheers"));
vi.mock("@/lib/api/checkins", () => import("./checkins"));
vi.mock("@/lib/api/privacy", () => import("./privacy"));
vi.mock("@/lib/api/profile", () => import("./profile"));
vi.mock("@/lib/api/taste", () => import("./taste"));
vi.mock("@/lib/api/party", () => import("./party"));
vi.mock("@/lib/api/checkinIdempotency", () => import("./checkinIdempotency"));
vi.mock("@/lib/mode", () => import("../mode"));
vi.mock("@/lib/friends", () => import("../friends"));
vi.mock("@/lib/rateLimit", () => import("../rateLimit"));
vi.mock("@/lib/games/rooms", () => import("../games/rooms"));
vi.mock("@/lib/hashtagLibrary", () => ({}));
vi.mock("@/lib/moderation", () => ({ moderateCheckin: async () => ({}), moderationAction: () => "allow" }));
vi.mock("@/lib/barCredits", () => ({}));
vi.mock("@/lib/accountDeletion", () => ({ isDeletionPending: async () => false }));
vi.mock("@/lib/appleSignIn", () => ({}));
vi.mock("@/lib/push/prefs", () => ({}));
vi.mock("@/lib/push/send", () => ({}));
vi.mock("@/lib/trust/ledger", () => ({ writeTrustEvent: vi.fn() }));
vi.mock("@/lib/api/chat", () => import("./chat"));
vi.mock("@/lib/api/invites", () => import("./invites"));
vi.mock("@/lib/api/clientRequestId", () => import("./clientRequestId"));
vi.mock("next/server", () => ({ after: vi.fn(), NextResponse: Response }));

const me = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
type Result = { data: unknown; error: unknown; count?: number };

/** `fails(columns)` 為真的 users 查詢回錯誤；其餘照給資料。 */
function database(fails: (columns: string) => boolean, broken: string[] = [], tables: Record<string, unknown[]> = {}) {
  const writes: string[] = [];
  const rows: Record<string, unknown> = {
    users: { id: me, mode: "public", gender: "male", dob: "1990-01-01", nickname: "a" },
    checkins: { id: "post", user_id: other, visibility: "public", created_at: new Date().toISOString() },
    parties: {
      id: "party", host_user_id: other, seats_total: 4, seats_male: 0, seats_female: 0,
      status: "open", expires_at: new Date(Date.now() + 3600_000).toISOString(),
    },
  };
  const from = (table: string) => {
    let columns = "";
    let id: unknown;
    const result = (single: boolean): Result =>
      (table === "users" && fails(columns)) || broken.includes(table)
        ? { data: null, error: { code: "unit" } }
        : {
            // users 按查詢的 id 回那一行（否則「對方」會變成自己）
            data: single ? (table === "users" && typeof id === "string" ? { ...(rows.users as object), id } : (rows[table] ?? null)) : (tables[table] ?? []),
            error: null,
            count: 0,
          };
    const chain: Record<string, unknown> = {};
    chain.eq = (k: string, v: unknown) => (k === "id" ? (id = v) : null, chain);
    for (const k of ["neq", "or", "in", "gt", "gte", "lt", "lte", "not", "is", "order", "limit"]) chain[k] = () => chain;
    chain.select = (c: string) => ((columns = c), chain);
    for (const k of ["insert", "update", "upsert", "delete"]) chain[k] = () => (writes.push(`${table}.${k}`), chain);
    chain.single = async () => result(true);
    chain.maybeSingle = async () => result(true);
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result(false)).then(resolve);
    return chain;
  };
  const db = { from, rpc: async () => ({ data: null, error: null }) };
  server.authed.mockResolvedValue({ supabase: db, userId: me });
  server.service.mockResolvedValue(db);
  return writes;
}
const request = (body: unknown, method = "POST") =>
  new Request("http://localhost/x", { method, body: JSON.stringify(body) });

describe("讀不到帳號狀態就拒絕（DEF-20261128-014）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  const refused = async (res: Response, writes: string[]) => {
    expect(res.status).toBe(503);
    expect(writes).toEqual([]);
  };

  it("敬酒：讀不到自己是否隱身", async () => {
    const writes = database((c) => c === "mode");
    await refused(await CHEER(request({ checkin_id: "post" })), writes);
  });
  it("敬酒：讀不到生日", async () => {
    const writes = database((c) => c === "dob");
    await refused(await CHEER(request({ checkin_id: "post" })), writes);
  });
  it("參加酒局：讀不到自己的模式與生日", async () => {
    const writes = database((c) => c.startsWith("mode,gender"));
    await refused(await PARTY_JOIN(request({}), { params: Promise.resolve({ id: "party" }) }), writes);
  });
  it("改個人資料：讀不到目前資料（否則生日可改、改名限次失效）", async () => {
    const writes = database((c) => c.includes("nickname_daily_count"));
    await refused(await PATCH_ME(request({ bio: "hi" }, "PATCH")), writes);
  });
  it("加入遊戲房：讀不到停玩狀態", async () => {
    const writes = database((c) => c === "game_banned_until");
    const res = await GAME_JOIN(request({ code: "123456" }));
    // 檢查前只會清過期房（維護寫入），不能有任何入座寫入
    expect(res.status).toBe(503);
    expect(writes.filter((w) => w.startsWith("game_room_players."))).toEqual([]);
  });
  it("打卡：讀不到默認可見性時不發佈（否則會發成公開）", async () => {
    const writes = database((c) => c === "checkin_visibility");
    await refused(await CHECKIN(request({ lat: 22.3, lng: 114.1, note: "hi" })), writes);
  });
});

describe("讀不到封鎖名單就拒絕（DEF-20261128-016）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  const none = () => false;
  const invitation = { to_user_id: other, place: "bar", slot: "tonight", bill_intent: "aa" };
  const refused = async (res: Response, writes: string[]) => {
    expect(res.status).toBe(503);
    expect(writes.filter((w) => !w.startsWith("users."))).toEqual([]);
  };

  it("發起聊天", async () => {
    const writes = database(none, ["cheers_blocks"]);
    await refused(await CHAT(request({ user_id: other })), writes);
  });
  it("約酒", async () => {
    const writes = database(none, ["cheers_blocks"]);
    await refused(await INVITE(request(invitation)), writes);
  });
  it("約酒：被對方封鎖也擋（走服務端身分才看得到反向封鎖）", async () => {
    const writes = database(none, [], { cheers_blocks: [{ blocker_id: other, blocked_id: me }] });
    const res = await INVITE(request(invitation));
    expect(res.status).toBe(403);
    expect(writes).toEqual([]);
  });
  it("發好友申請", async () => {
    const writes = database(none, ["cheers_blocks"]);
    await refused(await FRIEND_ADD(request({ friend_id: other })), writes);
  });
  it("接受好友申請", async () => {
    database(none, ["cheers_blocks"]);
    const writes: string[] = [];
    const db = await server.service();
    const from = db.from;
    db.from = (table: string) => {
      const chain = from(table);
      if (table === "friendships") chain.maybeSingle = async () => ({ data: { id: "r", user_id: other, friend_id: me, status: "pending" }, error: null });
      for (const k of ["insert", "update", "upsert", "delete"]) chain[k] = () => (writes.push(`${table}.${k}`), chain);
      return chain;
    };
    await refused(await FRIEND_REPLY(request({ action: "accept" }, "PATCH"), { params: Promise.resolve({ id: "r" }) }), writes);
  });
  it("遊戲房的封鎖／靜音判定", async () => {
    for (const table of ["cheers_blocks", "chat_mutes"]) {
      database(none, [table]);
      await expect(hasBlockOrMute(await server.service(), me, other)).rejects.toThrow("block-lookup-failed");
    }
  });
});
