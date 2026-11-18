/**
 * UR D.9 发送编排（E1 碰杯 P1；E2/E3 下一单沿此形加）。
 * 三刀＋合并＋限频＋badge＋失效清理＋日志（无 token 无正文）。
 * 缺 APNs key 即静默跳过＋warn（用户 Apple 后台并行办，不 block 落地）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApnsEnv } from "./apns";
import { configuredPushDevices, hasPushChannel, isDeadPushReason, nativePushConfigFromEnv, sendNativePush } from "./native";
import { computeBadge } from "./badge";
import { cheersCollapseId, cheersMergedTitle, fillPushTemplate, pushPrefsOf } from "./prefs";
import { createServiceClient } from "@/lib/supabase/server";
import zhHant from "@/messages/zh-Hant.json";
import zhHans from "@/messages/zh-Hans.json";
import en from "@/messages/en.json";

const COPY: Record<string, Record<string, string>> = {
  "zh-Hant": zhHant.v2 as Record<string, string>,
  "zh-Hans": zhHans.v2 as Record<string, string>,
  en: en.v2 as Record<string, string>,
};

function copyFor(locale: string): Record<string, string> {
  return COPY[locale] ?? COPY["zh-Hant"];
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Android account/expiry guard; iOS keeps its original payload byte-for-byte shape. */
async function aosEventMeta(db: SupabaseClient, table: string, filters: Record<string,string>, recipientId: string, kind: string): Promise<Record<string,string>|null> {
 const receiver=await db.from("users").select("id,push_prefs").eq("id",recipientId).maybeSingle();
 if(receiver.error||!receiver.data)return null;
 const preferences=pushPrefsOf(receiver.data.push_prefs);
 if(!(kind==="cheers"?preferences.cheers:kind==="game_invite"?preferences.game_invites:preferences.friends))return null;
 const actor=filters.from_user_id??(kind==="friend_request"?filters.user_id:filters.friend_id);
 if(!actor)return null;
 const block=await db.from("cheers_blocks").select("blocker_id").or(`and(blocker_id.eq.${actor},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${actor})`).limit(1);
 if(block.error||!Array.isArray(block.data)||block.data.length)return null;
 let query=db.from(table).select("id,created_at");
 for(const [key,value] of Object.entries(filters))query=query.eq(key,value);
 const {data,error}=await query.order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(error||!data||typeof data.id!=="string")return null;
 let expiresAt=Date.now()+86_400_000;
 if(table==="game_invites"){
  const room=await db.from("game_rooms").select("expires_at,status").eq("id",filters.room_id).maybeSingle();
  if(room.error||!room.data||room.data.status!=="lobby")return null;
  const roomExpiry=Date.parse(String(room.data.expires_at));if(!Number.isFinite(roomExpiry)||roomExpiry<=Date.now())return null;expiresAt=Math.min(expiresAt,roomExpiry);
 }
 const created=kind==="friend_accepted"?Date.now():Date.parse(String(data.created_at));
 if(!Number.isFinite(created)||created+86_400_000<=Date.now())return null;
 return {recipient_id:recipientId,event_id:kind.startsWith("friend_")?`${kind}:${data.id}:${Date.parse(String(data.created_at))}`:`${kind}:${data.id}`,expires_at:String(Math.min(expiresAt,created+86_400_000))};
}

async function aosDeviceIsCurrent(db: SupabaseClient, id: string, token: string, recipient: string): Promise<boolean> {
 const {data,error}=await db.from("devices").select("id").eq("id",id).eq("platform","aos").eq("user_id",recipient).eq("enabled",true).eq("push_token",token).maybeSingle();
 return !error&&data!==null;
}

/**
 * E1 碰杯推送（cheers POST 成功后 after() 调；throw 永不外泄，调用方 fire-and-forget）。
 * 返回 sent／skipped 原因（日志用，不影响主流程）。
 */
export async function sendCheersPush(args: {
  fromUserId: string;
  toUserId: string;
  checkinId: string;
}): Promise<{ sent: number; skipped?: string }> {
  const { fromUserId, toUserId, checkinId } = args;
  try {
    const cfg = nativePushConfigFromEnv(process.env as Record<string, string | undefined>);
    if (!hasPushChannel(cfg)) {
      console.warn("[push] E1 skipped: missing APNs/FCM config");
      return { sent: 0, skipped: "no-creds" };
    }
    const supa = await createServiceClient();
    const nowMs = Date.now();
    // 三刀 1：收件人 enabled native 设备（按独立凭证过滤通道）。
    const { data: devices } = await supa
      .from("devices")
      .select("id,platform,push_token,environment,locale")
      .eq("user_id", toUserId)
      .in("platform", ["ios", "aos"])
      .eq("enabled", true)
      .limit(10);
    const devs = configuredPushDevices(devices, cfg);
    if (devs.length === 0) return { sent: 0, skipped: "no-devices" };
    // 三刀 2：prefs 开关。
    const { data: peerRow } = await supa
      .from("users")
      .select("push_prefs")
      .eq("id", toUserId)
      .maybeSingle();
    const prefs = pushPrefsOf((peerRow as { push_prefs?: unknown } | null)?.push_prefs);
    if (!prefs.cheers) return { sent: 0, skipped: "prefs-off" };
    // 三刀 3：屏蔽任一方向。
    const { data: blocks } = await supa
      .from("cheers_blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${fromUserId},blocked_id.eq.${toUserId}),and(blocker_id.eq.${toUserId},blocked_id.eq.${fromUserId})`)
      .limit(1);
    if (Array.isArray(blocks) && blocks.length > 0) return { sent: 0, skipped: "blocked" };
    // 限频：小时 20＋同对 10min。
    const hourAgo = new Date(nowMs - 3600_000).toISOString();
    const { count: hourCount } = await supa
      .from("push_log")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", toUserId)
      .gte("created_at", hourAgo);
    if ((hourCount ?? 0) >= 20) return { sent: 0, skipped: "hourly-cap" };
    const dedupe = `${fromUserId}:${toUserId}:cheers`;
    const tenAgo = new Date(nowMs - 10 * 60_000).toISOString();
    const { data: recentPair } = await supa
      .from("push_log")
      .select("id")
      .eq("recipient_id", toUserId)
      .eq("dedupe_key", dedupe)
      .gte("created_at", tenAgo)
      .limit(1);
    if (Array.isArray(recentPair) && recentPair.length > 0) {
      return { sent: 0, skipped: "pair-dedupe" };
    }
    // 60s 合并计数＋badge。
    const minAgo = new Date(nowMs - 60_000).toISOString();
    const { count: minCount } = await supa
      .from("push_log")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", toUserId)
      .eq("kind", "cheers")
      .gte("created_at", minAgo);
    const badge = await computeBadge(supa, toUserId);
    // 文案（发起人昵称＋酒款名，取不到省略 body 行）。
    const { data: fromRow } = await supa
      .from("users")
      .select("nickname")
      .eq("id", fromUserId)
      .maybeSingle();
    const fromNick = (fromRow as { nickname?: unknown } | null)?.nickname;
    const fromName = typeof fromNick === "string" && fromNick !== "" ? fromNick : "酒友";
    const { data: postRow } = await supa
      .from("checkins")
      .select("beer_id")
      .eq("id", checkinId)
      .maybeSingle();
    let beerName = "";
    const beerId = (postRow as { beer_id?: unknown } | null)?.beer_id;
    if (typeof beerId === "string" && beerId !== "") {
      const { data: beerRow } = await supa.from("beers").select("name").eq("id", beerId).maybeSingle();
      if (typeof (beerRow as { name?: unknown } | null)?.name === "string") {
        beerName = (beerRow as { name: string }).name;
      }
    }
    const aosMeta=devs.some(d=>d.platform==="aos")?await aosEventMeta(supa,"cheers",{from_user_id:fromUserId,to_user_id:toUserId,checkin_id:checkinId},toUserId,"cheers"):null;
    let sent = 0;
    for (const d of devs) {
      if(d.platform==="aos"&&(!aosMeta||!await aosDeviceIsCurrent(supa,d.id,d.push_token,toUserId)))continue;
      const t = (k: string): string => copyFor(typeof d.locale === "string" ? d.locale : "zh-Hant")[k] ?? copyFor("zh-Hant")[k] ?? k;
      const title =
        (minCount ?? 0) > 0
          ? cheersMergedTitle(minCount ?? 0, t)
          : fillPushTemplate(t("pushCheersTitle"), { name: fromName });
      const alert: Record<string, string> = { title };
      if (beerName !== "") {
        alert.body = fillPushTemplate(t("pushCheersBody"), { beer: beerName });
      }
      const payload = {
        ...(d.platform === "aos" ? aosMeta : {}),
        aps: {
          alert,
          badge: badge.badge,
          sound: "default",
          "thread-id": "cheers",
          "mutable-content": 0,
        },
        t: "cheers",
        from: fromUserId,
        checkin_id: checkinId,
      };
      const env: ApnsEnv = d.environment === "sandbox" ? "sandbox" : "production";
      let res = await sendNativePush({ cfg, platform: d.platform, env,
        deviceToken: d.push_token,
        collapseId: cheersCollapseId(toUserId),
        payload,
      });
      // 429／5xx／网络超时重 2 次（指数 1s／2s）。
      let tries = 0;
      while (!res.ok && (res.status === 429 || res.status >= 500 || res.status === 0) && tries < 2) {
        tries += 1;
        await sleep(tries * 1000);
        res = await sendNativePush({ cfg, platform: d.platform, env,
          deviceToken: d.push_token,
          collapseId: cheersCollapseId(toUserId),
          payload,
        });
      }
      if (!res.ok && isDeadPushReason(res.reason)) {
        await supa.from("devices").delete().eq("id", d.id);
        await supa.from("push_log").insert({
          recipient_id: toUserId,
          kind: "cheers",
          dedupe_key: dedupe,
          status: "dead",
        });
        continue;
      }
      await supa.from("push_log").insert({
        recipient_id: toUserId,
        kind: "cheers",
        dedupe_key: dedupe,
        status: res.ok ? "sent" : "failed",
      });
      if (res.ok) sent += 1;
      else console.warn(`[push] E1 failed: status=${res.status} reason=${res.reason}`);
    }
    return { sent };
  } catch (e) {
    console.warn(`[push] E1 threw: ${e instanceof Error ? e.message : "unknown"}`);
    return { sent: 0, skipped: "threw" };
  }
}

/**
 * UR B.3 好友推送（`friend_request` 新请求／`friend_accepted` 被接受；prefs `friends` 门）。
 * 沿 E1 同形（badge＋collapse＋410 删行＋重试＋日志）；无合并（请求低频）。
 */export async function sendFriendPush(
  kind: "request" | "accepted",
  args: { fromUserId: string; toUserId: string; aosOnly?: boolean },
): Promise<{ sent: number; skipped?: string }> {
  const { fromUserId, toUserId } = args;
  try {
    const cfg = nativePushConfigFromEnv(process.env as Record<string, string | undefined>);
    if (!hasPushChannel(cfg)) {
      console.warn(`[push] friend ${kind} skipped: missing APNs/FCM config`);
      return { sent: 0, skipped: "no-creds" };
    }
    const supa = await createServiceClient();
    const { data: devices } = await supa
      .from("devices")
      .select("id,platform,push_token,environment,locale")
      .eq("user_id", toUserId)
      .in("platform", ["ios", "aos"])
      .eq("enabled", true)
      .limit(10);
    const devs = configuredPushDevices(devices, cfg).filter(d => !args.aosOnly || d.platform === "aos");
    if (devs.length === 0) return { sent: 0, skipped: "no-devices" };
    const { data: peerRow } = await supa
      .from("users")
      .select("push_prefs")
      .eq("id", toUserId)
      .maybeSingle();
    const prefs = pushPrefsOf((peerRow as { push_prefs?: unknown } | null)?.push_prefs);
    if (!prefs.friends) return { sent: 0, skipped: "prefs-off" };
    const badge = await computeBadge(supa, toUserId);
    const { data: fromRow } = await supa
      .from("users")
      .select("nickname")
      .eq("id", fromUserId)
      .maybeSingle();
    const nick = (fromRow as { nickname?: unknown } | null)?.nickname;
    const fromName = typeof nick === "string" && nick !== "" ? nick : "酒友";
    const aosMeta=devs.some(d=>d.platform==="aos")?await aosEventMeta(supa,"friendships",kind==="request"?{user_id:fromUserId,friend_id:toUserId,status:"pending"}:{user_id:toUserId,friend_id:fromUserId,status:"accepted"},toUserId,kind==="request"?"friend_request":"friend_accepted"):null;
    let sent = 0;
    for (const d of devs) {
      if(d.platform==="aos"&&(!aosMeta||!await aosDeviceIsCurrent(supa,d.id,d.push_token,toUserId)))continue;
      const t = (k: string): string => copyFor(typeof d.locale === "string" ? d.locale : "zh-Hant")[k] ?? copyFor("zh-Hant")[k] ?? k;
      const titleKey = kind === "request" ? "pushFriendRequestTitle" : "pushFriendAcceptedTitle";
      const payload = {
        ...(d.platform === "aos" ? aosMeta : {}),
        aps: {
          alert: { title: fillPushTemplate(t(titleKey), { name: fromName }) },
          badge: badge.badge,
          sound: "default",
          "thread-id": "friend",
          "mutable-content": 0,
        },
        t: kind === "request" ? "friend_request" : "friend_accepted",
        from: fromUserId,
      };
      const env: ApnsEnv = d.environment === "sandbox" ? "sandbox" : "production";
      const collapse = `friend-${kind}-${toUserId}`;
      let res = await sendNativePush({ cfg, platform: d.platform, env, deviceToken: d.push_token, collapseId: collapse, payload });
      let tries = 0;
      while (!res.ok && (res.status === 429 || res.status >= 500 || res.status === 0) && tries < 2) {
        tries += 1;
        await sleep(tries * 1000);
        res = await sendNativePush({ cfg, platform: d.platform, env, deviceToken: d.push_token, collapseId: collapse, payload });
      }
      if (!res.ok && isDeadPushReason(res.reason)) {
        await supa.from("devices").delete().eq("id", d.id);
        await supa.from("push_log").insert({
          recipient_id: toUserId,
          kind: kind === "request" ? "friend_request" : "friend_accepted",
          dedupe_key: `${fromUserId}:${toUserId}:${kind}`,
          status: "dead",
        });
        continue;
      }
      await supa.from("push_log").insert({
        recipient_id: toUserId,
        kind: kind === "request" ? "friend_request" : "friend_accepted",
        dedupe_key: `${fromUserId}:${toUserId}:${kind}`,
        status: res.ok ? "sent" : "failed",
      });
      if (res.ok) sent += 1;
      else console.warn(`[push] friend ${kind} failed: status=${res.status} reason=${res.reason}`);
    }
    return { sent };
  } catch (e) {
    console.warn(`[push] friend ${kind} threw: ${e instanceof Error ? e.message : "unknown"}`);
    return { sent: 0, skipped: "threw" };
  }
}

/**
 * UR H.1 游戏邀请推送（`game_invite`；prefs `game_invites` 门，默认开）。
 * 沿 friend 同形；badge 用 computeBadge（游戏邀请不计 badge，只展示）。
 * 点开 iOS 进房间（payload 带 room_id＋code）。
 */
export async function sendGameInvitePush(args: {
  fromUserId: string;
  toUserId: string;
  roomId: string;
  code: string;
}): Promise<{ sent: number; skipped?: string }> {
  const { fromUserId, toUserId, roomId, code } = args;
  try {
    const cfg = nativePushConfigFromEnv(process.env as Record<string, string | undefined>);
    if (!hasPushChannel(cfg)) {
      console.warn("[push] game_invite skipped: missing APNs/FCM config");
      return { sent: 0, skipped: "no-creds" };
    }
    const supa = await createServiceClient();
    const { data: devices } = await supa
      .from("devices")
      .select("id,platform,push_token,environment,locale")
      .eq("user_id", toUserId)
      .in("platform", ["ios", "aos"])
      .eq("enabled", true)
      .limit(10);
    const devs = configuredPushDevices(devices, cfg);
    if (devs.length === 0) return { sent: 0, skipped: "no-devices" };
    const { data: peerRow } = await supa
      .from("users")
      .select("push_prefs")
      .eq("id", toUserId)
      .maybeSingle();
    const prefs = pushPrefsOf((peerRow as { push_prefs?: unknown } | null)?.push_prefs);
    if (!prefs.game_invites) return { sent: 0, skipped: "prefs-off" };
    const badge = await computeBadge(supa, toUserId);
    const { data: fromRow } = await supa
      .from("users")
      .select("nickname")
      .eq("id", fromUserId)
      .maybeSingle();
    const nick = (fromRow as { nickname?: unknown } | null)?.nickname;
    const fromName = typeof nick === "string" && nick !== "" ? nick : "酒友";
    const aosMeta=devs.some(d=>d.platform==="aos")?await aosEventMeta(supa,"game_invites",{room_id:roomId,from_user_id:fromUserId,to_user_id:toUserId,status:"pending"},toUserId,"game_invite"):null;
    let sent = 0;
    for (const d of devs) {
      if(d.platform==="aos"&&(!aosMeta||!await aosDeviceIsCurrent(supa,d.id,d.push_token,toUserId)))continue;
      const t = (k: string): string => copyFor(typeof d.locale === "string" ? d.locale : "zh-Hant")[k] ?? copyFor("zh-Hant")[k] ?? k;
      const payload = {
        ...(d.platform === "aos" ? aosMeta : {}),
        aps: {
          alert: { title: fillPushTemplate(t("pushGameInviteTitle"), { name: fromName }) },
          badge: badge.badge,
          sound: "default",
          "thread-id": "game",
          "mutable-content": 0,
        },
        t: "game_invite",
        from: fromUserId,
        room_id: roomId,
        code,
      };
      const env: ApnsEnv = d.environment === "sandbox" ? "sandbox" : "production";
      const collapse = `game-invite-${toUserId}`;
      let res = await sendNativePush({ cfg, platform: d.platform, env, deviceToken: d.push_token, collapseId: collapse, payload });
      let tries = 0;
      while (!res.ok && (res.status === 429 || res.status >= 500 || res.status === 0) && tries < 2) {
        tries += 1;
        await sleep(tries * 1000);
        res = await sendNativePush({ cfg, platform: d.platform, env, deviceToken: d.push_token, collapseId: collapse, payload });
      }
      if (!res.ok && isDeadPushReason(res.reason)) {
        await supa.from("devices").delete().eq("id", d.id);
        await supa.from("push_log").insert({
          recipient_id: toUserId,
          kind: "game_invite",
          dedupe_key: `${fromUserId}:${toUserId}:${roomId}`,
          status: "dead",
        });
        continue;
      }
      await supa.from("push_log").insert({
        recipient_id: toUserId,
        kind: "game_invite",
        dedupe_key: `${fromUserId}:${toUserId}:${roomId}`,
        status: res.ok ? "sent" : "failed",
      });
      if (res.ok) sent += 1;
      else console.warn(`[push] game_invite failed: status=${res.status} reason=${res.reason}`);
    }
    return { sent };
  } catch (e) {
    console.warn(`[push] game_invite threw: ${e instanceof Error ? e.message : "unknown"}`);
    return { sent: 0, skipped: "threw" };
  }
}
