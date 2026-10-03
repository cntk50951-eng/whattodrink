"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LoaderCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { CommentJson } from "@/lib/api/comments";
import { parseReplyTarget } from "@/lib/api/comments";
import { formatWantTime } from "@/lib/wantRecord";

/**
 * UR E.7 v2 留言區（自家 Sheet＋他人卡共用；MOCK／本地無 DB id 時不掛載）。
 * IG 式行：頭像圓（名首字／匿）＋名行（名＋作者章＋我標＋時間）＋正文；
 * 發送＝圓形圖標鈕（Send→轉圈），送出即樂觀 pending 行占位，回來轉正／失敗撤下。
 * 匿名展示 `匿名·短號`，登入展示暱稱（缺行回 `酒友·前4`）。
 * 刪除鍵全行可見但服務端把關（本人／帖作者才刪得掉，無 session 辨身份是 MVP 誠實口徑）。
 */
export function V2Comments({ checkinId, anchorId }: { checkinId: string; anchorId?: string }): React.JSX.Element {
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
  const sendSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // UR E.10：一层回复（文本约定零 migration）：填 `@名 ` 进框＋聚焦，发出即带名前缀；
  // 作者回即正文沿 E.7（作者章已在行上，对话感不靠 thread 结构）。

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
    await sendText(draft);
  };

  // UR E.10：快捷回复走同一发送核（限流／审核／乐观占位全沿用，不另起路径）。
  const sendText = async (raw: string): Promise<void> => {
    const text = raw.trim();
    if (text === "" || sending) return;
    setSending(true);
    setBanner(null);
    // 樂觀占位：先上 pulse 行（pending id 计数器唯一，同毫秒连点不重键，不進翻頁 cursor）。
    const pendingId = `pending-${++sendSeq.current}`;
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

  // UR E.10 回复（见 helpers 注释）：填 @名＋聚焦，发出即带名前缀。
  const replyTo = (c: CommentJson): void => {
    setDraft(`@${nameOf(c)} `);
    inputRef.current?.focus();
  };

  return (
    <div id={anchorId} className="flex scroll-mt-2 flex-col gap-2.5 border-t pt-3">
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
        <p className="text-sm text-muted-foreground">{t("commentEmptyGuide")}</p>
      ) : (
        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {comments.map((c, i) => {
            const pending = c.id.startsWith("pending-");
            // 一层回复归属：@名 取最近上文同名（零 migration 的对话感，见 E.10）。
            const target = pending ? null : parseReplyTarget(c.body);
            let nested = false;
            if (target !== null) {
              for (let j = i - 1; j >= 0; j--) {
                const pj = comments[j];
                if (!pj.id.startsWith("pending-") && nameOf(pj) === target) {
                  nested = true;
                  break;
                }
              }
            }
            const rest = nested && target !== null ? c.body.slice(target.length + 2) : c.body;
            return (
              <div
                key={c.id}
                className={`flex items-start gap-2.5 rounded-xl px-1 py-1 ${
                  nested ? "ml-12" : ""
                } ${
                  // 本人的行淡底（token 透明度，不新增色值）；pending 行呼吸占位。
                  c.is_mine ? "bg-primary/[0.05]" : ""
                } ${pending ? "motion-safe:animate-pulse" : ""}`}
              >
                <span
                  aria-hidden
                  className={`flex shrink-0 items-center justify-center rounded-full font-bold ${
                    nested ? "h-7 w-7 text-[11px]" : "h-11 w-11 text-sm"
                  } ${
                    c.is_author
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {avatarOf(c)}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 ${
                      nested ? "text-[13px]" : "text-[15px]"
                    }`}
                  >
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
                  <p
                    className={`break-words pt-0.5 leading-relaxed ${
                      nested ? "text-sm" : "text-[15px]"
                    }`}
                  >
                    {nested && target !== null && (
                      <span className="text-primary">@{target} </span>
                    )}
                    {rest}
                  </p>
                  {!pending && (
                    <button
                      type="button"
                      onClick={() => replyTo(c)}
                      className="mt-0.5 w-fit shrink-0 rounded px-1 py-0.5 text-xs text-muted-foreground opacity-70 transition-opacity hover:text-foreground hover:opacity-100 focus-visible:opacity-100"
                    >
                      {t("checkinReply")}
                    </button>
                  )}
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
      {/* UR E.10：吸底输入（sticky 贴面板滚动底；快捷一键走 sendText 同核；匿名提示缩一行）。 */}
      <div className="sticky bottom-0 z-10 -mb-1 bg-background/95 pt-2 pb-1 backdrop-blur">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[t("checkinWant"), t("checkinQuickWhere"), t("checkinQuickJoin")].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void sendText(q)}
              disabled={sending}
              className="shrink-0 rounded-full border px-4 py-1.5 text-[13px] text-muted-foreground transition-opacity hover:text-foreground disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <Input
            ref={inputRef}
            value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder={t("commentPlaceholder")}
          aria-label={t("commentPlaceholder")}
          maxLength={500}
          disabled={sending}
          className="h-14 min-w-0 flex-1 rounded-full px-5 text-base md:text-base"
        />
        {/* UR E.10：发送用原生 button（shadcn size-8 会和 h-14 打架，见本轮；语义 token 照用；提交走 form onSubmit）。 */}
        <button
          type="submit"
          disabled={sending || draft.trim() === ""}
          aria-label={t("commentSend")}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
        >
          {sending ? (
            <LoaderCircle size={20} aria-hidden className="size-5 motion-safe:animate-spin" />
          ) : (
            <Send size={20} aria-hidden className="size-5" />
          )}
        </button>
      </div>
      <p className="pt-1 text-xs text-muted-foreground">{t("commentAnonShort")}</p>
      </div>
    </div>
  );
}
