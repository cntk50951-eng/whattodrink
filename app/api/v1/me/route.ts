import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parsePatchModeBody, toMeJson } from "@/lib/mode";
import { NICKNAME_DAILY_LIMIT, parseProfileBody, parseProfileInfoBody } from "@/lib/api/profile";
import { hkDayStartISO } from "@/lib/api/party";
import { moderateCheckin, moderationAction } from "@/lib/moderation";
import { parsePreferences } from "@/lib/api/taste";
import { parsePushPrefs } from "@/lib/push/prefs";

/**
 * UR A.16 隱身模式（A.4-6 子集先行，一次一個端點）。
 * `GET /api/v1/me`（🔒）：回自己 profile＋mode（0007 未遷移時 mode 按 public 回退）。
 * `PATCH /api/v1/me {mode}`（🔒）：白名單三檔，寫 `mode＋mode_updated_at`。
 * UR E.18 首登四段＋E.28 preferences 同口径（全可选；有任一有效字段即写）。
 * 缺行自建沿 DEF-20250925-001（POST /checkins 同配方）；RLS 沿 0006 users self read/update。
 */

const ME_SELECT =
  "id,nickname,avatar_url,gender,mode,mode_updated_at,dob,bio,onboarded_at,created_at,preferences,push_prefs,height_cm,occupation,languages,interests,info_visibility";
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

export async function PATCH(req: Request): Promise<Response> {  const { supabase, userId } = await getAuthedClient(req);
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
  const profile = parseProfileBody(raw);
  const info = parseProfileInfoBody(raw);
  const hasMode = (raw as Record<string, unknown>).mode !== undefined;
  if (hasMode && "error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  if (!hasMode && "error" in profile) {
    return apiError("invalid_params", profile.error, profile.error === "AGE_RESTRICTED" ? 422 : 400);
  }
  if ("error" in info) {
    return apiError("invalid_params", info.error, 400);
  }
  // UR E.28 口味偏好（整体替换；null 清空；对象走 parsePreferences；非法 400）。
  const prefRaw = (raw as Record<string, unknown>).preferences;
  const hasPref = prefRaw !== undefined;
  let prefBody: { favorites: string[]; likes: string[]; dislikes: string[] } | null | undefined;
  if (hasPref) {
    if (prefRaw === null) {
      prefBody = null;
    } else {
      const pp = parsePreferences(prefRaw);
      if ("error" in pp) {
        return apiError("invalid_params", pp.error, 400);
      }
      prefBody = pp.body;
    }
  }
  try {
    await ensureUserRow(supabase, userId);
    const nowIso = new Date().toISOString();
    // 当前行（改名频率＋变化检测＋旧头像清理用；本人行自读）。
    const { data: curRaw } = await supabase
      .from("users")
      .select("nickname,bio,avatar_url,nickname_updated_at,nickname_daily_count,info_visibility,dob")
      .eq("id", userId)
      .maybeSingle();
    const cur = (curRaw ?? {}) as {
      nickname?: unknown;
      bio?: unknown;
      avatar_url?: unknown;
      nickname_updated_at?: unknown;
      nickname_daily_count?: unknown;
      info_visibility?: unknown;
      dob?: unknown;
    };
    const update: Record<string, unknown> = {};
    if (!("error" in parsed)) {
      update.mode = parsed.body.mode;
      update.mode_updated_at = nowIso;
    }
    if (!("error" in profile)) {
      // UR E.18 首登資料（四段全可选；首登必填由调用方表单判，不进端点）。
      if (profile.gender !== undefined) update.gender = profile.gender;
      // 生日锁定（WEB_HANDOFF_ONBOARDING）：首次写入后不可改成不同日期，防止未成年被 422 后改填成年日期绕过。
      // 相同值放行（iOS 首页重传同一生日幂等）；未成年从未写入库（422 在前），故 dob 为空时仍可重试。
      if (profile.dob !== undefined) {
        if (typeof cur.dob === "string" && cur.dob !== "" && profile.dob !== cur.dob) {
          return apiError("forbidden", "生日首次填寫後不可修改，如需更正請聯繫客服", 403);
        }
        update.dob = profile.dob;
      }
      if (profile.bio !== undefined) update.bio = profile.bio;
      if (profile.avatar_url !== undefined) update.avatar_url = profile.avatar_url;
      if (profile.nickname !== undefined) update.nickname = profile.nickname;
      if ((raw as Record<string, unknown>).onboarded === true) {
        update.onboarded_at = nowIso;
      }
      // 新欄（全选填；languages／interests 整體替換；info_visibility 合併，null 值刪鍵回默认）。
      if (info.height_cm !== undefined) update.height_cm = info.height_cm;
      if (info.occupation !== undefined) update.occupation = info.occupation;
      if (info.languages !== undefined) update.languages = info.languages;
      if (info.interests !== undefined) update.interests = info.interests;
      if (info.info_visibility !== undefined) {
        const merged: Record<string, string> =
          typeof cur.info_visibility === "object" && cur.info_visibility !== null
            ? { ...(cur.info_visibility as Record<string, string>) }
            : {};
        for (const [k, v] of Object.entries(info.info_visibility)) {
          if (v === null) delete merged[k];
          else merged[k] = v;
        }
        update.info_visibility = merged;
      }
      // 改名频率（WEB_HANDOFF_PROFILE_EDIT_MODERATION：每天最多 3 次，HK 天；真改才计）。
      if (profile.nickname !== undefined && profile.nickname !== cur.nickname) {
        const dayStart = hkDayStartISO(Date.now());
        const sameDay =
          typeof cur.nickname_updated_at === "string" && cur.nickname_updated_at >= dayStart;
        const usedToday =
          sameDay && typeof cur.nickname_daily_count === "number" ? cur.nickname_daily_count : 0;
        if (usedToday >= NICKNAME_DAILY_LIMIT) {
          return apiError("rate_limited", "改名太頻繁，每日最多 3 次", 429);
        }
        update.nickname_updated_at = nowIso;
        update.nickname_daily_count = usedToday + 1;
      }
    }
    // UR E.28 口味偏好（对象替换／null 清空；计有效字段，沿"至少一个有效"）。
    if (hasPref) {
      update.preferences = prefBody;
    }
    // UR D.9 推送偏好（整体替换；非法 400；计有效字段）。
    const pushPrefRaw = (raw as Record<string, unknown>).push_prefs;
    if (pushPrefRaw !== undefined) {
      const pp = parsePushPrefs(pushPrefRaw);
      if ("error" in pp) {
        return apiError("invalid_params", pp.error, 400);
      }
      update.push_prefs = pp.body;
    }
    // 内容审核（WEB_HANDOFF_PROFILE_EDIT_MODERATION）：昵称／bio 文审，头像图审；
    // 任一项不过整个不保存（原子，单 update 在后）；空值（清 bio／清头像）不审直接放行。
    const newAvatarUrl = !("error" in profile) && typeof profile.avatar_url === "string" ? profile.avatar_url : null;
    const avatarChanged = newAvatarUrl !== null && newAvatarUrl !== cur.avatar_url;
    const newAvatarPath = avatarChanged ? selfBucketPath(newAvatarUrl) : null;
    if (Object.keys(update).length > 0 && !("error" in profile)) {
      const targets: { label: string; text?: string; imageDataUrl?: string }[] = [];
      if (typeof profile.nickname === "string" && profile.nickname !== cur.nickname) {
        targets.push({ label: "暱稱", text: profile.nickname });
      }
      if (typeof profile.bio === "string" && profile.bio !== "" && profile.bio !== cur.bio) {
        targets.push({ label: "自我介紹", text: profile.bio });
      }
      if (avatarChanged && newAvatarPath !== null) {
        const imageDataUrl = await fetchAvatarDataUrl(newAvatarPath);
        if (imageDataUrl === null) {
          return apiError("rejected", "審核服務暫不可用，請稍後再試", 503);
        }
        targets.push({ label: "頭像", imageDataUrl });
      }
      for (const t of targets) {
        const verdict = await moderateCheckin(
          { ...(t.text !== undefined ? { text: t.text } : {}), ...(t.imageDataUrl !== undefined ? { imageDataUrl: t.imageDataUrl } : {}) },
          {
            openaiKey: process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY,
            minimaxKey: process.env.minimaxi_api_key,
            minimaxBaseUrl: process.env.MINIMAX_API_BASE,
          },
        );
        const action = moderationAction(verdict);
        if (action === "reject") {
          // 头像已先落桶且公开：被拒即删（新文件；旧文件不动，本次无保存）。
          if (newAvatarPath !== null) await deleteAvatarPath(newAvatarPath);
          return apiError("rejected", `內容未通過審核（${t.label}），請修改後再發`, 403);
        }
        if (action === "unavailable") {
          if (newAvatarPath !== null) await deleteAvatarPath(newAvatarPath);
          return apiError("rejected", "審核服務暫不可用，請稍後再試", 503);
        }
      }
    }
    if (Object.keys(update).length === 0) {
      return apiError("invalid_params", "body 無有效字段", 400);
    }
      // UR E.18：舊誤導文案退役（缺列直報真名，沿 0024 口徑；不再提 0007）。
    const { data, error } = await supabase
      .from("users")
      .update(update)
      .eq("id", userId)
      .select(ME_SELECT)
      .maybeSingle();
    if (error) {
      if (error.code === "42703") {
        const m = /column "?(\w+)"? (of relation|does not exist)/.exec(error.message);
        return apiError("internal", `字段缺失（${m?.[1] ?? error.message}，請執行對應 migration）`, 500);
      }
      console.error(`[api/v1/me] update error: code=${error.code} message=${error.message}`);
      return apiError("internal", "保存失敗", 500);
    }
    const me = toMeJson(data);
    if (me === null) {
      console.error("[api/v1/me] bad users row after update");
      return apiError("internal", "模式切換失敗", 500);
    }
    // 旧头像顺手清理（自家桶＋路径变了；失败只记 log，不拦响应）。
    if (avatarChanged && typeof cur.avatar_url === "string") {
      const oldPath = selfBucketPath(cur.avatar_url);
      if (oldPath !== null && oldPath !== newAvatarPath) await deleteAvatarPath(oldPath);
    }
    return apiOk({ me });
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}

/** 自家 avatars 桶 URL→桶内 path（Google 头像／非法即 null，不碰）。 */
function selfBucketPath(avatarUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(avatarUrl);
  } catch {
    return null;
  }
  const marker = "/avatars/";
  const i = u.pathname.indexOf(marker);
  if (i === -1) return null;
  const p = u.pathname.slice(i + marker.length);
  if (p === "" || p.includes("..")) return null;
  return p;
}

/** 取自家头像文件转 data URL 送图审（取不到即 null，调用方按不可用处理）。 */
async function fetchAvatarDataUrl(storagePath: string): Promise<string | null> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const svc = await createServiceClient();
    const { data, error } = await svc.storage.from("avatars").download(storagePath);
    if (error !== null || data === null) {
      console.error(`[api/v1/me] avatar fetch error: message=${error?.message}`);
      return null;
    }
    if (data.size > 5 * 1024 * 1024) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.error(`[api/v1/me] avatar fetch threw: ${err instanceof Error ? err.message : "unknown"}`);
    return null;
  }
}

/** 删桶内头像文件（被拒新文件／换下的旧文件；失败只记 log）。 */
async function deleteAvatarPath(storagePath: string): Promise<void> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const svc = await createServiceClient();
    const { error } = await svc.storage.from("avatars").remove([storagePath]);
    if (error !== null) {
      console.error(`[api/v1/me] avatar remove error: message=${error.message}`);
    }
  } catch (err) {
    console.error(`[api/v1/me] avatar remove threw: ${err instanceof Error ? err.message : "unknown"}`);
  }
}
