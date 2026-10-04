"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Beer, MoreHorizontal } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatWantTime } from "@/lib/wantRecord";
import styles from "./v2.module.css";

type MailPeer = { user_id: string; nickname: string; avatar_url: string | null };
type ReceivedItem = {
  id: string;
  from: MailPeer;
  checkin_id: string | null;
  message: string | null;
  created_at: string;
  seen: boolean;
  mutual: boolean;
  is_friend: boolean;
};
type SentItem = {
  id: string;
  to: MailPeer;
  checkin_id: string | null;
  message: string | null;
  created_at: string;
  reciprocal: boolean;
  is_friend: boolean;
};

function AvatarMini({ name, url }: { name: string; url: string | null }) {
  if (url !== null && /^https?:\/\//.test(url)) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground"
    >
      {name.slice(0, 1)}
    </span>
  );
}

function timeOf(locale: string, iso: string): string {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? formatWantTime(ms, locale) : "";
}

/**
 * UR E.15 乾杯信箱（v2-only；收到／送出双籤，卡片只放摘要，记录不依赖帖寿命）。
 * 数据沿 inbox／sent（mutual／is_friend 服务端一次算好，不 N+1）；
 * 动作：回敬（POST /cheers to_user）／成為好友（POST /friends）／解除（DELETE，
 * accepted→pending 两段确认）／屏蔽／舉報；做完即 refresh 重拉。
 */
export function CheersMailbox({
  open,
  stealth,
  onClose,
  onRead,
}: {
  open: boolean;
  /** 隐身即温和提示（不强推，沿评审口径）。 */
  stealth: boolean;
  onClose: () => void;
  /** 读数变化（标已读／新动作后刷新 Bell 用，调用方 refreshCheers）。 */
  onRead: () => void;
}) {
  const t = useTranslations("v2");
  const locale = useLocale();
  const [tab, setTab] = useState<"in" | "out">("in");
  const [received, setReceived] = useState<ReceivedItem[]>([]);
  const [sent, setSent] = useState<SentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [arming, setArming] = useState<string | null>(null);
  // UR E.10：相对时间锚点（render 内禁 Date.now impure，mount 快照一次，沿列表页口径）。
  const [nowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const [iRes, sRes] = await Promise.all([
        fetch("/api/v1/cheers/inbox?limit=20", { credentials: "include" }),
        fetch("/api/v1/cheers/sent?limit=20", { credentials: "include" }),
      ]);
      if (iRes.ok) {
        const j = (await iRes.json()) as { items?: ReceivedItem[] };
        if (Array.isArray(j.items)) setReceived(j.items);
      }
      if (sRes.ok) {
        const j = (await sRes.json()) as { items?: SentItem[] };
        if (Array.isArray(j.items)) setSent(j.items);
      }
    } catch {
      /* 列表失败静默（空态即视，不挡地图主体，沿 V2Comments 口径） */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 开门重置 tab＋重拉属 props-sync（沿开房重置豁免口径）
    setTab("in");
    void load();
  }, [open, load]);

  const act = async (key: string, fn: () => Promise<Response>, doneMsg?: string): Promise<void> => {
    if (busy !== null) return;
    setBusy(key);
    setBanner(null);
    try {
      const res = await fn();
      if (!res.ok) throw new Error("bad");
      await load();
      onRead();
      if (doneMsg !== undefined) setBanner(doneMsg);
    } catch {
      /* 失败静默留行（用户可再点，不吞记录，沿乐观失败口径） */
    } finally {
      setBusy(null);
    }
  };

  const toastBack = (uid: string): Promise<Response> =>
    fetch("/api/v1/cheers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ to_user_id: uid }),
    });

  const befriend = (uid: string): Promise<Response> =>
    fetch("/api/v1/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ friend_id: uid }),
    });

  const unfriend = (uid: string): Promise<Response> =>
    fetch("/api/v1/friends", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ friend_id: uid }),
    });

  const block = (uid: string): Promise<Response> =>
    fetch("/api/v1/cheers/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ blocked_id: uid }),
    });

  const report = (uid: string): Promise<Response> =>
    fetch("/api/v1/cheers/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ target_user_id: uid }),
    });

  const sentStatus = (s: SentItem): string => {
    if (s.is_friend) return t("mailStFriended");
    if (s.reciprocal) return t("mailStReciprocated");
    if (nowMs - Date.parse(s.created_at) > 24 * 3600_000) return t("mailStNoReply");
    return t("mailStSent");
  };

  const rows = tab === "in" ? received : sent;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <div aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-1.5">
            <Beer size={16} aria-hidden className="text-primary" />
            {t("mailTitle")}
          </SheetTitle>
          <SheetDescription>{stealth ? t("mailStealthHint") : ""}</SheetDescription>
        </SheetHeader>
        <div role="tablist" aria-label={t("mailTitle")} className="grid shrink-0 grid-cols-2 rounded-full border border-border bg-muted p-1">
          {(["in", "out"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`rounded-full px-2 py-1.5 text-sm font-bold ${tab === k ? "bg-card shadow" : "text-muted-foreground"}`}
            >
              {k === "in" ? t("mailReceived") : t("mailSent")}
            </button>
          ))}
        </div>
        {banner !== null && (
          <p role="status" className="rounded-lg bg-primary/[0.08] px-2.5 py-1.5 text-sm text-primary">
            {banner}
          </p>
        )}
        {loading ? (
          <div className="flex flex-col gap-2" aria-hidden>
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("mailEmpty")}</p>
        ) : (
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {tab === "in"
              ? (rows as ReceivedItem[]).map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                    <AvatarMini name={r.from.nickname} url={r.from.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <span className="font-bold">{r.from.nickname}</span>
                        <span className="pl-1.5 text-xs text-muted-foreground">{timeOf(locale, r.created_at)}</span>
                      </p>
                      {r.message !== null && r.message !== "" && (
                        <p className="truncate text-xs text-muted-foreground">“{r.message}”</p>
                      )}
                      {r.checkin_id === null && (
                        <p className="text-xs text-muted-foreground">{t("mailGone")}</p>
                      )}
                      {r.mutual && !r.is_friend && (
                        <button
                          type="button"
                          onClick={() => void act(`be-${r.id}`, () => befriend(r.from.user_id))}
                          disabled={busy !== null}
                          className="mt-0.5 w-fit rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
                        >
                          {t("mailBefriend")}
                        </button>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void act(`back-${r.id}`, () => toastBack(r.from.user_id))}
                        disabled={busy !== null}
                        className="shrink-0 rounded-full border border-primary px-2.5 py-1 text-xs text-primary disabled:opacity-50"
                      >
                        {t("cheersBack")}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={t("checkinMore")}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal size={14} aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={styles.v2scope}>
                          <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => void act(`bl-${r.id}`, () => block(r.from.user_id), t("mailBlocked"))}>
                              {t("mailBlock")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void act(`rp-${r.id}`, () => report(r.from.user_id), t("mailReported"))}>
                              {t("mailReport")}
                            </DropdownMenuItem>
                            {r.is_friend && (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  if (arming === r.id) {
                                    setArming(null);
                                    void act(`un-${r.id}`, () => unfriend(r.from.user_id));
                                  } else {
                                    setArming(r.id);
                                  }
                                }}
                              >
                                {arming === r.id ? t("mailUnfriendConfirm") : t("mailUnfriend")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              : (rows as SentItem[]).map((s) => (
                  <div key={s.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                    <AvatarMini name={s.to.nickname} url={s.to.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <span className="font-bold">{s.to.nickname}</span>
                        <span className="pl-1.5 text-xs text-muted-foreground">{timeOf(locale, s.created_at)}</span>
                      </p>
                      {s.message !== null && s.message !== "" && (
                        <p className="truncate text-xs text-muted-foreground">“{s.message}”</p>
                      )}
                      <p className="text-xs text-muted-foreground">{sentStatus(s)}</p>
                    </div>
                    {!s.is_friend && s.reciprocal && (
                      <button
                        type="button"
                        onClick={() => void act(`be-${s.id}`, () => befriend(s.to.user_id))}
                        disabled={busy !== null}
                        className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
                      >
                        {t("mailBefriend")}
                      </button>
                    )}
                  </div>
                ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
