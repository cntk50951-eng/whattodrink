import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseCompositeCursor } from "@/lib/api/compositeCursor";
import { BlockLookupError, blockLookupUnavailable, getBlockedUserIds } from "@/lib/api/blocks";
import { EXPLORE_SQL_EXCLUDE_LIMIT, exploreCursorFilter, exploreFetchLimit, explorePage, parseExploreParams } from "@/lib/api/partyExplore";
import { isMinorDob } from "@/lib/api/cheers";
import { clientRequestIdOf } from "@/lib/api/clientRequestId";
import { countGenders, cancelPolicy, hkDayStartISO, isAllowedPoiCoverUrl, leavePolicy, mineOrCondition, parsePartyBody, partyCoverUploadPath, partyExpiresAt, PARTY_POI_IMAGE_HOSTS_DEFAULT } from "@/lib/api/party";
import { hostTrustMap, readTrust } from "@/lib/trust/ledger";
import { TRUST_CONFIG } from "@/lib/trust/config";
import { moderateCheckin, moderationAction } from "@/lib/moderation";
import { haversineMeters } from "@/lib/geo";
import { STEALTH_SELF_BLOCK_MSG } from "@/lib/mode";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * UR E.23 發攢局（🔒，匿名 401；隐身／未成年 403；3／天 429；iOS-0.57 联调）。
 * `POST /api/v1/parties` —— 總量 2–12、男女和≤總量、門檻 2..總量、
 * `start_at` 未来 14 天内；host 不自動占席（joined_count 從 0 起，用戶定案 2026-10-08）。
 * 回 `201 {id, expires_at}`（`expires_at`＝`start_at`＋3h，問答定案）。
 */
export async function POST(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parsePartyBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  // IOS-C04：同一次「發佈嘗試」重試（弱網連點／回包丟失）回第一次建好的那個局，不另建
  const clientRequestId = clientRequestIdOf(raw);
  if (clientRequestId !== null) {
    const { data: prior, error: priorErr } = await supabase
      .from("parties")
      .select("id,expires_at")
      .eq("host_user_id", userId)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    // 0095 未跑（42703）時查詢失敗：當作沒有，沿舊行為
    if (priorErr === null && prior !== null) {
      const pr = prior as { id: string; expires_at: string };
      return apiOk({ id: pr.id, expires_at: pr.expires_at }, 200);
    }
  }
  const { data: meRow } = await supabase
    .from("users")
    .select("mode,dob")
    .eq("id", userId)
    .maybeSingle();
  const me = (meRow ?? {}) as { mode?: unknown; dob?: unknown };
  if (me.mode === "stealth") {
    return apiError("forbidden", STEALTH_SELF_BLOCK_MSG, 403);
  }
  if (isMinorDob(me.dob, Date.now())) {
    return apiError("forbidden", "未滿 18 歲不可發局", 403);
  }
  const { count: dayCount } = await supabase
    .from("parties")
    .select("id", { count: "exact", head: true })
    .eq("host_user_id", userId)
    .neq("status", "cancelled")
    .gte("created_at", hkDayStartISO(Date.now()));
  if ((dayCount ?? 0) >= 10) {
    return apiError("rate_limited", "今日發局已達上限（10 次）", 429);
  }
  // E.30 诚信限制（默认全关，配置开；watch 日发 1 局，restricted 停 14 天）。
  if (TRUST_CONFIG.enforce_watch_limit || TRUST_CONFIG.enforce_restricted) {
    const svc = await createServiceClient();    const t = await readTrust(svc, userId);
    if (TRUST_CONFIG.enforce_restricted && t.tier === "restricted") {
      // 包络无带数通道（沿 429-quota 口径）：until＝now＋14d，写进 message，iOS 解析或展示。
      const until = new Date(Date.now() + TRUST_CONFIG.restricted_days * 24 * 3600_000).toISOString();
      return apiError(
        "trust_restricted",
        `誠信受限，暫停發起至 ${until}`,
        403,
      );
    }
    if (TRUST_CONFIG.enforce_watch_limit && t.tier === "watch" && (dayCount ?? 0) >= TRUST_CONFIG.watch_daily_parties) {
      return apiError("rate_limited", "今日發局已達上限", 429);
    }
  }
  const b = parsed.body;
  const startMs = Date.parse(b.start_at);
  const expiresIso = new Date(partyExpiresAt(startMs)).toISOString();
  // 自我介绍＋自填目的过审（沿 PATCH /me：reject 403 标项／全挂 503；整单原子，先审后插）。
  const modTargets = [
    { label: "自我介紹", text: b.host_intro },
    ...(b.purpose_other !== null ? [{ label: "目的", text: b.purpose_other }] : []),
  ];
  for (const t of modTargets) {
    const verdict = await moderateCheckin(
      { text: t.text },
      {
        openaiKey: process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY,
        minimaxKey: process.env.minimaxi_api_key,
        minimaxBaseUrl: process.env.MINIMAX_API_BASE,
      },
    );
    const action = moderationAction(verdict);
    if (action === "reject") {
      return apiError("rejected", `內容未通過審核（${t.label}），請修改後再發`, 403);
    }
    if (action === "unavailable") {
      return apiError("rejected", "審核服務暫不可用，請稍後再試", 503);
    }
  }
  // 封面：upload＝必须是自己 party-covers 桶的文件，先过图审（不过即删文件）；poi＝白名单域名 https，不转存不审。
  let coverPath: string | null = null;
  if (b.cover_url !== undefined && b.cover_source === "upload") {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    coverPath = partyCoverUploadPath(b.cover_url, supabaseUrl, userId);
    if (coverPath === null) {
      return apiError("invalid_params", "cover_url 須是你自己上傳嘅封面", 400);
    }
    const dataUrl = await fetchCoverDataUrl(coverPath);
    if (dataUrl === null) {
      return apiError("rejected", "審核服務暫不可用，請稍後再試", 503);
    }
    const verdict = await moderateCheckin(
      { imageDataUrl: dataUrl },
      {
        openaiKey: process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY,
        minimaxKey: process.env.minimaxi_api_key,
        minimaxBaseUrl: process.env.MINIMAX_API_BASE,
      },
    );
    const action = moderationAction(verdict);
    if (action === "reject") {
      await deleteCoverPath(coverPath);
      return apiError("rejected", "內容未通過審核（封面），請換一張再發", 403);
    }
    if (action === "unavailable") {
      await deleteCoverPath(coverPath);
      return apiError("rejected", "審核服務暫不可用，請稍後再試", 503);
    }
  } else if (b.cover_url !== undefined && b.cover_source === "poi") {
    const hosts = (process.env.PARTY_POI_IMAGE_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter((h) => h !== "");
    if (!isAllowedPoiCoverUrl(b.cover_url, hosts.length > 0 ? hosts : PARTY_POI_IMAGE_HOSTS_DEFAULT)) {
      return apiError("invalid_params", "cover_url 域名不在白名單（或非 https）", 400);
    }
  }
  const { data: inserted, error: iErr } = await supabase
    .from("parties")
    .insert({
      host_user_id: userId,
      place: b.place,
      poi_id: b.poi_id ?? null,
      city: b.city,
      lat: b.lat,
      lng: b.lng,
      start_at: b.start_at,
      expires_at: expiresIso,
      seats_total: b.seats_total,
      seats_male: b.seats_male,
      seats_female: b.seats_female,
      min_members: b.min_members,
      bill_intent: b.bill_intent,
      purposes: b.purposes,
      purpose_other: b.purpose_other,
      host_intro: b.host_intro,
      ...(b.cover_url !== undefined ? { cover_url: b.cover_url, cover_source: b.cover_source } : {}),
      ...(clientRequestId !== null ? { client_request_id: clientRequestId } : {}),
      status: "open",
    })
    .select("id")
    .single();
  // 並發的同一嘗試撞唯一索引（23505）：回已建好的那個
  if (iErr?.code === "23505" && clientRequestId !== null) {
    const { data: dup } = await supabase
      .from("parties").select("id,expires_at").eq("host_user_id", userId).eq("client_request_id", clientRequestId).maybeSingle();
    if (dup !== null) {
      if (coverPath !== null) await deleteCoverPath(coverPath);
      const d = dup as { id: string; expires_at: string };
      return apiOk({ id: d.id, expires_at: d.expires_at }, 200);
    }
  }
  if (iErr !== null || inserted === null) {
    console.error(`[api/v1/parties] insert error: code=${iErr?.code} message=${iErr?.message}`);
    if (coverPath !== null) await deleteCoverPath(coverPath);
    if (iErr?.code === "42703") {
      return apiError("internal", "字段缺失（cover_url／cover_source，請執行 migration 0063）", 500);
    }
    return apiError("internal", "發局失敗", 500);
  }
  const pid = (inserted as { id: string }).id;
  // host 不自動占席（用戶定案 2026-10-08）：joined_count 從 0 起，host 另行参加才占位。
  return apiOk({ id: pid, expires_at: expiresIso }, 201);
}

type PartyListRow = {
  id: string;
  host_user_id: string;
  place: string;
  city: string;
  lat: number;
  lng: number;
  start_at: string;
  expires_at: string;
  seats_total: number;
  seats_male: number;
  seats_female: number;
  min_members: number;
  bill_intent: string;
  purposes: string[];
  purpose_other: string | null;
  host_intro: string | null;
  cover_url?: string | null;
  cover_source?: string | null;
  status: string;
  created_at: string;
};

/**
 * UR E.23 看板列表（🌐匿名可看；iOS-0.57 联调；round-2 加 box=mine 撤销保留）。
 * `GET /api/v1/parties?box=&city=&bbox=&near=lat,lng&limit=&cursor=` —— 缺省
 * 只回未过期非 cancelled；`box=mine` 回我发起＋我参加（含 cancelled／过期，
 * 需登录，匿名 401）；行含 status＋計數＋host＋本人旗＋距離
 * （`near` 一次性查询用，不存储）。
 * UR E.34 `view=explore&phase=active|ended&from=&to=`：探索分頁（進行中按開始時間升序、已結束降序，
 *   `start_at|id` keyset；撤銷不回；排除封鎖雙方；已結束流需登入並排除本人已刪除的局）。不帶 view 行為不變。
 * cursor：優先用回包的 `next_cursor`（`<created_at>|<id>` 複合 keyset，按 created_at、id 倒序，
 *   同一時間戳的多行跨頁不漏不重）；舊客戶端傳純 created_at ISO 仍可用（只按 created_at 嚴格小於，行為同前）。
 */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const limitRaw = Number(q.get("limit"));
  const limit =
    Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 50 ? limitRaw : 20;
  const city = (q.get("city") ?? "").trim().slice(0, 30);
  const nearRaw = q.get("near");
  let near: { lat: number; lng: number } | null = null;
  if (nearRaw !== null) {
    const [la, ln] = nearRaw.split(",").map(Number);
    if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      near = { lat: la, lng: ln };
    }
  }
  let bbox: { west: number; south: number; east: number; north: number } | null = null;
  const bboxRaw = q.get("bbox");
  if (bboxRaw !== null) {
    const [w, s, e, n] = bboxRaw.split(",").map(Number);
    if ([w, s, e, n].every(Number.isFinite) && w < e && s < n) {
      bbox = { west: w, south: s, east: e, north: n };
    }
  }
  const exploreParsed = parseExploreParams(q);
  if (exploreParsed !== null && "error" in exploreParsed) {
    return apiError("invalid_params", exploreParsed.error, 400);
  }
  const explore = exploreParsed;
  const cursor = q.get("cursor");
  const composite = parseCompositeCursor(cursor);
  const cursorMs = cursor !== null && composite === null ? Date.parse(cursor) : NaN;

  const { supabase, userId: viewerId } = await getAuthedClient(req);
  const nowIso = new Date(Date.now()).toISOString();
  // round-2 撤销保留：box=mine 回我发起＋我参加（含 cancelled／过期，需登录）。
  const box = explore === null && q.get("box") === "mine" ? "mine" : "all";

  if ((box === "mine" || explore?.phase === "ended") && viewerId === null) {
    return apiError("unauthorized", "未登录", 401);
  }

  let joinedIds: string[] = [];
  let hiddenPartyIds = new Set<string>();
  // 探索已結束流：本人「刪除」過的局不能又冒出來（同我的約局口徑）
  if (explore?.phase === "ended" && viewerId !== null) {
    const hides = await supabase.from("party_hides").select("party_id").eq("user_id", viewerId);
    if (hides.error !== null && hides.error.code !== "42P01") {
      console.error(`[api/v1/parties] hides error: code=${hides.error.code} message=${hides.error.message}`);
      return apiError("internal", "酒局讀取失敗", 500);
    }
    hiddenPartyIds = new Set(
      ((hides.data ?? []) as { party_id?: unknown }[]).map((h) => h.party_id).filter((v): v is string => typeof v === "string" && UUID_RE.test(v)),
    );
  }
  // 探索：封鎖雙方的局在限頁前排除；查不到就 503，不放行
  let blockedHosts: string[] = [];
  if (explore !== null && viewerId !== null) {
    try {
      blockedHosts = [...(await getBlockedUserIds(await createServiceClient(), viewerId))].filter((v) => UUID_RE.test(v));
    } catch (e) {
      if (e instanceof BlockLookupError) return blockLookupUnavailable();
      throw e;
    }
  }
  if (box === "mine" && viewerId !== null) {
    // 先查「我參加的局」與「我已隱藏的終態局」，在 SQL 限頁前排除隱藏 ID，避免 51 筆藏 1 筆時首頁只回 49 筆導致客戶端提早停止翻頁
    const [joinsRes, hidesRes] = await Promise.all([
      supabase.from("joins").select("party_id").eq("user_id", viewerId),
      supabase.from("party_hides").select("party_id").eq("user_id", viewerId),
    ]);
    if (joinsRes.error !== null) {
      console.error(
        `[api/v1/parties] joins error: code=${joinsRes.error.code} message=${joinsRes.error.message}`,
      );
      return apiError("internal", "酒局讀取失敗", 500);
    }
    joinedIds = ((joinsRes.data ?? []) as { party_id: unknown }[])
      .map((j) => j.party_id)
      .filter((id): id is string => typeof id === "string" && id !== "");
    if (hidesRes.error !== null) {
      // 只有 0082 遷移未跑（42P01）才降級為空集合；其餘 DB 故障不可假裝無隱藏而讓已刪除酒局復活
      if (hidesRes.error.code !== "42P01") {
        console.error(
          `[api/v1/parties] hides error: code=${hidesRes.error.code} message=${hidesRes.error.message}`,
        );
        return apiError("internal", "酒局讀取失敗", 500);
      }
    } else if (Array.isArray(hidesRes.data)) {
      hiddenPartyIds = new Set(
        (hidesRes.data as { party_id?: unknown }[])
          .map((h) => h.party_id)
          .filter((v): v is string => typeof v === "string" && UUID_RE.test(v)),
      );
    }
  }
  const hiddenList = [...hiddenPartyIds];
  const pushSqlHiddenFilter = hiddenList.length > 0 && hiddenList.length <= 200;
  const pushSqlBlockedFilter = blockedHosts.length > 0 && blockedHosts.length <= EXPLORE_SQL_EXCLUDE_LIMIT;
  const memoryHidden = pushSqlHiddenFilter ? 0 : hiddenList.length;
  const memoryBlocked = pushSqlBlockedFilter ? 0 : blockedHosts.length;
  const fetchLimit = explore !== null
    ? exploreFetchLimit(limit, memoryHidden + memoryBlocked)
    : pushSqlHiddenFilter ? limit : Math.min(limit + hiddenList.length, 500);

  const BASE_COLS = "id,host_user_id,place,city,lat,lng,start_at,expires_at,seats_total,seats_male,seats_female,min_members,bill_intent,purposes,purpose_other,host_intro,status,created_at";
  let rows: unknown[] | null = null;
  let error: { code?: string; message?: string } | null = null;
  for (const cols of [BASE_COLS.replace("host_intro,", "host_intro,cover_url,cover_source,"), BASE_COLS]) {
    let query = supabase
      .from("parties")
      .select(cols)
      .order(explore === null ? "created_at" : "start_at", { ascending: explore?.phase === "active" })
      .order("id", { ascending: explore?.phase === "active" })
      .limit(fetchLimit);
    if (explore !== null) {
      query = query.eq("status", "open");
      query = explore.phase === "active" ? query.gt("expires_at", nowIso) : query.lte("expires_at", nowIso);
      if (explore.from !== null) query = query.gte("start_at", explore.from);
      if (explore.to !== null) query = query.lt("start_at", explore.to);
      if (explore.cursor !== null) query = query.or(exploreCursorFilter(explore.phase, explore.cursor));
      if (pushSqlBlockedFilter) query = query.not("host_user_id", "in", `(${blockedHosts.join(",")})`);
      if (pushSqlHiddenFilter) query = query.not("id", "in", `(${hiddenList.join(",")})`);
    } else if (box === "mine" && viewerId !== null) {
      query = query.or(mineOrCondition(viewerId, joinedIds));
      if (pushSqlHiddenFilter) {
        query = query.not("id", "in", `(${hiddenList.join(",")})`);
      }
    } else {
      query = query.eq("status", "open").gt("expires_at", nowIso);
    }
    if (city !== "") query = query.eq("city", city);
    if (bbox !== null) {
      query = query
        .gte("lat", bbox.south)
        .lte("lat", bbox.north)
        .gte("lng", bbox.west)
        .lte("lng", bbox.east);
    }
    if (explore !== null) {
      // 探索游標已在上面按 start_at 套用
    } else if (composite !== null) {
      // 值已由 parseCompositeCursor 嚴格校驗（時間戳字符集＋UUID），可安全拼進 or()
      query = query.or(`created_at.lt.${composite.createdAt},and(created_at.eq.${composite.createdAt},id.lt.${composite.id})`);
    } else if (Number.isFinite(cursorMs)) {
      query = query.lt("created_at", new Date(cursorMs).toISOString());
    }
    ({ data: rows, error } = await query);
    if (error === null || error.code !== "42703") break; // 0063 未跑：缺封面列，退回不带封面的旧查询
  }
  if (error !== null) {
    console.error(`[api/v1/parties] list error: code=${error.code} message=${error.message}`);
    return apiError("internal", "酒局讀取失敗", 500);
  }
  const fetched = ((rows ?? []) as PartyListRow[]).filter((r) => typeof r.id === "string");
  const page = explore === null
    ? null
    : explorePage(fetched, {
        limit,
        fetchLimit,
        excludedHosts: new Set(pushSqlBlockedFilter ? [] : blockedHosts),
        excludedParties: hiddenPartyIds,
      });
  const list = page !== null ? page.list : fetched.filter((r) => !hiddenPartyIds.has(r.id)).slice(0, limit);
  const ids = list.map((r) => r.id);
  const hostIds = [...new Set(list.map((r) => r.host_user_id))];
  let hosts = new Map<string, { nickname: string; avatar_url: string | null }>();
  const joinCounts = new Map<string, number>();
  const gendersByParty = new Map<string, (string | null)[]>();
  const mine = new Set<string>();
  const arrivedIds = new Set<string>();
  let trustMap = new Map<string, Awaited<ReturnType<typeof hostTrustMap>> extends Map<string, infer V> ? V : never>();
  if (ids.length > 0) {
    // 查完主表後四路併發：joins→性別 / 發起人資料 / 我是否到場打卡 / 發起人信用徽章，消除原先 7 層串行 DB RTT
    const svc = await createServiceClient();
    const [joinsRes, hostsRes, attRes, trustRes] = await Promise.all([
      (async () => {
        const { data: joins } = await supabase
          .from("joins")
          .select("party_id,user_id")
          .in("party_id", ids);
        const jrows = ((joins ?? []) as { party_id: string; user_id: string }[]).filter(
          (j) => typeof j.party_id === "string" && typeof j.user_id === "string",
        );
        const genderOf = new Map<string, string | null>();
        const joinerIds = [...new Set(jrows.map((j) => j.user_id))];
        if (joinerIds.length > 0) {
          const { data: joiners } = await svc
            .from("users")
            .select("id,gender")
            .in("id", joinerIds);
          for (const u of ((joiners ?? []) as { id: string; gender: string | null }[])) {
            genderOf.set(u.id, u.gender ?? null);
          }
        }
        return { jrows, genderOf };
      })(),
      hostIds.length > 0
        ? svc.from("users").select("id,nickname,avatar_url").in("id", hostIds)
        : Promise.resolve({ data: null }),
      viewerId !== null
        ? svc
            .from("party_attendance")
            .select("party_id")
            .eq("user_id", viewerId)
            .in("party_id", ids)
            .not("arrived_at", "is", null)
        : Promise.resolve({ data: null }),
      hostTrustMap(svc, hostIds, Date.now()),
    ]);
    for (const j of joinsRes.jrows) {
      joinCounts.set(j.party_id, (joinCounts.get(j.party_id) ?? 0) + 1);
      if (viewerId !== null && j.user_id === viewerId) mine.add(j.party_id);
      const arr = gendersByParty.get(j.party_id) ?? [];
      arr.push(joinsRes.genderOf.get(j.user_id) ?? null);
      gendersByParty.set(j.party_id, arr);
    }
    hosts = new Map(
      (((hostsRes.data ?? []) as unknown[]) as { id: string; nickname: string; avatar_url: string | null }[]).map(
        (u) => [u.id, { nickname: u.nickname, avatar_url: u.avatar_url }],
      ),
    );
    for (const a of ((attRes.data ?? []) as unknown[]) as { party_id?: unknown }[]) {
      if (typeof a.party_id === "string") arrivedIds.add(a.party_id);
    }
    trustMap = trustRes;
  }
  const items = list.map((r) => {
    const host = hosts.get(r.host_user_id) ?? { nickname: "酒友", avatar_url: null };
    const gc = countGenders(gendersByParty.get(r.id) ?? []);
    // 匿名只回 purposes 枚举（自填目的＋介绍仅登录可见，WEB_HANDOFF_PARTY_INTRO 定案）。
    const authed = viewerId !== null;
    return {
      id: r.id,
      place: r.place,
      city: r.city,
      lat: r.lat,
      lng: r.lng,
      start_at: r.start_at,
      expires_at: r.expires_at,
      created_at: r.created_at,
      seats_total: r.seats_total,
      seats_male: r.seats_male,
      seats_female: r.seats_female,
      min_members: r.min_members,
      bill_intent: r.bill_intent,
      purposes: Array.isArray(r.purposes) ? r.purposes.filter((p): p is string => typeof p === "string") : [],
      ...(authed
        ? {
            purpose_other: typeof r.purpose_other === "string" ? r.purpose_other : null,
            host_intro: typeof r.host_intro === "string" ? r.host_intro : null,
          }
        : {}),
      cover_url: typeof r.cover_url === "string" ? r.cover_url : null,
      cover_source: r.cover_source === "upload" || r.cover_source === "poi" || r.cover_source === "default" ? r.cover_source : null,
      status: r.status,
      joined_count: joinCounts.get(r.id) ?? 0,
      male_count: gc.male,
      female_count: gc.female,
      host: { user_id: r.host_user_id, nickname: host.nickname, avatar_url: host.avatar_url, trust: trustMap.get(r.host_user_id) ?? { tier: "newbie", hosted_count: 0, completion_rate: null, cancel_90d: 0 } },
      joined_by_me: mine.has(r.id),
      is_mine: viewerId !== null && r.host_user_id === viewerId,
      distance_m:
        near === null
          ? null
          : Math.round(haversineMeters(near, { lat: r.lat, lng: r.lng })),
      // 阶段 A 政策欄（服务端时间算；匿名缺席；iOS 置灰＋确认文案用，不在客户端写规则）。
      ...(viewerId !== null
        ? {
            my_arrived: arrivedIds.has(r.id),
            cancel_policy: cancelPolicy({
              isHost: r.host_user_id === viewerId,
              status: r.status,
              startAtMs: Date.parse(r.start_at),
              expiresAtMs: Date.parse(r.expires_at),
              joinersCount: joinCounts.get(r.id) ?? 0,
              nowMs: Date.now(),
            }),
            ...(mine.has(r.id)
              ? {
                  leave_policy: leavePolicy({
                    joined: true,
                    startAtMs: Date.parse(r.start_at),
                    nowMs: Date.now(),
                  }),
                }
              : {}),
          }
        : {}),
    };
  });
  // UR E.29 同步游标（服务端 ms；changes 的 since 原样回传，与翻页 cursor 区分命名）。
  const lastRow = list.length > 0 ? list[list.length - 1] : null;
  const next_cursor = page !== null
    ? page.next_cursor
    : lastRow !== null && typeof lastRow.created_at === "string" ? `${lastRow.created_at}|${lastRow.id}` : null;
  return apiOk({ items, sync_cursor: Date.now(), next_cursor });
}

/** 取自家封面文件转 data URL 送图审（取不到／超 8MB 即 null，调用方按不可用处理）。 */
async function fetchCoverDataUrl(storagePath: string): Promise<string | null> {
  try {
    const svc = await createServiceClient();
    const { data, error } = await svc.storage.from("party-covers").download(storagePath);
    if (error !== null || data === null) {
      console.error(`[api/v1/parties] cover fetch error: message=${error?.message}`);
      return null;
    }
    if (data.size > 8 * 1024 * 1024) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.error(`[api/v1/parties] cover fetch threw: ${err instanceof Error ? err.message : "unknown"}`);
    return null;
  }
}

/** 删桶内封面文件（被拒／插入失败；失败只记 log）。 */
async function deleteCoverPath(storagePath: string): Promise<void> {
  try {
    const svc = await createServiceClient();
    const { error } = await svc.storage.from("party-covers").remove([storagePath]);
    if (error !== null) console.error(`[api/v1/parties] cover remove error: message=${error.message}`);
  } catch (err) {
    console.error(`[api/v1/parties] cover remove threw: ${err instanceof Error ? err.message : "unknown"}`);
  }
}
