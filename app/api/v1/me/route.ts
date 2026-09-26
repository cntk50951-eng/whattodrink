import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parsePatchModeBody, toMeJson } from "@/lib/mode";

/**
 * UR A.16 隱身模式（A.4-6 子集先行，一次一個端點）。
 * `GET /api/v1/me`（🔒）：回自己 profile＋mode（0007 未遷移時 mode 按 public 回退）。
 * `PATCH /api/v1/me {mode}`（🔒）：白名單三檔，寫 `mode＋mode_updated_at`。
 * 缺行自建沿 DEF-20250925-001（POST /checkins 同配方）；RLS 沿 0006 users self read/update。
 */

const ME_SELECT =
  "id,nickname,avatar_url,gender,mode,mode_updated_at";
const ME_SELECT_LEGACY = "id,nickname,avatar_url,gender,created_at";

async function ensureUserRow(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  userId: string,
): Promise<void> {
  try {
    const { data: ensured } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (ensured !== null) return;
    let nickname = "酒友";
    let avatar: string | null = null;
    try {
      const { data: u } = await supabase.auth.getUser();
      const meta = (u.user?.user_metadata ?? {}) as Record<string, unknown>;
      const cand =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        (typeof u.user?.email === "string" ? u.user.email.split("@")[0] : null);
      if (typeof cand === "string" && cand.trim().length > 0)
        nickname = cand.trim().slice(0, 32);
      if (typeof meta.avatar_url === "string") avatar = meta.avatar_url;
      else if (typeof meta.picture === "string") avatar = meta.picture;
    } catch {}
    await supabase
      .from("users")
      .insert({ id: userId, nickname, avatar_url: avatar, gender: "secret" });
  } catch {}
}

export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  try {
    await ensureUserRow(supabase, userId);
    const { data, error } = await supabase
      .from("users")
      .select(ME_SELECT)
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      // 0007 未遷移（mode 缺列 42703）：回退舊列，mode 按 public
      if (error.code === "42703") {
        const { data: legacy, error: legacyErr } = await supabase
          .from("users")
          .select(ME_SELECT_LEGACY)
          .eq("id", userId)
          .maybeSingle();
        if (legacyErr || legacy === null) {
          console.error(`[api/v1/me] legacy read error: code=${legacyErr?.code} message=${legacyErr?.message}`);
          return apiError("internal", "我的資料讀取失敗", 500);
        }
        const r = legacy as unknown as Record<string, unknown>;
        return apiOk({
          me: {
            id: r.id as string,
            nickname: r.nickname as string,
            avatar_url: (r.avatar_url ?? null) as string | null,
            gender: (r.gender ?? "secret") as "male" | "female" | "secret",
            mode: "public" as const,
            mode_updated_at: r.created_at as string,
          },
        });
      }
      console.error(`[api/v1/me] read error: code=${error.code} message=${error.message}`);
      return apiError("internal", "我的資料讀取失敗", 500);
    }
    const me = toMeJson(data);
    if (me === null) {
      console.error("[api/v1/me] bad users row");
      return apiError("internal", "我的資料讀取失敗", 500);
    }
    return apiOk({ me });
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}

export async function PATCH(req: Request): Promise<Response> {
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
  const parsed = parsePatchModeBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  try {
    await ensureUserRow(supabase, userId);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("users")
      .update({ mode: parsed.body.mode, mode_updated_at: nowIso })
      .eq("id", userId)
      .select(ME_SELECT)
      .maybeSingle();
    if (error) {
      // 0007 未遷移無法寫 mode：誠實 500（不靜默假裝切了）
      console.error(`[api/v1/me] update error: code=${error.code} message=${error.message}`);
      return apiError("internal", "模式切換失敗（users.mode 未遷移，請執行 0007）", 500);
    }
    const me = toMeJson(data);
    if (me === null) {
      console.error("[api/v1/me] bad users row after update");
      return apiError("internal", "模式切換失敗", 500);
    }
    return apiOk({ me });
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}
