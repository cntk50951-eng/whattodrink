import {beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({mode:"normal",status:"pending",inserted:false,notices:[] as unknown[],bumps:vi.fn()}));
vi.mock("@/lib/api/envelope",()=>import("../../../../../../../../lib/api/envelope"));
vi.mock("@/lib/games/rooms",()=>({parseJoinDecision:()=>({decision:"approve"}),loadRoomAsMember:async()=>({room:{id:"room",status:"lobby",version:4,max_players:2}}),requireHost:()=>null,getActiveMembers:async()=>state.mode==="existing"?[{seat:0},{seat:1}]:[{seat:0}],bumpRoom:state.bumps,appendEvent:async()=>{}}));
vi.mock("@/lib/supabase/server",()=>{
 const db={from:(table:string)=>{let op="read";let values:Record<string,unknown>={};let pending=false;
  const q={select:()=>q,eq:(key:string,value:unknown)=>{if(key==="status"&&value==="pending")pending=true;return q;},
   update:(v:Record<string,unknown>)=>{op="update";values=v;return q;},insert:(v:unknown)=>{op="insert";values=v as Record<string,unknown>;return q;},
   maybeSingle:async()=>({error:null,data:table==="game_join_requests"?{id:"request",room_id:"room",user_id:"player",status:state.status}:state.mode==="existing"||state.mode==="race"&&state.inserted?{user_id:"player",status:"active"}:state.mode==="inactive"?{user_id:"player",status:"kicked"}:null}),
   then:(resolve:(v:unknown)=>unknown)=>{let error=null;let data:unknown=[];
    if(table==="game_room_players"&&op==="insert"){state.inserted=true;if(state.mode!=="normal")error={code:"23505"};}
    if(table==="game_join_requests"&&op==="update"&&(!pending||state.status==="pending")){state.status=String(values.status);data=[{id:"request"}];}
    if(table==="notifications"&&op==="insert")state.notices.push(values);
    return Promise.resolve({data,error}).then(resolve);
   }};return q;
 }};return {getAuthedClient:async()=>({userId:"host",supabase:db}),createServiceClient:async()=>db};
});
import {POST} from "./route";
const approve=()=>POST(new Request("https://example.invalid",{method:"POST",body:JSON.stringify({decision:"approve"})}),{params:Promise.resolve({id:"room",rid:"request"})});
beforeEach(()=>{state.mode="normal";state.status="pending";state.inserted=false;state.notices.splice(0);state.bumps.mockReset();state.bumps.mockResolvedValue(5);});
describe("approval result coverage",()=>{
 it.each(["normal","existing","race"])("produces one result for %s membership and does not duplicate on retry",async mode=>{
  state.mode=mode;expect((await approve()).status).toBe(200);expect(state.notices).toEqual([expect.objectContaining({user_id:"player",kind:"game_join_result",payload:{decision:"approved",room_id:"room"}})]);
  expect(state.bumps).toHaveBeenCalledTimes(mode==="normal"?1:0);
  expect((await approve()).status).toBe(200);expect(state.notices).toHaveLength(1);
 });
 it("does not approve or notify on a seat collision with another player",async()=>{
  state.mode="seat";expect((await approve()).status).toBe(409);expect(state.status).toBe("pending");expect(state.notices).toHaveLength(0);
 });
 it("does not restore a kicked player",async()=>{state.mode="inactive";expect((await approve()).status).toBe(403);expect(state.notices).toHaveLength(0);});
});
