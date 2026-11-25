/**
 * 寄信給客服信箱（Resend REST API，不加 npm 依賴；2026-11-25 依 https://resend.com/docs/api-reference/emails/send-email）：
 * `POST https://api.resend.com/emails`，`Authorization: Bearer RESEND_API_KEY`，body {from,to,subject,text}，
 * `Idempotency-Key`（24 小時內同 key 不重寄，≤256 字）。寄件網域必須已在 Resend 驗證，否則 403。
 *
 * 環境變量：RESEND_API_KEY（必）、SUPPORT_EMAIL_TO（默認 support@whattodrink.app）、
 * SUPPORT_EMAIL_FROM（默認 WhatToDrink <noreply@whattodrink.app>）、NEXT_PUBLIC_SITE_URL（後台連結基址）。
 */
import { REPORT_ROUTE_REASON_TEXT, type ReportRouteReason } from "../reportTriage";

export const RESEND_ENDPOINT = "https://api.resend.com/emails";
export const SUPPORT_EMAIL_TO_DEFAULT = "support@whattodrink.app";
export const SUPPORT_EMAIL_FROM_DEFAULT = "WhatToDrink <noreply@whattodrink.app>";
export const SITE_URL_DEFAULT = "https://www.whattodrink.app";

const TARGET_LABEL: Record<string, string> = { post: "帖子", user: "用戶", message: "聊天訊息" };
const REASON_LABEL: Record<string, string> = {
  harassment: "騷擾",
  inappropriate: "不當內容",
  spam: "垃圾訊息／廣告",
  underage: "疑似未成年",
  other: "其他",
};

export type ReportEmailInput = {
  reportId: string;
  targetType: string;
  reasonCode: string | null;
  reasonText: string | null;
  targetName: string | null;
  routeReason: ReportRouteReason;
  score: number | null;
  categories: string[];
  siteUrl?: string;
};

/** 純組裝（可單測）：人工審核通知信的主旨與正文。不放舉報人身份與證據原文（信箱不是安全的存證處），只給後台連結。 */
export function buildReportEmail(i: ReportEmailInput): { subject: string; text: string } {
  const base = (i.siteUrl ?? SITE_URL_DEFAULT).replace(/\/$/, "");
  const target = TARGET_LABEL[i.targetType] ?? i.targetType;
  const reason = i.reasonCode !== null ? (REASON_LABEL[i.reasonCode] ?? i.reasonCode) : "未選";
  const scoreText = i.score === null ? "無（AI 未給分）" : i.score.toFixed(2);
  const subject = `[待人工審核] ${target}舉報・${reason}・${i.reportId.slice(0, 8)}`;
  const lines = [
    `有一宗舉報需要人工審核。`,
    ``,
    `案件：${i.reportId}`,
    `類型：${target}${i.targetName !== null ? `（被舉報人：${i.targetName}）` : ""}`,
    `理由：${reason}`,
    i.reasonText !== null && i.reasonText.trim() !== "" ? `補充：${i.reasonText.trim().slice(0, 200)}` : null,
    `轉人工原因：${REPORT_ROUTE_REASON_TEXT[i.routeReason]}`,
    `AI 分數：${scoreText}${i.categories.length > 0 ? `（${i.categories.join(", ")}）` : ""}`,
    ``,
    `處理：${base}/innerharbour/user-reports/${i.reportId}`,
  ].filter((l): l is string => l !== null);
  return { subject, text: lines.join("\n") };
}

export type SendResult = { ok: true; id: string | null } | { ok: false; status: number | null; error: string };

/** 寄信；沒設 RESEND_API_KEY 直接回失敗（不拋），呼叫端記日誌並保留可重寄狀態。 */
export async function sendSupportEmail(
  mail: { subject: string; text: string },
  opts: { idempotencyKey: string; apiKey?: string; to?: string; from?: string; fetchFn?: typeof fetch },
): Promise<SendResult> {
  const apiKey = opts.apiKey ?? process.env.RESEND_API_KEY;
  if (apiKey === undefined || apiKey === "") return { ok: false, status: null, error: "missing RESEND_API_KEY" };
  const doFetch = opts.fetchFn ?? fetch;
  try {
    const res = await doFetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": opts.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: opts.from ?? process.env.SUPPORT_EMAIL_FROM ?? SUPPORT_EMAIL_FROM_DEFAULT,
        to: [opts.to ?? process.env.SUPPORT_EMAIL_TO ?? SUPPORT_EMAIL_TO_DEFAULT],
        subject: mail.subject,
        text: mail.text,
      }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = JSON.stringify(await res.json()).slice(0, 300);
      } catch {
        // 回包不是 JSON：只記狀態碼
      }
      return { ok: false, status: res.status, error: detail || `resend ${res.status}` };
    }
    const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
    return { ok: true, id: typeof body?.id === "string" ? body.id : null };
  } catch (err) {
    return { ok: false, status: null, error: err instanceof Error ? err.message : "network error" };
  }
}
