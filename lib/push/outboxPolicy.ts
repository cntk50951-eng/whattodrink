/** D.12 pure policy. Lock-screen copy never accepts message text or complaint evidence. */
import { timingSafeEqual } from "node:crypto";

export const NOTICE_KINDS = ["member_joined","party_cancelled","member_left","member_left_late","reminder_1h","attendance_confirm","complaint_filed","complaint_response_needed","complaint_ack","complaint_result","trust_changed","game_join_request","game_join_result","game_kicked"] as const;
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
 complaint_ack:["你的投訴已收到","你的投诉已收到","Your report was received"],
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
export function eventPayload(event: {id:string;recipient_id:string;kind:string;actor_id:string|null;payload:Record<string,unknown>;expires_at:string}, locale: string|null): Record<string,unknown> {
 const copy=safePushCopy(event.kind,locale);
 const ids: Record<string,unknown>={};
 for (const key of ["conversation_id","invite_id","party_id","complaint_id","room_id","code","decision","checkin_id"]) {
  const value=event.payload[key];if(typeof value==="string") ids[key]=value;
 }
 return {aps:{alert:copy,sound:"default"},t:event.kind,recipient_id:event.recipient_id,event_id:event.id,
 expires_at:String(Date.parse(event.expires_at)),...ids,...(event.actor_id?{from_user_id:event.actor_id}:{})};
}
