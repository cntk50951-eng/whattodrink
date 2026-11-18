import {beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({rows:[] as Array<Record<string,unknown>>,jobs:[] as Array<()=>Promise<void>>,push:vi.fn(),failUpdate:false,updates:[] as Array<Record<string,unknown>>}));
vi.mock("next/server",()=>({after:(job:()=>Promise<void>)=>state.jobs.push(job)}));
vi.mock("@/lib/api/envelope",()=>import("../../../../lib/api/envelope"));
vi.mock("@/lib/api/chat",()=>import("../../../../lib/api/chat"));
vi.mock("@/lib/friends",()=>import("../../../../lib/friends"));
vi.mock("@/lib/push/send",()=>({sendFriendPush:state.push}));
vi.mock("@/lib/accountDeletion",()=>({isDeletionPending:async()=>false}));
vi.mock("@/lib/supabase/server",()=>{
 const db={from:(table:string)=>{
  let updating=false;
  const q={select:()=>q,eq:()=>q,gte:()=>q,or:()=>q,limit:()=>q,delete:()=>q,
   update:(v:Record<string,unknown>)=>{state.updates.push(v);updating=true;return q;},
   maybeSingle:async()=>({data:table==="users"?{id:"me"}:null,error:null}),
   then:(resolve:(result:unknown)=>unknown)=>Promise.resolve({data:table==="friendships"?state.rows:[],count:0,error:updating&&state.failUpdate?{code:"DB_FAIL"}:null}).then(resolve),
  };return q;
 }};return {getAuthedClient:async()=>({userId:"me",supabase:db}),createServiceClient:async()=>db};
});
import {POST} from "./route";
const request=()=>new Request("https://example.invalid/api/v1/friends",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({friend_id:"peer"})});
beforeEach(()=>{state.jobs.splice(0);state.updates.splice(0);state.push.mockReset();state.push.mockResolvedValue({sent:1});state.failUpdate=false;state.rows=[{user_id:"peer",friend_id:"me",status:"pending"}];});
describe("D.12 reciprocal friend-request acceptance",()=>{
 it("schedules and awaits an AOS-only acceptance notification after the successful flip",async()=>{
  const result=await POST(request());expect(result.status).toBe(200);expect(await result.json()).toEqual({status:"accepted"});
  expect(state.push).not.toHaveBeenCalled();expect(state.jobs).toHaveLength(1);
  const pending=state.jobs[0]();expect(pending).toBeInstanceOf(Promise);await pending;
  expect(state.push).toHaveBeenCalledWith("accepted",{fromUserId:"me",toUserId:"peer",aosOnly:true});
 });
 it("does not re-notify an already accepted pair",async()=>{
  state.rows[0].status="accepted";expect((await POST(request())).status).toBe(200);expect(state.jobs).toHaveLength(0);
 });
 it("does not claim acceptance or notify after a failed database flip",async()=>{
  vi.spyOn(console,"error").mockImplementation(()=>{});state.failUpdate=true;
  expect((await POST(request())).status).toBe(500);expect(state.jobs).toHaveLength(0);expect(state.push).not.toHaveBeenCalled();vi.restoreAllMocks();
 });
});

it("starts a fresh request generation when reviving an old blocked row",async()=>{
 const old="2026-11-14T00:00:00Z";state.rows=[{user_id:"me",friend_id:"peer",status:"blocked",created_at:old}];
 const before=Date.now();expect((await POST(request())).status).toBe(201);
 expect(state.updates).toHaveLength(1);const stamp=state.updates[0].created_at;
 expect(typeof stamp).toBe("string");expect(Date.parse(String(stamp))).toBeGreaterThanOrEqual(before);
 expect(state.jobs).toHaveLength(1);await state.jobs[0]();expect(state.push).toHaveBeenCalledWith("request",{fromUserId:"me",toUserId:"peer"});
});
