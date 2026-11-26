import {beforeEach,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({created:"",sent:vi.fn()}));
vi.mock("@/messages/zh-Hant.json",()=>({default:{v2:{}}}));
vi.mock("@/messages/zh-Hans.json",()=>({default:{v2:{}}}));
vi.mock("@/messages/en.json",()=>({default:{v2:{}}}));
vi.mock("./badge",()=>({computeBadge:async()=>({badge:1})}));
vi.mock("./native",()=>({nativePushConfigFromEnv:()=>({fcm:{}}),hasPushChannel:()=>true,configuredPushDevices:(v:unknown)=>v,isDeadPushReason:()=>false,sendNativePush:state.sent}));
vi.mock("@/lib/supabase/server",()=>({createServiceClient:async()=>({from:(table:string)=>{
 const q={select:()=>q,eq:()=>q,in:()=>q,limit:()=>q,or:()=>q,order:()=>q,insert:()=>q,delete:()=>q,
 maybeSingle:async()=>({data:table==="friendships"?{id:"row",created_at:state.created}:table==="devices"?{id:"aos"}:{id:"recipient",nickname:"Ray",push_prefs:{}},error:null}),
 then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:table==="devices"?[{id:"aos",platform:"aos",push_token:"opaque:test",locale:"en"},{id:"ios",platform:"ios",push_token:"ios",locale:"en"}]:[],error:null}).then(resolve)};
 return q;
}})}));
import {partyNoticeCopy,sendFriendPush} from "./send";
const now=Date.parse("2026-11-18T12:00:00Z");
beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(Date,"now").mockReturnValue(now);state.created=new Date(now-1000).toISOString();state.sent.mockReset();state.sent.mockResolvedValue({ok:true});});
const args={fromUserId:"actor",toUserId:"recipient"};
it("keeps a stable Android receipt within one request generation and changes it for a revived request",async()=>{
 await sendFriendPush("request",args);const first=state.sent.mock.calls[0][0].payload;
 expect(Number(first.expires_at)).toBeGreaterThan(now);
 await sendFriendPush("request",args);expect(state.sent.mock.calls[2][0].payload.event_id).toBe(first.event_id);
 state.created=new Date(now).toISOString();await sendFriendPush("request",args);
 expect(state.sent.mock.calls[4][0].payload.event_id).not.toBe(first.event_id);
});
it("iOS APNs payload carries only recipient_id (account guard, round 7); no Android event_id/expires_at",async()=>{
 await sendFriendPush("request",args);const payload=state.sent.mock.calls[1][0].payload;
 expect(payload).toMatchObject({t:"friend_request",from:"actor",recipient_id:args.toUserId});
 for(const key of ["event_id","expires_at"])expect(payload).not.toHaveProperty(key);
});
it("does not expire a new acceptance because its original request was sent days ago",async()=>{
 state.created=new Date(now-3*86_400_000).toISOString();
 expect(await sendFriendPush("accepted",args)).toEqual({sent:2});
 expect(Number(state.sent.mock.calls[0][0].payload.expires_at)).toBe(now+86_400_000);
});

it("酒局因違規被平台取消（0093）：文案不說「發起人撤銷」，三語齊",()=>{
  for(const loc of ["zh-Hant","zh-Hans","en"]){
    const v=partyNoticeCopy("party_cancelled",loc,"Amy","中環酒吧","violation");
    const plain=partyNoticeCopy("party_cancelled",loc,"Amy","中環酒吧");
    expect(v.body).not.toContain("Amy");
    expect(v.body).toContain("中環酒吧");
    expect(v.body).not.toBe(plain.body);
  }
});
