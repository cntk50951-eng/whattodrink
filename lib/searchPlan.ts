/**
 * 遇見智能搜索（多意圖計劃）：一句話 → 最多 4 類意圖（人／地點／酒局／帖子）。
 * LLM 只做「翻譯成受限 JSON」；每類意圖的字段都過白名單校驗，超界丟棄進 ignored；
 * 查詢全由代碼／既有接口參數化執行（模型不寫 SQL、不碰數據庫）。
 */

import { sanitizeCriteria, dropNoisyGroups, type MeetCriteria } from "./meet";

/** 酒局關鍵詞裡的泛詞：指的就是「酒局」本身，拿去比對會把結果全部濾掉。 */
const PARTY_GENERIC = new Set([
  "酒局", "局", "約局", "约局", "約酒", "约酒", "酒聚", "聚會", "聚会", "飲酒", "饮酒", "喝酒", "飲嘢", "party", "parties", "meetup", "gathering", "drinks",
]);
import { groupOfKey } from "./api/taste";
import { normalizeHashtag } from "./hashtags";

export const PLAN_QUERY_MAX = 120;
export const PLAN_MAX_INTENTS = 4;

export const PARTY_WHENS = ["now", "tonight", "tomorrow", "weekend", "week"] as const;
export type PartyWhen = (typeof PARTY_WHENS)[number];

export type PlanIntent =
  | { type: "people"; criteria: MeetCriteria }
  | {
      type: "places";
      keywords: string[];
      near_me: boolean;
      radius_m: number;
      open_24h: boolean;
      open_now: boolean;
    }
  | { type: "parties"; keywords: string[]; when: PartyWhen | null; near_me: boolean; radius_m: number }
  | {
      type: "posts";
      tags: string[];
      hashtags: string[];
      keywords: string[];
      near_me: boolean;
      radius_m: number;
      within_hours: number;
    };

const KEYWORD_RE = /^[\p{L}\p{N}_\-·]+$/u;

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return dflt;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

function keywordsOf(v: unknown, max = 3): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const s = x.normalize("NFKC").trim();
    if (s === "" || [...s].length > 12 || !KEYWORD_RE.test(s)) continue;
    if (!out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length === max) break;
  }
  return out;
}

/** 計劃校驗：回「生效意圖（每類最多一個、最多 4 個）」＋被丟的片段。 */
export function sanitizePlan(raw: unknown): { intents: PlanIntent[]; dropped: string[] } {
  const dropped: string[] = [];
  const intents: PlanIntent[] = [];
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  for (const it of list) {
    if (typeof it !== "object" || it === null) continue;
    const r = it as Record<string, unknown>;
    const type = r.type;
    if (typeof type !== "string" || seen.has(type)) continue;
    if (type === "people") {
      const s = sanitizeCriteria(r.criteria ?? {});
      const g = dropNoisyGroups(s.criteria);
      dropped.push(...s.dropped);
      seen.add(type);
      intents.push({ type: "people", criteria: g.criteria });
    } else if (type === "places") {
      seen.add(type);
      intents.push({
        type: "places",
        keywords: keywordsOf(r.keywords),
        near_me: r.near_me !== false,
        radius_m: clampInt(r.radius_m, 200, 20_000, 3000),
        open_24h: r.open_24h === true,
        open_now: r.open_now === true,
      });
    } else if (type === "parties") {
      seen.add(type);
      const when = typeof r.when === "string" && (PARTY_WHENS as readonly string[]).includes(r.when) ? (r.when as PartyWhen) : null;
      intents.push({
        type: "parties",
        keywords: keywordsOf(r.keywords, 6).filter((k) => !PARTY_GENERIC.has(k.toLowerCase())).slice(0, 3),
        when,
        // 沒說「附近」就不限距離（1.79.0）
        near_me: r.near_me === true,
        radius_m: clampInt(r.radius_m, 200, 30_000, 5000),
      });
    } else if (type === "posts") {
      seen.add(type);
      const tags = (Array.isArray(r.tags) ? r.tags : []).filter((k): k is string => typeof k === "string" && groupOfKey(k) !== null).slice(0, 5);
      const hashtags: string[] = [];
      for (const h of Array.isArray(r.hashtags) ? r.hashtags : []) {
        const n = typeof h === "string" ? normalizeHashtag(h) : null;
        if (n !== null && !hashtags.some((x) => x.toLowerCase() === n.toLowerCase())) hashtags.push(n);
        if (hashtags.length === 5) break;
      }
      intents.push({
        type: "posts",
        tags: [...new Set(tags)],
        hashtags,
        keywords: keywordsOf(r.keywords),
        near_me: r.near_me === true,
        radius_m: clampInt(r.radius_m, 200, 30_000, 5000),
        within_hours: clampInt(r.within_hours, 1, 720, 168),
      });
    } else {
      dropped.push(`type:${type}`);
    }
    if (intents.length === PLAN_MAX_INTENTS) break;
  }
  return { intents, dropped: [...new Set(dropped)].slice(0, 5) };
}

/** 模型回覆解析：抠 JSON；非法拋錯（調用方 503 不扣次數）。 */
export function parsePlanReply(text: string): { intents: unknown; ignored: string[] } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("plan reply not json");
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("plan reply not json");
  }
  const ignored = Array.isArray(obj.ignored)
    ? (obj.ignored as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 5)
    : [];
  return { intents: obj.intents ?? [], ignored };
}

/** 系統提示：寫死規則＋少樣本（含「30 歲以下女生＋附近 24 小時酒吧」）。 */
export function searchPlanPrompt(peopleSchema: string): { system: string } {
  const shots = [
    `输入：帮我找到年龄在30岁以下的女生以及附近24小时内的酒吧\n输出：{"intents":[{"type":"people","criteria":{"gender":"female","age_max":29}},{"type":"places","keywords":["酒吧"],"near_me":true,"radius_m":3000,"open_24h":true}],"ignored":[]}`,
    `输入：今晚附近有咩酒局\n输出：{"intents":[{"type":"parties","when":"tonight","near_me":true}],"ignored":[]}`,
    `输入：想搵人一齊飲威士忌，同埋睇下大家飲過咩威士忌\n输出：{"intents":[{"type":"people","criteria":{"taste_keys":["whisky"]}},{"type":"posts","tags":["whisky"],"near_me":false}],"ignored":[]}`,
    `输入：香港仔有冇通宵嘅bar\n输出：{"intents":[{"type":"places","keywords":["香港仔","bar"],"near_me":false,"open_24h":true}],"ignored":[]}`,
    `输入：找一個暱稱為Chris的人\n输出：{"intents":[{"type":"people","criteria":{"nickname":"Chris"}}],"ignored":[]}`,
    `输入：找chris\n输出：{"intents":[{"type":"people","criteria":{"nickname":"chris"}}],"ignored":[]}`,
    `输入：搵阿明\n输出：{"intents":[{"type":"people","criteria":{"nickname":"阿明"}}],"ignored":[]}`,
    `输入：find Kelvin\n输出：{"intents":[{"type":"people","criteria":{"nickname":"Kelvin"}}],"ignored":[]}`,
    `输入：#微醺 嘅帖子\n输出：{"intents":[{"type":"posts","hashtags":["微醺"],"near_me":false}],"ignored":[]}`,
  ].join("\n");
  return {
    system: [
      "你是「遇見」智能搜索的意图解析器。输入是用户一句话（可能中英粤混说、口语），只输出一个 JSON 对象，其他一律不输出。",
      "把一句话拆成 1–4 个意图，每类最多一个：",
      "- people：找人。字段 criteria（白名单见下）。",
      "- places：找地点（酒吧／bar／pub／club 等）。字段 keywords（≤3 个，每个≤12 字，如店名/地区/类型）、near_me（说了附近/我这里才 true，指明地区则 false）、radius_m（200–20000，默认 3000）、open_24h（明说24小时/通宵/深夜不打烊才 true）、open_now（明说现在营业才 true）。",
      "- parties：找酒局（约酒的局）。字段 keywords、when（now|tonight|tomorrow|weekend|week）、near_me、radius_m。",
      "- posts：找别人发的打卡帖子。字段 tags（酒类 key，如 lager、japanese_whisky、whisky）、hashtags（用户说的 #标签，不带 #）、keywords、near_me、radius_m、within_hours（1–720，默认 168）。",
      "people 的 criteria 白名单：",
      peopleSchema,
      "硬规则：",
      "1. 只输出用户明确说过的需求；没提的类型一律不输出，不要硬凑。",
      "2. 拿不准是找人还是找地点时，两个都给。",
      "3. 年龄「X岁以下」→age_max=X-1；「X岁以上」→age_min=X+1；「X 岁左右」→X±3。",
      "4. 不支持的（外貌、身材、种族、宗教、性取向等敏感属性，以及无法映射的描述）丢弃并把原文片段记入 ignored（≤5）。",
      "5. 「找／搵／搜／find／search」后面直接跟一个像人名的词（英文名、人名、昵称，不是地区／酒吧类型／酒名），就是按昵称找人：people.criteria.nickname＝那个词（保留原样大小写），不要当成地点。",
      "示例：",
      shots,
      '输出形状：{"intents":[...], "ignored":["原文片段"]}',
    ].join("\n"),
  };
}

/**
 * 計劃接口的「進度流」（可選，向後兼容）：請求帶 `stream:true`（或 Accept: application/x-ndjson）時，
 * 回包改成逐行 JSON（NDJSON），每行一個事件，讓客戶端能顯示「AI 現在做到哪一步」：
 *  {"event":"stage","stage":"moderating"}    審核文字中
 *  {"event":"stage","stage":"understanding"} 理解並拆分條件中（LLM）
 *  {"event":"result","data":{intents,ignored,remaining_today}}   成功（與非流式的 200 回包同形）
 *  {"event":"error","code":"rejected|rate_limited|ai_unavailable|…","message":"…","status":403}  失敗
 * 沒帶 stream 的舊客戶端完全不受影響。校驗類錯誤（401／400）在開流之前就用普通 HTTP 狀態回。
 */
export type PlanStage = "moderating" | "understanding";

export type PlanStreamEvent =
  | { event: "stage"; stage: PlanStage }
  | { event: "result"; data: unknown }
  | { event: "error"; code: string; message: string; status: number };

export function planStreamLine(e: PlanStreamEvent): string {
  return `${JSON.stringify(e)}\n`;
}

export function wantsPlanStream(body: Record<string, unknown>, accept: string | null): boolean {
  return body.stream === true || (accept ?? "").toLowerCase().includes("application/x-ndjson");
}

/** 明显的地点／类型词：不当人名（「找 bar」「搵酒吧」） */
const NOT_NAMES = new Set([
  "bar", "bars", "pub", "pubs", "club", "clubs", "party", "parties", "nearby", "people", "friends",
  "wine", "beer", "whisky", "whiskey", "cocktail", "cocktails", "gin", "rum", "vodka", "tequila", "ipa", "lager",
  "stout", "ale", "sake", "soju", "highball",
]);

/**
 * 兜底（iOS DEF-20261126-026）：「找 chris／搵阿明／find Kelvin／找暱稱叫 X 的人」這類短句，
 * 模型偶爾把名字丢掉或当成地点。规则：明说「叫／暱稱／昵称」→ 取后面的词；否则只认拉丁字母开头的单词（避免把「找酒吧」当人名）。
 * 返回 null＝不是按昵称找人。纯函数，可单测。
 */
export function nicknameFromQuery(query: string): string | null {
  const q = query.trim().replace(/[。！？!?.，,]+$/u, "");
  // 「暱稱／名叫／叫做 X」直接認；單獨一個「叫」必須以「的人」收尾（免得「叫得出名」被當人名）
  const explicit =
    /(?:暱稱(?:為|是|叫)?|昵称(?:为|是|叫)?|nickname(?:\s+is)?|名叫|叫做)\s*[「“"']?([^\s「」“”"'的]{1,20})[」”"']?(?:\s*(?:的人|這個人|这个人))?$/iu.exec(q) ??
    /叫\s*[「“"']?([^\s「」“”"'的]{1,20})[」”"']?\s*(?:的人|這個人|这个人)$/u.exec(q);
  if (explicit !== null) return explicit[1];
  const m = /^(?:幫我|帮我|請|请)?\s*(?:找|搵|搜|尋找|寻找|find|search(?:\s+for)?|look\s+for)\s*(?:一個|一个|一位|個|个|位)?\s*([A-Za-z][A-Za-z0-9_.\-]{1,19})(?:\s*(?:的人|這個人|这个人))?$/iu.exec(q);
  if (m === null) return null;
  return NOT_NAMES.has(m[1].toLowerCase()) ? null : m[1];
}

/**
 * 计划里没有找人意图、句子又像按昵称找人：补一个 people.nickname 意图放最前。
 * 地点意图保留（「找 Soho／find Central」可能真是找地方，拿不准就两个都给，和 prompt 规则 2 一致）
 */
export function withNicknameFallback(intents: PlanIntent[], query: string): PlanIntent[] {
  // 模型有時給一個空條件的找人意圖：那等於沒認出人名，照樣補
  if (intents.some((i) => i.type === "people" && Object.keys(i.criteria).length > 0)) return intents;
  const nick = nicknameFromQuery(query);
  if (nick === null) return intents;
  const s = sanitizeCriteria({ nickname: nick });
  if (s.criteria.nickname === undefined) return intents;
  return [{ type: "people", criteria: s.criteria } as PlanIntent, ...intents.filter((i) => i.type !== "people")];
}

