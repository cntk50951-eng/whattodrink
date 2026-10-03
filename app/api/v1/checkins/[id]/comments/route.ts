import { createHash, randomUUID } from "node:crypto";

import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin, parseCheckinIdParam } from "@/lib/api/checkins";
import { friendIdsOf } from "@/lib/friends";
import { moderateCheckin, moderationAction } from "@/lib/moderation";
import {
  anonHasOutstanding,
  encodeCommentsCursor,
  overWindowLimit,
  parseCommentBody,
  parseCommentsParams,
  rawAnonIdOf,
  toCommentJson,
  withViewerFlags,
  COMMENT_IP_MAX_PER_WINDOW,
  COMMENT_IP_WINDOW_MS,
  COMMENT_LOGIN_MAX_PER_WINDOW,
  COMMENT_LOGIN_WINDOW_MS,
  type CommentJson,
} from "@/lib/api/comments";

/**
 * UR E.7 留言列表（🌐 免登入）＋發表（🌐 匿名／登入雙通道）。
 * `GET /api/v1/checkins/:id/comments?limit&cursor` -> `{comments, nextCursor}`。
 * `POST /api/v1/checkins/:id/comments {body}` -> `{comment}`（201；
 *   匿名首評帶 `Set-Cookie: wtd-anon`）。
 * 可见性：public 人人见；friends／private 走 canViewCheckin（friends 需登入＋
 * accepted 互好友，沿 wall scope 口径；陌生／私密一律 404 不洩）。
 * 發表守衛：隱身 403 → 三檔限流 422 → 審核（reject 403／全掛 503 fail-closed）。
 * 寫入走 service 客戶端（匿名無 RLS 身份；歸屬與限流全由應用層判定，
 * 沿 D.2 建會話口徑）。
 */

const COMMENT_COLUMNS = "id,checkin_id,body,status,created_at,user_id,anon_id,users(nickname)";
const ANON_COOKIE = "wtd-anon";
const ANON_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

type PostRow = { id: string; user_id: string | null; visibility: unknown };

async function loadPost(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  checkinId: string,
): Promise<{ post: PostRow } | { error: Response }> {
  const { data: post, error: postErr } = await supabase
    .from("checkins")
    .select("id,user_id,visibility")
    .eq("id", checkinId)
    .maybeSingle();
  if (postErr) {
    console.error(
      `[api/v1/comments] post lookup error: code=${postErr.code} message=${postErr.message}`,
    );
    return { error: apiError("internal", "帖子读取失败", 500) };
  }
  if (post === null) {
    return { error: apiError("not_found", "帖子不存在", 404) };
  }
  return { post: post as PostRow };
}

/** 非公開帖的關係＋可見判定（friends 查 accepted；不過即 404）。 */
async function gateNonPublic(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  post: PostRow,
  userId: string | null,
): Promise<Response | null> {
  if (post.visibility === "public") return null;
  if (userId === null) {
    return apiError("not_found", "帖子不存在", 404);
  }
  let friendIds: string[] = [];
  if (post.visibility === "friends") {
    const { data: fsRows, error: fsErr } = await supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    if (fsErr) {
      console.error(
        `[api/v1/comments] friendships error: code=${fsErr.code} message=${fsErr.message}`,
      );
      return apiError("internal", "好友查詢失敗", 500);
    }
    friendIds = friendIdsOf(
      userId,
      (fsRows ?? []) as { user_id: unknown; friend_id: unknown; status: unknown }[],
    );
  }
  if (!canViewCheckin(userId, post.user_id, post.visibility, friendIds)) {
    return apiError("not_found", "帖子不存在", 404);
  }
  return null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: rawId } = await ctx.params;
  const idParsed = parseCheckinIdParam(rawId);
  if ("error" in idParsed) {
    return apiError("invalid_params", idParsed.error, 400);
  }
  const paramsParsed = parseCommentsParams(new URL(req.url).searchParams);
  if ("error" in paramsParsed) {
    return apiError("invalid_params", paramsParsed.error, 400);
  }
  const { limit, cursor } = paramsParsed;

  try {
    const service = await createServiceClient();
    const loaded = await loadPost(service, idParsed.id);
    if ("error" in loaded) return loaded.error;
    const authed = await getAuthedClient(req);
    const gated = await gateNonPublic(service, loaded.post, authed.userId);
    if (gated !== null) return gated;

    // 讀評論：只回 visible，创建时间倒序 keyset（limit＋1 探下一页）。
    let query = service
      .from("checkin_comments")
      .select(COMMENT_COLUMNS)
      .eq("checkin_id", idParsed.id)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (cursor !== null) {
      query = query.or(
        `created_at.lt.${cursor.ca},and(created_at.eq.${cursor.ca},id.lt.${cursor.id})`,
      );
    }
    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) {
      console.error(
        `[api/v1/comments] rows error: code=${rowsErr.code} message=${rowsErr.message}`,
      );
      return apiError("internal", "留言读取失败", 500);
    }
    const comments: CommentJson[] = [];
    // 身份章：viewer 身份（登录／匿名 cookie／游客）＋帖归属；user_id／anon_id 不下发。
    const viewer =
      authed.userId !== null
        ? { userId: authed.userId }
        : readAnonId(req) !== null
          ? { anonId: readAnonId(req) as string }
          : null;
    for (const r of (rows ?? []) as unknown[]) {
      const j = toCommentJson(r);
      if (j !== null) {
        comments.push(withViewerFlags(j, viewer, loaded.post.user_id, rawAnonIdOf(r)));
      }
    }
    const page = comments.slice(0, limit);
    const nextCursor =
      comments.length > limit && page.length > 0
        ? encodeCommentsCursor({
            v: 1,
            ca: page[page.length - 1].created_at,
            id: page[page.length - 1].id,
          })
        : null;
    return apiOk({ comments: page, nextCursor });
  } catch (err) {
    console.error(
      `[api/v1/comments] unexpected: ${err instanceof Error ? err.message : err}`,
    );
    return apiError("internal", "留言读取失败", 500);
  }
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd !== null && fwd !== "") {
    const first = fwd.split(",")[0].trim();
    if (first !== "") return first;
  }
  return "unknown";
}

function ipHash(ip: string): string {
  const salt = process.env.COMMENT_IP_SALT ?? "wtd-dev-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function readAnonId(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (header === null || header === "") return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === ANON_COOKIE) {
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      if (/^[A-Za-z0-9-]{8,64}$/.test(v)) return v;
      return null;
    }
  }
  return null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: rawId } = await ctx.params;
  const idParsed = parseCheckinIdParam(rawId);
  if ("error" in idParsed) {
    return apiError("invalid_params", idParsed.error, 400);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const bodyParsed = parseCommentBody(raw);
  if ("error" in bodyParsed) {
    return apiError("invalid_params", bodyParsed.error, 400);
  }
  const text = bodyParsed.body;

  const authed = await getAuthedClient(req);
  const userId = authed.userId;

  try {
    const service = await createServiceClient();
    const loaded = await loadPost(service, idParsed.id);
    if ("error" in loaded) return loaded.error;
    const post = loaded.post;
    const gated = await gateNonPublic(service, post, userId);
    if (gated !== null) return gated;

    // 隱身禁評（A.15 社交禁令；自己的帖也不行——評論是社交面）。
    if (userId !== null) {
      const { data: meRow, error: meErr } = await service
        .from("users")
        .select("mode")
        .eq("id", userId)
        .maybeSingle();
      if (meErr && meErr.code !== "PGRST116") {
        console.error(
          `[api/v1/comments] mode lookup error: code=${meErr.code} message=${meErr.message}`,
        );
        return apiError("internal", "用户模式读取失败", 500);
      }
      const mode = (meRow as { mode?: string } | null)?.mode ?? "public";
      if (mode === "stealth") {
        return apiError("forbidden", "隱身模式不可留言，請切換至好友或公開模式", 403);
      }
    }

    // 三檔限流（服務端計數；localStorage 不算數）。
    const now = Date.now();
    let anonId: string | null = null;
    if (userId !== null) {
      const since = new Date(now - COMMENT_LOGIN_WINDOW_MS).toISOString();
      const { count, error: cErr } = await service
        .from("checkin_comments")
        .select("id", { count: "exact", head: true })
        .eq("checkin_id", idParsed.id)
        .eq("user_id", userId)
        .eq("status", "visible")
        .gte("created_at", since);
      if (cErr) {
        console.error(
          `[api/v1/comments] login window count error: code=${cErr.code} message=${cErr.message}`,
        );
        return apiError("internal", "頻控查詢失敗", 500);
      }
      if (overWindowLimit(count ?? 0, COMMENT_LOGIN_MAX_PER_WINDOW)) {
        return apiError("rate_limited", "留言太頻繁，稍後再試", 429);
      }
    } else {
      anonId = readAnonId(req) ?? randomUUID();
      const ip = ipHash(clientIp(req));
      // outstanding：該身份在帖作者最後回覆之後還有可見留言即不可再評。
      // 單層結構無線程歸屬——帖作者在該身份首評之後的任何回覆即清零（帖級從寬）。
      const { data: mine, error: mErr } = await service
        .from("checkin_comments")
        .select("created_at")
        .eq("checkin_id", idParsed.id)
        .is("user_id", null)
        .eq("anon_id", anonId)
        .eq("status", "visible")
        .order("created_at", { ascending: true });
      if (mErr) {
        console.error(
          `[api/v1/comments] anon outstanding error: code=${mErr.code} message=${mErr.message}`,
        );
        return apiError("internal", "頻控查詢失敗", 500);
      }
      const anonMs = ((mine ?? []) as { created_at: string }[])
        .map((r) => Date.parse(r.created_at))
        .filter((t) => Number.isFinite(t));
      const firstAnon = anonMs.length > 0 ? Math.min(...anonMs) : Number.POSITIVE_INFINITY;
      const { data: ownerReplies, error: oErr } = await service
        .from("checkin_comments")
        .select("created_at")
        .eq("checkin_id", idParsed.id)
        .eq("status", "visible")
        .eq("user_id", post.user_id ?? "__none__")
        .order("created_at", { ascending: true });
      if (oErr) {
        console.error(
          `[api/v1/comments] owner replies error: code=${oErr.code} message=${oErr.message}`,
        );
        return apiError("internal", "頻控查詢失敗", 500);
      }
      const ownerMs = ((ownerReplies ?? []) as { created_at: string }[])
        .map((r) => Date.parse(r.created_at))
        .filter((t) => Number.isFinite(t) && t > firstAnon);
      if (anonHasOutstanding(anonMs, ownerMs)) {
        return apiError("rate_limited", "作者回覆前只能留 1 條", 429);
      }
      // IP 墊底：同 IP 哈希同帖 24h 匿名評上限（防清 cookie 重刷）。
      const ipSince = new Date(now - COMMENT_IP_WINDOW_MS).toISOString();
      const { count: ipCount, error: ipErr } = await service
        .from("checkin_comments")
        .select("id", { count: "exact", head: true })
        .eq("checkin_id", idParsed.id)
        .is("user_id", null)
        .eq("anon_ip_hash", ip)
        .eq("status", "visible")
        .gte("created_at", ipSince);
      if (ipErr) {
        console.error(
          `[api/v1/comments] ip window count error: code=${ipErr.code} message=${ipErr.message}`,
        );
        return apiError("internal", "頻控查詢失敗", 500);
      }
      if (overWindowLimit(ipCount ?? 0, COMMENT_IP_MAX_PER_WINDOW)) {
        return apiError("rate_limited", "留言太頻繁，稍後再試", 429);
      }
    }

    // 審核（沿 E.2 管線：OpenAI 主審 → Minimax 兜底；命中 403／全掛 503）。
    const verdict = await moderateCheckin(
      { text },
      {
        openaiKey: process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY,
        minimaxKey: process.env.minimaxi_api_key,
        minimaxBaseUrl: process.env.MINIMAX_API_BASE,
      },
    );
    if ("primaryError" in verdict && verdict.primaryError !== undefined) {
      console.warn(
        `[api/v1/comments] moderation primary failed, fallback used: vendor=${verdict.primaryError.vendor} status=${verdict.primaryError.status ?? "network"}`,
      );
    }
    const action = moderationAction(verdict);
    if (action === "reject" && verdict.flagged) {
      return apiError("rejected", "內容未通過審核，請修改後再發", 403);
    }
    if (action === "unavailable") {
      console.error(
        `[api/v1/comments] moderation vendors all failed: ${JSON.stringify("errors" in verdict ? verdict.errors : [])}`,
      );
      return apiError("rejected", "審核服務暫不可用，請稍後再試", 503);
    }

    // 落庫（service 旁路 RLS；歸屬已由應用層判定）。
    const finalAnonId = userId !== null ? null : (anonId as string);
    const finalIpHash = userId !== null ? null : ipHash(clientIp(req));
    const { data: inserted, error: insErr } = await service
      .from("checkin_comments")
      .insert({
        checkin_id: idParsed.id,
        ...(userId !== null ? { user_id: userId } : {}),
        ...(finalAnonId !== null ? { anon_id: finalAnonId } : {}),
        ...(finalIpHash !== null ? { anon_ip_hash: finalIpHash } : {}),
        body: text,
        status: "visible",
      })
      .select(COMMENT_COLUMNS)
      .single();
    if (insErr || inserted === null) {
      console.error(
        `[api/v1/comments] insert error: code=${insErr?.code} message=${insErr?.message}`,
      );
      return apiError("internal", "留言發表失敗", 500);
    }
    const mapped = toCommentJson(inserted);
    if (mapped === null) {
      return apiError("internal", "留言發表失敗", 500);
    }
    // 身份章：刚发的必是本人（is_mine true）；作者自评顺带作者章。
    const comment = withViewerFlags(
      mapped,
      userId !== null
        ? { userId }
        : finalAnonId !== null
          ? { anonId: finalAnonId }
          : null,
      post.user_id,
      rawAnonIdOf(inserted),
    );
    // 匿名首評發 cookie（httpOnly，沿 guest_id 配方；Secure 由平台層處理）。
    if (userId === null && readAnonId(req) === null && finalAnonId !== null) {
      const headers = new Headers();
      headers.set(
        "Set-Cookie",
        `${ANON_COOKIE}=${encodeURIComponent(finalAnonId)}; Path=/; Max-Age=${ANON_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`,
      );
      return Response.json({ comment }, { status: 201, headers });
    }
    return apiOk({ comment }, 201);
  } catch (err) {
    console.error(
      `[api/v1/comments] unexpected: ${err instanceof Error ? err.message : err}`,
    );
    return apiError("internal", "留言發表失敗", 500);
  }
}

