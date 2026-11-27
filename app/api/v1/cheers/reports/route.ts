import { after } from "next/server";

import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { notifyReportSubmitted, runReportStp } from "@/lib/api/reportStp";
import {
  avatarStoragePath,
  buildUserProfileModerationText,
  collectPostImageDataUrls,
  extractChatImagePaths,
  reportedTextFromSnapshot,
  type ReportModerationInput,
} from "@/lib/reportTriage";
import {
  messageEvidence,
  parseReportBody,
  partyReportGate,
  REPORT_DEDUPE_MS,
  REPORT_EVIDENCE_MAX,
  clipSnapshotText,
  type SnapshotLine,
} from "@/lib/userReports";

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: string;
  body: string | null;
  attachments?: unknown;
  created_at: string | null;
};
type PartyRow = {
  id: string;
  host_user_id: string;
  place: string | null;
  start_at: string | null;
  host_intro: string | null;
  purpose_other: string | null;
  status: string | null;
  created_at: string | null;
};
type PostRow = {
  id: string;
  user_id: string;
  place_name: string | null;
  note: string | null;
  transcript: string | null;
  photo_url: string | null;
  photo_urls?: unknown;
  kind: string | null;
  created_at: string | null;
};

/** 訊息證據：被舉報那條＋之前最多 5 條上下文（RLS 保證舉報人只看得到自己會話裡的）。 */
const MESSAGE_CONTEXT = 5;

/**
 * 舉報（🔒；Apple 1.2 要求 UGC 有舉報＋人工審核）。
 * `POST /api/v1/cheers/reports`
 *   用戶：`{target_user_id, reason?, reason_code?}`（舊形狀照舊可用）
 *   帖子：`{target_type:"post", target_id:<checkins.id>, reason?, reason_code?}`
 *   訊息：`{target_type:"message", target_id:<messages.id>, reason?, reason_code?}`
 *   酒局：`{target_type:"party", target_id:<parties.id>, reason_code∈fake|dangerous|inappropriate|harassment|other, reason?}`
 *     （0093；一律人工，成立即取消未結束的局；同一局只能舉報一次；每人 24h 最多 10 個酒局）
 * 帖子／訊息的作者由服務端按目標反查，並留證據快照；舉報進後台 `/innerharbour/user-reports`。
 * reason 限 200 字；reason_code ∈ harassment|inappropriate|spam|underage|other。
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
  const parsed = parseReportBody(raw, userId);
  if (!parsed.ok) {
    return apiError("invalid_params", parsed.message, 400);
  }
  const p = parsed.value;

  let targetUserId = p.targetUserId;
  let snapshot: SnapshotLine[] | null = null;
  let postForStp: PostRow | null = null;
  let partyForStp: PartyRow | null = null;
  let chatImagePaths: string[] = [];

  if (p.targetType === "message" && p.targetRef !== null) {
    const { data } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,kind,body,attachments,created_at")
      .eq("id", p.targetRef)
      .maybeSingle();
    const msg = data as MessageRow | null;
    if (msg === null) return apiError("not_found", "找不到這條訊息", 404);
    if (msg.sender_id === userId) return apiError("invalid_params", "不能舉報自己", 400);
    targetUserId = msg.sender_id;
    const { data: ctx } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,kind,body,attachments,created_at")
      .eq("conversation_id", msg.conversation_id)
      .lte("created_at", msg.created_at ?? new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(MESSAGE_CONTEXT + 1);
    const rows = ((ctx ?? []) as MessageRow[]).slice().reverse();
    snapshot = rows.map((m) => messageEvidence(m, msg.sender_id, userId));
    chatImagePaths = extractChatImagePaths(rows, msg.sender_id);
  } else if (p.targetType === "post" && p.targetRef !== null) {
    let postRes = await supabase
      .from("checkins")
      .select("id,user_id,place_name,note,transcript,photo_url,photo_urls,kind,created_at")
      .eq("id", p.targetRef)
      .maybeSingle();
    if (postRes.error?.code === "42703") {
      postRes = await supabase
        .from("checkins")
        .select("id,user_id,place_name,note,transcript,photo_url,kind,created_at")
        .eq("id", p.targetRef)
        .maybeSingle();
    }
    const post = postRes.data as PostRow | null;
    if (post === null) return apiError("not_found", "找不到這則帖子", 404);
    if (post.user_id === userId) return apiError("invalid_params", "不能舉報自己", 400);
    targetUserId = post.user_id;
    postForStp = post;
    const text = [post.place_name, post.note].filter((s): s is string => typeof s === "string" && s !== "").join(" · ");
    snapshot = [{ who: "reported", kind: post.kind ?? "post", text: clipSnapshotText(text), at: post.created_at }];
  } else if (p.targetType === "party" && p.targetRef !== null) {
    // 酒局舉報（0093）：用舉報人自己的會話讀（RLS 決定看不看得到這個局），發起人由服務端反查
    const { data } = await supabase
      .from("parties")
      .select("id,host_user_id,place,start_at,host_intro,purpose_other,status,created_at")
      .eq("id", p.targetRef)
      .maybeSingle();
    const party = data as PartyRow | null;
    if (party === null) return apiError("not_found", "找不到這個酒局", 404);
    if (party.host_user_id === userId) return apiError("invalid_params", "不能舉報自己發起的酒局", 400);
    targetUserId = party.host_user_id;
    partyForStp = party;
    // 先查重再限額（iOS R6-05）：同一人對同一局永遠只算一次；已舉報過＝回包丟失後的重試，直接回已提交，
    // 不能先撞「每人 24h 最多 PARTY_REPORT_DAILY_MAX 個酒局」回 429（並發仍由 0093 唯一索引＋下方查重兜底）
    const { data: priorParty } = await supabase
      .from("cheers_reports")
      .select("id")
      .eq("reporter_id", userId)
      .eq("target_type", "party")
      .eq("target_ref", p.targetRef)
      .limit(1);
    const { count } = await supabase
      .from("cheers_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", userId)
      .eq("target_type", "party")
      .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
    const gate = partyReportGate(Array.isArray(priorParty) && priorParty.length > 0, count ?? 0);
    if (gate === "duplicate") return apiOk({ reported: true });
    if (gate === "rate_limited") return apiError("rate_limited", "今天舉報次數已達上限，請明天再試", 429);
    const text = [party.place, party.start_at, party.host_intro, party.purpose_other]
      .filter((s): s is string => typeof s === "string" && s.trim() !== "")
      .join(" · ");
    snapshot = [{ who: "reported", kind: "party", text: clipSnapshotText(text), at: party.created_at }];
  }

  if (targetUserId === null) {
    return apiError("invalid_params", "target 非法", 400);
  }

  // 用戶舉報附聊天記錄：以服務端原文＋發送時間做快照（不信客戶端文字）。
  // 校驗：消息屬於 conversation_id（RLS 讓舉報人只讀得到自己會話裡的消息）、且是被舉報人發的。
  if (
    p.targetType === "user" &&
    p.evidenceMessageIds !== undefined &&
    p.evidenceMessageIds.length > 0 &&
    p.conversationId !== undefined
  ) {
    const { data: evRows } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,kind,body,attachments,created_at")
      .in("id", p.evidenceMessageIds)
      .eq("conversation_id", p.conversationId)
      .eq("sender_id", targetUserId)
      .order("created_at", { ascending: true })
      .limit(REPORT_EVIDENCE_MAX);
    const rows = (evRows ?? []) as MessageRow[];
    const lines = rows.map((m) => messageEvidence(m, targetUserId, userId));
    if (lines.length > 0) snapshot = lines;
    chatImagePaths = extractChatImagePaths(rows, targetUserId);
  }

  // 24h 內同一人對同一對象的重複舉報不再入庫（回成功，免洗版；證據以第一次為準）
  // 酒局：同一人對同一局永遠只算一次（0093 唯一索引兜並發）
  const since = new Date(p.targetType === "party" ? 0 : Date.now() - REPORT_DEDUPE_MS).toISOString();
  let dupe = supabase
    .from("cheers_reports")
    .select("id")
    .eq("reporter_id", userId)
    .eq("target_type", p.targetType)
    .eq("target_user_id", targetUserId)
    .gte("created_at", since)
    .limit(1);
  dupe = p.targetRef === null ? dupe.is("target_ref", null) : dupe.eq("target_ref", p.targetRef);
  const { data: existing } = await dupe;
  if (Array.isArray(existing) && existing.length > 0) {
    return apiOk({ reported: true });
  }

  const { data: inserted, error } = await supabase
    .from("cheers_reports")
    .insert({
      reporter_id: userId,
      target_user_id: targetUserId,
      target_type: p.targetType,
      target_ref: p.targetRef,
      reason_code: p.reasonCode,
      reason: p.reason,
      snapshot,
    })
    .select("id")
    .single();
  // 並發重複提交撞上酒局唯一索引：當作已舉報
  if (error !== null && error.code === "23505") {
    return apiOk({ reported: true });
  }
  if (error !== null) {
    console.error(`[api/v1/cheers/reports] insert error: code=${error.code} message=${error.message}`);
    return apiError("internal", "举报失败", 500);
  }
  const reportId = typeof (inserted as { id?: unknown } | null)?.id === "string" ? (inserted as { id: string }).id : "";

  // 寫入舉報人「已提交舉報」動態紀錄，並啟動背景 AI STP 自動分診（不拖慢 HTTP 回包）
  const svc = await createServiceClient();
  let targetName: string | null = null;
  let targetBio: string | null = null;
  let targetAvatar: string | null = null;
  let targetAvatarPath: string | null = null;
  try {
    let tuRes = await svc.from("users").select("nickname,bio,avatar_url").eq("id", targetUserId).maybeSingle();
    if (tuRes.error?.code === "42703") {
      tuRes = await svc.from("users").select("nickname,avatar_url").eq("id", targetUserId).maybeSingle();
    }
    const tu = tuRes.data as { nickname?: unknown; bio?: unknown; avatar_url?: unknown } | null;
    if (typeof tu?.nickname === "string" && tu.nickname.trim() !== "") targetName = tu.nickname.trim();
    if (typeof tu?.bio === "string" && tu.bio.trim() !== "") targetBio = tu.bio.trim();
    if (typeof tu?.avatar_url === "string" && tu.avatar_url.startsWith("data:image/")) targetAvatar = tu.avatar_url;
    // 頭像實際存 avatars bucket 的 https 公開連結：記下路徑，背景下載後送審（iOS DEF-20261126-010）
    else targetAvatarPath = avatarStoragePath(tu?.avatar_url as string | null | undefined);
  } catch {}

  if (reportId !== "") {
    await notifyReportSubmitted(svc, {
      reporterId: userId,
      reportId,
      targetType: p.targetType,
      targetRef: p.targetRef,
      reasonCode: p.reasonCode,
      placeName: postForStp?.place_name ?? partyForStp?.place ?? null,
      targetName,
    });
    // 三類舉報都走 MiniMax-M3 初審＋置信度分流：
    //   post：原文＋多圖（photo_urls／photo_url）；
    //   message：被舉報人文字＋私聊圖片附件（chat-images）；
    //   user：已勾聊天記錄（文字＋圖）＋被舉報人公開檔案（暱稱／簡介／頭像）
    const stpTargetUserId = targetUserId;
    const stpPost = postForStp;
    const stpContent: ReportModerationInput =
      stpPost !== null
        ? {
            text: [stpPost.place_name, stpPost.note, stpPost.transcript]
              .filter((x): x is string => typeof x === "string" && x.trim() !== "")
              .join("\n") || undefined,
            imageDataUrls: collectPostImageDataUrls(stpPost),
          }
        : p.targetType === "user"
          ? {
              text: [
                reportedTextFromSnapshot(snapshot),
                buildUserProfileModerationText({ nickname: targetName, bio: targetBio }),
              ]
                .filter((x) => x.trim() !== "")
                .join("\n\n") || undefined,
              imageDataUrls: targetAvatar !== null ? [targetAvatar] : undefined,
            }
          : { text: reportedTextFromSnapshot(snapshot) || undefined };
    const stpChatImagePaths = chatImagePaths;
    const stpPartyPlace = partyForStp?.place ?? null;
    // 用戶舉報沒有任何互動證據（沒勾聊天文字／圖）：AI 只看得到公開檔案，檔案乾淨不等於沒騷擾 → 不准自動結案
    const stpProfileOnly = p.targetType === "user" && reportedTextFromSnapshot(snapshot).trim() === "" && chatImagePaths.length === 0;
    const stpAvatarPath = p.targetType === "user" ? targetAvatarPath : null;
    after(async () => {
      const bgSvc = await createServiceClient();
      await runReportStp(bgSvc, {
        reportId,
        targetType: p.targetType,
        targetRef: p.targetRef,
        targetUserId: stpTargetUserId,
        reporterId: userId,
        reasonCode: p.reasonCode,
        reasonText: p.reason,
        placeName: stpPost?.place_name ?? stpPartyPlace,
        targetName,
        content: stpContent,
        chatImagePaths: stpChatImagePaths,
        avatarPath: stpAvatarPath,
        profileOnly: stpProfileOnly,
      });
    });
  }
  return apiOk({ reported: true, report_id: reportId || null });
}
