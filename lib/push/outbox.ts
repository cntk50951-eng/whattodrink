/** D.12 AOS-only durable dispatch. Every source/privacy read fails closed on database errors. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { configuredPushDevices, isDeadPushReason, nativePushConfigFromEnv, sendNativePush } from "./native";
import { computeBadge } from "./badge";
import { pushPrefsOf } from "./prefs";
import { eventPayload, retryAt, unreadMessage } from "./outboxPolicy";

type Row = Record<string, unknown>;
export type OutboxEvent = {id:string;recipient_id:string;kind:string;source_type:"notification"|"message"|"invite";source_id:string;actor_id:string|null;payload:Row;expires_at:string;attempts:number;lease_token:string};
async function rows(query: PromiseLike<{data:unknown;error:unknown}>): Promise<Row[]> {
 const result=await query;if(result.error) throw new Error("database-read-failed");
 if(result.data===null)return [];if(!Array.isArray(result.data))throw new Error("invalid-database-shape");
 return result.data.filter((r):r is Row=>typeof r==="object"&&r!==null&&!Array.isArray(r));
}
async function one(query:PromiseLike<{data:unknown;error:unknown}>):Promise<Row|null>{return(await rows(query))[0]??null;}
async function write(query:PromiseLike<{error:unknown}>):Promise<void>{if((await query).error)throw new Error("database-write-failed");}
const future=(v:unknown,now:number):boolean=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&Date.parse(v)>now;
const pair=(a:string,b:string):string=>`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`;
async function blocked(db:SupabaseClient,a:string,b:string,chat=false):Promise<boolean>{
 if((await rows(db.from("cheers_blocks").select("blocker_id").or(pair(a,b)).limit(1))).length)return true;
 return chat&&(await rows(db.from("chat_mutes").select("blocker_id").or(pair(a,b)).limit(1))).length>0;
}
async function isFriend(db:SupabaseClient,a:string,b:string):Promise<boolean>{
 return (await rows(db.from("friendships").select("id").eq("status","accepted").or(`and(user_id.eq.${a},friend_id.eq.${b}),and(user_id.eq.${b},friend_id.eq.${a})`).limit(1))).length>0;
}
/** Returns false for an obsolete event; throws for uncertain state, preserving a retry. */
export async function eventStillEligible(db:SupabaseClient,e:OutboxEvent,now:number):Promise<boolean>{
 if(!future(e.expires_at,now))return false;
 const recipient=await one(db.from("users").select("id,mode,push_prefs").eq("id",e.recipient_id).limit(1));
 if(!recipient)return false;
 const prefs=pushPrefsOf(recipient.push_prefs);
 if(e.actor_id&&await blocked(db,e.actor_id,e.recipient_id,e.source_type==="message"))return false;
 if(e.source_type==="message"){
  const msg=await one(db.from("messages").select("id,conversation_id,sender_id,created_at").eq("id",e.source_id).limit(1));
  if(!msg||msg.sender_id!==e.actor_id||msg.conversation_id!==e.payload.conversation_id||recipient.mode==="stealth")return false;
  const actor=await one(db.from("users").select("id,mode").eq("id",e.actor_id).limit(1));
  if(!actor||actor.mode==="stealth")return false;
  const [cm,sender,conv]=await Promise.all([
   one(db.from("conversation_members").select("user_id,muted,last_read_at").eq("conversation_id",msg.conversation_id).eq("user_id",e.recipient_id).limit(1)),
   one(db.from("conversation_members").select("user_id").eq("conversation_id",msg.conversation_id).eq("user_id",e.actor_id).limit(1)),
   one(db.from("conversations").select("expires_at").eq("id",msg.conversation_id).limit(1)),
  ]);
  if(!sender||!conv||!future(conv.expires_at,now)||!unreadMessage(cm,msg,now))return false;
  return (await isFriend(db,e.actor_id as string,e.recipient_id))?prefs.chat:prefs.stranger_chat;
 }
 if(e.source_type==="invite"){
  const inv=await one(db.from("drink_invites").select("id,from_user_id,to_user_id,status,expires_at").eq("id",e.source_id).limit(1));
  if(!inv||!future(inv.expires_at,now)||recipient.mode==="stealth")return false;
  const actor=await one(db.from("users").select("id,mode").eq("id",e.actor_id).limit(1));if(!actor||actor.mode==="stealth")return false;
  if(e.kind==="invite_reply")return prefs.invite_replies&&inv.from_user_id===e.recipient_id&&inv.to_user_id===e.actor_id&&inv.status===e.payload.decision;
  if(inv.to_user_id!==e.recipient_id||inv.from_user_id!==e.actor_id||inv.status!=="sent")return false;
  return(await isFriend(db,e.actor_id as string,e.recipient_id))?prefs.invites:prefs.stranger_invites;
 }
 const notice=await one(db.from("notifications").select("id,user_id,kind,read_at,payload,party_id,actor_id").eq("id",e.source_id).limit(1));
 if(!notice||notice.user_id!==e.recipient_id||notice.kind!==e.kind||notice.read_at!==null)return false;
 if(e.kind.startsWith("game_")){
  if(!prefs.game_invites||typeof e.payload.room_id!=="string")return false;
  const room=await one(db.from("game_rooms").select("id,host_id,status,expires_at").eq("id",e.payload.room_id).limit(1));
  if(!room||!future(room.expires_at,now))return false;
  if(e.kind==="game_join_request"){
   if(room.host_id!==e.recipient_id||room.status!=="lobby")return false;
   const req=await one(db.from("game_join_requests").select("status,created_at").eq("room_id",room.id).eq("user_id",e.actor_id).limit(1));
   return req?.status==="pending"&&typeof req.created_at==="string"&&Date.parse(req.created_at)>now-300_000;
  }
  if(e.kind==="game_join_result"){
   const req=await one(db.from("game_join_requests").select("status").eq("room_id",room.id).eq("user_id",e.recipient_id).limit(1));
   return req?.status===e.payload.decision&&["approved","rejected"].includes(String(e.payload.decision));
  }
  const player=await one(db.from("game_room_players").select("status").eq("room_id",room.id).eq("user_id",e.recipient_id).limit(1));
  return player?.status==="kicked"||player?.status==="left";
 }
 if(!prefs.party)return false;
 if(e.kind.startsWith("complaint_")){
  if(typeof e.payload.complaint_id!=="string")return false;
  const c=await one(db.from("complaints").select("id,filer_id,target_id,status,response_due_at,responded_at").eq("id",e.payload.complaint_id).limit(1));
  if(!c||![c.filer_id,c.target_id].includes(e.recipient_id))return false;
  if(e.kind==="complaint_response_needed")return c.target_id===e.recipient_id&&c.status==="awaiting_response"&&c.responded_at===null&&future(c.response_due_at,now);
  if(e.kind==="complaint_ack")return c.filer_id===e.recipient_id;
  if(e.kind==="complaint_filed")return c.target_id===e.recipient_id;
  return ["upheld","dismissed","malicious"].includes(String(c.status));
 }
 if(e.kind==="trust_changed")return true;
 if(typeof e.payload.party_id!=="string")return false;
 const p=await one(db.from("parties").select("id,host_user_id,status,start_at,expires_at").eq("id",e.payload.party_id).limit(1));if(!p)return false;
 const member=await one(db.from("joins").select("user_id").eq("party_id",p.id).eq("user_id",e.recipient_id).limit(1));
 if(e.kind==="party_cancelled")return p.status==="cancelled"&&(p.host_user_id===e.recipient_id||member!==null);
 if(p.status!=="open")return false;
 if(e.kind==="reminder_1h")return future(p.start_at,now)&&(p.host_user_id===e.recipient_id||member!==null);
 if(e.kind==="attendance_confirm")return !future(p.expires_at,now)&&typeof p.expires_at==="string"&&Date.parse(p.expires_at)+86_400_000>now&&(p.host_user_id===e.recipient_id||member!==null);
 if(p.host_user_id!==e.recipient_id||!future(p.start_at,now)||!e.actor_id)return false;
 const actorMember=await one(db.from("joins").select("user_id").eq("party_id",p.id).eq("user_id",e.actor_id).limit(1));
 return e.kind==="member_joined"?actorMember!==null:actorMember===null;
}

export async function dispatchNativePush(db:SupabaseClient):Promise<{claimed:number;sent:number;skipped:number;retry:number;failed:number}>{
 const cfg=nativePushConfigFromEnv(process.env);if(!cfg.fcm)throw new Error("fcm-not-configured");
 const scheduled=await db.rpc("produce_native_push_reminders");if(scheduled.error)throw new Error("reminder-producer-failed");
 const claimed=await db.rpc("claim_native_push",{p_limit:16});if(claimed.error||!Array.isArray(claimed.data))throw new Error("claim-failed");
 const deadline=Date.now()+45_000;
 const events=claimed.data as OutboxEvent[];const summary={claimed:events.length,sent:0,skipped:0,retry:0,failed:0};
 const finish=async(e:OutboxEvent,status:string,error:string|null=null):Promise<void>=>{
  await write(db.from("native_push_outbox").update({status,last_error:error,lease_until:null,lease_token:null,
   ...(status==="pending"?{available_at:retryAt(e.attempts,Date.now())}:{finished_at:new Date().toISOString()})}).eq("id",e.id).eq("lease_token",e.lease_token));
 };
 const processEvent=async(e:OutboxEvent):Promise<void>=>{
  try{
   if(Date.now()>=deadline)throw new Error("dispatch-budget");
   if(!await eventStillEligible(db,e,Date.now())){await finish(e,"skipped");summary.skipped++;return;}
   const devices=configuredPushDevices(await rows(db.from("devices").select("id,platform,push_token,environment,locale").eq("user_id",e.recipient_id).eq("platform","aos").eq("enabled",true).limit(10)),cfg);
   if(!devices.length){await finish(e,"skipped","no-aos-devices");summary.skipped++;return;}
   const badge=(await computeBadge(db,e.recipient_id)).badge;
   const done=await rows(db.from("native_push_deliveries").select("device_id").eq("event_id",e.id));const doneIds=new Set(done.map(r=>r.device_id));
   let retry=false;let successes=0;
   for(const device of devices){
    if(doneIds.has(device.id))continue;
    if(Date.now()>=deadline){retry=true;break;}
    // Re-read owner/enabled/token immediately before transport to narrow logout/rebind races.
    const current=await one(db.from("devices").select("id,user_id,enabled,push_token").eq("id",device.id).limit(1));
    if(!current||current.user_id!==e.recipient_id||current.enabled!==true||current.push_token!==device.push_token)continue;
    if(!await eventStillEligible(db,e,Date.now()))continue;
    const payload=eventPayload(e,device.locale);
    (payload.aps as Row).badge=badge;
    let timeout: ReturnType<typeof setTimeout>|undefined;
    const result=await Promise.race([sendNativePush({cfg,platform:"aos",env:"production",deviceToken:device.push_token,collapseId:`${e.kind}-${e.payload.conversation_id??e.payload.party_id??e.payload.room_id??e.recipient_id}`,payload}),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error("provider-timeout")),5000);})]).finally(()=>{if(timeout)clearTimeout(timeout);});
    if(result.ok){await write(db.from("native_push_deliveries").upsert({event_id:e.id,device_id:device.id,status:"sent"},{onConflict:"event_id,device_id"}));successes++;}
    else if(isDeadPushReason(result.reason)){
     await write(db.from("native_push_deliveries").upsert({event_id:e.id,device_id:device.id,status:"dead"},{onConflict:"event_id,device_id"}));
     await write(db.from("devices").update({enabled:false}).eq("id",device.id).eq("user_id",e.recipient_id).eq("push_token",device.push_token));
    }else retry=true;
   }
   if(retry){await finish(e,e.attempts>=8?"dead":"pending","transport-failed");summary.retry++;}
   else{await finish(e,"sent");summary.sent+=successes;}
  }catch{
   summary.failed++;
   // Sanitized code only. If persisting retry fails, the lease expires and another run can reclaim.
   await finish(e,e.attempts>=8?"dead":"pending","dispatch-failed");
  }
 };
 // Four event workers, bounded claim (16) and device fanout (10), isolate a failed worker.
 for(let i=0;i<events.length;i+=4)await Promise.allSettled(events.slice(i,i+4).map(processEvent));
 return summary;
}
