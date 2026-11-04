/**
 * 遇見搜索的本地敏感詞兜底（成人／性交易類）。
 * 為什麼要有：審核鏈（OpenAI／Minimax）對「找炮友／約砲／包夜」這類短關鍵詞常判 PASS，
 * 而且沒配 key 或全掛時是直接放行（可用性優先）。這道詞表不依賴任何外部服務，先擋最明顯的。
 * 只做子串匹配（先 NFKC、轉小寫、去空白標點），寧可少擋也不要誤傷正常的「喝酒」搜索。
 */
const BLOCKED_TERMS = [
  // 繁／簡／粵：性交易、約炮、成人內容
  "約炮", "约炮", "約砲", "约砲", "炮友", "砲友", "一夜情", "一夜晴", "找女", "找妹", "叫雞", "叫鸡", "叫小姐",
  "包夜", "包養", "包养", "援交", "外圍", "外围", "上門服務", "上门服务", "全套服務", "全套服务", "做愛", "做爱",
  "性服務", "性服务", "裸聊", "色情", "成人影片", "成人视频", "av女優", "av女优", "開房", "开房", "打炮", "打砲",
  "fuckbuddy", "fwb", "hookup", "escort", "sexchat", "nudes", "onlyfans", "sugarbaby", "sugardaddy",
  "porn", "blowjob", "handjob", "threesome",
];

const STRIP = /[\s​-‍﻿.,，。、!！?？~～_\-—·•'"“”‘’()（）\[\]【】*#@]/g;

function normalize(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(STRIP, "");
}

const NORMALIZED = BLOCKED_TERMS.map(normalize);

/** 命中就回命中的詞（給日誌用，不回給用戶）；沒有回 null。 */
export function matchBlockedSearchTerm(query: string): string | null {
  const q = normalize(query);
  for (let i = 0; i < NORMALIZED.length; i++) {
    if (q.includes(NORMALIZED[i]!)) return BLOCKED_TERMS[i]!;
  }
  return null;
}
