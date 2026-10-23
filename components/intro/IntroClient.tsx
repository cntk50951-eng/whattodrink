"use client";

import dynamic from "next/dynamic";

// Remotion Player 只在瀏覽器端跑（用到 matchMedia／rAF），不做 SSR
const IntroPlayer = dynamic(() => import("./IntroPlayer"), { ssr: false });

export function IntroClient() {
  return <IntroPlayer />;
}
