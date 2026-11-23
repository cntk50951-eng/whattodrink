import { redirect } from "next/navigation";

import { adminGate } from "@/lib/ops";
import { safeOpsNext } from "@/lib/opsPage";
import { OpsLoginForm } from "./OpsLoginForm";

export const metadata = { robots: { index: false, follow: false } };

/**
 * 後台專用登入入口：當 SITE_LIVE=false（/login 被擋回 /coming-soon）或瀏覽器會話過期時，
 * 管理員可由此建立 Supabase cookie 會話；登入後仍須通過 admins 白名單＋Authenticator TOTP（/innerharbour/mfa），
 * 非管理員帳號登入後訪問任何後台頁依然 404。
 */
export default async function OpsLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeOpsNext(next ?? "/innerharbour/notices");
  const g = await adminGate({ skipMfa: true });
  if (g.ok) {
    redirect(`/innerharbour/mfa?next=${encodeURIComponent(target)}`);
  }
  return (
    <main style={{ maxWidth: 420, margin: "64px auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Hi Drink 管理後台登入</h1>
      <p style={{ fontSize: 13.5, color: "#4b5563", marginTop: 8, lineHeight: 1.5 }}>
        請先登入管理員帳號，隨後將進入 Authenticator 二次驗證。
      </p>
      <OpsLoginForm nextPath={target} />
    </main>
  );
}
