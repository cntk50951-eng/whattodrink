import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * UR A.7 Google OAuth 回調：`?code=`＋`?next=` → 換 session → 回站內。
 * 沿 `@supabase/ssr@0.12` 服務端配方（型別實證見 memory A.7）：
 * server client 的 cookie getAll／setAll 在 Route Handler 可寫，
 * exchange 成功即種下 httpOnly session，後續 middleware 照常刷新。
 * 無 code／換失敗→回登入頁帶錯，不報 500（用户可重試）。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  if (code === null) {
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error !== null) {
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
