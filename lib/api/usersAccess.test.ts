import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DEF-20261128-003／004：`users` 只由服務端身分讀寫（0101 之後匿名和登入身分完全沒有權限）。
 * 假資料庫的路由測試發現不了缺授權，所以直接掃源碼。
 */
const root = join(__dirname, "../..");
const files = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
const sources = ["app", "lib", "components"].flatMap(files).map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));

/** 這些檔的函數參數就是服務端 client（呼叫方都傳 createServiceClient()） */
const SERVICE_PARAM = new Set(["db", "svc", "service"]);
/** 唯一允許內嵌 users 的地方：整條查詢本來就用服務端身分 */
const EMBED_ALLOWED = new Set(["app/api/v1/checkins/[id]/comments/route.ts"]);

/** 允許不走 `requireUserRead`／不解構 error 的 `users` 讀取（檔案 → 處數） */
const UNCHECKED_ALLOWED: Record<string, number> = {
  // 只用來顯示暱稱、頭像、性別等
  "app/api/v1/checkins/[id]/route.ts": 1,
  "app/api/v1/cheers/blocks/route.ts": 1,
  "app/api/v1/cheers/inbox/route.ts": 1,
  "app/api/v1/cheers/reports/route.ts": 2,
  "app/api/v1/cheers/sent/route.ts": 1,
  "app/api/v1/complaints/[id]/route.ts": 1,
  "app/api/v1/friends/requests/route.ts": 1,
  "app/api/v1/games/invites/route.ts": 1,
  "app/api/v1/games/rooms/[id]/messages/route.ts": 1,
  "app/api/v1/games/rooms/[id]/requests/route.ts": 1,
  "app/api/v1/games/rooms/[id]/route.ts": 1,
  "app/api/v1/games/rooms/bump-join/route.ts": 1,
  "app/api/v1/games/rooms/join/route.ts": 1,
  "app/api/v1/invites/[id]/route.ts": 3,
  "app/api/v1/invites/route.ts": 1,
  "app/api/v1/me/complaints/route.ts": 1,
  "app/api/v1/me/notifications/route.ts": 1,
  "app/api/v1/me/privacy/route.ts": 1,
  "app/api/v1/me/saves/route.ts": 1,
  "app/api/v1/me/trust/route.ts": 1,
  "app/api/v1/parties/[id]/attendance/route.ts": 2,
  "app/api/v1/parties/[id]/joins/route.ts": 1,
  "app/api/v1/parties/[id]/route.ts": 2,
  "app/api/v1/parties/route.ts": 2,
  "app/api/v1/presence/route.ts": 1,
  "app/innerharbour/analytics/page.tsx": 1,
  "app/innerharbour/review/[id]/page.tsx": 1,
  "app/innerharbour/review/history/page.tsx": 1,
  "app/p/[id]/page.tsx": 1,
  "lib/api/myReports.ts": 1,
  "lib/api/reportStp.ts": 1,
  "lib/reviewContext.ts": 2,
  "lib/tasteCardData.ts": 1,
  "lib/push/send.ts": 4, // 暱稱 3 處；aosEventMeta 另查 receiver.error
  // 讀不到就查無此人／什麼都不做（失敗等於拒絕）
  "app/api/v1/checkins/route.ts": 1, // 補建行
  "app/api/v1/friends/route.ts": 1, // 補建行
  "app/api/v1/me/route.ts": 1, // 補建行
  "app/api/v1/users/[id]/profile/route.ts": 1, // 讀不到回 404
  "app/api/v1/users/[id]/trust/route.ts": 2, // 一處讀不到回 404，一處只用於顯示
  // 用別的寫法檢查錯誤
  "app/api/v1/meet/search/route.ts": 2, // 候選池與好友計數：讀不到就是空結果
  "app/api/v1/meet/status/route.ts": 1, // email.error
  "app/api/v1/nearby/people/route.ts": 1, // r.error
  "lib/push/outbox.ts": 5, // rows()／one() 出錯會丟例外
};

describe("users 表只走服務端身分", () => {
  it("沒有用匿名／登入身分讀寫 users（補建行的 insert 除外：現行權限下本來就寫不進去）", () => {
    const bad: string[] = [];
    for (const { path, text } of sources) {
      for (const m of text.matchAll(/(\(await createServiceClient\(\)\)|[\w.]+)\s*\.from\("users"\)\s*\.(\w+)/g)) {
        const [, receiver, op] = m;
        if (receiver.startsWith("(await createServiceClient") || SERVICE_PARAM.has(receiver)) continue;
        const declared = [...text.slice(0, m.index).matchAll(new RegExp(`(?:const|let)\\s+${receiver}\\s*=\\s*await\\s+(\\w+)\\(`, "g"))].pop()?.[1];
        if (declared === "createServiceClient" || op === "insert") continue;
        bad.push(`${path}: ${receiver}.${op}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("沒有 users(...) 內嵌查詢", () => {
    const bad = sources
      .filter(({ path, text }) => !EMBED_ALLOWED.has(path) && /["`][^"`\n]*[,"]users(?:![\w]+)?\([a-z_*]/.test(text))
      .map(({ path }) => path);
    expect(bad).toEqual([]);
  });
  // DEF-20261128-014：決定放不放行的讀取要用 `requireUserRead`，或自己檢查 error。
  // 下面是允許「讀不到就降級」的地方（只影響顯示，或失敗本來就等於拒絕）；數字要完全相符，新增一處就得在此說明。
  it("讀取 users 時不能默默忽略錯誤", () => {
    const found: Record<string, number> = {};
    for (const { path, text } of sources) {
      for (const m of text.matchAll(/\.from\("users"\)\s*\.select\(/g)) {
        const before = text.slice(Math.max(0, m.index - 400), m.index);
        const statement = before.slice(before.lastIndexOf(";") + 1);
        if (statement.includes("requireUserRead(")) continue;
        if (/(?:const|let)\s*\{[^}]*error[^}]*\}\s*=\s*await[^;{}]*$/.test(statement)) continue;
        found[path] = (found[path] ?? 0) + 1;
      }
    }
    expect(found).toEqual(UNCHECKED_ALLOWED);
  });
  // DEF-20261128-016：封鎖／靜音名單讀取只取 data 會在出錯時當作沒有封鎖。
  it("讀取封鎖與靜音名單時一定同時取 error", () => {
    const bad = sources.filter(({ text }) => /\{\s*data:\s*\w*(?:[Bb]lock|[Mm]ute)\w*\s*\}/.test(text)).map(({ path }) => path);
    expect(bad).toEqual([]);
  });
});
