import { createServiceClient } from "@/lib/supabase/server";
import { purgeExpired } from "@/lib/accountDeletion";

/**
 * UR I.3 排程：清到期（>30 天）的注销账号（文件＋登录账号，快照置空）。
 * 仅供 Vercel Cron 调用（vercel.json）：Vercel 会带 `Authorization: Bearer $CRON_SECRET`；
 * 未配 CRON_SECRET 一律拒绝（不对公网开放）。不在 /api/v1 契约内。
 */
export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret === undefined || secret.length < 16) {
    return Response.json({ error: "cron not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const svc = await createServiceClient();
    const r = await purgeExpired(svc, new Date());
    return Response.json(r);
  } catch (err) {
    console.error(`[purge-accounts] ${err instanceof Error ? err.message : "unknown"}`);
    return Response.json({ error: "purge failed" }, { status: 500 });
  }
}
