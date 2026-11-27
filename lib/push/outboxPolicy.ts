/** D.12 pure policy. Lock-screen copy never accepts message text or complaint evidence. */
import { timingSafeEqual } from "node:crypto";
import { NICKNAME_MAX } from "../api/profile";
import { PUSH_NAME_WIDTH, pushName } from "./prefs";

export const NOTICE_KINDS = ["member_joined","party_cancelled","member_left","member_left_late","reminder_1h","attendance_confirm","complaint_filed","complaint_response_needed","complaint_ack","complaint_result","trust_changed","game_join_request","game_join_result","game_kicked"] as const;
/** Isolate push credentials from Vercel Cron. Explicit empty/weak values fail closed. */
export function pushDispatchSecret(env: Record<string, string | undefined>): string | undefined {
  return env.PUSH_DISPATCH_SECRET ?? env.CRON_SECRET;
}

export function isDispatchAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !authorization) return false;
  const actual = Buffer.from(authorization); const expected = Buffer.from("Bearer " + secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function retryAt(attempt: number, now: number): string {
  return new Date(now + Math.min(3600_000, 30_000 * 2 ** Math.min(7, Math.max(0, attempt - 1)))).toISOString();
}
export function unreadMessage(member: Record<string, unknown> | null, message: Record<string, unknown>, now: number): boolean {
  const created = typeof message.created_at === "string" ? Date.parse(message.created_at) : NaN;
  const read = typeof member?.last_read_at === "string" ? Date.parse(member.last_read_at) : NaN;
  return member !== null && member.muted === false && Number.isFinite(created) && Number.isFinite(read) && created > read && created <= now;
}
const TITLE: Record<string, [string,string,string]> = {
 chat:["你有新訊息","你有新消息","You have a new message"], invite:["你有新的約酒邀請","你有新的约酒邀请","You have a drink invitation"],
 invite_reply:["約酒邀請有新回應","约酒邀请有新回应","Your invitation has a response"],
 member_joined:["有人加入你的酒局","有人加入你的酒局","Someone joined your gathering"],
 party_cancelled:["你參加的酒局已取消","你参加的酒局已取消","Your gathering was cancelled"],
 member_left:["有人退出你的酒局","有人退出你的酒局","Someone left your gathering"],
 member_left_late:["開局前有成員退出","开局前有成员退出","A member left before your gathering"],
 reminder_1h:["酒局快開始了","酒局快开始了","Your gathering starts soon"],
 attendance_confirm:["請確認酒局出席情況","请确认酒局出席情况","Confirm gathering attendance"],
 complaint_filed:["你有新的案件通知","你有新的案件通知","You have a case update"],
 complaint_response_needed:["有案件需要你回應","有案件需要你回应","A case needs your response"],
 complaint_ack:["你的投訴已收到","你的投诉已收到","Your complaint was received"],
 complaint_result:["案件處理結果已更新","案件处理结果已更新","Your case result is available"],
 trust_changed:["你的誠信資料已更新","你的诚信资料已更新","Your trust information was updated"],
 game_join_request:["有人申請加入遊戲","有人申请加入游戏","Someone requested to join your game"],
 game_join_result:["遊戲入座申請有結果","游戏入座申请有结果","Your game request has a result"],
 game_kicked:["你的遊戲房間狀態已更新","你的游戏房间状态已更新","Your game room status changed"],
};
export function safePushCopy(kind: string, locale: string | null): {title: string;body: string} {
 const index = locale === "en" ? 2 : locale === "zh-Hans" ? 1 : 0;
 return {title:(TITLE[kind] ?? ["你有新通知","你有新通知","You have a new notification"])[index],
 body:["打開 hi drink 查看詳情","打开 hi drink 查看详情","Open hi drink for details"][index]};
}
/** Display names only. Never message text, evidence or free text beyond a nickname. */
export type CopyContext = { actor?: string; host?: string };
export function cleanName(v: unknown): string|undefined {
 if (typeof v!=="string") return undefined;
 // 按字符截到暱稱上限（不切開 emoji）：舊帳號暱稱可能比現在的上限長
 const s=Array.from(v.replace(/[\u0000-\u001f\u007f\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,"").trim()).slice(0,NICKNAME_MAX).join("").trim();
 // 鎖屏一行放不下長暱稱：顯示寬度超過 16 就縮寫成「前段…」（iOS DEF-20261126-023）
 return s===""?undefined:pushName(s,PUSH_NAME_WIDTH);
}
type L3 = [string,string,string];
const pick=(l:L3,locale:string|null):string=>l[locale==="en"?2:locale==="zh-Hans"?1:0];
const PARTY_TITLE:L3=["酒局通知","酒局通知","Gathering"];
const PARTY_STATE: Record<string,L3> = {
 member_joined:["有人加入","有人加入","someone joined"],party_cancelled:["已取消","已取消","was cancelled"],
 member_left:["有人退出","有人退出","someone left"],member_left_late:["開局前有人退出","开局前有人退出","someone left before it starts"],
 reminder_1h:["即將開始","即将开始","starts soon"],attendance_confirm:["請確認出席","请确认出席","please confirm attendance"],
};
/** Type-specific lock/notification copy with a display name. Falls back to generic copy when a name is missing. */
export function richPushCopy(kind: string, locale: string|null, ctx: CopyContext, payload: Record<string,unknown>): {title:string;body:string}|null {
 const a=ctx.actor,h=ctx.host,en=locale==="en";
 if(kind==="chat"&&a) return {title:pick(["聊天訊息","聊天消息","Chat message"],locale),body:pick([`${a} 傳來新訊息`,`${a} 发来新消息`,`${a} sent you a message`],locale)};
 if(kind==="invite"&&a) return {title:pick(["約酒邀請","约酒邀请","Drink invitation"],locale),body:pick([`${a} 邀請你一起喝酒`,`${a} 邀请你一起喝酒`,`${a} invited you for a drink`],locale)};
 if(kind==="invite_reply"&&a&&(payload.decision==="accepted"||payload.decision==="declined")){
  const ok=payload.decision==="accepted";
  return {title:pick(["約酒回覆","约酒回复","Invitation reply"],locale),body:pick(ok?[`${a} 接受了你的邀請`,`${a} 接受了你的邀请`,`${a} accepted your invitation`]:[`${a} 婉拒了你的邀請`,`${a} 婉拒了你的邀请`,`${a} declined your invitation`],locale)};
 }
 const state=PARTY_STATE[kind];
 if(state&&h) return {title:pick(PARTY_TITLE,locale),body:en?`${h}'s gathering: ${pick(state,locale)}`:`${h}的酒局：${pick(state,locale)}`};
 return null;
}
export function eventPayload(event: {id:string;recipient_id:string;kind:string;actor_id:string|null;payload:Record<string,unknown>;expires_at:string}, locale: string|null, ctx: CopyContext = {}): Record<string,unknown> {
 const copy=richPushCopy(event.kind,locale,ctx,event.payload)??safePushCopy(event.kind,locale);
 const ids: Record<string,unknown>={};
 for (const key of ["conversation_id","invite_id","party_id","complaint_id","room_id","code","decision","checkin_id"]) {
  const value=event.payload[key];if(typeof value==="string") ids[key]=value;
 }
 return {aps:{alert:copy,sound:"default"},t:event.kind,recipient_id:event.recipient_id,event_id:event.id,
 expires_at:String(Date.parse(event.expires_at)),...ids,...(event.actor_id?{from_user_id:event.actor_id}:{})};
}
