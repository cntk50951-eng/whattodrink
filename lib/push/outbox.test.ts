import {beforeEach,describe,expect,it,vi} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {eventPayload,isDispatchAuthorized,NOTICE_KINDS,retryAt,safePushCopy,unreadMessage} from "./outboxPolicy";
const transport=vi.hoisted(()=>({send:vi.fn()}));
vi.mock("./badge",()=>({computeBadge:async()=>({badge:7})}));
vi.mock("./native",()=>({
 nativePushConfigFromEnv:()=>({fcm:{projectId:"unit"},apns:null}),
 configuredPushDevices:(rows:unknown)=>rows,
 isDeadPushReason:(s:string)=>s==="messaging/registration-token-not-registered",
 sendNativePush:transport.send,
}));
import {dispatchNativePush,eventStillEligible} from "./outbox";
import type {OutboxEvent} from "./outbox";

type R=Record<string,unknown>;
function database(tables:Record<string,R[]>,failTable?:string):SupabaseClient{
 class Query implements PromiseLike<{data:unknown;error:unknown}>{
  filters:Array<[string,unknown]>=[];operation="read";value:R={};max=100;constructor(readonly table:string){}
  select(){return this;} eq(k:string,v:unknown){this.filters.push([k,v]);return this;}limit(n:number){this.max=n;return this;}
  or(){return this;} update(value:R){this.operation="update";this.value=value;return this;}
  upsert(value:R){this.operation="upsert";this.value=value;return this;}
  then<TResult1={data:unknown;error:unknown},TResult2=never>(onfulfilled?:((v:{data:unknown;error:unknown})=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((r:unknown)=>TResult2|PromiseLike<TResult2>)|null):PromiseLike<TResult1|TResult2>{
   const all=tables[this.table]??[];const matched=all.filter(r=>this.filters.every(([k,v])=>r[k]===v)).slice(0,this.max);
   if(this.operation==="update")matched.forEach(r=>Object.assign(r,this.value));
   if(this.operation==="upsert"){
    const old=all.find(r=>r.event_id===this.value.event_id&&r.device_id===this.value.device_id);
    if(old)Object.assign(old,this.value);else(tables[this.table]??=[]).push({...this.value});
   }
   return Promise.resolve({data:matched,error:this.table===failTable?{code:"db-unavailable"}:null}).then(onfulfilled,onrejected);
  }
 }
 return {from:(t:string)=>new Query(t),rpc:async(name:string)=>({data:name==="claim_native_push"?(tables.native_push_outbox??[]).filter(e=>e.status==="processing"):0,error:null})} as unknown as SupabaseClient;
}
const now=Date.parse("2026-11-17T04:00:00Z");
function event(overrides:Partial<OutboxEvent>={}):OutboxEvent{return {id:"event",recipient_id:"recipient",kind:"chat",source_type:"message",source_id:"message",actor_id:"actor",payload:{conversation_id:"conv"},expires_at:new Date(now+3600_000).toISOString(),attempts:1,lease_token:"lease",...overrides};}
function chatTables():Record<string,R[]>{return{
 users:[{id:"recipient",mode:"public",push_prefs:{stranger_chat:false}},{id:"actor",mode:"public"}],
 messages:[{id:"message",sender_id:"actor",conversation_id:"conv",created_at:new Date(now-1000).toISOString()}],
 conversation_members:[{conversation_id:"conv",user_id:"recipient",muted:false,last_read_at:new Date(now-2000).toISOString()},{conversation_id:"conv",user_id:"actor"}],
 conversations:[{id:"conv",expires_at:new Date(now+86_400_000).toISOString()}],friendships:[{id:"friend",status:"accepted"}],cheers_blocks:[],chat_mutes:[],
 };}
beforeEach(()=>{vi.restoreAllMocks();transport.send.mockReset();transport.send.mockResolvedValue({ok:true});});
describe("D.12 authorization and privacy",()=>{
 it("rejects absent, weak and incorrect dispatcher credentials",()=>{
  const secret="unit-test-secret-long";expect(isDispatchAuthorized(null,secret)).toBe(false);expect(isDispatchAuthorized("Bearer x","x")).toBe(false);
  expect(isDispatchAuthorized("Bearer wrong",secret)).toBe(false);expect(isDispatchAuthorized("Bearer "+secret,secret)).toBe(true);
 });
 it("never copies message/evidence/free-text into any core notification",()=>{
  for(const kind of ["chat","invite","invite_reply",...NOTICE_KINDS]){
   const payload=eventPayload({...event({kind}),payload:{conversation_id:"conv",detail:"private evidence",body:"private chat",note:"private case",lat:1}},"en");
   expect(JSON.stringify(payload)).not.toMatch(/private|evidence|latitude/);expect(payload).toMatchObject({event_id:"event",recipient_id:"recipient",expires_at:String(now+3600_000)});
   expect(safePushCopy(kind,"zh-Hans").title).not.toBe("");
  }
 });
 it("uses capped durable retry backoff",()=>{expect(Date.parse(retryAt(1,now))-now).toBe(30_000);expect(Date.parse(retryAt(99,now))-now).toBe(3600_000);});
 it("requires a valid read watermark older than the message",()=>{
  const message={created_at:new Date(now-1000).toISOString()};
  expect(unreadMessage({muted:false,last_read_at:new Date(now-2000).toISOString()},message,now)).toBe(true);
  for(const member of [null,{muted:true,last_read_at:new Date(now-2000).toISOString()},{muted:false,last_read_at:"bad"},{muted:false,last_read_at:new Date(now).toISOString()}])expect(unreadMessage(member,message,now)).toBe(false);
 });
});
describe("D.12 source rechecks",()=>{
 it("allows a live unread friend message",async()=>{expect(await eventStillEligible(database(chatTables()),event(),now)).toBe(true);});
 it.each(["cheers_blocks","chat_mutes"])("suppresses pair-level %s",async table=>{const t=chatTables();t[table]=[{blocker_id:"recipient",blocked_id:"actor"}];expect(await eventStillEligible(database(t),event(),now)).toBe(false);});
 it("rechecks current mute/read/expiry and sender membership",async()=>{
  for(const mutation of [(t:Record<string,R[]>)=>{t.conversation_members[0].muted=true;},(t:Record<string,R[]>)=>{t.conversation_members[0].last_read_at=new Date(now).toISOString();},(t:Record<string,R[]>)=>{t.conversation_members.pop();},(t:Record<string,R[]>)=>{t.conversations[0].expires_at=new Date(now-1).toISOString();}]){
   const t=chatTables();mutation(t);expect(await eventStillEligible(database(t),event(),now)).toBe(false);
  }
 });
 it("defaults stranger chat off and respects explicit opt-in",async()=>{
  const t=chatTables();t.friendships=[];expect(await eventStillEligible(database(t),event(),now)).toBe(false);
  t.users[0].push_prefs={stranger_chat:true};expect(await eventStillEligible(database(t),event(),now)).toBe(true);
 });
 it("never converts a failed privacy query into permission",async()=>{await expect(eventStillEligible(database(chatTables(),"cheers_blocks"),event(),now)).rejects.toThrow("database-read-failed");});
 it("drops expired events before any database access",async()=>{expect(await eventStillEligible(database({},"users"),event({expires_at:new Date(now-1).toISOString()}),now)).toBe(false);});
 it("suppresses invitation notification after recall",async()=>{
  const t=chatTables();t.drink_invites=[{id:"inv",from_user_id:"actor",to_user_id:"recipient",status:"recalled",expires_at:new Date(now+1000).toISOString()}];
  expect(await eventStillEligible(database(t),event({source_type:"invite",source_id:"inv",kind:"invite",payload:{invite_id:"inv"}}),now)).toBe(false);
 });
 it("suppresses a completed complaint response and a read notice",async()=>{
  const t=chatTables();t.notifications=[{id:"notice",kind:"complaint_response_needed",user_id:"recipient",read_at:null}];t.complaints=[{id:"case",target_id:"recipient",filer_id:"actor",status:"triaged",responded_at:new Date(now).toISOString(),response_due_at:new Date(now+1000).toISOString()}];
  const e=event({source_type:"notification",source_id:"notice",kind:"complaint_response_needed",payload:{complaint_id:"case"}});
  expect(await eventStillEligible(database(t),e,now)).toBe(false);t.notifications[0].read_at=new Date(now).toISOString();expect(await eventStillEligible(database(t),e,now)).toBe(false);
 });
});
describe("D.12 durable per-device delivery",()=>{
 it("retries only failed devices and never sends new events through APNs",async()=>{
  vi.spyOn(Date,"now").mockReturnValue(now);
  const t=chatTables();t.native_push_outbox=[{...event(),status:"processing"}];
  t.devices=[{id:"sent",platform:"aos",user_id:"recipient",enabled:true,push_token:"one",locale:"en"},{id:"retry",platform:"aos",user_id:"recipient",enabled:true,push_token:"two",locale:"en"}];
  transport.send.mockResolvedValueOnce({ok:true}).mockResolvedValueOnce({ok:false,status:503,reason:"temporary"});
  const first=await dispatchNativePush(database(t));expect(first.retry).toBe(1);expect(t.native_push_deliveries).toHaveLength(1);
  Object.assign(t.native_push_outbox[0],{status:"processing",lease_token:"new-lease",attempts:2});transport.send.mockClear();transport.send.mockResolvedValue({ok:true});
  await dispatchNativePush(database(t));expect(transport.send).toHaveBeenCalledTimes(1);expect(transport.send).toHaveBeenCalledWith(expect.objectContaining({platform:"aos",deviceToken:"two",payload:expect.objectContaining({event_id:"event",recipient_id:"recipient",aps:expect.objectContaining({badge:7})})}));
 });
 it("persists sanitized retry on a privacy database error without contacting FCM",async()=>{
  vi.spyOn(Date,"now").mockReturnValue(now);const t=chatTables();t.native_push_outbox=[{...event(),status:"processing"}];
  const result=await dispatchNativePush(database(t,"cheers_blocks"));expect(result.failed).toBe(1);expect(transport.send).not.toHaveBeenCalled();expect(t.native_push_outbox[0]).toMatchObject({status:"pending",last_error:"dispatch-failed:eligibility:database-read-failed"});
 });
});
