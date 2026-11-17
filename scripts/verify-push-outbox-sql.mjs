/** Optional local SQL integration check. No production connection and no runtime dependency.
 * Install @electric-sql/pglite in a temporary directory, then set PGLITE_MODULE to its
 * absolute dist/index.js path and run node scripts/verify-push-outbox-sql.mjs.
 */
const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`
create role anon;create role authenticated;create role service_role bypassrls;
create table users(id uuid primary key);
create table devices(id uuid primary key);
create table parties(id uuid primary key,host_user_id uuid references users(id),place text,start_at timestamptz,expires_at timestamptz,status text);
create table joins(id uuid primary key default gen_random_uuid(),party_id uuid references parties(id),user_id uuid references users(id),unique(party_id,user_id));
create table notifications(id uuid primary key default gen_random_uuid(),user_id uuid references users(id),kind text,party_id uuid references parties(id),actor_id uuid references users(id),payload jsonb default '{}',created_at timestamptz default now(),read_at timestamptz);
create table conversation_members(conversation_id uuid,user_id uuid,last_read_at timestamptz default now(),muted boolean default false,primary key(conversation_id,user_id));
create table messages(id uuid primary key,conversation_id uuid,sender_id uuid,created_at timestamptz default now());
create table drink_invites(id uuid primary key,from_user_id uuid,to_user_id uuid,status text,expires_at timestamptz);
create table complaints(id uuid primary key,party_id uuid,filer_id uuid,target_id uuid,status text,response_due_at timestamptz);
create table party_reminders(party_id uuid,user_id uuid,kind text,primary key(party_id,user_id,kind));
`);
const migration=readFileSync(new URL('../supabase/migrations/0077_native_push_outbox.sql', import.meta.url),'utf8');
await db.exec(migration); await db.exec(migration);
console.log('PASS migration applies and replays');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const p='33333333-3333-4333-8333-333333333333',c='44444444-4444-4444-8444-444444444444';
await db.exec(`insert into users values('${a}'),('${b}');
insert into parties values('${p}','${a}','Test',now()+interval '30 minutes',now()+interval '3 hours','open');
insert into joins(party_id,user_id) values('${p}','${b}');
insert into joins(party_id,user_id) values('${p}','${b}') on conflict do nothing;
insert into conversation_members(conversation_id,user_id) values('${c}','${a}'),('${c}','${b}');
insert into messages values('55555555-5555-4555-8555-555555555555','${c}','${a}',now());
insert into messages values('55555555-5555-4555-8555-555555555555','${c}','${a}',now()) on conflict do nothing;
insert into drink_invites values('66666666-6666-4666-8666-666666666666','${a}','${b}','sent',now()+interval '3 hours');
update drink_invites set status='accepted';update drink_invites set status='accepted';
insert into complaints values('77777777-7777-4777-8777-777777777777','${p}','${a}','${b}','awaiting_response',now()+interval '1 day');
insert into notifications(user_id,kind,party_id,payload) values('${b}','complaint_filed','${p}','{"complaint_id":"77777777-7777-4777-8777-777777777777"}');
`);
async function counts(){return Object.fromEntries((await db.query('select kind,count(*)::int as n from native_push_outbox group by kind')).rows.map(r=>[r.kind,r.n]));}
assert.deepEqual(await counts(),{chat:1,member_joined:1,invite:1,invite_reply:1,complaint_ack:1,complaint_response_needed:1});
console.log('PASS messages, joins, invite transitions, complaint notices enqueue once, combined filed/response alert');
await db.exec('select produce_native_push_reminders();select produce_native_push_reminders();');
assert.equal((await counts()).reminder_1h,2);
await db.exec(`update parties set start_at=now()-interval '3 hours',expires_at=now()-interval '1 hour';select produce_native_push_reminders();select produce_native_push_reminders();`);
assert.equal((await counts()).attendance_confirm,2);
console.log('PASS reminders and attendance create all recipients exactly once under repeated producer calls');
const first=(await db.query('select * from claim_native_push(2)')).rows;
const second=(await db.query('select * from claim_native_push(2)')).rows;
assert.equal(first.length,2);assert.equal(second.length,2);
assert.ok(second.every(r=>!first.some(x=>r.id===x.id)));
await db.query("update native_push_outbox set lease_until=now()-interval '1 second', available_at=now()-interval '1 day' where id=$1",[first[0].id]);
const retry=(await db.query('select * from claim_native_push(1)')).rows[0];
assert.equal(retry.id,first[0].id);assert.equal(retry.attempts,2);assert.notEqual(retry.lease_token,first[0].lease_token);
console.log('PASS claimed batches disjoint and crashed lease reclaims with new identity');
const perms=(await db.query("select has_function_privilege('anon','public.claim_native_push(integer)','EXECUTE') as anon,has_function_privilege('authenticated','public.produce_native_push_reminders()','EXECUTE') as auth,has_function_privilege('service_role','public.claim_native_push(integer)','EXECUTE') as service")).rows[0];
assert.deepEqual(perms,{anon:false,auth:false,service:true});
await db.exec("update native_push_outbox set expires_at=now()-interval '1 second';select * from claim_native_push(32);");
assert.equal((await db.query("select count(*)::int as n from native_push_outbox where status='dead'")).rows[0].n,10);
console.log('PASS RPC permissions and expired jobs terminal handling');
await db.close();
