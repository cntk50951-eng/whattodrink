"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * UR E.12 打卡面板数据钩（v2-only；读口 GET 扩展，写口 like／want／ratings）。
 * - detail 为空即加载中／失败（调用方骨架或藏行，不另起文案）。
 * - toggle 乐观 ±1，失败回滚＋重拉对账；评分走 POST ratings（他人制），作者端只读。
 * - 全程 credentials 同源。
 */

/** 乾杯名单行（作者侧 recent；他人侧空数组，只看数）。 */
export type CheersRecentRow = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
};

export type CheckinDetail = {
  id: string;
  beer_name: string | null;
  /** 他人制平均（未舍入；展示层 formatAvgRating 取 1 位小数），无人评即 null。 */
  rating_avg: number | null;
  rating_count: number;
  rated_by_me: boolean;
  my_rating: number | null;
  /** 服务端判的作者身份（分支 prop 不可信，见 GET is_author）。 */
  is_author: boolean;
  cheers_count: number;
  cheers_recent: CheersRecentRow[];
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
  const avg = num(row.rating_avg);
  const my = num(row.my_rating);
  return {
    id,
    beer_name: typeof row.beer_name === "string" ? row.beer_name : null,
    rating_avg: avg !== null && avg >= 1 && avg <= 5 ? avg : null,
    rating_count: count(row.rating_count),
    rated_by_me: row.rated_by_me === true,
    my_rating:
      my !== null && Number.isInteger(my) && my >= 1 && my <= 5 ? my : null,
    is_author: row.is_author === true,
    cheers_count: count(row.cheers_count),
    cheers_recent: Array.isArray(row.cheers_recent)
      ? (row.cheers_recent as unknown[])
          .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
          .slice(0, 5)
          .map((r) => ({
            user_id: typeof r.user_id === "string" ? r.user_id : "",
            nickname: typeof r.nickname === "string" && r.nickname !== "" ? r.nickname : "酒友",
            avatar_url: typeof r.avatar_url === "string" ? r.avatar_url : null,
            created_at: typeof r.created_at === "string" ? r.created_at : "",
          }))
          .filter((r) => r.user_id !== "" && r.created_at !== "")
      : [],
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
  /** 首拉失败（!ok／抛错）即 true；切帖重置。调用方据此骨架→藏行，不无限骨架。 */
  failed: boolean;
  toggleLike: () => void;
  toggleWant: () => void;
  rate: (rating: number | null) => void;
  /** 重拉对账（敬酒 POST 后刷权威计数用；切帖竞态守卫沿首拉口径）。 */
  refresh: () => void;
} {
  const [detail, setDetail] = useState<CheckinDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- checkinId 切换清旧帖属 props-sync（沿 ChatRoomLive 开房重置豁免口径）
    setDetail(null);
    setFailed(false);
    if (checkinId === null) return;
    const my = ++seq.current;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/checkins/${encodeURIComponent(checkinId)}`, {
          credentials: "include",
        });
        if (!res.ok || cancelled) {
          if (!cancelled && seq.current === my) setFailed(!res.ok);
          return;
        }
        const j = (await res.json()) as { checkin?: DetailRow };
        if (seq.current !== my || cancelled) return;
        // 畸形包当失败（免无限骨架，沿 failed 藏行口径）。
        if (typeof j.checkin !== "object" || j.checkin === null) {
          setFailed(true);
          return;
        }
        setDetail(toDetail(j.checkin, checkinId));
      } catch {
        if (!cancelled && seq.current === my) setFailed(true);
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
      // 乐观：星星先跟本人值（失败重拉对账回滚，沿 toggle 口径）。
      const prevMine = { current: null as number | null };
      setDetail((prev) => {
        if (prev === null) return prev;
        prevMine.current = prev.my_rating;
        return {
          ...prev,
          my_rating: rating,
          rated_by_me: rating !== null,
        };
      });
      void (async () => {
        try {
          const res = await fetch(`/api/v1/checkins/${encodeURIComponent(checkinId)}/ratings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ rating }),
          });
          const j = (await res.json().catch(() => null)) as {
            rated?: unknown;
            my_rating?: unknown;
            rating_avg?: unknown;
            rating_count?: unknown;
          } | null;
          if (!res.ok) throw new Error("bad");
          const num = (v: unknown): number | null =>
            typeof v === "number" && Number.isFinite(v) ? v : null;
          const avg = num(j?.rating_avg);
          const my = num(j?.my_rating);
          setDetail((prev) =>
            prev === null
              ? prev
              : {
                  ...prev,
                  rated_by_me: j?.rated === true,
                  my_rating:
                    my !== null && Number.isInteger(my) && my >= 1 && my <= 5 ? my : null,
                  rating_avg: avg !== null && avg >= 1 && avg <= 5 ? avg : null,
                  rating_count:
                    typeof j?.rating_count === "number" && j.rating_count > 0
                      ? Math.floor(j.rating_count)
                      : 0,
                },
          );
        } catch {
          // 回滚＋重拉对账（作者 403 等硬拒亦走此路，星星回到旧值）。
          setDetail((prev) =>
            prev === null
              ? prev
              : {
                  ...prev,
                  my_rating: prevMine.current,
                  rated_by_me: prevMine.current !== null,
                },
          );
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
    },
    [checkinId],
  );

  const refresh = useCallback(() => {
    if (checkinId === null) return;
    const my = ++seq.current;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/checkins/${encodeURIComponent(checkinId)}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const j = (await res.json()) as { checkin?: DetailRow };
        if (seq.current !== my || typeof j.checkin !== "object" || j.checkin === null) return;
        setDetail(toDetail(j.checkin, checkinId));
      } catch {
        /* 静默；旧数留着，下次切帖重拉 */
      }
    })();
  }, [checkinId]);

  return { detail, busy, failed, toggleLike, toggleWant, rate, refresh };
}
