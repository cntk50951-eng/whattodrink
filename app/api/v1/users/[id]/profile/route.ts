import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseCheckinIdParam, parseMineParams } from "@/lib/api/checkins";
import { friendsOnlyCountOf, visibleRowsFor } from "@/lib/api/privacy";
import { friendIdsOf } from "@/lib/friends";
import { hkAge, collectNightStats, infoVisibilityOf, weekNights, weekStreak } from "@/lib/api/profile";
import { aggregateTaste, TAXONOMY_VERSION } from "@/lib/api/taste";

type UserRow = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  gender: string;
  dob: string | null;
  bio: string | null;
  mode: string;
  created_at: string;
  preferences: unknown;
  height_cm: number | null;
  occupation: string | null;
  languages: string[] | null;
  interests: string[] | null;
  info_visibility: unknown;
};

/** 他人视角新欄：按可見性逐欄放行（缺鍵＝friends；被隱藏直接不出現，不留痕跡）。 */
function visibleInfoFor(
  u: UserRow,
  isFriend: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const put = (key: string, field: "height" | "occupation" | "languages" | "interests", value: unknown): void => {
    const vis = infoVisibilityOf(u.info_visibility, field);
    if (vis === "private") return;
    if (vis === "friends" && !isFriend) return;
    out[key] = value;
  };
  put("height_cm", "height", typeof u.height_cm === "number" ? u.height_cm : null);
  put("occupation", "occupation", typeof u.occupation === "string" ? u.occupation : null);
  put("languages", "languages", Array.isArray(u.languages) ? u.languages.filter((x): x is string => typeof x === "string") : []);
  put("interests", "interests", Array.isArray(u.interests) ? u.interests.filter((x): x is string => typeof x === "string") : []);
  return out;
}

/** preferences 读端窄化（写时已验；坏形回 null 不炸包）。 */
function narrowPreferences(
  raw: unknown,
): { favorites: string[]; likes: string[]; dislikes: string[] } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const arr = (v: unknown): string[] | null =>
    Array.isArray(v) && v.every((x): x is string => typeof x === "string") ? [...v] : null;
  const f = arr(r.favorites);
  const l = arr(r.likes);
  const d = arr(r.dislikes);
  if (f === null || l === null || d === null) return null;
  return { favorites: f, likes: l, dislikes: d };
}

const TASTE_STALE_MS = 10 * 60_000;

/**
 * UR E.28 口味推测（读时懒算：无缓存／超 10min／有新打卡即全量重算写回；
 * 确定性聚合 v1，不调 AI；iOS 文案须称"根據打卡推測"）。
 * 表未迁移（0036 未跑）即回 null（与"从没算过"同形，不炸包）。
 */
async function tasteInference(
  supa: Awaited<ReturnType<typeof createServiceClient>>,
  targetId: string,
  nowMs: number,
): Promise<{ sample_count: number; computed_at: string; groups: unknown[] } | null> {
  try {
    const { data: cacheRaw, error: cErr } = await supa
      .from("user_taste_inference")
      .select("payload,sample_count,computed_at,checkin_watermark")
      .eq("user_id", targetId)
      .maybeSingle();
    if (cErr !== null) return null;
    const cache = cacheRaw as {
      payload: unknown;
      sample_count: number;
      computed_at: string;
      checkin_watermark: string | null;
    } | null;
    const [{ data: nMain }, { data: nArch }] = await Promise.all([
      supa.from("checkins").select("created_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(1),
      supa.from("checkins_archive").select("created_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(1),
    ]);
    const newest = [nMain, nArch]
      .flat()
      .map((r) => (r as { created_at?: unknown } | null)?.created_at)
      .filter((v): v is string => typeof v === "string")
      .sort()
      .pop() ?? null;
    const stale =
      cache === null ||
      !Number.isFinite(Date.parse(cache.computed_at)) ||
      nowMs - Date.parse(cache.computed_at) > TASTE_STALE_MS ||
      (cache.payload as Record<string, unknown> | null)?.v !== TAXONOMY_VERSION ||
      (newest !== null &&
        (cache.checkin_watermark === null || newest > cache.checkin_watermark));
    if (!stale && cache !== null) {
      const groups =
        cache.sample_count < 5
          ? []
          : Array.isArray((cache.payload as Record<string, unknown>)?.groups)
            ? ((cache.payload as Record<string, unknown>).groups as unknown[])
            : [];
      return { sample_count: cache.sample_count, computed_at: cache.computed_at, groups };
    }
    // 全量信号（tags＋酒款分类；主＋归档）。
    const [{ data: mainRows }, { data: archRows }] = await Promise.all([
      supa.from("checkins").select("tags,beer_id").eq("user_id", targetId),
      supa.from("checkins_archive").select("tags,beer_id").eq("user_id", targetId),
    ]);
    const all = [...((mainRows ?? []) as unknown[]), ...((archRows ?? []) as unknown[])];
    const beerIds = [
      ...new Set(
        all
          .map((r) => (r as Record<string, unknown>)?.beer_id)
          .filter((id): id is string => typeof id === "string" && id !== ""),
      ),
    ];
    const catByBeer = new Map<string, string>();
    if (beerIds.length > 0) {
      const { data: beers } = await supa.from("beers").select("id,category").in("id", beerIds);
      for (const b of ((beers ?? []) as unknown[]) as Record<string, unknown>[]) {
        if (typeof b.id === "string" && typeof b.category === "string") {
          catByBeer.set(b.id, b.category);
        }
      }
    }
    const { groups, sample_count } = aggregateTaste(
      all.map((r) => {
        const rec = (r ?? {}) as Record<string, unknown>;
        return {
          tags: Array.isArray(rec.tags)
            ? (rec.tags as unknown[]).filter((x): x is string => typeof x === "string")
            : [],
          beerCategory:
            typeof rec.beer_id === "string" ? (catByBeer.get(rec.beer_id) ?? null) : null,
        };
      }),
    );
    const computedIso = new Date(nowMs).toISOString();
    const outGroups = sample_count < 5 ? [] : groups;
    await supa.from("user_taste_inference").upsert(
      {
        user_id: targetId,
        payload: { groups, v: TAXONOMY_VERSION },
        sample_count,
        computed_at: computedIso,
        checkin_watermark: newest,
      },
      { onConflict: "user_id" },
    );
    return { sample_count, computed_at: computedIso, groups: outGroups };
  } catch (e) {
    console.warn(`[api/v1/users/profile] taste skipped: ${e instanceof Error ? e.message : "unknown"}`);
    return null;
  }
}

/**
 * 好友视角推测（WEB_HANDOFF_FRIEND_TASTE_INFERENCE，iOS-0.95）：
 * 只用 public＋friends 行现算（private 永不进聚合）；不读本人缓存
 * （本人缓存是全量，复用即经条形图泄露私人帖），也不写缓存。
 * 形状与本人同（sample_count／computed_at／groups，<5 组空）。
 */
async function tasteInferenceForFriend(
  supa: Awaited<ReturnType<typeof createServiceClient>>,
  targetId: string,
  nowMs: number,
): Promise<{ sample_count: number; computed_at: string; groups: unknown[] } | null> {
  try {
    const vis = ["public", "friends"];
    const [{ data: mainRows }, { data: archRows }] = await Promise.all([
      supa.from("checkins").select("tags,beer_id").eq("user_id", targetId).in("visibility", vis),
      supa.from("checkins_archive").select("tags,beer_id").eq("user_id", targetId).in("visibility", vis),
    ]);
    const all = [...((mainRows ?? []) as unknown[]), ...((archRows ?? []) as unknown[])];
    const beerIds = [
      ...new Set(
        all
          .map((r) => (r as Record<string, unknown>)?.beer_id)
          .filter((id): id is string => typeof id === "string" && id !== ""),
      ),
    ];
    const catByBeer = new Map<string, string>();
    if (beerIds.length > 0) {
      const { data: beers } = await supa.from("beers").select("id,category").in("id", beerIds);
      for (const b of ((beers ?? []) as unknown[]) as Record<string, unknown>[]) {
        if (typeof b.id === "string" && typeof b.category === "string") {
          catByBeer.set(b.id, b.category);
        }
      }
    }
    const { groups, sample_count } = aggregateTaste(
      all.map((r) => {
        const rec = (r ?? {}) as Record<string, unknown>;
        return {
          tags: Array.isArray(rec.tags)
            ? (rec.tags as unknown[]).filter((x): x is string => typeof x === "string")
            : [],
          beerCategory:
            typeof rec.beer_id === "string" ? (catByBeer.get(rec.beer_id) ?? null) : null,
        };
      }),
    );
    return {
      sample_count,
      computed_at: new Date(nowMs).toISOString(),
      groups: sample_count < 5 ? [] : groups,
    };
  } catch (e) {
    console.warn(`[api/v1/users/profile] friend taste skipped: ${e instanceof Error ? e.message : "unknown"}`);
    return null;
  }
}

type FsRow = { user_id: unknown; friend_id: unknown; status: unknown };

/**
 * UR E.27 个人主页（🔒，匿名 401；iOS profile 输入）。
 * `GET /api/v1/users/:id/profile` —— id 或 `me`（自己视角完整）；
 * PRIVACY_MODE_MATRIX 矩阵 C（2026-10-11）：主页对所有人完整，不再 404 整页锁定；
 * 足迹按 visibility 过滤（本人全见；好友 public＋friends；陌生人 public；private 永不见）；
 * 统计只计可见集合；mode 只回本人。拉黑仍 404。
 * 读走 service（跨表聚合 RLS 表述不了，可见门全代码判，沿 ratings 聚合口径）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id: rawId } = await params;
  if (rawId === "me") {
    return profileOf(req, userId, userId);
  }
  const parsedId = parseCheckinIdParam(rawId);
  if ("error" in parsedId) {
    return apiError("invalid_params", parsedId.error, 400);
  }
  return profileOf(req, userId, parsedId.id);
}

async function profileOf(req: Request, viewerId: string, targetId: string): Promise<Response> {
  const supa = await createServiceClient();
  const nowMs = Date.now();
  const { data: userRaw } = await supa
    .from("users")
    .select("id,nickname,avatar_url,gender,dob,bio,mode,created_at,preferences,height_cm,occupation,languages,interests,info_visibility")
    .eq("id", targetId)
    .maybeSingle();
  const u = userRaw as UserRow | null;
  if (u === null || typeof u.id !== "string") {
    return apiError("not_found", "用户不存在", 404);
  }
  const self = targetId === viewerId;

  // 关系（accepted 双向任一＝好友；pending 按方向；blocked 行视而不见，沿交接口径只认 cheers_blocks）。
  let relationship: "self" | "friend" | "pending_out" | "pending_in" | "none" = self ? "self" : "none";
  let myFriendIds: string[] = [];
  let targetFriendIds: string[] = [];
  if (!self) {
    // 拉黑任一方向即 404（不泄存在，沿交接）。矩阵 C：对方隐身不再 404，主页对所有人完整。
    const { data: blockRows } = await supa
      .from("cheers_blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${viewerId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${viewerId})`)
      .limit(1);
    if (Array.isArray(blockRows) && blockRows.length > 0) {
      return apiError("not_found", "用户不存在", 404);
    }
    const { data: fsRows } = await supa
      .from("friendships")
      .select("user_id,friend_id,status")
      .or(
        `and(user_id.eq.${viewerId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${viewerId})`,
      )
      .limit(4);
    const rel = ((fsRows ?? []) as unknown[]) as FsRow[];
    const acc = rel.some((r) => r.status === "accepted");
    if (acc) {
      relationship = "friend";
    } else {
      const out = rel.some(
        (r) => r.status === "pending" && r.user_id === viewerId && r.friend_id === targetId,
      );
      const inn = rel.some(
        (r) => r.status === "pending" && r.user_id === targetId && r.friend_id === viewerId,
      );
      if (out) relationship = "pending_out";
      else if (inn) relationship = "pending_in";
    }
    // 共同好友：双方 accepted id 集求交。
    const collect = async (uid: string): Promise<string[]> => {
      const { data: rows } = await supa
        .from("friendships")
        .select("user_id,friend_id")
        .eq("status", "accepted")
        .or(`user_id.eq.${uid},friend_id.eq.${uid}`)
        .limit(2000);
      const ids = new Set<string>();
      for (const r of ((rows ?? []) as unknown[]) as { user_id: unknown; friend_id: unknown }[]) {
        if (typeof r.user_id === "string" && r.user_id !== uid) ids.add(r.user_id);
        if (typeof r.friend_id === "string" && r.friend_id !== uid) ids.add(r.friend_id);
      }
      return [...ids];
    };
    [myFriendIds, targetFriendIds] = await Promise.all([collect(viewerId), collect(targetId)]);
  } else {
    const { data: fsRows } = await supa
      .from("friendships")
      .select("user_id,friend_id,status")
      .or(`user_id.eq.${viewerId},friend_id.eq.${viewerId}`)
      .limit(200);
    myFriendIds = friendIdsOf(
      viewerId,
      ((fsRows ?? []) as unknown[]) as FsRow[],
    );
  }

  const mutualCount = self
    ? null
    : myFriendIds.filter((id) => targetFriendIds.includes(id)).length;
  // 矩阵 C：主页对所有人完整（stats／preferences／recent 全给，不再整页锁定）。
  // locked 字段保留恒 false（契约 required，删字段会破旧客户端）。
  const statsVisible = true;
  const locked = false;

  // user（mode／dob 仅自己；别人只 age）。
  const user: Record<string, unknown> = {
    id: u.id,
    nickname: u.nickname,
    avatar_url: u.avatar_url ?? null,
    gender: u.gender,
    age: hkAge(u.dob, nowMs),
    bio: u.bio ?? null,
    created_at: u.created_at,
  };
  if (self) {
    user.mode = u.mode;
    user.dob = u.dob ?? null;
    user.height_cm = typeof u.height_cm === "number" ? u.height_cm : null;
    user.occupation = typeof u.occupation === "string" ? u.occupation : null;
    user.languages = Array.isArray(u.languages) ? u.languages.filter((x): x is string => typeof x === "string") : [];
    user.interests = Array.isArray(u.interests) ? u.interests.filter((x): x is string => typeof x === "string") : [];
    user.info_visibility =
      typeof u.info_visibility === "object" && u.info_visibility !== null
        ? u.info_visibility
        : {};
  } else {
    // 新欄按可見性過濾（好友 public＋friends；陌生人 public；info_visibility 永不回他人）。
    Object.assign(user, visibleInfoFor(u, relationship === "friend"));
  }

  // stats（矩阵 C：对所有人可见，但只统计查看者看得到的行；本人看全部总数）。
  let stats: Record<string, number | null> | null = null;
  let nights: Set<string> | null = null;
  if (statsVisible) {
    // 本人全集；好友 public＋friends；陌生人 public（private 永不计入）。
    const visForStats =
      self || relationship === "friend" ? ["public", "friends", ...(self ? ["private"] : [])] : ["public"];
    const [{ count: mainCount }, { count: archCount }, { count: savesCount }, { count: cheersCount }] =
      await Promise.all([
        supa.from("checkins").select("id", { count: "exact", head: true }).eq("user_id", targetId).in("visibility", visForStats),
        supa.from("checkins_archive").select("id", { count: "exact", head: true }).eq("user_id", targetId).in("visibility", visForStats),
        supa.from("checkin_saves").select("checkin_id", { count: "exact", head: true }).eq("user_id", targetId),
        supa.from("cheers").select("id", { count: "exact", head: true }).eq("to_user_id", targetId),
      ]);
    // DEF-20261009-002：扫描分页拉全（PostgREST 单次 1000 上限；有错即停记 warn，不静默）。
    const scanAll = async (table: "checkins" | "checkins_archive"): Promise<unknown[]> => {
      const out: unknown[] = [];
      const PAGE = 1000;
      for (let page = 0; ; page += 1) {
        const { data, error } = await supa
          .from(table)
          .select("created_at,place_name,visibility")
          .eq("user_id", targetId)
          .in("visibility", visForStats)
          .order("created_at", { ascending: false })
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (error !== null) {
          console.warn(`[api/v1/users/profile] scan ${table} error: code=${error.code} message=${error.message}`);
          break;
        }
        const rows = (data ?? []) as unknown[];
        out.push(...rows);
        if (rows.length < PAGE) break;
      }
      return out;
    };
    const [mainScan, archScan] = await Promise.all([
      scanAll("checkins"),
      scanAll("checkins_archive"),
    ]);
    const collected = collectNightStats([...mainScan, ...archScan]);
    nights = collected.nights;
    const places = collected.places;
    stats = {
      nights_total: nights.size,
      places_total: places.size,
      checkins_total: (mainCount ?? 0) + (archCount ?? 0),
      friends_total: self ? myFriendIds.length : targetFriendIds.length,
      // WEB_HANDOFF_USER_SAVES：陌生人看不到收藏列表，计数也回 0（与可见集一致）。
      saves_total: self || relationship === "friend" ? (savesCount ?? 0) : 0,
      cheers_total: cheersCount ?? 0,
      week_streak: weekStreak(nights, nowMs),
      nights_this_week: weekNights(nights, nowMs),
    };
  }

  // recent（默认 30 max 50＋cursor；可见门逐行沿现有；lat/lng 仅自己）。
  const q = new URL(req.url).searchParams;
  const parsedLimit = parseMineParams(q);
  if ("error" in parsedLimit) {
    return apiError("invalid_params", parsedLimit.error, 400);
  }
  const limit = parsedLimit.limit;
  const cursor = q.get("cursor");
  const cursorMs = cursor !== null ? Date.parse(cursor) : NaN;

  let recent: Record<string, unknown>[] = [];
  let recent_cursor: string | null = null;
  let friends_only_count: number | null = null;
  {
    const { data: mainRows } = await supa
      .from("checkins")
      .select("id,kind,visibility,place_name,lat,lng,created_at,expires_at,note,photo_thumb,beer_id,tags,hashtags")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false })
      .limit(200);
    const { data: archRows } = await supa
      .from("checkins_archive")
      .select("id,kind,visibility,place_name,lat,lng,created_at,expires_at,note,photo_thumb,beer_id,tags,hashtags")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false })
      .limit(200);
    const all = [
      ...((mainRows ?? []) as Record<string, unknown>[]),
      ...((archRows ?? []) as Record<string, unknown>[]),
    ].filter((r) => typeof r.id === "string");
    all.sort((a, b) => {
      const ca = typeof a.created_at === "string" ? a.created_at : "";
      const cb = typeof b.created_at === "string" ? b.created_at : "";
      return cb < ca ? -1 : cb > ca ? 1 : 0;
    });
    // 矩阵 C：本人全见（含 private，前端加锁）；好友 public＋friends；陌生人 public；
    // private 永不见。「另有 N 条」只数 friends（不含 private，不泄露存在）。
    const visible = visibleRowsFor(viewerId, targetId, all, myFriendIds);
    if (!self && relationship !== "friend") {
      friends_only_count = friendsOnlyCountOf(all);
    }
    const afterCursor =
      Number.isFinite(cursorMs)
        ? visible.filter(
            (r) => typeof r.created_at === "string" && Date.parse(r.created_at) < cursorMs,
          )
        : visible;
    const page = afterCursor.slice(0, limit + 1);
    const hasMore = page.length > limit;
    const rows = page.slice(0, limit);
    if (hasMore && rows.length > 0) {
      const last = rows[rows.length - 1].created_at;
      recent_cursor = typeof last === "string" ? last : null;
    }
    // beer＋like 批量（各一次，N+1 收敛）。
    const ids = rows.map((r) => r.id as string);
    const beerIds = [...new Set(rows.map((r) => r.beer_id).filter((id): id is string => typeof id === "string" && id !== ""))];
    const beerById = new Map<string, { name: string; emoji: string }>();
    if (beerIds.length > 0) {
      const { data: beers } = await supa.from("beers").select("id,name,emoji").in("id", beerIds);
      for (const b of ((beers ?? []) as unknown[]) as Record<string, unknown>[]) {
        if (typeof b.id === "string" && typeof b.name === "string") {
          beerById.set(b.id, {
            name: b.name,
            emoji: typeof b.emoji === "string" ? b.emoji : "🍺",
          });
        }
      }
    }
    const likeById = new Map<string, number>();
    if (ids.length > 0) {
      const { data: likes } = await supa.from("post_likes").select("post_id").in("post_id", ids).limit(5000);
      for (const l of ((likes ?? []) as unknown[]) as { post_id: unknown }[]) {
        if (typeof l.post_id === "string") {
          likeById.set(l.post_id, (likeById.get(l.post_id) ?? 0) + 1);
        }
      }
    }
    recent = rows.map((r) => {
      const bid = typeof r.beer_id === "string" ? r.beer_id : null;
      const item: Record<string, unknown> = {
        id: r.id,
        kind: r.kind,
        visibility: r.visibility,
        place_name: typeof r.place_name === "string" ? r.place_name : null,
        created_at: r.created_at,
        expires_at: typeof r.expires_at === "string" ? r.expires_at : null,
        note:
          typeof r.note === "string" && r.note !== "" ? r.note.slice(0, 200) : null,
        thumb_url: typeof r.photo_thumb === "string" ? r.photo_thumb : null,
        beer: bid !== null ? (beerById.get(bid) ?? null) : null,
        like_count: likeById.get(r.id as string) ?? 0,
        tags: Array.isArray(r.tags)
          ? (r.tags as unknown[]).filter((x): x is string => typeof x === "string")
          : [],
        hashtags: Array.isArray(r.hashtags)
          ? (r.hashtags as unknown[]).filter((x): x is string => typeof x === "string")
          : [],
      };
      if (self) {
        item.lat = typeof r.lat === "number" ? r.lat : null;
        item.lng = typeof r.lng === "number" ? r.lng : null;
      }
      return item;
    });
  }

  return apiOk({
    user,
    relationship: self ? "self" : relationship,
    mutual_friends_count: mutualCount,
    can_add_friend: !self && relationship === "none",
    stats,
    // UR E.28 口味（preferences 与 stats 同门；taste 只给自己）。
    preferences: statsVisible ? narrowPreferences(u.preferences) : null,
    // 好友视角推测（iOS-0.95）：好友按可见行现算，陌生人 null。
    taste_inference:
      self || relationship === "friend"
        ? self
          ? await tasteInference(supa, targetId, nowMs)
          : await tasteInferenceForFriend(supa, targetId, nowMs)
        : null,
    level: null,
    badges: [],
    badges_total: null,
    top_percent: null,
    location: null,
    recent_checkins: recent,
    recent_cursor,
    friends_only_count,
    locked,
  });
}
