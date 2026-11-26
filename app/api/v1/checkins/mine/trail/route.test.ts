import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getMap } from "./map/route";
import { GET as getList } from "./route";

const auth = vi.hoisted(() => ({
  get: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getAuthedClient: auth.get }));
// vitest 沒有 `@/` 別名（無 vitest.config）：路由的 lib 依賴照倉內慣例用相對路徑接上
vi.mock("@/lib/api/checkins", () => import("../../../../../../lib/api/checkins"));
vi.mock("@/lib/api/envelope", () => import("../../../../../../lib/api/envelope"));
vi.mock("@/lib/api/myTrail", () => import("../../../../../../lib/api/myTrail"));

const id = "11111111-1111-1111-1111-111111111111";
const nextId = "22222222-2222-2222-2222-222222222222";
const at = "2026-11-01T10:01:02.123456Z";
const cursor = `${at}|${id}`;
const checkin = {
  id, beer_id: null, lat: 22.3, lng: 114.1, place_name: "Central",
  kind: "flash", visibility: "private", expires_at: null, created_at: at,
  photo_thumb: "data:image/jpeg;base64,dGh1bWI=",
};
const makeReq = (path = "", params: Record<string, string> = {}) =>
  new Request(`http://localhost/api/v1/checkins/mine/trail${path}?${new URLSearchParams(params)}`);
const bbox = "114.1,22.3,114.1,22.3";

describe("owner trail API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.get.mockResolvedValue({ supabase: { rpc: auth.rpc }, userId: id });
  });

  it("rejects unauthenticated reads before invoking either RPC", async () => {
    auth.get.mockResolvedValue({ supabase: { rpc: auth.rpc }, userId: null });
    expect((await getList(makeReq())).status).toBe(401);
    expect((await getMap(makeReq("/map"))).status).toBe(401);
    expect(auth.rpc).not.toHaveBeenCalled();
  });

  it("uses a microsecond cursor and accepts degenerate drill-down bounds", async () => {
    auth.rpc.mockResolvedValue({ data: [], error: null });
    const res = await getList(makeReq("", { cursor, bbox }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(auth.rpc).toHaveBeenCalledWith("my_checkin_trail_page", {
      p_limit: 30, p_after_at: at, p_after_id: id,
      p_west: 114.1, p_east: 114.1, p_south: 22.3, p_north: 22.3,
    });
    expect(await res.json()).toEqual({ checkins: [], next_cursor: null });
  });

  it("emits the last displayed row's cursor when a sentinel row is present", async () => {
    auth.rpc.mockResolvedValue({
      data: [
        { checkin, page_cursor: cursor },
        { checkin: { ...checkin, id: nextId }, page_cursor: `${at}|${nextId}` },
      ],
      error: null,
    });
    const res = await getList(makeReq("", { limit: "1" }));
    expect(await res.json()).toMatchObject({
      checkins: [{ id, photo_url: checkin.photo_thumb, audio_url: null }],
      next_cursor: cursor,
    });
  });

  it("preserves cursor progress across a malformed DB row", async () => {
    auth.rpc.mockResolvedValue({
      data: [
        { checkin: null, page_cursor: cursor },
        { checkin: { ...checkin, id: nextId }, page_cursor: `${at}|${nextId}` },
      ],
      error: null,
    });
    const res = await getList(makeReq("", { limit: "1" }));
    expect(await res.json()).toEqual({ checkins: [], next_cursor: cursor });
  });

  it("rejects out-of-range inputs and degenerate map viewports", async () => {
    expect((await getList(makeReq("", { limit: "51" }))).status).toBe(400);
    expect((await getList(makeReq("", { cursor: "wrong" }))).status).toBe(400);
    expect((await getMap(makeReq("/map", { bbox, zoom: "16" }))).status).toBe(400);
    expect((await getMap(makeReq("/map", { bbox: "114,22,115,23", zoom: "25" }))).status).toBe(400);
    expect(auth.rpc).not.toHaveBeenCalled();
  });

  it("passes a wrapping map viewport and returns singles and cluster bounds", async () => {
    const single = { ...checkin, photo_thumb: null };
    const singlePoint = { id, lat: 22.3, lng: 114.1, count: 1, checkin: single, bbox: null };
    const clusterPoint = { id: "trail:16:1:2", lat: 22.3, lng: 179.9, count: 4, checkin: null, bbox: "179.9,22.3,-179.9,22.4" };
    auth.rpc.mockResolvedValue({ data: [singlePoint, clusterPoint], error: null });
    const res = await getMap(makeReq("/map", { bbox: "110,20,-170,25", zoom: "10.5" }));
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(auth.rpc).toHaveBeenCalledWith("my_checkin_trail_map", {
      p_west: 110, p_south: 20, p_east: -170, p_north: 25, p_zoom: 10.5,
    });
    expect(await res.json()).toMatchObject({
      points: [{ ...singlePoint, checkin: { id, photo_url: null } }, clusterPoint],
    });
  });

  it("attaches the global stop number and total from 0092 to list rows and map singles (DEF-20261125-035)", async () => {
    auth.rpc.mockImplementation(async (fn: string) => {
      if (fn === "my_checkin_trail_seq") return { data: [{ id, seq: 6, total: 9 }], error: null };
      if (fn === "my_checkin_trail_page") return { data: [{ checkin, page_cursor: cursor }], error: null };
      return {
        data: [
          { id, lat: 22.3, lng: 114.1, count: 1, checkin, bbox: null },
          { id: "trail:16:1:2", lat: 22.3, lng: 114.1, count: 3, checkin: null, bbox: bbox },
        ],
        error: null,
      };
    });
    const list = await (await getList(makeReq())).json();
    expect(list.total).toBe(9);
    expect(list.checkins[0]).toMatchObject({ id, seq: 6 });
    expect(auth.rpc).toHaveBeenCalledWith("my_checkin_trail_seq", { p_ids: [id] });
    const map = await (await getMap(makeReq("/map", { bbox: "114,22,115,23", zoom: "12" }))).json();
    expect(map.total).toBe(9);
    expect(map.points[0]).toMatchObject({ seq: 6 });
    expect(map.points[1].seq).toBeUndefined();
  });

  it("keeps serving the trail without seq when 0092 is not deployed", async () => {
    auth.rpc.mockImplementation(async (fn: string) =>
      fn === "my_checkin_trail_seq"
        ? { data: null, error: { code: "PGRST202", message: "missing" } }
        : { data: [{ checkin, page_cursor: cursor }], error: null },
    );
    const res = await getList(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBeUndefined();
    expect(body.checkins[0].seq).toBeUndefined();
  });
});
