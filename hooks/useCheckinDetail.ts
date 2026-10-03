"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * UR E.10 打卡面板数据钩（v2-only；读口 Batch4 GET 扩展，写口 like／want／rating）。
 * - detail 为空即加载中／失败（调用方骨架或藏行，不另起文案）。
 * - toggle 乐观 ±1，失败回滚＋重拉对账；全程 credentials 同源。
 */

export type CheckinDetail = {
  id: string;
  beer_name: string | null;
  rating: number | null;
  place_name: string | null;
  lat: number | null;
  lng: number | null;
  like_count: number;
  liked_by_me: boolean;
  want_count: number;
  wanted_by_me: boolean;
  comment_count: number;
};

type DetailRow = Record<string, unknown>;

function toDetail(row: DetailRow, id: string): CheckinDetail {
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const count = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  const rating = num(row.rating);
  return {
    id,
    beer_name: typeof row.beer_name === "string" ? row.beer_name : null,
    rating: rating !== null && Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    place_name: typeof row.place_name === "string" ? row.place_name : null,
    lat: num(row.lat),
    lng: num(row.lng),
    like_count: count(row.like_count),
    liked_by_me: row.liked_by_me === true,
    want_count: count(row.want_count),
    wanted_by_me: row.wanted_by_me === true,
    comment_count: count(row.comment_count),
  };
}

export function useCheckinDetail(checkinId: string | null): {
  detail: CheckinDetail | null;
  busy: boolean;
  toggleLike: () => void;
  toggleWant: () => void;
  rate: (rating: number | null) => void;
} {
  const [detail, setDetail] = useState<CheckinDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- checkinId 切换清旧帖属 props-sync（沿 ChatRoomLive 开房重置豁免口径）
    setDetail(null);
    if (checkinId === null) return;
    const my = ++seq.current;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/checkins/${encodeURIComponent(checkinId)}`, {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { checkin?: DetailRow };
        if (seq.current !== my || cancelled || typeof j.checkin !== "object" || j.checkin === null) return;
        setDetail(toDetail(j.checkin, checkinId));
      } catch {
        // 失败留空（调用方藏行，面板主体不炸；计数按钮稍后重挂即回）
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkinId]);

  const toggleLike = useCallback(() => {
    if (checkinId === null) return;
    setBusy(true);
    setDetail((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            liked_by_me: !prev.liked_by_me,
            like_count: Math.max(0, prev.like_count + (prev.liked_by_me ? -1 : 1)),
          },
    );
    void (async () => {
      try {
        const res = await fetch(`/api/v1/checkins/${encodeURIComponent(checkinId)}/like`, {
          method: "POST",
          credentials: "include",
        });
        const j = (await res.json().catch(() => null)) as {
          liked?: unknown;
          like_count?: unknown;
        } | null;
        if (!res.ok || typeof j?.liked !== "boolean") throw new Error("bad");
        setDetail((prev) =>
          prev === null
            ? prev
            : {
                ...prev,
                liked_by_me: j.liked as boolean,
                like_count:
                  typeof j.like_count === "number" && j.like_count >= 0
                    ? Math.floor(j.like_count)
                    : prev.like_count,
              },
        );
      } catch {
        // 回滚：重拉对账（单次，不循环）。
        try {
          const res = await fetch(`/api/v1/checkins/${encodeURIComponent(checkinId)}`, {
            credentials: "include",
          });
          const j = (await res.json()) as { checkin?: DetailRow };
          if (typeof j.checkin === "object" && j.checkin !== null) {
            setDetail(toDetail(j.checkin, checkinId));
          }
        } catch {}
      } finally {
        setBusy(false);
      }
    })();
  }, [checkinId]);

  const toggleWant = useCallback(() => {
    if (checkinId === null) return;
    setBusy(true);
    setDetail((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            wanted_by_me: !prev.wanted_by_me,
            want_count: Math.max(0, prev.want_count + (prev.wanted_by_me ? -1 : 1)),
          },
    );
    void (async () => {
      try {
        const res = await fetch(`/api/v1/checkins/${encodeURIComponent(checkinId)}/want`, {
          method: "POST",
          credentials: "include",
        });
        const j = (await res.json().catch(() => null)) as {
          wanted?: unknown;
          want_count?: unknown;
        } | null;
        if (!res.ok || typeof j?.wanted !== "boolean") throw new Error("bad");
        setDetail((prev) =>
          prev === null
            ? prev
            : {
                ...prev,
                wanted_by_me: j.wanted as boolean,
                want_count:
                  typeof j.want_count === "number" && j.want_count >= 0
                    ? Math.floor(j.want_count)
                    : prev.want_count,
              },
        );
      } catch {
        try {
          const res = await fetch(`/api/v1/checkins/${encodeURIComponent(checkinId)}`, {
            credentials: "include",
          });
          const j = (await res.json()) as { checkin?: DetailRow };
          if (typeof j.checkin === "object" && j.checkin !== null) {
            setDetail(toDetail(j.checkin, checkinId));
          }
        } catch {}
      } finally {
        setBusy(false);
      }
    })();
  }, [checkinId]);

  const rate = useCallback(
    (rating: number | null) => {
      if (checkinId === null) return;
      setBusy(true);
      void (async () => {
        try {
          const res = await fetch(`/api/v1/checkins/${encodeURIComponent(checkinId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ rating }),
          });
          const j = (await res.json().catch(() => null)) as { rating?: unknown } | null;
          if (!res.ok) throw new Error("bad");
          const v = j?.rating;
          setDetail((prev) =>
            prev === null
              ? prev
              : { ...prev, rating: typeof v === "number" ? v : null },
          );
        } catch {
          // 失败不翻 state（星星保持旧值，用户可再点）
        } finally {
          setBusy(false);
        }
      })();
    },
    [checkinId],
  );

  return { detail, busy, toggleLike, toggleWant, rate };
}
