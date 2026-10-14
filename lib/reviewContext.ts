/**
 * 後台審核詳情的「案件背景」（僅內部可見；每次查看詳情已寫審計）：
 * 投訴人／被投訴人的身份、在該局的角色與到場、誠信、投訴歷史；酒局資料；雙方歷史交集。
 * 讓審核員不必翻庫就能判斷「這是誰、在局裡做了什麼、過往有沒有類似記錄」。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { ageOf } from "./api/profile";
import { readTrust } from "./trust/ledger";

export type ComplaintTally = { total: number; upheld: number; dismissed: number; malicious: number; pending: number };

export type PersonCard = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  gender: string | null;
  age: number | null;
  registeredAt: string | null;
  /** host＝發起人；member＝在名單；left＝曾報名已退出；none＝不在該局名單（資料異常） */
  role: "host" | "member" | "left" | "none";
  events: { kind: string; at: string }[];
  arrivedAt: string | null;
  hostMarked: boolean | null;
  trust: { score: number; tier: string; completed: number } | null;
  asFiler: ComplaintTally;
  asTarget: ComplaintTally;
  suspendedUntil: string | null;
};

export type PartyCard = {
  id: string;
  place: string;
  startAt: string | null;
  expiresAt: string | null;
  status: string | null;
  seatsTotal: number | null;
  minMembers: number | null;
  hostId: string | null;
  hostNickname: string | null;
  roster: { id: string; nickname: string; isHost: boolean }[];
};

export type PairHistoryItem = {
  id: string;
  category: string;
  status: string;
  at: string;
  /** filer→target 與本案同向（same）或反向（reverse）；其餘（涉及雙方之一的別案）不放這裡 */
  direction: "same" | "reverse";
};

export type ReviewContext = { filer: PersonCard; target: PersonCard; party: PartyCard | null; pair: PairHistoryItem[] };

const EMPTY_TALLY: ComplaintTally = { total: 0, upheld: 0, dismissed: 0, malicious: 0, pending: 0 };

/** 純函數：統計某人作為投訴人／被投訴人的案件結果（排除本案）。 */
export function tallyComplaints(
  rows: { id: unknown; filer_id: unknown; target_id: unknown; status: unknown }[],
  side: "filer_id" | "target_id",
  userId: string,
  excludeId: string,
): ComplaintTally {
  const t = { ...EMPTY_TALLY };
  for (const r of rows) {
    if (r.id === excludeId || r[side] !== userId) continue;
    t.total += 1;
    if (r.status === "upheld") t.upheld += 1;
    else if (r.status === "dismissed") t.dismissed += 1;
    else if (r.status === "malicious") t.malicious += 1;
    else t.pending += 1;
  }
  return t;
}

/** 純函數：雙方之間的其他投訴（同向／反向），新到舊。 */
export function pairHistory(
  rows: { id: unknown; filer_id: unknown; target_id: unknown; status: unknown; category: unknown; created_at: unknown }[],
  filerId: string,
  targetId: string,
  excludeId: string,
): PairHistoryItem[] {
  const out: PairHistoryItem[] = [];
  for (const r of rows) {
    if (r.id === excludeId || typeof r.id !== "string") continue;
    const same = r.filer_id === filerId && r.target_id === targetId;
    const reverse = r.filer_id === targetId && r.target_id === filerId;
    if (!same && !reverse) continue;
    out.push({
      id: r.id,
      category: String(r.category ?? ""),
      status: String(r.status ?? ""),
      at: typeof r.created_at === "string" ? r.created_at : "",
      direction: same ? "same" : "reverse",
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function genderLabel(g: string | null): string {
  return g === "male" ? "男" : g === "female" ? "女" : g === "secret" ? "保密" : "未填";
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

export async function loadReviewContext(
  svc: SupabaseClient,
  c: Record<string, unknown>,
  nowMs: number = Date.now(),
): Promise<ReviewContext> {
  const filerId = String(c.filer_id ?? "");
  const targetId = String(c.target_id ?? "");
  const partyId = str(c.party_id);

  const [{ data: partyRow }, { data: joinRows }, { data: eventRows }, { data: attRows }, { data: complaintRows }] =
    await Promise.all([
      partyId
        ? svc.from("parties").select("id,place,start_at,expires_at,status,seats_total,min_members,host_user_id").eq("id", partyId).maybeSingle()
        : Promise.resolve({ data: null }),
      partyId ? svc.from("joins").select("user_id").eq("party_id", partyId).limit(100) : Promise.resolve({ data: [] }),
      partyId
        ? svc.from("party_events").select("user_id,kind,created_at").eq("party_id", partyId).order("created_at", { ascending: true }).limit(300)
        : Promise.resolve({ data: [] }),
      partyId
        ? svc.from("party_attendance").select("user_id,arrived_at,host_marked").eq("party_id", partyId).limit(200)
        : Promise.resolve({ data: [] }),
      svc
        .from("complaints")
        .select("id,filer_id,target_id,status,category,created_at")
        .or(`filer_id.in.(${filerId},${targetId}),target_id.in.(${filerId},${targetId})`)
        .order("created_at", { ascending: false })
        .limit(400),
    ]);

  const party = partyRow as Record<string, unknown> | null;
  const hostId = str(party?.host_user_id);
  const joinIds = (((joinRows ?? []) as unknown[]) as { user_id?: unknown }[]).map((j) => str(j.user_id)).filter((x): x is string => x !== null);
  const idSet = new Set<string>([filerId, targetId, ...joinIds]);
  if (hostId !== null) idSet.add(hostId);
  const { data: userRows } = await svc
    .from("users")
    .select("id,nickname,avatar_url,gender,dob,created_at,complaint_suspended_until")
    .in("id", [...idSet].slice(0, 200));
  const userById = new Map<string, Record<string, unknown>>();
  for (const u of ((userRows ?? []) as unknown[]) as Record<string, unknown>[]) {
    if (typeof u.id === "string") userById.set(u.id, u);
  }
  const nick = (id: string): string => str(userById.get(id)?.nickname) ?? "酒友";

  const events = ((eventRows ?? []) as unknown[]) as Record<string, unknown>[];
  const atts = ((attRows ?? []) as unknown[]) as Record<string, unknown>[];
  const complaints = ((complaintRows ?? []) as unknown[]) as {
    id: unknown; filer_id: unknown; target_id: unknown; status: unknown; category: unknown; created_at: unknown;
  }[];

  const card = async (id: string): Promise<PersonCard> => {
    const u = userById.get(id);
    const att = atts.find((a) => a.user_id === id);
    const mine = events.filter((e) => e.user_id === id);
    const everJoined = mine.some((e) => e.kind === "join");
    const left = mine.some((e) => typeof e.kind === "string" && e.kind.startsWith("leave"));
    const role: PersonCard["role"] =
      id === hostId ? "host" : joinIds.includes(id) ? "member" : everJoined || left ? "left" : "none";
    let trust: PersonCard["trust"] = null;
    try {
      const t = await readTrust(svc, id, nowMs);
      trust = { score: Math.round(t.score), tier: t.tier, completed: t.completed };
    } catch {
      trust = null;
    }
    return {
      id,
      nickname: nick(id),
      avatarUrl: ((): string | null => {
        const a = str(u?.avatar_url);
        return a !== null && /^https:\/\//.test(a) ? a : null;
      })(),
      gender: str(u?.gender),
      age: ageOf(u?.dob, nowMs),
      registeredAt: str(u?.created_at),
      role,
      events: mine.map((e) => ({ kind: String(e.kind ?? ""), at: str(e.created_at) ?? "" })),
      arrivedAt: str(att?.arrived_at),
      hostMarked: typeof att?.host_marked === "boolean" ? (att.host_marked as boolean) : null,
      trust,
      asFiler: tallyComplaints(complaints, "filer_id", id, String(c.id ?? "")),
      asTarget: tallyComplaints(complaints, "target_id", id, String(c.id ?? "")),
      suspendedUntil: ((): string | null => {
        const s = str(u?.complaint_suspended_until);
        return s !== null && Date.parse(s) > nowMs ? s : null;
      })(),
    };
  };

  const [filer, target] = await Promise.all([card(filerId), card(targetId)]);
  return {
    filer,
    target,
    party:
      party === null
        ? null
        : {
            id: String(party.id ?? ""),
            place: str(party.place) ?? "（未知酒吧）",
            startAt: str(party.start_at),
            expiresAt: str(party.expires_at),
            status: str(party.status),
            seatsTotal: typeof party.seats_total === "number" ? party.seats_total : null,
            minMembers: typeof party.min_members === "number" ? party.min_members : null,
            hostId,
            hostNickname: hostId !== null ? nick(hostId) : null,
            roster: [
              ...(hostId !== null ? [{ id: hostId, nickname: nick(hostId), isHost: true }] : []),
              ...joinIds.filter((j) => j !== hostId).map((j) => ({ id: j, nickname: nick(j), isHost: false })),
            ],
          },
    pair: pairHistory(complaints, filerId, targetId, String(c.id ?? "")),
  };
}

/**
 * 利益衝突回避（四眼原則）：審核員不能審自己是投訴人／被投訴人的案，也不能審自己參加或發起的那一局的案。
 * `allowSelf`＝運營在**測試／單管理員階段**顯式開啟（env `ADMIN_ALLOW_SELF_CASE=true`，默認關）時放行，
 * 但調用方必須把 `self_review:true` 寫進審計，頁面也要顯示橫幅。回 null＝可審；否則回原因碼。
 */
export function selfCaseBlock(args: {
  adminId: string;
  filerId: unknown;
  targetId: unknown;
  partyHostId: unknown;
  adminInParty: boolean;
  allowSelf: boolean;
}): "self_case" | "same_party" | null {
  if (args.allowSelf) return null;
  if (args.filerId === args.adminId || args.targetId === args.adminId) return "self_case";
  if (args.partyHostId === args.adminId || args.adminInParty) return "same_party";
  return null;
}

/** 這個管理員是否踩到了回避規則（不論是否放行）；放行時用來決定要不要寫 self_review 審計標記。 */
export function isSelfCase(args: { adminId: string; filerId: unknown; targetId: unknown; partyHostId: unknown; adminInParty: boolean }): boolean {
  return selfCaseBlock({ ...args, allowSelf: false }) !== null;
}

export function allowSelfCaseEnabled(env: string | undefined = process.env.ADMIN_ALLOW_SELF_CASE): boolean {
  return env === "true";
}

