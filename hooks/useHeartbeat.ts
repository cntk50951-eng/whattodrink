"use client";

import { useCallback, useEffect, useRef } from "react";

import { haversineMeters } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import { HEARTBEAT_MIN_MOVE_M } from "@/lib/presence";

/** 心跳週期（沿 UR3.3 30s 口徑；問答定案）。 */
export const HEARTBEAT_MS = 30_000;

/**
 * UR A.21 心跳上報：登入＋非隱身＋有定位＋頁面可見才跑；
 * 30s 一次＋位移>50m 才 POST（省電＋省寫；stealth 由 enabled 門擋，
 * server 另有 403 雙保險）。失敗靜默（下輪補）。
 */
export function useHeartbeat(opts: {
  enabled: boolean;
  position: LatLng | null;
}): void {
  const { enabled, position } = opts;
  const lastSent = useRef<LatLng | null>(null);
  const stateRef = useRef({ enabled, position });
  useEffect(() => {
    stateRef.current = { enabled, position };
  });

  const beat = useCallback(() => {
    const { enabled: on, position: pos } = stateRef.current;
    if (!on || pos === null) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    const prev = lastSent.current;
    if (prev !== null && haversineMeters(prev, pos) < HEARTBEAT_MIN_MOVE_M) return;
    lastSent.current = pos;
    void fetch("/api/v1/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ lat: pos.lat, lng: pos.lng }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [enabled, beat]);
}
