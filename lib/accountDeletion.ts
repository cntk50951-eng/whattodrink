import type { createServiceClient } from "@/lib/supabase/server";

/**
 * UR I.3 账号注销（立即永久删除／30 天可恢复）。
 * 纯函数（可单测）＋ service_role IO。快照存 `account_deletions.snapshot`（0066）。
 * 恢复范围＝个人资料＋自己发的内容（RESTORE_TABLES）；好友／聊天／碰杯／酒局不恢复。
 */

export const GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DeleteMode = "now" | "grace";

export type SnapshotRow = Record<string, unknown>;
export type Snapshot = {
  /** users 行（一行） */
  users: SnapshotRow[];
  /** 其余表：表名 → 行 */
  tables: Record<string, SnapshotRow[]>;
};

/** 恢复范围（按依赖顺序：帖子先于评论）。col＝指向 users.id 的列。 */
export const RESTORE_TABLES: ReadonlyArray<{ table: string; col: string }> = [
  { table: "checkins", col: "user_id" },
  { table: "checkin_comments", col: "user_id" },
  { table: "checkin_wants", col: "user_id" },
  { table: "checkin_ratings", col: "user_id" },
  { table: "checkin_saves", col: "user_id" },
  { table: "post_likes", col: "user_id" },
  { table: "mood_logs", col: "user_id" },
  { table: "bar_memories", col: "user_id" },
  { table: "user_taste_cards", col: "user_id" },
  { table: "user_taste_inference", col: "user_id" },
  { table: "user_hashtags", col: "user_id" },
];

/**
 * 删 users 行前必须主动清的列：这些外键是 ON DELETE SET NULL，不清就会留下无主内容（0001／0015／0042／0050）。
 * 其余外键是 CASCADE，随 users 行删除。
 */
export const CLEANUP_COLUMNS: ReadonlyArray<{ table: string; col: string }> = [
  { table: "checkins", col: "user_id" },
  { table: "checkin_comments", col: "user_id" },
  { table: "post_likes", col: "user_id" },
  { table: "mood_logs", col: "user_id" },
  { table: "cheers", col: "from_user_id" },
  { table: "cheers", col: "to_user_id" },
  { table: "drink_invites", col: "from_user_id" },
  { table: "drink_invites", col: "to_user_id" },
  { table: "devices", col: "user_id" },
  { table: "post_reports", col: "reporter_id" },
  { table: "party_events", col: "user_id" },
  { table: "notifications", col: "actor_id" },
  { table: "game_events", col: "actor_id" },
  { table: "checkins_archive", col: "user_id" },
];

/** 用户文件在这些桶里都放在 `${userId}/` 前缀下（uploads/sign 的路径约定）。 */
export const STORAGE_BUCKETS = ["avatars", "chat-images", "chat-voice", "party-covers"] as const;

export function purgeAtFrom(now: Date): Date {
  return new Date(now.getTime() + GRACE_DAYS * DAY_MS);
}

export function parseDeleteBody(raw: unknown): { mode: DeleteMode } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  if (r.confirm !== true) return { error: "需要 confirm:true（防误触）" };
  if (r.mode !== "now" && r.mode !== "grace") return { error: "mode 非法：只要 now|grace" };
  return { mode: r.mode };
}

/** 恢复期内才可恢复（status=grace 且未过 purge_at）。 */
export function isRestorable(
  row: { status: string; purge_at: string } | null,
  now: Date,
): boolean {
  if (row === null || row.status !== "grace") return false;
  const t = Date.parse(row.purge_at);
  return Number.isFinite(t) && t > now.getTime();
}

export function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** 宽容地从 jsonb 读出快照（坏形状回 null，调用方按不可恢复处理）。 */
export function parseSnapshot(raw: unknown): Snapshot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.users) || r.users.length !== 1) return null;
  const tables: Record<string, SnapshotRow[]> = {};
  const rawTables = typeof r.tables === "object" && r.tables !== null ? (r.tables as Record<string, unknown>) : {};
  for (const { table } of RESTORE_TABLES) {
    const rows = rawTables[table];
    if (Array.isArray(rows)) {
      tables[table] = rows.filter((x): x is SnapshotRow => typeof x === "object" && x !== null);
    }
  }
  const user = r.users[0];
  if (typeof user !== "object" || user === null) return null;
  return { users: [user as SnapshotRow], tables };
}

/**
 * 恢复计划：users 先，其余按 RESTORE_TABLES 顺序；只留属于该用户的行
 * （防快照被改坏后写进别人名下），白名单外的表丢弃。
 */
export function planRestore(
  snap: Snapshot,
  userId: string,
): Array<{ table: string; rows: SnapshotRow[] }> {
  const plan: Array<{ table: string; rows: SnapshotRow[] }> = [];
  const userRows = snap.users.filter((r) => r.id === userId);
  if (userRows.length !== 1) return [];
  plan.push({ table: "users", rows: userRows });
  for (const { table, col } of RESTORE_TABLES) {
    const rows = (snap.tables[table] ?? []).filter((r) => r[col] === userId);
    if (rows.length > 0) plan.push({ table, rows });
  }
  return plan;
}

// ---------------------------------------------------------------------------
// IO（service_role；不进单测，逻辑都在上面的纯函数里）
// ---------------------------------------------------------------------------

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

const PAGE = 1000;
const MAX_PAGES = 20;

async function selectAll(svc: Svc, table: string, col: string, userId: string): Promise<SnapshotRow[]> {
  const out: SnapshotRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await svc
      .from(table)
      .select("*")
      .eq(col, userId)
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error !== null) throw new Error(`snapshot ${table}: ${error.message}`);
    const rows = (data ?? []) as SnapshotRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function takeSnapshot(svc: Svc, userId: string): Promise<Snapshot> {
  const users = await selectAll(svc, "users", "id", userId);
  const tables: Record<string, SnapshotRow[]> = {};
  for (const { table, col } of RESTORE_TABLES) {
    tables[table] = await selectAll(svc, table, col, userId);
  }
  return { users, tables };
}

/** 先清 SET NULL 的无主内容，再删 users 行（其余 CASCADE 随之而去）。可重复执行。 */
export async function deleteUserData(svc: Svc, userId: string): Promise<void> {
  for (const { table, col } of CLEANUP_COLUMNS) {
    const { error } = await svc.from(table).delete().eq(col, userId);
    // 表尚未迁移（42P01）视为无数据；其余错误中止，避免半删后误报成功
    if (error !== null && error.code !== "42P01") throw new Error(`cleanup ${table}.${col}: ${error.message}`);
  }
  const { error } = await svc.from("users").delete().eq("id", userId);
  if (error !== null) throw new Error(`delete users: ${error.message}`);
}

/** 递归列出前缀下所有文件路径（Storage list 只列一层）。 */
async function listFiles(svc: Svc, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 4) return [];
  const { data, error } = await svc.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error !== null || data === null) return [];
  const files: string[] = [];
  for (const item of data) {
    const path = `${prefix}/${item.name}`;
    // 文件夹没有 id；文件有
    if (item.id === null || item.id === undefined) files.push(...(await listFiles(svc, bucket, path, depth + 1)));
    else files.push(path);
  }
  return files;
}

export async function removeUserFiles(svc: Svc, userId: string): Promise<void> {
  for (const bucket of STORAGE_BUCKETS) {
    const files = await listFiles(svc, bucket, userId);
    for (const batch of chunk(files, 100)) {
      const { error } = await svc.storage.from(bucket).remove(batch);
      if (error !== null) throw new Error(`storage ${bucket}: ${error.message}`);
    }
  }
}

async function deleteAuthUser(svc: Svc, userId: string): Promise<void> {
  const { error } = await svc.auth.admin.deleteUser(userId);
  // 账号已不存在视为成功（重复执行）
  if (error !== null && !/not.?found/i.test(error.message)) throw new Error(`auth delete: ${error.message}`);
}

export type DeletionRow = { user_id: string; status: string; purge_at: string; snapshot: unknown };

export async function getDeletionRow(svc: Svc, userId: string): Promise<DeletionRow | null> {
  const { data, error } = await svc
    .from("account_deletions")
    .select("user_id,status,purge_at,snapshot")
    .eq("user_id", userId)
    .maybeSingle();
  // 0066 未迁移（42P01）按「无申请」处理，不拖垮其他接口
  if (error !== null) {
    if (error.code === "42P01") return null;
    throw new Error(`deletion row: ${error.message}`);
  }
  return (data as DeletionRow | null) ?? null;
}

/** 是否处于「已申请注销、恢复期内」（给 GET /me 与自建 users 行的地方做守卫；出错按否，不挡人）。 */
export async function isDeletionPending(userId: string, now: Date = new Date()): Promise<boolean> {
  try {
    const { createServiceClient: make } = await import("@/lib/supabase/server");
    const svc = await make();
    const row = await getDeletionRow(svc, userId);
    return row !== null && isRestorable(row, now);
  } catch {
    return false;
  }
}

/**
 * 申请注销。grace：快照→记表→删数据（登录账号与文件保留到期清）；
 * now：清文件→删数据→删登录账号，不留快照。
 */
export async function requestDeletion(
  svc: Svc,
  userId: string,
  mode: DeleteMode,
  now: Date,
): Promise<{ mode: DeleteMode; purgeAt: string | null }> {
  if (mode === "grace") {
    const existing = await getDeletionRow(svc, userId);
    // 已在恢复期：幂等回原到期时间，不覆盖快照（数据已删，重拍会拍成空）
    if (existing !== null && isRestorable(existing, now)) return { mode, purgeAt: existing.purge_at };
    const snap = await takeSnapshot(svc, userId);
    const purgeAt = purgeAtFrom(now).toISOString();
    const { error } = await svc.from("account_deletions").upsert({
      user_id: userId,
      status: "grace",
      requested_at: now.toISOString(),
      purge_at: purgeAt,
      snapshot: snap,
      purged_at: null,
    });
    if (error !== null) throw new Error(`record deletion: ${error.message}`);
    await deleteUserData(svc, userId);
    return { mode, purgeAt };
  }
  await removeUserFiles(svc, userId);
  await deleteUserData(svc, userId);
  await deleteAuthUser(svc, userId);
  const { error } = await svc.from("account_deletions").delete().eq("user_id", userId);
  if (error !== null && error.code !== "42P01") throw new Error(`clear deletion row: ${error.message}`);
  return { mode, purgeAt: null };
}

export type RestoreResult =
  | { ok: true; skipped: number }
  | { ok: false; reason: "not_found" | "corrupt" };

/** 恢复：回填快照（逐表批量插；批量失败退到逐行，跳过插不进的行，如引用的别人帖子已不存在）。 */
export async function restoreAccount(svc: Svc, userId: string, now: Date): Promise<RestoreResult> {
  const row = await getDeletionRow(svc, userId);
  if (row === null || !isRestorable(row, now)) return { ok: false, reason: "not_found" };
  const snap = parseSnapshot(row.snapshot);
  if (snap === null) return { ok: false, reason: "corrupt" };
  const plan = planRestore(snap, userId);
  if (plan.length === 0) return { ok: false, reason: "corrupt" };
  let skipped = 0;
  for (const { table, rows } of plan) {
    for (const batch of chunk(rows, 200)) {
      const { error } = await svc.from(table).upsert(batch, { ignoreDuplicates: true });
      if (error === null) continue;
      // users 行插不进＝恢复失败（后面都依赖它）
      if (table === "users") throw new Error(`restore users: ${error.message}`);
      for (const one of batch) {
        const { error: e1 } = await svc.from(table).upsert(one, { ignoreDuplicates: true });
        if (e1 !== null) skipped += 1;
      }
    }
  }
  const { error } = await svc.from("account_deletions").delete().eq("user_id", userId);
  if (error !== null) throw new Error(`clear deletion row: ${error.message}`);
  return { ok: true, skipped };
}

/** 排程：清到期账号（文件＋登录账号），快照置空，行留 purged 墓碑。单次最多 50 个。 */
export async function purgeExpired(svc: Svc, now: Date): Promise<{ purged: number; failed: number }> {
  const { data, error } = await svc
    .from("account_deletions")
    .select("user_id")
    .eq("status", "grace")
    .lt("purge_at", now.toISOString())
    .limit(50);
  if (error !== null) throw new Error(`list expired: ${error.message}`);
  let purged = 0;
  let failed = 0;
  for (const { user_id: userId } of (data ?? []) as Array<{ user_id: string }>) {
    try {
      await removeUserFiles(svc, userId);
      await deleteAuthUser(svc, userId);
      const { error: e } = await svc
        .from("account_deletions")
        .update({ status: "purged", snapshot: null, purged_at: now.toISOString() })
        .eq("user_id", userId);
      if (e !== null) throw new Error(e.message);
      purged += 1;
    } catch (err) {
      failed += 1;
      console.error(`[purge-accounts] ${userId}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  return { purged, failed };
}
