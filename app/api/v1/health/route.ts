import { NextResponse } from "next/server";

import { resolveSupabaseEnv } from "@/lib/supabase/env";

/**
 * UR A.3 冒煙口： `{ok:true}`＋env 自檢（只報 key 名，不報值）。
 * 永遠 200——health 是給人看狀態的，不是第二個 fail fast；
 * 缺 key 時 `supabase.configured=false`＋`missing` 點名。
 */
export async function GET() {
  const { env, missing } = resolveSupabaseEnv();
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    supabase:
      env === null
        ? { configured: false, missing }
        : { configured: true, url: env.url },
  });
}
