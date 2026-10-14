/**
 * 游戏房聊天本地过滤（UR H.2 补丁，2026-10-14）：纯本地、同步、零外部调用（<1ms），默认开启。
 * 平时不走 AI 审核（成本／延迟），被举报时才由 AI 复核；本层只拦「明显的」，不追求穷尽。
 *
 * 能力：
 * - 英文：整词匹配（防 Scunthorpe：class／assassin／cocktail 不误伤）＋词形（-ing／-er／-ed…）＋
 *   叠字（fuuuck）＋夹符号／空格（f u c k／f.u.c.k／f*ck）＋数字符号替换（sh1t／$hit／@sshole）＋全角／零宽归一。
 * - 中文（繁／简／粤）：子串匹配，字间空格／标点不影响（屌 你 老 母）。
 * - 分级：block（严重：仇恨歧视、性骚扰、威胁）→ 拒发；mask（一般粗口）→ ★ 替换后照发。
 * - 白名单：酒名（Sex on the Beach 等）优先放行。
 * - 可选：站外联系方式拦截（URL／手机号／微信等）；env 追加词（GAME_CHAT_WORDLIST／GAME_CHAT_MASKLIST）。
 * 限制（诚实）：谐音／拆字／图片／多语混写绕过无法穷尽，靠举报＋AI 复核＋房主踢人兜底。
 */

export type ChatVerdict =
  | { action: "allow"; text: string }
  | { action: "mask"; text: string }
  | { action: "block"; reason: "severe" | "contact" };

export type ChatFilterOptions = {
  extraBlock?: string[];
  extraMask?: string[];
  blockContacts?: boolean;
  /** 词表过滤总开关（默认 true；false 时只做联系方式拦截）。 */
  wordFilter?: boolean;
};

// ---------- 词表 ----------

/** 英文严重词（整词）。 */
const LATIN_BLOCK_WORDS = [
  "nigger", "niggers", "faggot", "faggots", "chink", "chinks", "gook", "gooks", "spic", "spics",
  "kike", "kikes", "tranny", "trannies", "coon", "coons", "kys",
];

/** 英文严重短语（按归一化后的词序匹配）。 */
const LATIN_BLOCK_PHRASES = [
  "kill yourself", "go kill yourself", "go die", "kill your family", "rape you", "gonna rape",
  "will rape", "send nudes", "send me nudes", "nude pics", "nudes pls", "suck my dick", "suck my cock",
];

/** 英文一般粗口（词干；允许常见词尾）。 */
const LATIN_MASK_STEMS = [
  "fuck", "shit", "bitch", "bastard", "asshole", "arsehole", "dick", "dickhead", "cunt", "slut", "whore",
  "prick", "wanker", "twat", "bollocks", "motherfucker", "bullshit", "stfu", "retard", "retarded",
  "piss", "dumbass", "jackass", "douchebag",
];

/** 粤语／拼音粗口缩写（原样 token，不做词形）。 */
const SLANG_TOKENS_MASK = ["on9", "on99", "on999", "cnm", "nmsl", "tmd", "dllm", "dnlm"];

/** 中文严重词（繁简都列；子串匹配）。 */
const CJK_BLOCK = [
  "去死", "死全家", "殺你全家", "杀你全家", "強姦", "强奸", "輪姦", "轮奸", "約炮", "约炮", "援交", "裸照", "裸聊",
  "賣淫", "卖淫", "嫖妓", "砍死你",
];

/** 中文一般粗口（子串；繁简都列）。 */
const CJK_MASK = [
  "屌", "撚", "仆街", "扑街", "冚家", "屌你", "撚樣", "柒頭", "柒头",
  "他妈的", "他媽的", "妈的", "媽的", "你妈的", "你媽的", "操你", "草你", "肏", "艹", "傻逼", "傻屄", "煞筆", "煞笔",
  "婊子", "贱人", "賤人", "狗屎", "死八婆", "死八公",
];

/** 酒名白名单（命中则该片段不参与判定）。 */
const ALLOW_PHRASES = [
  "sex on the beach", "slippery nipple", "buttery nipple", "blow job", "blowjob", "screaming orgasm",
  "redheaded slut", "red headed slut", "cock sucking cowboy", "sloe comfortable screw",
  "slow comfortable screw", "dirty bastard", "angry balls", "naked and famous",
];

const SUFFIX = "(?:s|es|ed|er|ers|ing|in|y|head|heads|face)?";
const ZERO_WIDTH = /[​-‏⁠﻿­‪-‮]/g;
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };
const WILD = /[*#?]/;

function squeeze(s: string): string {
  return s.replace(/(.)\1+/g, "$1");
}

const STEM_RES = LATIN_MASK_STEMS.map((w) => new RegExp(`^${squeeze(w)}${SUFFIX}$`));
const STEM_RAW = LATIN_MASK_STEMS;

function norm(s: string): string {
  return s.normalize("NFKC").replace(ZERO_WIDTH, "");
}

// ---------- 分词 ----------

type Tok = { start: number; end: number; text: string };

/** 按空白和分隔符切词（保留 @ $ ! # * ? 在词内）；返回词在原串中的位置。 */
function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  const re = /[^\s.,;:"'()[\]{}<>/\\|~`^&%+=_\-]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    // 去掉词尾的标点（! ? * #）：shit! → shit；词内的保留
    let text = m[0];
    let end = m.index + text.length;
    while (/^[!?*#]$/.test(text.slice(-1)) && text.length > 1 && /[a-z0-9一-鿿]/i.test(text.slice(0, -1))) {
      text = text.slice(0, -1);
      end -= 1;
    }
    out.push({ start: m.index, end, text });
  }
  return out;
}

function hasLetters(t: string): boolean {
  return /[a-z]/i.test(t);
}

function leet(t: string): string {
  if ((t.match(/[a-z]/gi) ?? []).length < 2) return t;
  return t.replace(/[0134578@$!]/g, (c) => LEET[c] ?? c);
}

/** 连续 ≥3 个单字母词（f u c k／f.u.c.k）并成一个词。 */
function mergeSpaced(toks: Tok[], s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < toks.length) {
    let j = i;
    while (j < toks.length && /^[a-z]$/i.test(toks[j].text) && (j === i || /^[\s.\-_]+$/.test(s.slice(toks[j - 1].end, toks[j].start)))) j += 1;
    if (j - i >= 3) {
      out.push({ start: toks[i].start, end: toks[j - 1].end, text: toks.slice(i, j).map((t) => t.text).join("") });
      i = j;
    } else {
      out.push(toks[i]);
      i += 1;
    }
  }
  return out;
}

function wildMatch(token: string, entry: string): boolean {
  if (token.length !== entry.length) return false;
  for (let i = 0; i < token.length; i += 1) {
    if (WILD.test(token[i])) continue;
    if (token[i] !== entry[i]) return false;
  }
  return true;
}

type Class = "block" | "mask" | null;

function classifyLatin(tokenLower: string, extraBlock: string[], extraMask: string[]): Class {
  const cands = new Set<string>([tokenLower]);
  if (hasLetters(tokenLower)) cands.add(leet(tokenLower));
  for (const c of cands) {
    if (c.length < 2) continue;
    if (WILD.test(c)) {
      // 含通配符：与同长度词条逐字比对
      const pool = [...LATIN_BLOCK_WORDS, ...extraBlock];
      if (pool.some((w) => wildMatch(c, w))) return "block";
      const maskPool = [...STEM_RAW, ...SLANG_TOKENS_MASK, ...extraMask];
      if (maskPool.some((w) => wildMatch(c, w))) return "mask";
      continue;
    }
    const sq = squeeze(c);
    if (LATIN_BLOCK_WORDS.some((w) => squeeze(w) === sq) || extraBlock.some((w) => squeeze(w) === sq)) return "block";
    if (SLANG_TOKENS_MASK.includes(c)) return "mask";
    if (STEM_RES.some((re) => re.test(sq))) return "mask";
    if (extraMask.some((w) => squeeze(w) === sq)) return "mask";
  }
  return null;
}

// ---------- 联系方式 ----------

const CONTACT_RE = /(https?:\/\/|www\.|\+?\d[\d\s-]{7,}\d|wechat|微信|line\s*id|telegram|tg\s*:|whatsapp|ig\s*:|instagram)/i;

// ---------- 主函数 ----------

function stripForCjk(s: string): string {
  return s.replace(/[^㐀-鿿豈-﫿]/g, "");
}

export function filterChatText(raw: string, opts: ChatFilterOptions = {}): ChatVerdict {
  const extraBlock = (opts.extraBlock ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const extraMask = (opts.extraMask ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const base = norm(raw);

  if (opts.blockContacts === true && CONTACT_RE.test(base)) return { action: "block", reason: "contact" };
  if (opts.wordFilter === false) return { action: "allow", text: raw };

  // 匹配副本：把白名单酒名按等长空格抹掉（位置不变）
  let match = base;
  for (const phrase of ALLOW_PHRASES) {
    const re = new RegExp(`\\b${phrase.replace(/ /g, "\\s+")}\\b`, "gi");
    match = match.replace(re, (m) => " ".repeat(m.length));
  }
  const lower = match.toLowerCase();

  // —— 英文／拼音 ——
  const toks = mergeSpaced(tokenize(lower), lower);
  const maskSpans: Tok[] = [];
  for (const t of toks) {
    const cls = classifyLatin(t.text, extraBlock.filter((w) => !/[㐀-鿿]/.test(w)), extraMask.filter((w) => !/[㐀-鿿]/.test(w)));
    if (cls === "block") return { action: "block", reason: "severe" };
    if (cls === "mask") maskSpans.push(t);
  }
  // 短语：归一化成单空格词序后匹配
  const phraseText = ` ${toks.map((t) => squeeze(leet(t.text))).join(" ")} `;
  for (const p of LATIN_BLOCK_PHRASES) {
    if (phraseText.includes(` ${p.split(" ").map(squeeze).join(" ")} `)) return { action: "block", reason: "severe" };
  }

  // —— 中文 ——
  const cjk = stripForCjk(match);
  const cjkBlock = [...CJK_BLOCK, ...extraBlock.filter((w) => /[㐀-鿿]/.test(w))];
  if (cjkBlock.some((w) => cjk.includes(w))) return { action: "block", reason: "severe" };
  const cjkMask = [...CJK_MASK, ...extraMask.filter((w) => /[㐀-鿿]/.test(w))];
  const cjkHits = cjkMask.filter((w) => cjk.includes(w));

  if (maskSpans.length === 0 && cjkHits.length === 0) return { action: "allow", text: raw };

  // —— 打码 ——
  let out = base;
  // 从后往前替换，位置不乱
  for (const sp of [...maskSpans].sort((a, b) => b.start - a.start)) {
    const seg = out.slice(sp.start, sp.end);
    out = out.slice(0, sp.start) + seg.replace(/[A-Za-z0-9@$!#*?]/g, "★") + out.slice(sp.end);
  }
  // 长词优先（屌你 先于 屌），否则短词先替换会把长词拆散
  for (const w of [...cjkHits].sort((x, y) => y.length - x.length)) {
    const re = new RegExp([...w].join("[\\s\\p{P}\\p{S}]*"), "gu");
    out = out.replace(re, (m) => "★".repeat([...m.replace(/[\s\p{P}\p{S}]/gu, "")].length));
  }
  return { action: "mask", text: out };
}

/** env 逗号列表解析（GAME_CHAT_WORDLIST／GAME_CHAT_MASKLIST）。 */
export function parseWordEnv(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((w) => w.trim()).filter((w) => w !== "");
}

/** 总开关：默认开；GAME_CHAT_FILTER=off 才关（排障用）。 */
export function chatFilterEnabled(env: string | undefined): boolean {
  return env !== "off";
}
