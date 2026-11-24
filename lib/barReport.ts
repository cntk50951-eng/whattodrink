import { parseBarLang, type BarLang } from "./bartender";

/**
 * 舉報酒保 Ivy 的回覆（Google Play AI-Generated Content 政策：App 內要能舉報不當 AI 輸出；Apple 同理）。
 * 純函數（可單測）：清洗客戶端回包，壞形狀回 null；路由只負責鑑權、限頻與落庫。
 */

export const IVY_REPORT_REASONS = [
  "sexual",
  "minors",
  "harassment",
  "dangerous_drinking",
  "self_harm",
  "other",
] as const;

export type IvyReportReason = (typeof IVY_REPORT_REASONS)[number];

export const IVY_REPORT_PLATFORMS = ["ios", "aos", "unknown"] as const;
export type IvyReportPlatform = (typeof IVY_REPORT_PLATFORMS)[number];

export const IVY_REPORT_REPLY_MAX = 1000;
export const IVY_REPORT_USER_TEXT_MAX = 500;

export type IvyReportInput = {
  replyText: string;
  userText: string;
  reason: IvyReportReason;
  lang: BarLang;
  platform: IvyReportPlatform;
};

function isReason(v: unknown): v is IvyReportReason {
  return typeof v === "string" && (IVY_REPORT_REASONS as readonly string[]).includes(v);
}

function isPlatform(v: unknown): v is IvyReportPlatform {
  return typeof v === "string" && (IVY_REPORT_PLATFORMS as readonly string[]).includes(v);
}

/** reply_text 必填（被舉報的那句 Ivy 台詞）；reason 缺省／非法當 other；user_text 為前一句用戶輸入（可選，給審核還原語境）。 */
export function parseIvyReport(body: unknown): IvyReportInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const replyText = typeof b.reply_text === "string" ? b.reply_text.trim().slice(0, IVY_REPORT_REPLY_MAX) : "";
  if (replyText === "") return null;
  const userText = typeof b.user_text === "string" ? b.user_text.trim().slice(0, IVY_REPORT_USER_TEXT_MAX) : "";
  return {
    replyText,
    userText,
    reason: isReason(b.reason) ? b.reason : "other",
    lang: parseBarLang(b.lang),
    platform: isPlatform(b.platform) ? b.platform : "unknown",
  };
}
