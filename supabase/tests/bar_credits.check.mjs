// Bar 積分 SQL 的行為測試（真的 Postgres：PGlite，WASM）。不進 CI／不加依賴，要驗證時：
//   cd /tmp && mkdir pgt && cd pgt && npm init -y && npm i @electric-sql/pglite && cp <repo>/supabase/tests/bar_credits.check.mjs . && node bar_credits.check.mjs
// 路徑指向 repo 內的 0073 migration；期望輸出全部 "ok"（20 項）。
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());`);
const sql = fs.readFileSync("/Users/joannalee/Desktop/workspace/whattodrink/supabase/migrations/0073_bar_credits.sql", "utf8");
await db.exec(sql);
await db.exec(sql);  // 可重放
const { rows: [{ id: U }] } = await db.query("INSERT INTO users DEFAULT VALUES RETURNING id");
const D = 15;
const T = (s) => new Date(s).toISOString();
const q = async (fn, ...a) => (await db.query(`SELECT ${fn} AS r`, [])).rows[0].r;
const call = async (text, params) => (await db.query(`SELECT ${text} AS r`, params)).rows[0].r;
const st = (now) => call(`bar_credit_state($1,$2,$3)`, [U, D, now]);
const spend = (n, kind, ref, partial, now) => call(`bar_credit_spend($1,$2,$3,$4,$5,$6,$7)`, [U, n, kind, ref, D, partial, now]);
const grant = (m, now, wins = 5, bal = 45) => call(`bar_credit_grant($1,3,$2,7,$3,$4,$5,$6)`, [U, m, wins, bal, D, now]);
const refund = (ref, now) => call(`bar_credit_refund($1,$2,$3,$4)`, [U, ref, D, now]);
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.log("FAIL", msg, "got", a, "want", b); process.exitCode = 1; } else console.log("ok  ", msg); };
const uuid = () => crypto.randomUUID();

// 週一 09:00 HKT（= 01:00Z）
const mon9 = "2026-11-02T01:00:00Z";
let s = await st(mon9);
eq([s.daily.remaining, s.total], [15, 15], "新用戶：免費 15");
for (let i = 0; i < 15; i++) await spend(1, "chat", `c${i}`, false, mon9);
s = await st(mon9); eq(s.total, 0, "聊 15 次後剩 0");
let r = await spend(1, "chat", "c15", false, mon9); eq([r.ok, r.reason], [false, "exhausted"], "第 16 次被拒");
let r2 = await spend(1, "chat", "c3", false, mon9); eq([r2.ok, r2.duplicate], [true, true], "同 request_id 重送不重複扣");
s = await st(mon9); eq(s.total, 0, "重送沒有多扣");

// 贏 → +3，7 天過期
const m1 = uuid(); const mon10 = "2026-11-02T02:00:00Z";
let g = await grant(m1, mon10); eq([g.granted, g.reason, g.credits.total], [3, "ok", 3], "贏一局 +3");
eq(g.credits.lots[0].expires_at.slice(0, 10), "2026-11-09", "到期＝7 天後");
let g2 = await grant(m1, mon10); eq([g2.granted, g2.reason], [0, "duplicate"], "同一局不重複入帳");

// 輸局扣 1（免費 0 → 從批次扣）
let l = await spend(1, "dice_loss", uuid(), true, "2026-11-02T02:30:00Z"); eq([l.ok, l.credits.total], [true, 2], "輸局 −1（扣批次）");
// 跨日：免費重置 15，先扣免費、批次保留
const tue = "2026-11-02T16:30:00Z"; // = 週二 00:30 HKT
s = await st(tue); eq([s.daily.remaining, s.earned_total, s.total], [15, 2, 17], "週二 00:30 免費重置為 15（不累加），積分仍 2");
await spend(1, "chat", "t1", false, tue); s = await st(tue); eq([s.daily.remaining, s.earned_total], [14, 2], "先扣免費、批次不動");
// 7 天後過期
const exp = "2026-11-09T02:00:01Z"; s = await st(exp); eq(s.earned_total, 0, "過了 7 天積分作廢");
// 輸局在 0 時不為負
const U2row = await db.query("INSERT INTO users DEFAULT VALUES RETURNING id"); const U2 = U2row.rows[0].id;
for (let i = 0; i < 15; i++) await call(`bar_credit_spend($1,1,'chat',$2,$3,false,$4)`, [U2, `x${i}`, D, mon9]);
let z = await call(`bar_credit_spend($1,1,'dice_loss',$2,$3,true,$4)`, [U2, uuid(), D, mon9]); eq([z.ok, z.spent, z.credits.total], [true, 0, 0], "已是 0 時輸局不扣成負數");
// 消耗順序：免費先、最快過期的批次先
const U3 = (await db.query("INSERT INTO users DEFAULT VALUES RETURNING id")).rows[0].id;
await call(`bar_credit_grant($1,3,$2,7,5,45,$3,$4)`, [U3, uuid(), D, "2026-11-02T01:00:00Z"]);   // 先贏的（較早過期）
await call(`bar_credit_grant($1,3,$2,7,5,45,$3,$4)`, [U3, uuid(), D, "2026-11-03T01:00:00Z"]);   // 後贏的
for (let i = 0; i < 15; i++) await call(`bar_credit_spend($1,1,'chat',$2,$3,false,$4)`, [U3, `y${i}`, D, "2026-11-03T02:00:00Z"]);   // 用光免費
await call(`bar_credit_spend($1,4,'chat','y99',$2,false,$3)`, [U3, D, "2026-11-03T02:00:00Z"]);   // 扣 4：先把舊批次 3 扣完、再從新批次扣 1
const lots = (await call(`bar_credit_state($1,$2,$3)`, [U3, D, "2026-11-03T02:00:00Z"])).lots;
eq(lots.map(x => x.remaining), [2], "先扣最快過期的批次（舊批次扣光後只剩新批次 2）");
// 退款
const U4 = (await db.query("INSERT INTO users DEFAULT VALUES RETURNING id")).rows[0].id;
await call(`bar_credit_spend($1,1,'chat','rf1',$2,false,$3)`, [U4, D, mon9]);
let rf = await call(`bar_credit_refund($1,'rf1',$2,$3)`, [U4, D, mon9]); eq([rf.refunded, rf.credits.daily.remaining], [1, 15], "退款：免費額度退回");
let rf2 = await call(`bar_credit_refund($1,'rf1',$2,$3)`, [U4, D, mon9]); eq(rf2.refunded, 0, "重複退款無效");
let again = await call(`bar_credit_spend($1,1,'chat','rf1',$2,false,$3)`, [U4, D, mon9]); eq([again.ok, again.duplicate ?? false], [true, false], "退款後同 request_id 可再扣");
// 賺取上限：每日 5 局、餘額 45
const U5 = (await db.query("INSERT INTO users DEFAULT VALUES RETURNING id")).rows[0].id;
const gs = []; for (let i = 0; i < 7; i++) gs.push((await call(`bar_credit_grant($1,3,$2,7,5,45,$3,$4)`, [U5, uuid(), D, mon9])).reason);
eq(gs, ["ok", "ok", "ok", "ok", "ok", "daily_cap", "daily_cap"], "每日第 6 局起不再入帳");
const nextDay = "2026-11-02T17:00:00Z"; const g6 = await call(`bar_credit_grant($1,3,$2,7,5,45,$3,$4)`, [U5, uuid(), D, nextDay]); eq(g6.granted, 3, "隔天可再賺");
const U6 = (await db.query("INSERT INTO users DEFAULT VALUES RETURNING id")).rows[0].id;
let last; for (let d = 0; d < 4; d++) for (let i = 0; i < 5; i++) last = await call(`bar_credit_grant($1,3,$2,7,5,45,$3,$4)`, [U6, uuid(), D, new Date(Date.parse(mon9) + d * 86400e3).toISOString()]);
eq([last.credits.earned_total <= 45, last.credits.earned_total], [true, 45], "餘額上限 45（4 天×15＝60 → 封頂 45）");
