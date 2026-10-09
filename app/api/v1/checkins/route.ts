import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseCreateCheckinBody } from "@/lib/api/checkins";
import { moderateCheckin, moderationAction } from "@/lib/moderation";

/**
 * UR A.12 打卡雙類型（🔒，承 A.10）。
 * `POST /api/v1/checkins {beer_id, lat, lng, place_name?, kind}` -> 插 `checkins(type=want, kind, visibility deriv. from users.mode, expires_at)`。
 * 隱身模式直接 403，前端引導切換；未傳 kind 兼容為 flash。
 */

const CHECKIN_SELECT = "id,beer_id,lat,lng,place_name,kind,visibility,expires_at,created_at,photo_url,note,audio_url,audio_seconds,transcript,tags";

/** key 缺席只 warn 一次（開發態容許跳過；生產必須配 key，見 UR E.2）。 */
let warnedNoModerationKey = false;

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

  const parsed = parseCreateCheckinBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { beer_id, lat, lng, place_name, kind } = parsed.body;
  const photoUrl = parsed.body.photo_url ?? null;  // UR E.20 縮圖隨單（缺即 null；42703 老庫回退鏈不碰此列，見下）。
  const photoThumb = parsed.body.photo_thumb ?? null;
  const noteText = parsed.body.note ?? null;
  const audioUrl = parsed.body.audio_url ?? null;
  const audioSeconds = parsed.body.audio_seconds ?? null;
  const transcriptText = parsed.body.transcript ?? null;
  const tags = parsed.body.tags ?? [];

  try {
    // 防御：若 public.users 缺行（0006 触发器未执行或旧库），先补行再落库，避免 FK 23503
    try {
      const { data: ensured } = await supabase.from("users").select("id").eq("id", userId).maybeSingle();
      if (ensured === null) {
        // 尝试从 auth 取昵称/头像，失败则兜底
        let nickname = "酒友";
        let avatar: string | null = null;
        try {
          const { data: u } = await supabase.auth.getUser();
          const meta = (u.user?.user_metadata ?? {}) as Record<string, unknown>;
          const cand =
            (typeof meta.full_name === "string" && meta.full_name) ||
            (typeof meta.name === "string" && meta.name) ||
            (typeof u.user?.email === "string" ? u.user.email.split("@")[0] : null);
          if (typeof cand === "string" && cand.trim().length > 0) nickname = cand.trim().slice(0, 32);
          if (typeof meta.avatar_url === "string") avatar = meta.avatar_url;
          else if (typeof meta.picture === "string") avatar = meta.picture;
        } catch {}
        await supabase.from("users").insert({ id: userId, nickname, avatar_url: avatar, gender: "secret" });
      }
    } catch {}
    // 取用戶模式派生 visibility；隱身直接 403（A.12 模式權限）。0007 未遷移時 users.mode 缺列，按 public 回退
    let mode: string = "public";
    try {
      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("mode")
        .eq("id", userId)
        .maybeSingle();
      if (userErr) {
        // 42703 未遷移時 users.mode 缺列，視為 public
        if (userErr.code === "42703") {
          mode = "public";
        } else {
          console.error(`[api/v1/checkins] user mode lookup error: code=${userErr.code} message=${userErr.message}`);
          return apiError("internal", "用户模式读取失败", 500);
        }
      } else {
        mode = (userRow as { mode?: string } | null)?.mode ?? "public";
      }
    } catch {
      mode = "public";
    }
    if (mode === "stealth") {
      return apiError("forbidden", "隱身模式不可打卡，請切換至好友或公開模式", 403);
    }
    // UR E.2 發送工作流：即時在線審核（圖＋文＋轉錄一次調過；語音本體兩邊
    // 都不支援，走 transcript；鏈：OpenAI 主審 → Minimax 兜底 → 全掛放行＋warn）。
    const modText =
      [noteText, transcriptText]
        .filter((s): s is string => s !== null)
        .join("\n") || undefined;
    const verdict = await moderateCheckin(
      {
        ...(modText !== undefined ? { text: modText } : {}),
        ...(photoUrl !== null ? { imageDataUrl: photoUrl } : {}),
      },
      {
        // 用戶手寫的是 OPENAI_KEY，標準名優先，兼容舊名。
        openaiKey: process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY,
        minimaxKey: process.env.minimaxi_api_key,
        minimaxBaseUrl: process.env.MINIMAX_API_BASE,
      },
    );
    // DEF-20260929-001：主审挂了一定大声（vendor＋status，不记内容／key；
    // 此前空 catch 静默下沉是放行的直接帮凶）。
    if ("primaryError" in verdict && verdict.primaryError !== undefined) {
      console.warn(
        `[api/v1/checkins] moderation primary failed, fallback used: vendor=${verdict.primaryError.vendor} status=${verdict.primaryError.status ?? "network"}`,
      );
    }
    const action = moderationAction(verdict);
    if (action === "reject" && verdict.flagged) {
      const fields = [
        ...(photoUrl !== null ? ["照片"] : []),
        ...(modText !== undefined ? ["文字"] : []),
      ].join("／");
      return apiError(
        "rejected",
        `內容未通過審核（${fields !== "" ? fields : "內容"}），請修改後再發`,
        403,
      );
    }
    if (action === "unavailable") {
      // 有 key 但两家全挂：fail-closed，不落地（沿 rejected 通道，message 区分是服务问题；
      // 客户端零改动——rejected 本来就 toast＋不进离线回退）。
      console.error(
        `[api/v1/checkins] moderation vendors all failed: ${JSON.stringify("errors" in verdict ? verdict.errors : [])}`,
      );
      return apiError("rejected", "審核服務暫不可用，請稍後再試", 503);
    }
    if ("skipped" in verdict && verdict.skipped) {
      if (!warnedNoModerationKey) {
        warnedNoModerationKey = true;
        console.warn("[api/v1/checkins] 審核鏈無 key／無輸入，放行（僅開發態容許）");
      }
    } else if (!verdict.flagged && verdict.via === "minimax") {
      // 兜底命中記錄（驗證時可分清誰審的；日常乾淨請求不打日誌）。
      console.info("[api/v1/checkins] moderation pass via minimax（主審下沉）");
    }
    const visibility = mode === "friends" ? "friends" : "public";
    const expiresAt = kind === "flash" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

    // 先校验 beer_id 是否存在（無酒纯照片打卡跳过；FK 不存在会 500，提前转 400 更友好；并发竞态下仍可能落 FK，故容错两路）
    if (beer_id !== null) {
      const { data: beerExists, error: beerErr } = await supabase
        .from("beers")
        .select("id")
        .eq("id", beer_id)
        .maybeSingle();
      if (beerErr) {
        console.error(
          `[api/v1/checkins] beer lookup error: code=${beerErr.code} message=${beerErr.message}`,
        );
        return apiError("internal", "beer 校验失败", 500);
      }
      if (beerExists === null) {
        return apiError("invalid_params", `beer_id 不存在：${beer_id}`, 400);
      }
    }

    let inserted: Record<string, unknown> | null = null;
    {
      const { data, error } = await supabase
        .from("checkins")
        .insert({
          user_id: userId,
          beer_id,
          lat,
          lng,
          place_name: place_name ?? null,
          type: "want",
          kind,
          visibility,
          expires_at: expiresAt,
          photo_url: photoUrl,
          photo_thumb: photoThumb,
          note: noteText ?? "",
          audio_url: audioUrl,
          audio_seconds: audioSeconds,
          transcript: transcriptText ?? "",
          tags,
        })
        .select(CHECKIN_SELECT)
        .single();
      if (error === null && data !== null) {
        inserted = data as unknown as Record<string, unknown>;
      } else {
        // 0007 未遷移時 kind/visibility/expires_at 缺列（42703），回退舊插入（private）
        if (error?.code === "42703") {
          console.warn("[api/v1/checkins] 0007 未遷移，回退舊插入");
          const { data: legacyData, error: legacyErr } = await supabase
            .from("checkins")
            .insert({
              user_id: userId,
              beer_id,
              lat,
              lng,
              place_name: place_name ?? null,
              type: "want",
              visibility: "private",
              photo_url: photoUrl,
              note: noteText ?? "",
              audio_url: audioUrl,
              audio_seconds: audioSeconds,
              transcript: transcriptText ?? "",
            })
            .select("id,beer_id,lat,lng,place_name,created_at,photo_url,note,audio_url,audio_seconds,transcript")
            .single();
          if (legacyErr || legacyData === null) {
            const isFk = legacyErr?.code === "23503";
            if (isFk) return apiError("invalid_params", `beer_id 不存在：${beer_id}`, 400);
            console.error(`[api/v1/checkins] legacy insert error: code=${legacyErr?.code} message=${legacyErr?.message}`);
            return apiError("internal", "打卡落库失败", 500);
          }
          const r = legacyData as unknown as Record<string, unknown>;
          return apiOk(
            {
              checkin: {
                id: r.id as string,
                beer_id: (r.beer_id as string | null) ?? null,
                lat: r.lat as number,
                lng: r.lng as number,
                place_name: r.place_name as string | null,
                kind,
                visibility: "private" as const,
                expires_at: expiresAt,
                created_at: r.created_at as string,
                photo_url: (r.photo_url as string | null) ?? null,
                note: (r.note as string | null) ?? null,
                audio_url: (r.audio_url as string | null) ?? null,
                audio_seconds: (r.audio_seconds as number | null) ?? null,
                transcript: (r.transcript as string | null) ?? null,
              },
            },
            201,
          );
        }
        const isFk = error?.code === "23503";
        if (isFk) return apiError("invalid_params", `beer_id 不存在：${beer_id}`, 400);
        console.error(`[api/v1/checkins] insert error: code=${error?.code} message=${error?.message} details=${error?.details ?? ""}`);
        return apiError("internal", "打卡落库失败", 500);
      }
    }
    const row = inserted as Record<string, unknown>;
    return apiOk(
      {
        checkin: {
          id: row.id as string,
          beer_id: (row.beer_id as string | null) ?? null,
          lat: row.lat as number,
          lng: row.lng as number,
          place_name: row.place_name as string | null,
          kind: row.kind as "flash" | "post",
          visibility: row.visibility as "private" | "public" | "friends",
          expires_at: row.expires_at as string | null,
          created_at: row.created_at as string,
          photo_url: (row.photo_url as string | null) ?? null,
          note: (row.note as string | null) ?? null,
          audio_url: (row.audio_url as string | null) ?? null,
          audio_seconds: (row.audio_seconds as number | null) ?? null,
          transcript: (row.transcript as string | null) ?? null,
          tags: Array.isArray(row.tags) ? (row.tags as unknown[]).filter((x): x is string => typeof x === "string") : [],
        },
      },
      201,
    );
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}
