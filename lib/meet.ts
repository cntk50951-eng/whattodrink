/**
 * UR I.1 遇見 AI 找人（固定流水線：條件解析／查詢打分／理由生成各自獨立函數，不做 agent 编排）。
 * LLM 只做 query→受限 JSON；查詢／過濾／打分全代碼 deterministic（可單測）；
 * 模型輸出超白名單即丟棄進 ignored。
 */

import { INTERESTS, LANGUAGES, OCCUPATIONS } from "./api/profile";
import { TASTE_GROUPS, groupOfKey, type TasteGroupKey } from "./api/taste";

export const MEET_DAILY_LIMIT = 10;
export const MEET_MAX_RESULTS = 10;
export const MEET_QUERY_MAX = 100;
export const MEET_LLM_TIMEOUT_MS = 20_000;

export type MeetCriteria = {
  gender?: "male" | "female";
  age_min?: number;
  age_max?: number;
  height_min?: number;
  height_max?: number;
  occupations?: string[];
  languages?: string[];
  interests?: string[];
  taste_groups?: string[];
  /** 口味子類（如 lager、japanese_whisky；白名单＝大类＋子类，P1）。 */
  taste_keys?: string[];
  nearby_km?: number;
  online_only?: boolean;
};

const TASTE_GROUP_KEYS = Object.keys(TASTE_GROUPS);

function intIn(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.floor(v);
  if (n < min || n > max) return null;
  return n;
}

function strArr(v: unknown, allow: readonly string[], max: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string" || !allow.includes(x)) return null;
    if (!out.includes(x)) out.push(x);
  }
  if (out.length > max) return null;
  return out;
}

/**
 * 条件校验（query 与 criteria 共用同一白名单；非法键丢弃并记 ignored，不 400——
 * 模型输出不可信，丢弃是正常路径；只有形狀全错才由调用方 400）。
 * 回 {criteria（生效集）, dropped（被丢的键名）}。
 */
export function sanitizeCriteria(raw: unknown): { criteria: MeetCriteria; dropped: string[] } {
  const criteria: MeetCriteria = {};
  const dropped: string[] = [];
  if (typeof raw !== "object" || raw === null) return { criteria, dropped };
  const r = raw as Record<string, unknown>;
  const KNOWN = new Set([
    "gender", "age_min", "age_max", "height_min", "height_max", "occupations",
    "languages", "interests", "taste_groups", "taste_keys", "nearby_km", "online_only",
  ]);
  for (const k of Object.keys(r)) {
    if (!KNOWN.has(k) && !dropped.includes(k)) dropped.push(k);
  }
  if (r.gender === "male" || r.gender === "female") criteria.gender = r.gender;
  else if (r.gender !== undefined) dropped.push("gender");
  const ageMin = r.age_min === undefined ? null : intIn(r.age_min, 18, 99);
  const ageMax = r.age_max === undefined ? null : intIn(r.age_max, 18, 99);
  if (r.age_min !== undefined && ageMin === null) dropped.push("age_min");
  else if (ageMin !== null) criteria.age_min = ageMin;
  if (r.age_max !== undefined && ageMax === null) dropped.push("age_max");
  else if (ageMax !== null) criteria.age_max = ageMax;
  if (
    criteria.age_min !== undefined &&
    criteria.age_max !== undefined &&
    criteria.age_min > criteria.age_max
  ) {
    delete criteria.age_min;
    delete criteria.age_max;
    dropped.push("age_min", "age_max");
  }
  const hMin = r.height_min === undefined ? null : intIn(r.height_min, 140, 220);
  const hMax = r.height_max === undefined ? null : intIn(r.height_max, 140, 220);
  if (r.height_min !== undefined && hMin === null) dropped.push("height_min");
  else if (hMin !== null) criteria.height_min = hMin;
  if (r.height_max !== undefined && hMax === null) dropped.push("height_max");
  else if (hMax !== null) criteria.height_max = hMax;
  if (
    criteria.height_min !== undefined &&
    criteria.height_max !== undefined &&
    criteria.height_min > criteria.height_max
  ) {
    delete criteria.height_min;
    delete criteria.height_max;
    dropped.push("height_min", "height_max");
  }
  const occ = r.occupations === undefined ? undefined : strArr(r.occupations, OCCUPATIONS, 14);
  if (occ === null) {
    dropped.push("occupations");
  } else if (occ !== undefined && occ.length > 0) {
    criteria.occupations = occ;
  }
  const lang = r.languages === undefined ? undefined : strArr(r.languages, LANGUAGES, 10);
  if (lang === null) {
    dropped.push("languages");
  } else if (lang !== undefined && lang.length > 0) {
    criteria.languages = lang;
  }
  const inter = r.interests === undefined ? undefined : strArr(r.interests, INTERESTS, 50);
  if (inter === null) {
    dropped.push("interests");
  } else if (inter !== undefined && inter.length > 0) {
    criteria.interests = inter;
  }
  const taste = r.taste_groups === undefined ? undefined : strArr(r.taste_groups, TASTE_GROUP_KEYS, 17);
  if (taste === null) {
    dropped.push("taste_groups");
  } else if (taste !== undefined && taste.length > 0) {
    criteria.taste_groups = taste;
  }
  // P1：子類 key（大类＋子类皆可；非法／空即丢）。
  const keysRaw = r.taste_keys;
  if (keysRaw !== undefined) {
    if (!Array.isArray(keysRaw)) {
      dropped.push("taste_keys");
    } else {
      const keys: string[] = [];
      let bad = false;
      for (const k of keysRaw) {
        if (typeof k !== "string" || groupOfKey(k) === null) {
          bad = true;
          break;
        }
        if (!keys.includes(k)) keys.push(k);
      }
      if (bad || keys.length === 0 || keys.length > 17) dropped.push("taste_keys");
      else criteria.taste_keys = keys;
    }
  }
  const near = r.nearby_km === undefined ? null : intIn(r.nearby_km, 1, 100);
  if (r.nearby_km !== undefined && near === null) dropped.push("nearby_km");
  else if (near !== null) criteria.nearby_km = near;
  if (r.online_only === true) criteria.online_only = true;
  else if (r.online_only !== undefined && r.online_only !== false) dropped.push("online_only");
  return { criteria, dropped };
}

export type ScoredSoft = {
  interests: number;
  languages: number;
  occupation: boolean;
  /** 口味命中强度（0 无／1 推断弱／2 喜欢中／3 最爱强；dislikes 命中即 0）。 */
  tasteLevel: 0 | 1 | 2 | 3;
  mutual: number;
  online: boolean;
  nearby: boolean;
};

/** 权重（确定性；調參只改此表，單測鎖死）。 */
export const MEET_WEIGHTS = {
  interest_each: 4,
  interest_cap: 3,
  language_each: 3,
  occupation: 3,
  taste_weak: 4,
  taste_medium: 6,
  taste_strong: 8,
  mutual_each: 1,
  mutual_cap: 5,
  online: 2,
  nearby: 3,
} as const;

function tastePoints(level: 0 | 1 | 2 | 3): number {
  if (level === 3) return MEET_WEIGHTS.taste_strong;
  if (level === 2) return MEET_WEIGHTS.taste_medium;
  if (level === 1) return MEET_WEIGHTS.taste_weak;
  return 0;
}

/** 是否指定了口味条件（大类或子类任一）。 */
export function hasTasteCriteria(c: MeetCriteria): boolean {
  return c.taste_groups !== undefined || c.taste_keys !== undefined;
}

/** 可能的最高分（按实际指定的条件算；0 条件即 0，全同分按活跃排）。 */
export function maxPossibleScore(c: MeetCriteria): number {
  const w = MEET_WEIGHTS;
  let m = 0;
  if (c.interests !== undefined) m += Math.min(c.interests.length, w.interest_cap) * w.interest_each;
  if (c.languages !== undefined) m += c.languages.length * w.language_each;
  if (c.occupations !== undefined) m += w.occupation;
  if (hasTasteCriteria(c)) m += w.taste_strong;
  m += w.mutual_cap;
  m += w.online;
  if (c.nearby_km !== undefined) m += w.nearby;
  return m;
}

/** 打分（0–100；earned／possible 归一，同分调用方按活跃排）。 */
export function scoreCandidate(c: MeetCriteria, s: ScoredSoft): number {
  const w = MEET_WEIGHTS;
  let earned = 0;
  if (c.interests !== undefined) earned += Math.min(s.interests, w.interest_cap) * w.interest_each;
  if (c.languages !== undefined) earned += s.languages * w.language_each;
  if (c.occupations !== undefined && s.occupation) earned += w.occupation;
  if (hasTasteCriteria(c)) earned += tastePoints(s.tasteLevel);
  earned += Math.min(s.mutual, w.mutual_cap) * w.mutual_each;
  if (s.online) earned += w.online;
  if (c.nearby_km !== undefined && s.nearby) earned += w.nearby;
  const max = maxPossibleScore(c);
  if (max <= 0) return 0;
  return Math.min(100, Math.round((earned * 100) / max));
}

const LANG_LABEL: Record<string, string> = {
  yue: "粵語",
  zh: "普通話",
  en: "英文",
  ja: "日文",
  ko: "韓文",
  fr: "法文",
  de: "德文",
  es: "西班牙文",
  th: "泰文",
  other: "其他語言",
};

export const TASTE_HEADLINE: Record<string, string> = {
  beer: "啤酒派",
  whisky: "威士忌派",
  cocktail: "雞尾酒派",
  wine: "葡萄酒派",
  sparkling: "氣泡酒派",
  sake: "清酒派",
  korean: "韓酒派",
  chinese: "中國酒派",
  gin: "氈酒派",
  rum: "冧酒派",
  tequila: "龍舌蘭派",
  brandy: "白蘭地派",
  shochu: "燒酎派",
  liqueur: "利口酒派",
  spirits: "烈酒派",
  other: "雜飲派",
  zero: "無酒精派",
};

export function tasteHeadline(group: string | null): string | null {
  if (group === null) return null;
  return TASTE_HEADLINE[group] ?? null;
}

/** taste_groups 命中（候选visible行聚合出的 top group 是否在条件里；旧口径，taste_keys 用 tasteLevel）。 */
export function tasteMatches(topGroup: TasteGroupKey | null, wanted: string[] | undefined): boolean {
  if (wanted === undefined || topGroup === null) return false;
  return wanted.includes(topGroup);
}

export type DeclaredTaste = {
  favorites: string[];
  likes: string[];
  dislikes: string[];
};

function normTasteList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function declaredTasteOf(preferences: unknown): DeclaredTaste {
  if (typeof preferences !== "object" || preferences === null) {
    return { favorites: [], likes: [], dislikes: [] };
  }
  const p = preferences as Record<string, unknown>;
  return { favorites: normTasteList(p.favorites), likes: normTasteList(p.likes), dislikes: normTasteList(p.dislikes) };
}

/** 条件口味归一到大类（子→组；大类保持）。 */
function wantedGroups(c: MeetCriteria): string[] {
  const out: string[] = [];
  for (const g of c.taste_groups ?? []) {
    if (!out.includes(g)) out.push(g);
  }
  for (const k of c.taste_keys ?? []) {
    const g = groupOfKey(k);
    if (g !== null && !out.includes(g)) out.push(g);
  }
  return out;
}

/** 条件是否含某子類 key（精确）。 */
function wantsKey(c: MeetCriteria, key: string): boolean {
  return (c.taste_keys ?? []).includes(key);
}

/**
 * 口味命中强度（P0：声明优先——favorites 强 3＞likes 中 2＞打卡推断弱 1；
 * dislikes 命中任一条件组即 0；无口味条件即 0）。
 * favorites/likes 匹配：精确 key 命中，或组命中（条件组含该组；条件子 key 属该组亦算组命中）。
 */
export function tasteLevel(
  c: MeetCriteria,
  declared: DeclaredTaste,
  inferredTop: TasteGroupKey | null,
): 0 | 1 | 2 | 3 {
  if (!hasTasteCriteria(c)) return 0;
  const groups = wantedGroups(c);
  const hit = (keys: string[]): boolean =>
    keys.some((k) => {
      if (wantsKey(c, k)) return true;
      const g = groupOfKey(k);
      return g !== null && groups.includes(g);
    });
  if (hit(declared.dislikes)) return 0;
  if (hit(declared.favorites)) return 3;
  if (hit(declared.likes)) return 2;
  if (inferredTop !== null && groups.includes(inferredTop)) return 1;
  return 0;
}

/** P2 完全符合（指定的每一类软条件至少命中一个；硬条件调用方已保证）。 */
export function isFullMatch(
  c: MeetCriteria,
  hit: { occupations: boolean; languages: number; interests: number; tasteLevel: 0 | 1 | 2 | 3 },
): boolean {
  if (c.occupations !== undefined && !hit.occupations) return false;
  if (c.languages !== undefined && hit.languages === 0) return false;
  if (c.interests !== undefined && hit.interests === 0) return false;
  if (hasTasteCriteria(c) && hit.tasteLevel === 0) return false;
  return true;
}

/** P1 派系標題（聲明優先：favorites/likes 命中的組＞推斷 top；無即 null）。 */
export function preferredHeadline(
  c: MeetCriteria,
  declared: DeclaredTaste,
  inferredTop: TasteGroupKey | null,
): string | null {
  const groups: string[] = [];
  for (const g of c.taste_groups ?? []) {
    if (!groups.includes(g)) groups.push(g);
  }
  for (const k of c.taste_keys ?? []) {
    const g = groupOfKey(k);
    if (g !== null && !groups.includes(g)) groups.push(g);
  }
  const hitGroup = (keys: string[]): string | null => {
    for (const k of keys) {
      if (groups.includes(k)) return k;
      const g = groupOfKey(k);
      if (g !== null && groups.includes(g)) return g;
    }
    return null;
  };
  const fav = hitGroup(declared.favorites);
  if (fav !== null) return tasteHeadline(fav);
  const lik = hitGroup(declared.likes);
  if (lik !== null) return tasteHeadline(lik);
  return tasteHeadline(inferredTop);
}

export type ReasonHit = {
  taste: string | null;
  interest: string | null;
  language: string | null;
  mutual: number;
  nearbyM: number | null;
};

/**
 * 理由短語（≤3，只用命中條件拼裝，不編造；不含暱稱／id，LLM 潤色預留但本期不用）。
 * 優先級：口味＞興趣＞語言＞共同好友＞距離。
 */
export function buildReasons(hit: ReasonHit): string[] {
  const out: string[] = [];
  if (hit.taste !== null) out.push(`都係${hit.taste}`);
  if (out.length < 3 && hit.interest !== null) out.push(`都鍾意${hit.interest.replace(/_/g, " ")}`);
  if (out.length < 3 && hit.language !== null) out.push(`講${LANG_LABEL[hit.language] ?? hit.language}`);
  if (out.length < 3 && hit.mutual > 0) out.push(`${hit.mutual} 位共同好友`);
  if (out.length < 3 && hit.nearbyM !== null) {
    out.push(hit.nearbyM < 1000 ? `距你 ${hit.nearbyM}m` : `距你 ${(hit.nearbyM / 1000).toFixed(1)}km`);
  }
  return out.slice(0, 3);
}

/**
 * 放寬建議（results < 3 時）：年齡各放 5 歲、距離翻倍、去 online_only。
 * 全空条件即原样回（note 说明无可放宽）。
 */
export function relaxedCriteria(c: MeetCriteria): { note: string; criteria: MeetCriteria } {
  const next: MeetCriteria = { ...c };
  const notes: string[] = [];
  if (next.age_min !== undefined || next.age_max !== undefined) {
    next.age_min = Math.max(18, (next.age_min ?? 18) - 5);
    next.age_max = Math.min(99, (next.age_max ?? 99) + 5);
    notes.push("放寬咗年齡範圍");
  }
  if (next.nearby_km !== undefined) {
    next.nearby_km = Math.min(100, next.nearby_km * 2);
    notes.push("放寬咗距離");
  }
  if (next.online_only === true) {
    delete next.online_only;
    notes.push("唔再只要在線");
  }
  return {
    note: notes.length > 0 ? notes.join("、") : "暫無可放寬條件，試下改描述",
    criteria: next,
  };
}

/** LLM 系統提示（固定流水線①：只翻條件，不寫 SQL；枚举原样给出防编造）。 */
export function meetParsePrompt(): { system: string } {
  const subMap = TASTE_GROUP_KEYS.map((g) => {
    const subs = (TASTE_GROUPS[g as TasteGroupKey] as readonly string[]).join(",");
    return `${g}(${subs})`;
  }).join("\n");
  const enums = [
    `gender: male|female`,
    `age_min/age_max: 18-99 整数`,
    `height_min/height_max: 140-220 整数`,
    `occupations: ${(OCCUPATIONS as readonly string[]).join(",")}`,
    `languages: ${(LANGUAGES as readonly string[]).join(",")}`,
    `interests: ${(INTERESTS as readonly string[]).join(",")}`,
    `taste_groups: ${TASTE_GROUP_KEYS.join(",")}`,
    `taste_keys: 大类或子类 key（如 lager、japanese_whisky；子→大类映射见下）`,
    `nearby_km: 1-100 整数（提到附近/距离才给）`,
    `online_only: true（明确说只要在线才给）`,
    `大类→子类：\n${subMap}`,
  ].join("\n");
  return {
    system: [
      "你是交友搜索的条件解析器。输入是一句找人描述，只输出一个 JSON 对象，其他一律不输出。",
      "白名单字段（只用这些，多余一律丢弃并记入 ignored）：",
      enums,
      "不支持的一律丢弃并把用户原文片段记入 ignored（≤5）：外貌、身材、种族、宗教、性取向等敏感属性，以及无法映射的描述。",
      '输出形状：{"criteria": {只含命中的白名单字段}, "ignored": ["原文片段"]}',
    ].join("\n"),
  };
}

export type ParsedQuery = {
  criteria: unknown;
  ignored: string[];
};

/**
 * 模型回复解析（JSON 抠取＋ignored 上限；非法即抛错，调用方 503 不扣次數）。
 * instructions 只允许白名单 key（防模型编造敏感条件直达查询）。
 */
export function parseMeetReply(text: string): ParsedQuery {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("meet reply not json");
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("meet reply not json");
  }
  const ignored = Array.isArray(obj.ignored)
    ? (obj.ignored as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 5)
    : [];
  return { criteria: obj.criteria ?? {}, ignored };
}
