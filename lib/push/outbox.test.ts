import {beforeEach,describe,expect,it,vi} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {cleanName,eventPayload,isDispatchAuthorized,NOTICE_KINDS,retryAt,richPushCopy,safePushCopy,unreadMessage} from "./outboxPolicy";
const transport=vi.hoisted(()=>({send:vi.fn(),apns:null as unknown}));
vi.mock("./badge",()=>({computeBadge:async()=>({badge:7})}));
vi.mock("./native",()=>({
 nativePushConfigFromEnv:()=>({fcm:{projectId:"unit"},apns:transport.apns}),
 configuredPushDevices:(rows:unknown)=>rows,
 isDeadPushReason:(s:string)=>s==="messaging/registration-token-not-registered"||s==="BadDeviceToken",
 sendNativePush:transport.send,
}));
import {dispatchNativePush,eventStillEligible,IOS_OUTBOX_KINDS} from "./outbox";
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
beforeEach(()=>{vi.restoreAllMocks();transport.send.mockReset();transport.send.mockResolvedValue({ok:true});transport.apns=null;});
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
 it("retries only failed devices and never sends non-allowlisted events through APNs",async()=>{
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

describe("type-specific notification copy",()=>{
 it("names the type and the person, never message text",()=>{
  const p=eventPayload({...event({kind:"chat"}),actor_id:"a",payload:{conversation_id:"conv",body:"secret text"}},"zh-Hant",{actor:"Ray"});
  expect((p.aps as {alert:{title:string;body:string}}).alert).toEqual({title:"聊天訊息",body:"Ray 傳來新訊息"});
  expect(JSON.stringify(p)).not.toMatch(/secret/);
  expect(richPushCopy("invite","en",{actor:"Ray"},{})).toEqual({title:"Drink invitation",body:"Ray invited you for a drink"});
  expect(richPushCopy("invite_reply","zh-Hans",{actor:"Ray"},{decision:"declined"})?.body).toBe("Ray 婉拒了你的邀请");
  expect(richPushCopy("member_joined","zh-Hant",{host:"Amy"},{})).toEqual({title:"酒局通知",body:"Amy的酒局：有人加入"});
  expect(richPushCopy("reminder_1h","en",{host:"Amy"},{})?.body).toBe("Amy's gathering: starts soon");
 });
 it("falls back to generic copy without a name and for sensitive kinds",()=>{
  expect(richPushCopy("chat","en",{},{})).toBeNull();
  for(const kind of ["complaint_filed","complaint_result","trust_changed","game_kicked"])expect(richPushCopy(kind,"en",{actor:"Ray",host:"Amy"},{})).toBeNull();
  expect(eventPayload({...event({kind:"chat"}),payload:{conversation_id:"conv"}},"en").aps).toMatchObject({alert:{title:"You have a new message"}});
 });
 it("cleans display names",()=>{
  expect(cleanName("  Ray\u202e\n  ")).toBe("Ray");expect(cleanName("x".repeat(50))).toBe("x".repeat(15)+"…");expect(cleanName("🍺".repeat(50))).toBe("🍺".repeat(7)+"…");expect(cleanName("👨\u200d👩\u200d👧")).toBe("👨\u200d👩\u200d👧");expect(cleanName("A\u2067B")).toBe("AB");expect(cleanName("   ")).toBeUndefined();expect(cleanName(5)).toBeUndefined();
 });
});

describe("coverage boundary regressions",()=>{
 function partyTables(kind="member_joined"):Record<string,R[]>{const t=chatTables();
  t.notifications=[{id:"notice",kind,user_id:"recipient",read_at:null}];
  t.parties=[{id:"party",host_user_id:"recipient",status:"open",start_at:new Date(now-1000).toISOString(),expires_at:new Date(now+3600_000).toISOString()}];
  t.joins=[{party_id:"party",user_id:"actor"}];return t;
 }
 const joined=()=>event({source_type:"notification",source_id:"notice",kind:"member_joined",payload:{party_id:"party"}});
 it("notifies the host of a valid join after the gathering has started",async()=>{
  expect(await eventStillEligible(database(partyTables()),joined(),now)).toBe(true);
 });
 it("drops joins after the member left, gathering ended or was cancelled",async()=>{
  for(const mutate of [(t:Record<string,R[]>)=>{t.joins=[];},(t:Record<string,R[]>)=>{t.parties[0].expires_at=new Date(now-1).toISOString();},(t:Record<string,R[]>)=>{t.parties[0].status="cancelled";}]){
   const t=partyTables();mutate(t);expect(await eventStillEligible(database(t),joined(),now)).toBe(false);
  }
 });
 it("keeps departure notices restricted to before the gathering starts",async()=>{
  for(const kind of ["member_left","member_left_late"]){const t=partyTables(kind);t.joins=[];
   expect(await eventStillEligible(database(t),{...joined(),kind},now)).toBe(false);
  }
 });
 it("delivers the system removal result even when the host also blocked the player",async()=>{
  const t=chatTables();t.cheers_blocks=[{blocker_id:"actor",blocked_id:"recipient"}];
  t.notifications=[{id:"notice",kind:"game_kicked",user_id:"recipient",read_at:null}];
  t.game_rooms=[{id:"room",host_id:"actor",status:"lobby",expires_at:new Date(now+3600_000).toISOString()}];
  t.game_room_players=[{room_id:"room",user_id:"recipient",status:"kicked"}];
  const e=event({source_type:"notification",source_id:"notice",kind:"game_kicked",payload:{room_id:"room"}});
  expect(await eventStillEligible(database(t),e,now)).toBe(true);
  t.game_room_players[0].status="active";expect(await eventStillEligible(database(t),e,now)).toBe(false);
 });
});

describe("iOS chat delivery through the outbox (Push-2a)",()=>{
 const live=()=>{vi.spyOn(Date,"now").mockReturnValue(now);const t=chatTables();t.native_push_outbox=[{...event(),status:"processing"}];return t;};
 const ios=(over:R={})=>({id:"ios",platform:"ios",user_id:"recipient",enabled:true,push_token:"ios-token",locale:"zh-Hant",environment:"sandbox",...over});
 const aos=(over:R={})=>({id:"aos",platform:"aos",user_id:"recipient",enabled:true,push_token:"aos-token",locale:"en",environment:"production",...over});
 it("sends a chat event to an iOS device through APNs with the device's own environment",async()=>{
  transport.apns={keyId:"k"};const t=live();t.devices=[ios()];
  const r=await dispatchNativePush(database(t));
  expect(r.sent).toBe(1);expect(transport.send).toHaveBeenCalledTimes(1);
  expect(transport.send).toHaveBeenCalledWith(expect.objectContaining({platform:"ios",env:"sandbox",deviceToken:"ios-token",
   payload:expect.objectContaining({t:"chat",conversation_id:"conv",aps:expect.objectContaining({badge:7,"thread-id":"chat-conv"})})}));
  expect(JSON.stringify(transport.send.mock.calls[0][0].payload)).not.toMatch(/secret|body text/);
  expect(t.native_push_deliveries).toEqual([expect.objectContaining({device_id:"ios",status:"sent"})]);
 });
 it("uses production for an iOS device registered as production",async()=>{
  transport.apns={keyId:"k"};const t=live();t.devices=[ios({environment:"production"})];
  await dispatchNativePush(database(t));expect(transport.send).toHaveBeenCalledWith(expect.objectContaining({platform:"ios",env:"production"}));
 });
 it("delivers to both platforms; AOS keeps its production env and carries no thread-id",async()=>{
  transport.apns={keyId:"k"};const t=live();t.devices=[aos(),ios()];
  const r=await dispatchNativePush(database(t));expect(r.sent).toBe(2);
  const calls=transport.send.mock.calls.map(c=>c[0]);
  expect(calls.find(c=>c.platform==="aos")).toMatchObject({env:"production",deviceToken:"aos-token"});
  expect((calls.find(c=>c.platform==="aos").payload as {aps:R}).aps["thread-id"]).toBeUndefined();
  expect(calls.find(c=>c.platform==="ios")).toMatchObject({env:"sandbox",deviceToken:"ios-token"});
 });
 it("sends a private invitation to iOS (no direct iOS sender exists for it)",async()=>{
  transport.apns={keyId:"k"};vi.spyOn(Date,"now").mockReturnValue(now);const t=chatTables();
  t.drink_invites=[{id:"inv",from_user_id:"actor",to_user_id:"recipient",status:"sent",expires_at:new Date(now+60_000).toISOString()}];
  t.native_push_outbox=[{...event({source_type:"invite",source_id:"inv",kind:"invite",payload:{invite_id:"inv"}}),status:"processing"}];t.devices=[ios()];
  const r=await dispatchNativePush(database(t));
  expect(r.sent).toBe(1);expect(transport.send).toHaveBeenCalledWith(expect.objectContaining({platform:"ios",payload:expect.objectContaining({t:"invite",invite_id:"inv"})}));
 });
 it("delivers a trust change to iOS with only generic lock-screen copy (Push-2c; report penalties produce these)",async()=>{
  transport.apns={keyId:"k"};vi.spyOn(Date,"now").mockReturnValue(now);const t=chatTables();
  t.notifications=[{id:"notice",kind:"trust_changed",user_id:"recipient",read_at:null,payload:{delta:-10,note:"private evidence"}}];
  t.native_push_outbox=[{...event({source_type:"notification",source_id:"notice",kind:"trust_changed",payload:{delta:-10,note:"private evidence"}}),status:"processing"}];t.devices=[ios()];
  const r=await dispatchNativePush(database(t));
  expect(r.sent).toBe(1);
  const call=transport.send.mock.calls[0][0];
  expect(call).toMatchObject({platform:"ios",payload:expect.objectContaining({t:"trust_changed"})});
  expect(JSON.stringify(call.payload)).not.toMatch(/private|evidence|-10/);
 });
 it("delivers game results to iOS (kicked)",async()=>{
  transport.apns={keyId:"k"};vi.spyOn(Date,"now").mockReturnValue(now);const t=chatTables();
  t.notifications=[{id:"notice",kind:"game_kicked",user_id:"recipient",read_at:null}];
  t.game_rooms=[{id:"room",host_id:"actor",status:"lobby",expires_at:new Date(now+3600_000).toISOString()}];
  t.game_room_players=[{room_id:"room",user_id:"recipient",status:"kicked"}];
  t.native_push_outbox=[{...event({source_type:"notification",source_id:"notice",kind:"game_kicked",payload:{room_id:"room"}}),status:"processing"}];t.devices=[ios()];
  const r=await dispatchNativePush(database(t));
  expect(r.sent).toBe(1);expect(transport.send).toHaveBeenCalledWith(expect.objectContaining({platform:"ios",payload:expect.objectContaining({t:"game_kicked",room_id:"room"})}));
 });
 it("never sends a kind that is not allowlisted to iOS (party_cancelled already has a direct iOS sender)",async()=>{
  transport.apns={keyId:"k"};vi.spyOn(Date,"now").mockReturnValue(now);const t=chatTables();
  t.notifications=[{id:"notice",kind:"party_cancelled",user_id:"recipient",read_at:null}];
  t.parties=[{id:"party",host_user_id:"recipient",status:"cancelled",start_at:new Date(now+1000).toISOString(),expires_at:new Date(now+3600_000).toISOString()}];
  t.joins=[{party_id:"party",user_id:"actor"}];
  t.native_push_outbox=[{...event({source_type:"notification",source_id:"notice",kind:"party_cancelled",payload:{party_id:"party"}}),status:"processing"}];t.devices=[ios()];
  const r=await dispatchNativePush(database(t));
  expect(transport.send).not.toHaveBeenCalled();expect(r.skipped).toBe(1);expect(t.native_push_outbox[0]).toMatchObject({status:"skipped",last_error:"no-devices"});
 });
 it("keeps kinds that already have a direct iOS sender out of the allowlist, and lists exactly what iOS can route",()=>{
  // direct iOS senders (sendPartyNoticePush) would double-notify
  for(const k of ["party_cancelled","party_completed","invite_cancelled","invite_completed"])expect(IOS_OUTBOX_KINDS.has(k)).toBe(false);
  // UGC report notices are in-app only (the 0077 trigger never enqueues them) and must not be pushed
  for(const k of ["report_submitted","post_reported","post_actioned","report_actioned","report_resolved"])expect(IOS_OUTBOX_KINDS.has(k)).toBe(false);
  expect([...IOS_OUTBOX_KINDS].sort()).toEqual(["attendance_confirm","chat","complaint_ack","complaint_filed","complaint_response_needed","complaint_result","game_join_request","game_join_result","game_kicked","invite","invite_reply","member_joined","member_left","member_left_late","reminder_1h","trust_changed"]);
 });
 it("disables an iOS device whose token APNs rejects, without retrying forever",async()=>{
  transport.apns={keyId:"k"};const t=live();t.devices=[ios()];transport.send.mockResolvedValue({ok:false,status:400,reason:"BadDeviceToken"});
  await dispatchNativePush(database(t));
  expect(t.devices[0]).toMatchObject({enabled:false});expect(t.native_push_deliveries).toEqual([expect.objectContaining({device_id:"ios",status:"dead"})]);
  expect(t.native_push_outbox[0].status).toBe("sent");
 });
 it("does not touch iOS devices when the recipient has none enabled",async()=>{
  transport.apns={keyId:"k"};const t=live();t.devices=[ios({enabled:false})];
  const r=await dispatchNativePush(database(t));expect(r.skipped).toBe(1);expect(transport.send).not.toHaveBeenCalled();
 });
});
