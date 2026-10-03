"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LoaderCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { CommentJson } from "@/lib/api/comments";
import { formatWantTime } from "@/lib/wantRecord";

/**
 * UR E.7 v2 留言區（自家 Sheet＋他人卡共用；MOCK／本地無 DB id 時不掛載）。
 * IG 式行：頭像圓（名首字／匿）＋名行（名＋作者章＋我標＋時間）＋正文；
 * 發送＝圓形圖標鈕（Send→轉圈），送出即樂觀 pending 行占位，回來轉正／失敗撤下。
 * 匿名展示 `匿名·短號`，登入展示暱稱（缺行回 `酒友·前4`）。
 * 刪除鍵全行可見但服務端把關（本人／帖作者才刪得掉，無 session 辨身份是 MVP 誠實口徑）。
 */
export function V2Comments({ checkinId }: { checkinId: string }): React.JSX.Element {
  const t = useTranslations("v2");
  const locale = useLocale();
  const [comments, setComments] = useState<CommentJson[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [arming, setArming] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (next: string | null, append: boolean) => {
      const my = ++seq.current;
      if (append) {
        setLoadingMore(true);
      } else {
        // 首屏（含切帖）：重置舊帖殘影再拉（effect 只調用本函數，不直寫 state）。
        setComments([]);
        setCursor(null);
        setBanner(null);
        setArming(null);
        setLoading(true);
      }
      try {
        const qs = new URLSearchParams({ limit: "20" });
        if (next !== null) qs.set("cursor", next);
        const res = await fetch(
          `/api/v1/checkins/${encodeURIComponent(checkinId)}/comments?${qs.toString()}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const j = (await res.json()) as {
          comments?: CommentJson[];
          nextCursor?: string | null;
        };
        if (seq.current !== my) return;
        if (append) {
          setComments((prev) => [...prev, ...((j.comments ?? []) as CommentJson[])]);
        } else {
          setComments((j.comments ?? []) as CommentJson[]);
        }
        setCursor(j.nextCursor ?? null);
      } catch {
        /* 列表失敗靜默（空態即視，不擋卡片主體） */
      } finally {
        if (seq.current === my) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [checkinId],
  );

  useEffect(() => {
    // mount 同步寫 state 撞 lint（UR3.0 同款）：microtask 包一層。
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load(null, false);
    });
    return () => {
      cancelled = true;
    };
  }, [checkinId, load]);

  const send = async (): Promise<void> => {
    const text = draft.trim();
    if (text === "" || sending) return;
    setSending(true);
    setBanner(null);
    // 樂觀占位：先上 pulse 行（pending id 本地唯一，不進翻頁 cursor）。
    const pendingId = `pending-${Date.now()}`;
    const optimistic: CommentJson = {
      id: pendingId,
      checkin_id: checkinId,
      body: text,
      status: "visible",
      created_at: new Date().toISOString(),
      author: { kind: "anon", tag: "…" },
      is_author: false,
      is_mine: true,
    };
    setComments((prev) => [optimistic, ...prev]);
    setDraft("");
    try {
      const res = await fetch(
        `/api/v1/checkins/${encodeURIComponent(checkinId)}/comments`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        },
      );
      const j = (await res.json()) as {
        comment?: CommentJson;
        error?: { code?: string; message?: string };
      };
      if (!res.ok || j.comment === undefined) {
        // 失敗撤占位＋行內 banner（422／403／503 直顯服務端文案，草稿已收進輸入框可改）。
        setComments((prev) => prev.filter((c) => c.id !== pendingId));
        setDraft(text);
        setBanner(j.error?.message ?? t("commentFailed"));
        return;
      }
      // 轉正：pending 行換真行（含服務端短號＋身份章）。
      setComments((prev) =>
        prev.map((c) => (c.id === pendingId ? (j.comment as CommentJson) : c)),
      );
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== pendingId));
      setDraft(text);
      setBanner(t("commentFailed"));
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    if (id.startsWith("pending-")) return;
    if (arming !== id) {
      setArming(id);
      return;
    }
    setArming(null);
    try {
      const res = await fetch(`/api/v1/comments/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) return;
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* 靜默；行還在即沒刪掉 */
    }
  };

  const nameOf = (c: CommentJson): string =>
    c.author.kind === "anon"
      ? `匿名·${c.author.tag}`
      : (c.author.name ?? `酒友·${c.author.user_id.slice(0, 4)}`);

  const avatarOf = (c: CommentJson): string =>
    c.author.kind === "anon" ? "匿" : (c.author.name ?? "酒").slice(0, 1);

  const timeOf = (c: CommentJson): string => {
    const ms = Date.parse(c.created_at);
    return Number.isFinite(ms) ? formatWantTime(ms, locale) : "";
  };

  return (
    <div className="flex flex-col gap-2.5 border-t pt-3">
      <p className="text-sm font-bold">
        {t("commentTitle")}
        {comments.length > 0 && (
          <span className="pl-1 font-normal text-muted-foreground">{comments.length}</span>
        )}
      </p>
      {loading ? (
        <div className="flex flex-col gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("commentEmpty")}</p>
      ) : (
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {comments.map((c) => {
            const pending = c.id.startsWith("pending-");
            return (
              <div
                key={c.id}
                className={`flex items-start gap-2 rounded-xl px-1 py-1.5 ${
                  // 本人的行淡底（token 透明度，不新增色值）；pending 行呼吸占位。
                  c.is_mine ? "bg-primary/[0.05]" : ""
                } ${pending ? "motion-safe:animate-pulse" : ""}`}
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    c.is_author
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {avatarOf(c)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                    <span className="truncate font-bold">{nameOf(c)}</span>
                    {/* DEF-20261003-001：作者章（all 人可见，小红书／IG 同款）＋本人「我」標。 */}
                    {c.is_author && (
                      <Badge variant="secondary" className="h-4 shrink-0 px-1 text-[10px] leading-none">
                        {t("commentAuthor")}
                      </Badge>
                    )}
                    {c.is_mine && !c.is_author && (
                      <span className="shrink-0 font-normal text-muted-foreground">
                        {t("commentMe")}
                      </span>
                    )}
                    {!pending && timeOf(c) !== "" && (
                      <span className="shrink-0 font-normal text-muted-foreground">
                        {timeOf(c)}
                      </span>
                    )}
                  </p>
                  <p className="break-words pt-0.5 text-sm leading-relaxed">{c.body}</p>
                </div>
                {!pending && (
                  <button
                    type="button"
                    onClick={() => void remove(c.id)}
                    aria-label={t("commentDelete")}
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground opacity-40 transition-opacity hover:text-destructive hover:opacity-100 focus-visible:opacity-100"
                  >
                    {arming === c.id ? t("commentDeleteConfirm") : "×"}
                  </button>
                )}
              </div>
            );
          })}
          {cursor !== null && (
            <Button
              variant="ghost"
              size="sm"
              disabled={loadingMore}
              onClick={() => void load(cursor, true)}
              className="self-center text-muted-foreground"
            >
              {loadingMore ? "…" : t("commentMore")}
            </Button>
          )}
        </div>
      )}
      {banner !== null && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-sm text-destructive">
          {banner}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder={t("commentPlaceholder")}
          aria-label={t("commentPlaceholder")}
          maxLength={500}
          disabled={sending}
          className="min-w-0 flex-1 rounded-full"
        />
        <Button
          size="icon"
          onClick={() => void send()}
          disabled={sending || draft.trim() === ""}
          aria-label={t("commentSend")}
          className="h-9 w-9 shrink-0 rounded-full"
        >
          {sending ? (
            <LoaderCircle size={16} aria-hidden className="motion-safe:animate-spin" />
          ) : (
            <Send size={16} aria-hidden />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("commentAnonHint")}</p>
    </div>
  );
}
