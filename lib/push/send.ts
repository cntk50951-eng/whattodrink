/**
 * UR D.9 发送编排（E1 碰杯 P1；E2/E3 下一单沿此形加）。
 * 三刀＋合并＋限频＋badge＋失效清理＋日志（无 token 无正文）。
 * 缺 APNs key 即静默跳过＋warn（用户 Apple 后台并行办，不 block 落地）。
 */

import { apnsConfigFromEnv, sendApn, type ApnsEnv } from "./apns";
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

type PushDevice = {
  id: string;
  push_token: string;
  environment: string;
  locale: string | null;
};

const DEAD_REASONS = new Set(["Unregistered", "BadDeviceToken", "DeviceTokenNotForTopic"]);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

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
    const cfg = apnsConfigFromEnv(process.env as Record<string, string | undefined>);
    if (cfg === null) {
      console.warn("[push] E1 skipped: missing APNs env");
      return { sent: 0, skipped: "no-creds" };
    }
    const supa = await createServiceClient();
    const nowMs = Date.now();
    // 三刀 1：收件人 enabled ios 设备。
    const { data: devices } = await supa
      .from("devices")
      .select("id,push_token,environment,locale")
      .eq("user_id", toUserId)
      .eq("platform", "ios")
      .eq("enabled", true)
      .limit(10);
    const devs = (((devices ?? []) as unknown[]) as Record<string, unknown>[]).filter(
      (d): d is unknown & { id: string; push_token: string } =>
        typeof d.id === "string" && typeof d.push_token === "string" && d.push_token !== "",
    ) as PushDevice[];
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
    let sent = 0;
    for (const d of devs) {
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
      let res = await sendApn({
        cfg,
        env,
        deviceToken: d.push_token,
        collapseId: cheersCollapseId(toUserId),
        payload,
      });
      // 429／5xx／网络超时重 2 次（指数 1s／2s）。
      let tries = 0;
      while (!res.ok && (res.status === 429 || res.status >= 500 || res.status === 0) && tries < 2) {
        tries += 1;
        await sleep(tries * 1000);
        res = await sendApn({
          cfg,
          env,
          deviceToken: d.push_token,
          collapseId: cheersCollapseId(toUserId),
          payload,
        });
      }
      if (!res.ok && DEAD_REASONS.has(res.reason)) {
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
