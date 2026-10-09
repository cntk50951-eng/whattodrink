import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import {
  PINS_CHANGES_PROBE,
  PINS_RANGE_MS,
  capCount,
  parseBbox,
  parseRange,
  parseSince,
  type BBox,
} from "@/lib/api/pins";
import { friendIdsOf, parseScope } from "@/lib/friends";

/**
 * UR E.29 地图新内容轻量计数（🌐匿名可看；scope=friends 需登录 401；iOS-0.71）。
 * `GET /api/v1/map/pins/changes?bbox=&since=&near=&scope=&range=` —— 回两类计数
 * （各上限 99＋capped）＋服务端 cursor（ms 数字，下轮 since 原样回传）。
 * 可见性与 /map/pins 逐字一致（private 不算／flash 过期不算／friends scope／range 窗；
 * 坐标按库内真实值过滤，与 pins 同规则）；登录排除自己（作者／host）；匿名不排除。
 * 计数 bounded（各流 range 100 行代码数，不全表 COUNT）；near 显示用，过滤仍走 bbox。
 */

type BBoxFilter = {
  south: number;
  north: number;
  west: number;
  east: number;
};

function bboxOf(b: BBox): BBoxFilter {
  return { south: b.south, north: b.north, west: b.west, east: b.east };
}

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const bboxParsed = parseBbox(q.get("bbox"));
  if ("error" in bboxParsed) {
    return apiError("invalid_params", bboxParsed.error, 400);
  }
  const rangeParsed = parseRange(q.get("range"));
  if ("error" in rangeParsed) {
    return apiError("invalid_params", rangeParsed.error, 400);
  }
  const scopeParsed = parseScope(q.get("scope"));
  if ("error" in scopeParsed) {
    return apiError("invalid_params", scopeParsed.error, 400);
  }
  const nowMs = Date.now();
  const sinceParsed = parseSince(q.get("since"), nowMs, PINS_RANGE_MS[rangeParsed.range]);
  if ("error" in sinceParsed) {
    return apiError("invalid_params", sinceParsed.error, 400);
  }
  const sinceIso = new Date(sinceParsed.sinceMs).toISOString();
  const nowIso = new Date(nowMs).toISOString();
  const cutoffIso = new Date(nowMs - PINS_RANGE_MS[rangeParsed.range]).toISOString();
  const box = bboxOf(bboxParsed.bbox);

  const { supabase, userId: viewerId } = await getAuthedClient(req);
  if (scopeParsed.scope === "friends" && viewerId === null) {
    return apiError("unauthorized", "未登录", 401);
  }

  // friends scope 好友集（空即 checkins 两类计 0，不下空 in）。
  let friendIds: string[] = [];
  if (scopeParsed.scope === "friends" && viewerId !== null) {
    const { data: fsRows } = await supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .eq("status", "accepted")
      .or(`user_id.eq.${viewerId},friend_id.eq.${viewerId}`);
    friendIds = friendIdsOf(
      viewerId,
      ((fsRows ?? []) as unknown[]) as { user_id: unknown; friend_id: unknown; status: unknown }[],
    );
  }

  const countProbe = async (
    build: () => Promise<{ data: unknown[] | null; error: { code: string; message: string } | null }>,
    tag: string,
  ): Promise<number> => {
    try {
      const { data, error } = await build();
      if (error !== null) {
        console.error(`[api/v1/map/pins/changes] ${tag} error: code=${error.code} message=${error.message}`);
        return 0;
      }
      return (data ?? []).length;
    } catch (e) {
      console.error(`[api/v1/map/pins/changes] ${tag} threw: ${e instanceof Error ? e.message : "unknown"}`);
      return 0;
    }
  };

  // 打卡两流（flash 24h 内／post range 内；与 pins 同过滤＋created 下界＋排除自己）。
  const checkinCounts: Promise<number>[] = [];
  if (scopeParsed.scope === "friends") {
    if (friendIds.length > 0 && viewerId !== null) {
      const vis = ["friends", "public"];
      checkinCounts.push(
        countProbe(
          () =>
            supabase
              .from("checkins")
              .select("id")
              .in("visibility", vis)
              .in("user_id", friendIds)
              .eq("kind", "flash")
              .gt("expires_at", nowIso)
              .gt("created_at", sinceIso)
              .neq("user_id", viewerId)
              .not("lat", "is", null)
              .not("lng", "is", null)
              .gte("lat", box.south)
              .lte("lat", box.north)
              .gte("lng", box.west)
              .lte("lng", box.east)
              .range(0, PINS_CHANGES_PROBE - 1) as unknown as Promise<{
              data: unknown[] | null;
              error: { code: string; message: string } | null;
            }>,
          "checkins-flash",
        ),
      );
      checkinCounts.push(
        countProbe(
          () =>
            supabase
              .from("checkins")
              .select("id")
              .in("visibility", vis)
              .in("user_id", friendIds)
              .eq("kind", "post")
              .gte("created_at", cutoffIso)
              .gt("created_at", sinceIso)
              .neq("user_id", viewerId)
              .not("lat", "is", null)
              .not("lng", "is", null)
              .gte("lat", box.south)
              .lte("lat", box.north)
              .gte("lng", box.west)
              .lte("lng", box.east)
              .range(0, PINS_CHANGES_PROBE - 1) as unknown as Promise<{
              data: unknown[] | null;
              error: { code: string; message: string } | null;
            }>,
          "checkins-post",
        ),
      );
    }
  } else {
    const mine = viewerId === null ? null : viewerId;
    const flashBase = supabase
      .from("checkins")
      .select("id")
      .eq("visibility", "public")
      .eq("kind", "flash")
      .gt("expires_at", nowIso)
      .gt("created_at", sinceIso);
    const postBase = supabase
      .from("checkins")
      .select("id")
      .eq("visibility", "public")
      .eq("kind", "post")
      .gte("created_at", cutoffIso)
      .gt("created_at", sinceIso);
    const flashQ = mine === null ? flashBase : flashBase.neq("user_id", mine);
    const postQ = mine === null ? postBase : postBase.neq("user_id", mine);
    checkinCounts.push(
      countProbe(
        () =>
          flashQ
            .not("lat", "is", null)
            .not("lng", "is", null)
            .gte("lat", box.south)
            .lte("lat", box.north)
            .gte("lng", box.west)
            .lte("lng", box.east)
            .range(0, PINS_CHANGES_PROBE - 1) as unknown as Promise<{
            data: unknown[] | null;
            error: { code: string; message: string } | null;
          }>,
        "checkins-flash",
      ),
      countProbe(
        () =>
          postQ
            .not("lat", "is", null)
            .not("lng", "is", null)
            .gte("lat", box.south)
            .lte("lat", box.north)
            .gte("lng", box.west)
            .lte("lng", box.east)
            .range(0, PINS_CHANGES_PROBE - 1) as unknown as Promise<{
            data: unknown[] | null;
            error: { code: string; message: string } | null;
          }>,
        "checkins-post",
      ),
    );
  }

  // 酒局（缺省看板口径：open＋未过期＋created 下界＋bbox；host 是自己不计）。
  const partyBase = supabase
    .from("parties")
    .select("id")
    .eq("status", "open")
    .gt("expires_at", nowIso)
    .gt("created_at", sinceIso);
  const partyQ = viewerId === null ? partyBase : partyBase.neq("host_user_id", viewerId);
  const partyCount = countProbe(
    () =>
      partyQ
        .gte("lat", box.south)
        .lte("lat", box.north)
        .gte("lng", box.west)
        .lte("lng", box.east)
        .range(0, PINS_CHANGES_PROBE - 1) as unknown as Promise<{
        data: unknown[] | null;
        error: { code: string; message: string } | null;
      }>,
    "parties",
  );

  const checkinRows = await Promise.all(checkinCounts);
  const partyRows = await partyCount;
  const checkins = capCount(checkinRows.reduce((a, b) => a + b, 0));
  const parties = capCount(partyRows);
  const cacheControl = viewerId === null ? "public, max-age=10" : "private, max-age=10";
  return apiOk({ checkins, parties, cursor: nowMs }, 200, { "Cache-Control": cacheControl });
}
