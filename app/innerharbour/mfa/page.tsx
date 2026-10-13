import { notFound } from "next/navigation";

import { adminGate } from "@/lib/ops";
import { safeOpsNext } from "@/lib/opsPage";

import MfaPanel from "./MfaPanel";

export const metadata = { robots: { index: false, follow: false } };

/**
 * 管理員 TOTP 註冊／驗證頁。只有 admins 白名單內的人可見（其他人 404，與不存在無異）；
 * 這一頁本身不要求 aal2（否則永遠進不來），驗證成功後會話升到 aal2，其他後台頁才放行。
 */
export default async function OpsMfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const g = await adminGate({ skipMfa: true });
  if (!g.ok) notFound();
  const { next } = await searchParams;
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 480 }}>
      <h1>管理員二次驗證</h1>
      <MfaPanel next={safeOpsNext(next)} />
    </main>
  );
}
