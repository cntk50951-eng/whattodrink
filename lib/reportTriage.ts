/**
 * 舉報 AI 分流（iOS DEF-20261125-020〜024；用戶 2026-11-25 定案，純函數可單測）：
 * - 高置信違規（OpenAI 最高類別分數 ≥ REPORT_AUTO_ACTION_MIN）→ 系統直接處分
 * - 高置信無違規（分數 ≤ REPORT_AUTO_DISMISS_MAX、未被標記）→ 系統結案，通知舉報人「未發現違規」
 * - 其餘一律人工：中間分數、AI 判斷不了的理由（垃圾訊息／未成年／其他）、沒內容可審、
 *   OpenAI 不可用（Minimax 兜底沒有分數，不據此自動結案或處分）
 * 人工案件由呼叫端寄郵件到 support。
 */
import type { ModerationChainResult } from "./moderation";

export const REPORT_AUTO_ACTION_MIN = 0.85;
export const REPORT_AUTO_DISMISS_MAX = 0.1;

/** AI（內容審核模型）能判斷的理由；null＝舊客戶端沒選理由，按內容判斷。 */
const AI_JUDGEABLE_REASONS = new Set(["harassment", "inappropriate"]);

export type ReportAiDecision = "auto_actioned" | "auto_dismissed" | "human";
export type ReportRouteReason =
  | "high_confidence"
  | "low_confidence"
  | "reason_needs_human"
  | "ai_unavailable"
  | "no_content";

export type ReportRoute = {
  decision: ReportAiDecision;
  reason: ReportRouteReason;
  /** 0–1；只有 OpenAI 給分時有值 */
  score: number | null;
  categories: string[];
};

export function routeReport(args: { reasonCode: string | null; verdict: ModerationChainResult | null }): ReportRoute {
  const v = args.verdict;
  const categories = v !== null && v.flagged ? v.categories : [];
  const score = v !== null && "score" in v && typeof v.score === "number" ? v.score : null;
  const human = (reason: ReportRouteReason): ReportRoute => ({ decision: "human", reason, score, categories });

  if (args.reasonCode !== null && !AI_JUDGEABLE_REASONS.has(args.reasonCode)) return human("reason_needs_human");
  if (v === null) return human("ai_unavailable");
  if ("skipped" in v && v.skipped) return human(v.reason === "no-input" ? "no_content" : "ai_unavailable");
  // 只有 OpenAI 有分數；Minimax 兜底（無分數）一律交人工
  if (score === null || v.via !== "openai") return human("ai_unavailable");
  if (score >= REPORT_AUTO_ACTION_MIN) return { decision: "auto_actioned", reason: "high_confidence", score, categories };
  if (!v.flagged && score <= REPORT_AUTO_DISMISS_MAX) return { decision: "auto_dismissed", reason: "high_confidence", score, categories };
  return human("low_confidence");
}

/** 分流原因的後台／郵件說明（中文，給管理員看） */
export const REPORT_ROUTE_REASON_TEXT: Record<ReportRouteReason, string> = {
  high_confidence: "AI 高置信",
  low_confidence: "AI 置信度不足",
  reason_needs_human: "此舉報理由需人工判斷",
  ai_unavailable: "AI 審核暫不可用",
  no_content: "沒有可供 AI 審核的內容",
};

/** 用戶／訊息舉報：從證據快照取被舉報人說的話給 AI 審（帖子另有原文） */
export function reportedTextFromSnapshot(snapshot: unknown): string {
  if (!Array.isArray(snapshot)) return "";
  return snapshot
    .filter((l): l is { who: string; text: string } => typeof l === "object" && l !== null && (l as { who?: unknown }).who === "reported" && typeof (l as { text?: unknown }).text === "string")
    .map((l) => l.text.trim())
    .filter((t) => t !== "")
    .join("\n");
}
