import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isMinorDob } from "@/lib/api/cheers";
import { infoVisibilityOf } from "@/lib/api/profile";
import { aggregateTaste, groupOfKey, type TasteGroupKey } from "@/lib/api/taste";
import { ageOf } from "@/lib/api/profile";
import { haversineMeters } from "@/lib/geo";
import { moderateCheckin, moderationAction } from "@/lib/moderation";
import { minimaxChat } from "@/lib/minimax";
import {
  MEET_DAILY_LIMIT,
  MEET_LLM_TIMEOUT_MS,
  MEET_MAX_RESULTS,
  MEET_QUERY_MAX,
  buildReasons,
  declaredTasteOf,
  dropNoisyGroups,
  isFullMatch,
  meetParsePrompt,
  parseMeetReply,
  preferredHeadline,
  relaxedCriteria,
  sanitizeCriteria,
  scoreCandidate,
  tasteLevel,
  type MeetCriteria,
} from "@/lib/meet";
import { hkDayStartISO } from "@/lib/api/party";

const ONLINE_WINDOW_MS = 5 * 60_000;
const TASTE_EVAL_CAP = 40;

type CandRow = {
  id: string;
  nickname: unknown;
  avatar_url: unknown;
  gender: unknown;
  dob: unknown;
  height_cm: unknown;
  occupation: unknown;
  languages: unknown;
  interests: unknown;
  preferences: unknown;
  info_visibility: unknown;
  discoverable: unknown;
  mode: unknown;
  last_seen_at: unknown;
  live_lat: unknown;
  live_lng: unknown;
};

function asStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function freshMs(v: unknown, nowMs: number): number | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  if (!Number.isFinite(t) || t > nowMs) return null;
  return nowMs - t;
}

/**
 * UR I.1 遇見搜索（🔒，固定流水線）。
 * `POST /api/v1/meet/search {query?} | {criteria?}` —— query 走 LLM 翻條件（扣次數），
 * criteria 直查（不調 LLM 不扣次數；可同時給，以 criteria 為準）。
 * 硬過濾（自己／拉黑／解友／隱身／未成年／discoverable 非 true／明確條件）＋
 * 可見欄位匹配＋確定性打分 Top 10。用量見 `remaining_today`。
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const hasCriteria = body.criteria !== undefined;
  const queryRaw = typeof body.query === "string" ? body.query.trim() : "";
  if (!hasCriteria && queryRaw === "") {
    return apiError("invalid_params", "query 或 criteria 必填其一", 400);
  }
  if (queryRaw !== "" && Array.from(queryRaw).length > MEET_QUERY_MAX) {
    return apiError("invalid_params", `query 最长 ${MEET_QUERY_MAX} 字`, 400);
  }
  if (hasCriteria && (typeof body.criteria !== "object" || body.criteria === null)) {
    return apiError("invalid_params", "criteria 需为对象", 400);
  }
  const svc = await createServiceClient();
  const nowMs = Date.now();
  // 搜索者门：性别＋生日齐（引导完成）＋已成年。
  const { data: meRow } = await svc
    .from("users")
    .select("gender,dob,live_lat,live_lng,last_seen_at,meet_search_date,meet_search_count")
    .eq("id", userId)
    .maybeSingle();
  const me = ((meRow ?? {}) as Record<string, unknown>);
  if (me.gender !== "male" && me.gender !== "female") {
    return apiError("onboarding_required", "請先完成性別與生日", 403);
  }
  if (typeof me.dob !== "string" || me.dob === "") {
    return apiError("onboarding_required", "請先完成性別與生日", 403);
  }
  if (isMinorDob(me.dob, nowMs)) {
    return apiError("age_restricted", "未滿 18 歲不可用遇見", 403);
  }

  let criteria: MeetCriteria;
  let ignored: string[];
  const notes: string[] = [];
  let llmPath = false;
  if (hasCriteria) {
    const s = sanitizeCriteria(body.criteria);
    criteria = s.criteria;
    ignored = s.dropped.slice(0, 5);
  } else {
    // 内容审核（query 明文；不过 403 标项／全挂 503，沿 PATCH /me）。
    const verdict = await moderateCheckin(
      { text: queryRaw },
      {
        openaiKey: process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY,
        minimaxKey: process.env.minimaxi_api_key,
        minimaxBaseUrl: process.env.MINIMAX_API_BASE,
      },
    );
    const action = moderationAction(verdict);
    if (action === "reject") {
      return apiError("rejected", "內容未通過審核（搜尋描述），請修改後再發", 403);
    }
    if (action === "unavailable") {
      return apiError("rejected", "審核服務暫不可用，請稍後再試", 503);
    }
    // 配额（HK 自然日 10 次，只算 query 路径；先查后扣，LLM 失败不扣）。
    const dayStart = hkDayStartISO(nowMs);
    const sameDay = typeof me.meet_search_date === "string" && me.meet_search_date >= dayStart.slice(0, 10);
    const usedToday = sameDay && typeof me.meet_search_count === "number" ? me.meet_search_count : 0;
    if (usedToday >= MEET_DAILY_LIMIT) {
      return apiError("rate_limited", "今日搜尋次數已用完", 429);
    }
    const minimaxKey = process.env.minimaxi_api_key ?? "";
    if (minimaxKey === "") {
      console.error("[meet] missing minimaxi_api_key");
      return apiError("ai_unavailable", "AI 暫時唔可用，請稍後再試", 503);
    }
    let reply: string;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), MEET_LLM_TIMEOUT_MS);
      try {
        reply = await minimaxChat(
          [
            { role: "system", content: meetParsePrompt().system },
            { role: "user", content: queryRaw },
          ],
          {
            apiKey: minimaxKey,
            fetchFn: (url, init) => fetch(url, { ...init, signal: ctrl.signal }),
            // P0 稳定输出（同输入同结果；探针结论）。
            temperature: 0,
            topP: 1,
          },
        );
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      console.error(`[meet] llm error: ${err instanceof Error ? err.message : "unknown"}`);
      return apiError("ai_unavailable", "AI 暫時唔可用，請稍後再試", 503);
    }
    let parsed;
    try {
      parsed = parseMeetReply(reply);
    } catch {
      console.error("[meet] llm reply not json");
      return apiError("ai_unavailable", "AI 暫時唔可用，請稍後再試", 503);
    }
    const s = sanitizeCriteria(parsed.criteria);
    // P0 噪音護欄（整组乱填即丢；只走 LLM 路径，用户自选不动）。
    const g = dropNoisyGroups(s.criteria);
    criteria = g.criteria;
    ignored = [...parsed.ignored, ...s.dropped].slice(0, 5);
    if (g.droppedGroups.length > 0) {
      notes.push("泛指條件已略過");
    }
    // 扣次數（解析成功才扣；查询失败不回滚——条件已产出，沿"成功扣"口径）。
    const todayStr = new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10);
    await svc
      .from("users")
      .update({ meet_search_date: todayStr, meet_search_count: usedToday + 1 })
      .eq("id", userId);
    llmPath = true;
  }
  void llmPath;

  const out = await runSearch(svc, userId, me, criteria, nowMs);
  const remaining = await remainingToday(svc, userId, nowMs);
  // P1 条件生效说明（距离／在线只对好友生效，用户需知道）。
  if (criteria.nearby_km !== undefined || criteria.online_only === true) {
    notes.push("距離／在線只對好友生效");
  }
  return apiOk({ ...out, ignored, notes, remaining_today: remaining });
}

async function remainingToday(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  nowMs: number,
): Promise<number> {
  const { data } = await svc
    .from("users")
    .select("meet_search_date,meet_search_count")
    .eq("id", userId)
    .maybeSingle();
  const r = ((data ?? {}) as Record<string, unknown>);
  const dayStart = hkDayStartISO(nowMs).slice(0, 10);
  const sameDay = typeof r.meet_search_date === "string" && r.meet_search_date >= dayStart;
  const used = sameDay && typeof r.meet_search_count === "number" ? r.meet_search_count : 0;
  return Math.max(0, MEET_DAILY_LIMIT - used);
}

type SearchOut = {
  criteria: MeetCriteria;
  results: unknown[];
  stats: { pool: number; passed: number };
  friends_not_discoverable: number;
  relaxed?: { note: string; criteria: MeetCriteria };
};

async function runSearch(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  me: Record<string, unknown>,
  criteria: MeetCriteria,
  nowMs: number,
): Promise<SearchOut> {
  // P0 好友不受 discoverable 限制：先取我的全部边，好友集用于入池；池＝discoverable 真陌生人＋全部好友。
  const { data: allFs } = await svc
    .from("friendships")
    .select("user_id,friend_id,status")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .limit(2000);
  type Edge = { user_id: unknown; friend_id: unknown; status: unknown };
  const preFriends = new Set<string>();
  for (const r of ((allFs ?? []) as unknown[]) as Edge[]) {
    if (typeof r.user_id !== "string" || typeof r.friend_id !== "string") continue;
    if (r.status === "accepted") preFriends.add(r.user_id === userId ? r.friend_id : r.user_id);
  }
  const friendIn = [...preFriends].slice(0, 500).map((id) => `"${id}"`).join(",");
  // 候选池：discoverable＝true 的陌生人＋全部好友（NULL／false 的陌生人永不入池）。
  const { data: pool } = await svc
    .from("users")
    .select("id,nickname,avatar_url,gender,dob,height_cm,occupation,languages,interests,preferences,info_visibility,discoverable,mode,last_seen_at,live_lat,live_lng")
    .neq("id", userId)
    .neq("mode", "stealth")
    .or(friendIn !== "" ? `discoverable.eq.true,id.in.(${friendIn})` : `discoverable.eq.true`)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(200);
  const cands = (((pool ?? []) as unknown[]) as CandRow[]).filter((c) => typeof c.id === "string");
  // P1 未开启好友数（精确计数，不受 200 池上限影响）。
  let friendsNotDiscoverable = 0;
  if (preFriends.size > 0) {
    const { data: fDisc } = await svc
      .from("users")
      .select("id")
      .in("id", [...preFriends].slice(0, 2000))
      .or("discoverable.is.null,discoverable.eq.false");
    friendsNotDiscoverable = ((fDisc ?? []) as unknown[]).length;
  }
  if (cands.length === 0) {
    return { criteria, results: [], relaxed: relaxedCriteria(criteria), stats: { pool: 0, passed: 0 }, friends_not_discoverable: friendsNotDiscoverable };
  }
  const candIds = cands.map((c) => c.id);
  // 关系一次取：候选人边（共同好友计数）＋我的拉黑／解友（好友集上已取复用）。
  const inList = [...new Set([userId, ...candIds])].map((id) => `"${id}"`).join(",");
  const [{ data: edgeFs }, { data: myBlocks }, { data: myMutes }] = await Promise.all([
    svc.from("friendships").select("user_id,friend_id,status").eq("status", "accepted").or(`user_id.in.(${inList}),friend_id.in.(${inList})`).limit(5000),
    svc.from("cheers_blocks").select("blocker_id,blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`).limit(2000),
    svc.from("chat_mutes").select("blocker_id,blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`).limit(2000),
  ]);
  const blocked = new Set<string>();
  for (const b of ((myBlocks ?? []) as unknown[]) as { blocker_id?: unknown; blocked_id?: unknown }[]) {
    if (typeof b.blocker_id === "string" && typeof b.blocked_id === "string") {
      blocked.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id);
    }
  }
  const muted = new Set<string>();
  for (const b of ((myMutes ?? []) as unknown[]) as { blocker_id?: unknown; blocked_id?: unknown }[]) {
    if (typeof b.blocker_id === "string" && typeof b.blocked_id === "string") {
      muted.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id);
    }
  }
  const myFriends = new Set<string>();
  const relById = new Map<string, "friend" | "pending_out" | "pending_in">();
  for (const r of ((allFs ?? []) as unknown[]) as Edge[]) {
    if (typeof r.user_id !== "string" || typeof r.friend_id !== "string") continue;
    const peer = r.user_id === userId ? r.friend_id : r.user_id;
    if (r.status === "accepted") {
      myFriends.add(peer);
      relById.set(peer, "friend");
    } else if (r.status === "pending" && !relById.has(peer)) {
      relById.set(peer, r.user_id === userId ? "pending_out" : "pending_in");
    }
  }
  // 共同好友：候选人 accepted 边∩我的好友集。
  const candFriends = new Map<string, Set<string>>();
  for (const r of ((edgeFs ?? []) as unknown[]) as Edge[]) {
    if (r.status !== "accepted" || typeof r.user_id !== "string" || typeof r.friend_id !== "string") continue;
    for (const [a, b] of [[r.user_id, r.friend_id], [r.friend_id, r.user_id]] as const) {
      if (a === userId) continue;
      if (!candFriends.has(a)) candFriends.set(a, new Set());
      candFriends.get(a)?.add(b);
    }
  }
  // 搜索者位置（5min 鲜才用；无即 nearby 不滤不计）。
  const meAge = freshMs(me.last_seen_at, nowMs);
  const mePos =
    meAge !== null && meAge <= ONLINE_WINDOW_MS && typeof me.live_lat === "number" && typeof me.live_lng === "number"
      ? { lat: me.live_lat, lng: me.live_lng }
      : null;

  type Scored = {
    row: CandRow;
    isFriend: boolean;
    declared: { favorites: string[]; likes: string[]; dislikes: string[] };
    score: number;
    activeMs: number | null;
    soft: {
      interests: number;
      languages: number;
      occupation: boolean;
      tasteLevel: 0 | 1 | 2 | 3;
      mutual: number;
      online: boolean;
      nearby: boolean;
      nearbyM: number | null;
      interestHit: string | null;
      languageHit: string | null;
      tasteGroup: TasteGroupKey | null;
    };
  };
  const passed: Scored[] = [];
  for (const c of cands) {
    if (blocked.has(c.id) || muted.has(c.id)) continue;
    const isFriend = myFriends.has(c.id);
    // 年龄硬门（缺 dob 即不可验，fail-closed 排除）。
    const age = typeof c.dob === "string" && c.dob !== "" ? ageOf(c.dob, nowMs) : null;
    if (age === null || age < 18) continue;
    if (criteria.gender !== undefined && c.gender !== criteria.gender) continue;
    if (criteria.age_min !== undefined && age < criteria.age_min) continue;
    if (criteria.age_max !== undefined && age > criteria.age_max) continue;
    // 可见欄位（friends 仅好友；private 永不参与）。
    const vis = (f: "height" | "occupation" | "languages" | "interests"): boolean => {
      const v = infoVisibilityOf(c.info_visibility, f);
      if (v === "private") return false;
      if (v === "friends" && !isFriend) return false;
      return true;
    };
    if (criteria.height_min !== undefined || criteria.height_max !== undefined) {
      if (!vis("height") || typeof c.height_cm !== "number") continue;
      if (criteria.height_min !== undefined && c.height_cm < criteria.height_min) continue;
      if (criteria.height_max !== undefined && c.height_cm > criteria.height_max) continue;
    }
    const candLangs = vis("languages") ? asStrArr(c.languages) : [];
    const candInter = vis("interests") ? asStrArr(c.interests) : [];
    const candOcc = vis("occupation") ? asStr(c.occupation) : null;
    // 在线（仅好友可见；陌生人一律不可见，沿 live 口径）。
    const cActive = freshMs(c.last_seen_at, nowMs);
    const onlineVisible = isFriend && cActive !== null && cActive <= ONLINE_WINDOW_MS;
    if (criteria.online_only === true && !onlineVisible) continue;
    // 距离（双方位置可见才算；候选非好友即无位置）。
    let nearbyM: number | null = null;
    let nearbyOk = false;
    if (mePos !== null && isFriend && typeof c.live_lat === "number" && typeof c.live_lng === "number" && cActive !== null && cActive <= ONLINE_WINDOW_MS) {
      nearbyM = Math.round(haversineMeters(mePos, { lat: c.live_lat, lng: c.live_lng }) / 100) * 100;
      nearbyOk = true;
    }
    if (criteria.nearby_km !== undefined) {
      if (nearbyM === null || nearbyM > criteria.nearby_km * 1000) continue;
    }
    const mutual = [...(candFriends.get(c.id) ?? new Set())].filter((id) => myFriends.has(id)).length;
    const interestHit = criteria.interests?.find((k) => candInter.includes(k)) ?? null;
    const languageHit = criteria.languages?.find((k) => candLangs.includes(k)) ?? null;
    passed.push({
      row: c,
      isFriend,
      declared: { favorites: [], likes: [], dislikes: [] },
      score: 0,
      activeMs: cActive,
      soft: {
        interests: criteria.interests?.filter((k) => candInter.includes(k)).length ?? 0,
        languages: criteria.languages?.filter((k) => candLangs.includes(k)).length ?? 0,
        occupation: criteria.occupations !== undefined && candOcc !== null && criteria.occupations.includes(candOcc),
        tasteLevel: 0,
        mutual,
        online: onlineVisible,
        nearby: nearbyOk && criteria.nearby_km !== undefined,
        nearbyM,
        interestHit,
        languageHit,
        tasteGroup: null,
      },
    });
  }
  // P0 声明口味（preferences.favorites/likes/dislikes；主頁本就對所有人可見，无新增暴露）。
  for (const p of passed) {
    p.declared = declaredTasteOf((p.row as unknown as Record<string, unknown>).preferences);
  }
  // 两遍打分：先无口味取前 40，再算口味重排（口味要逐人查帖，POC 限流）。
  const first = passed
    .map((p) => ({ p, s: scoreCandidate(criteria, { ...p.soft, tasteLevel: 0 }) }))
    .sort((a, b) => b.s - a.s || (a.p.activeMs ?? Infinity) - (b.p.activeMs ?? Infinity))
    .slice(0, TASTE_EVAL_CAP);
  for (const { p } of first) {
    const top = await topTasteGroup(svc, p.row.id, p.isFriend);
    p.soft.tasteGroup = top;
    p.soft.tasteLevel = tasteLevel(criteria, p.declared, top);
  }
  const ranked = first
    .map(({ p }) => {
      const full = isFullMatch(criteria, {
        occupations: p.soft.occupation,
        languages: p.soft.languages,
        interests: p.soft.interests,
        tasteLevel: p.soft.tasteLevel,
      });
      return { p, s: scoreCandidate(criteria, p.soft), full };
    })
    // P2：完全符合在前，同级按分、活跃排。
    .sort((a, b) => Number(b.full) - Number(a.full) || b.s - a.s || (a.p.activeMs ?? Infinity) - (b.p.activeMs ?? Infinity))
    .slice(0, MEET_MAX_RESULTS);

  const results = ranked.map(({ p, s, full }) => {
    const c = p.row;
    const age = ageOf(asStr(c.dob) ?? "", nowMs) ?? 0;
    const nick = asStr(c.nickname);
    return {
      user_id: c.id,
      nickname: nick !== null && nick !== "" ? nick : "酒友",
      avatar_url: asStr(c.avatar_url),
      gender: c.gender,
      age,
      score: s,
      match: full ? "full" : "partial",
      reasons: buildReasons({
        taste: preferredHeadline(criteria, p.declared, p.soft.tasteGroup),
        interest: p.soft.interestHit,
        language: p.soft.languageHit,
        mutual: p.soft.mutual,
        nearbyM: p.soft.nearbyM,
      }),
      height_cm: p.isFriend || infoVisibilityOf(c.info_visibility, "height") === "public" ? (typeof c.height_cm === "number" ? c.height_cm : null) : null,
      occupation: p.isFriend || infoVisibilityOf(c.info_visibility, "occupation") === "public" ? asStr(c.occupation) : null,
      languages: p.isFriend || infoVisibilityOf(c.info_visibility, "languages") === "public" ? asStrArr(c.languages) : [],
      interests: p.isFriend || infoVisibilityOf(c.info_visibility, "interests") === "public" ? asStrArr(c.interests) : [],
      taste_headline: preferredHeadline(criteria, p.declared, p.soft.tasteGroup),
      mutual_friends_count: p.soft.mutual,
      distance_m: p.soft.nearbyM,
      online: p.soft.online,
      relationship: p.isFriend ? "friend" : (relById.get(c.id) ?? "none"),
    };
  });
  // P1 匿名统计（只含人数，无个人信息；iOS 解释"为什么没结果"用）。
  const out: SearchOut = {
    criteria,
    results,
    stats: { pool: cands.length, passed: passed.length },
    friends_not_discoverable: friendsNotDiscoverable,
  };
  if (results.length < 3) {
    out.relaxed = relaxedCriteria(criteria);
  }
  return out;
}

/** 候选口味 top group（只用搜索者可见行：public＋好友 friends；无信号即 null）。 */
async function topTasteGroup(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  isFriend: boolean,
): Promise<TasteGroupKey | null> {
  const vis = isFriend ? ["public", "friends"] : ["public"];
  const [{ data: main }, { data: arch }] = await Promise.all([
    svc.from("checkins").select("tags,beer_id").eq("user_id", userId).in("visibility", vis).limit(200),
    svc.from("checkins_archive").select("tags,beer_id").eq("user_id", userId).in("visibility", vis).limit(200),
  ]);
  const all = [...((main ?? []) as unknown[]), ...((arch ?? []) as unknown[])];
  const beerIds = [...new Set(all.map((r) => (r as Record<string, unknown>)?.beer_id).filter((id): id is string => typeof id === "string" && id !== ""))];
  const catByBeer = new Map<string, string>();
  if (beerIds.length > 0) {
    const { data: beers } = await svc.from("beers").select("id,category").in("id", beerIds);
    for (const b of ((beers ?? []) as unknown[]) as Record<string, unknown>[]) {
      if (typeof b.id === "string" && typeof b.category === "string") catByBeer.set(b.id, b.category);
    }
  }
  const { groups } = aggregateTaste(
    all.map((r) => {
      const rec = (r ?? {}) as Record<string, unknown>;
      return {
        tags: Array.isArray(rec.tags) ? (rec.tags as unknown[]).filter((x): x is string => typeof x === "string") : [],
        beerCategory: typeof rec.beer_id === "string" ? (catByBeer.get(rec.beer_id) ?? null) : null,
      };
    }),
  );
  if (groups.length === 0) return null;
  const top = [...groups].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0] as { key?: unknown };
  const g = typeof top.key === "string" ? groupOfKey(top.key) : null;
  return g;
}
