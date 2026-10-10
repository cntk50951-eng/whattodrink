/**
 * UR H.1 大話骰規則純函數（服务端权威，iOS 本地预校验同款口径；权威永远是服务端）。
 * 口径来源：交接 §五（维基：数量不减／同量点大／1 点百搭／实际≥叫数则质疑者输）。
 * `ones_break` 读法取经典圈规：庄家（房规）开此变体后，本局一旦有人叫过 1，
 * 之后 1 不再是百搭（`onesBroken` 由调用方按本局叫骰历史推导，见 countMatching）。
 */

import { randomInt } from "node:crypto";

export type LiarsRules = {
  /** 每人骰数（POC 固定 5）。 */
  dice_per_player: number;
  /** 开局叫骰最小数量（房规，默认 2）。 */
  min_open_qty: number;
  /** 1 点是否百搭。 */
  ones_wild: boolean;
  /** 是否启用"叫 1 破百搭"变体。 */
  ones_break: boolean;
  /** 是否启用齋／飛（POC 关，字段预留）。 */
  zhai_enabled: boolean;
  /** 回合时限秒（15／30／60／0＝无）。 */
  turn_seconds: number;
};

export const LIARS_RULES_DEFAULT: LiarsRules = {
  dice_per_player: 5,
  min_open_qty: 2,
  ones_wild: true,
  ones_break: false,
  zhai_enabled: false,
  turn_seconds: 30,
} as const;

const TURN_CHOICES = [15, 30, 60, 0] as const;

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  const n = Math.floor(v);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** 房规解析（非法回落默认，不 400——沿 parseRequestOrigin 口径）。 */
export function parseRules(raw: unknown): LiarsRules {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const turn =
    typeof r.turn_seconds === "number" && (TURN_CHOICES as readonly number[]).includes(r.turn_seconds)
      ? r.turn_seconds
      : LIARS_RULES_DEFAULT.turn_seconds;
  return {
    dice_per_player: clampInt(r.dice_per_player, 5, 1, 10),
    min_open_qty: clampInt(r.min_open_qty, 2, 1, 20),
    ones_wild: typeof r.ones_wild === "boolean" ? r.ones_wild : true,
    ones_break: typeof r.ones_break === "boolean" ? r.ones_break : false,
    zhai_enabled: typeof r.zhai_enabled === "boolean" ? r.zhai_enabled : false,
    turn_seconds: turn,
  };
}

export type BidInput = {
  qty: number;
  face: number;
  zhai?: boolean;
};

export type BidResult = { ok: true } | { ok: false; reason: string };

function checkShape(next: BidInput): BidResult {
  if (!Number.isInteger(next.qty) || next.qty < 1 || next.qty > 200) {
    return { ok: false, reason: "qty 非法" };
  }
  if (!Number.isInteger(next.face) || next.face < 1 || next.face > 6) {
    return { ok: false, reason: "face 只要 1-6" };
  }
  return { ok: true };
}

/**
 * 叫骰合法性（prev null＝开局）。
 * - 开局：qty ≥ min_open_qty。
 * - 加注：qty 不减；同 qty 则 face 更大（维基）。
 * - zhai：房规关即非法；齋→飛（unzhai）需 qty ≥ prev+2（交接 §五待产品确认，POC 先按 +2 落）。
 */
export function isValidBid(
  prev: { qty: number; face: number; zhai: boolean } | null,
  next: BidInput,
  rules: LiarsRules,
): BidResult {
  const shape = checkShape(next);
  if (!shape.ok) return shape;
  const zhai = next.zhai === true;
  if (zhai && !rules.zhai_enabled) {
    return { ok: false, reason: "本房未开齋" };
  }
  if (prev === null) {
    if (next.qty < rules.min_open_qty) {
      return { ok: false, reason: `开局数量至少 ${rules.min_open_qty}` };
    }
    return { ok: true };
  }
  if (next.qty < prev.qty) {
    return { ok: false, reason: "数量不可减少" };
  }
  if (next.qty === prev.qty && next.face <= prev.face) {
    return { ok: false, reason: "同数量点数必须更大" };
  }
  if (prev.zhai && !zhai && rules.zhai_enabled && next.qty < prev.qty + 2) {
    return { ok: false, reason: "齋转飛数量至少 +2" };
  }
  return { ok: true };
}

/**
 * 开盅计数（全场暗骰→命中数）。
 * wild＝ones_wild 且本叫非齋 且（未开 ones_break 变体 或 本局无人叫过 1）。
 * 叫 1 本身永远只数 1（face===1 时 wild 项恒空，两种读法同数）。
 */
export function countMatching(
  allDice: number[],
  bid: { qty: number; face: number; zhai: boolean },
  rules: LiarsRules,
  onesBroken = false,
): number {
  let n = 0;
  const wild =
    rules.ones_wild && !bid.zhai && !(rules.ones_break && onesBroken) && bid.face !== 1;
  for (const d of allDice) {
    if (d === bid.face) n += 1;
    else if (d === 1 && wild) n += 1;
  }
  return n;
}

export type ChallengeResult = {
  counted: number;
  /** 实际数 ≥ 叫数→质疑者输（true）；否则叫骰者输。 */
  bid_met: boolean;
};

/** 开盅结算（调用方按 bid_met 定 loser_id，见上）。 */
export function resolveChallenge(
  allDice: number[],
  bid: { qty: number; face: number; zhai: boolean },
  rules: LiarsRules,
  onesBroken = false,
): ChallengeResult {
  const counted = countMatching(allDice, bid, rules, onesBroken);
  return { counted, bid_met: counted >= bid.qty };
}

/** 超时替开局者最小叫骰（qty 取房规下限，face 取 1，合法性与 isValidBid 同口径）。 */
export function minAutoBid(rules: LiarsRules): { qty: number; face: number; zhai: false } {
  return { qty: Math.max(1, rules.min_open_qty), face: 1, zhai: false };
}

/** 本局是否已触发"叫 1 破百搭"（bids 历史有人叫过 1 且房规开变体）。 */
export function deriveOnesBroken(
  bids: { face: number }[],
  rules: LiarsRules,
): boolean {
  if (!rules.ones_break) return false;
  return bids.some((b) => b.face === 1);
}

/** 座位次序下一家（只传 active 名单；空即 null）。 */
export function nextTurn(activeUserIds: string[], currentUserId: string): string | null {
  if (activeUserIds.length === 0) return null;
  const i = activeUserIds.indexOf(currentUserId);
  if (i === -1) return activeUserIds[0];
  return activeUserIds[(i + 1) % activeUserIds.length];
}

function cryptoRandInt(min: number, maxExclusive: number): number {
  return randomInt(min, maxExclusive);
}

/** 服务端摇骰（crypto 默认；单测可注入确定性 randInt）。 */
export function rollDice(
  count: number,
  randInt: (min: number, maxExclusive: number) => number = cryptoRandInt,
): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw new RangeError("骰数非法");
  }
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(randInt(1, 7));
  }
  return out;
}

/** 6 位房间码字母表（避 0/O、1/I，大小写不敏感，沿交接 §3.1）。 */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 房间码（默认 crypto；单测可注入）。 */
export function generateRoomCode(
  randInt: (min: number, maxExclusive: number) => number = cryptoRandInt,
): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ROOM_CODE_ALPHABET[randInt(0, ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
