"use client";

import { useRef } from "react";

/**
 * DEF-20260926-009：好友關係會話緩存＋加好友（地圖卡／榜／詳情共用）。
 * - `isFriendCached`：`GET /friends/check?checkin_id`，命中緩存免再查；
 *   失敗回 null＝未知（調用方 fail-open）。
 * - `addFriendByCheckin`：`POST /friends {checkin_id}`（雙向 pending 即接受）；
 *   結果寫回緩存（accepted→true，pending→false）。
 */
export function useFriendRelation(): {
  isFriendCached: (checkinId: string) => Promise<boolean | null>;
  addFriendByCheckin: (
    checkinId: string,
  ) => Promise<"pending" | "accepted" | null>;
} {
  const cacheRef = useRef(new Map<string, boolean>());

  async function isFriendCached(checkinId: string): Promise<boolean | null> {
    const hit = cacheRef.current.get(checkinId);
    if (hit !== undefined) return hit;
    try {
      const res = await fetch(
        `/api/v1/friends/check?checkin_id=${encodeURIComponent(checkinId)}`,
        { cache: "no-store", credentials: "include" },
      );
      if (!res.ok) return null;
      const j = (await res.json()) as { is_friend?: unknown };
      const v = j.is_friend === true;
      cacheRef.current.set(checkinId, v);
      return v;
    } catch {
      return null;
    }
  }

  async function addFriendByCheckin(
    checkinId: string,
  ): Promise<"pending" | "accepted" | null> {
    try {
      const res = await fetch("/api/v1/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ checkin_id: checkinId }),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { status?: unknown };
      const st =
        j.status === "accepted"
          ? "accepted"
          : j.status === "pending"
            ? "pending"
            : null;
      if (st !== null) cacheRef.current.set(checkinId, st === "accepted");
      return st;
    } catch {
      return null;
    }
  }

  return { isFriendCached, addFriendByCheckin };
}
