"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import type { UserMode } from "@/lib/mode";

/** UR A.16 隱身守衛動作（引導文案按動作區分）。 */
export type GuardAction = "checkin" | "cheers" | "invite" | "like" | "photo";

type ModePromptProps = {
  open: boolean;
  action: GuardAction;
  /** 觸發守衛時 viewer 的模式（決定文案與選項矩陣；null 走 fail-open 雙鈕）。 */
  mode: UserMode | null;
  /** 切換模式（父層接 hook 的 patchMode）；回 true 即關層。 */
  onSwitch: (mode: UserMode) => Promise<boolean>;
  /** 切換成功後（關層前）回調：父層用來恢復被守衛收起的卡。 */
  onSwitched?: (mode: UserMode) => void;
  onClose: () => void;
  /**
   * UR A.19 引導好友感知：所選對象的 checkin id（地圖卡／榜／詳情皆有；
   * camera 無 target 不傳）。有則查關係，非好友隱藏好友鈕。
   */
  targetCheckinId?: string | null;
  /**
   * DEF-20260926-009：加好友（父層調 `POST /friends`）；回 status，
   * null＝失敗。缺省不渲染加鈕。
   */
  onAddFriend?: (checkinId: string) => Promise<"pending" | "accepted" | null>;
  /** 加好友成功後回調（公開邀約用來自發後續動作；其餘场景可不管）。 */
  onFriendAdded?: () => void;
};

const ACTION_KEYS: Record<GuardAction, string> = {
  checkin: "actCheckin",
  cheers: "actCheers",
  invite: "actInvite",
  like: "actLike",
  photo: "actPhoto",
};

/** 好友感知態：unknown（含 checking 中）一律 fail-open，交後端守衛兜底。 */
type FriendState = "unknown" | "checking" | "friend" | "nonfriend";

type AddState = "idle" | "sent" | "accepted";

/**
 * UR A.16 隱身攔截浮層（沿 stealthPrompt doodle 卡＋硬陰影＋膠帶配方，
 * 多一鍵切換鈕）＋ A.19 好友感知 ＋ DEF-009 模式×關係矩陣。
 * portal＋z1100 保頂（DEF-008，逃出一切 stacking context）。
 */
export function ModePrompt({
  open,
  action,
  mode,
  onSwitch,
  onSwitched,
  onClose,
  targetCheckinId,
  onAddFriend,
  onFriendAdded,
}: ModePromptProps) {
  const t = useTranslations("mode");
  const [busy, setBusy] = useState(false);
  const [failedOp, setFailedOp] = useState<"switch" | "add" | null>(null);
  const [friendState, setFriendState] = useState<FriendState>("unknown");
  const [addState, setAddState] = useState<AddState>("idle");
  useEffect(() => {
    if (!open || targetCheckinId == null) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setFriendState("checking");
        // 開層／換對象即重置加態，免舊 sent 殘留串台
        setAddState("idle");
      }
    });
    void fetch(`/api/v1/friends/check?checkin_id=${encodeURIComponent(targetCheckinId)}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const j = (await res.json()) as { is_friend?: unknown };
        if (!cancelled) setFriendState(j.is_friend === true ? "friend" : "nonfriend");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, targetCheckinId]);

  if (!open) return null;

  const isNonfriend = friendState === "nonfriend";
  // 按鈕矩陣（DEF-009＋修正）：切換鈕只在 stealth／friends 出現；
  // 加鈕只在已知非好友；全空（防禦）回退雙切換。公開乾杯直過不開層，
  // 故此層無需 proceed 鈕（邀約由 onFriendAdded 續發）。
  const showPublic = mode === "stealth" || mode === "friends";
  const showFriends = (mode === "stealth" || mode === "friends") && !isNonfriend;
  const showAdd =
    targetCheckinId != null && isNonfriend && onAddFriend != null;
  const fallbackDual = !showPublic && !showFriends && !showAdd;

  const doSwitch = (next: UserMode): void => {
    if (busy) return;
    setBusy(true);
    setFailedOp(null);
    void onSwitch(next).then((ok) => {
      setBusy(false);
      if (ok) {
        onSwitched?.(next);
        onClose();
      } else setFailedOp("switch");
    });
  };

  const doAddFriend = (): void => {
    if (busy || targetCheckinId == null || onAddFriend == null) return;
    setBusy(true);
    setFailedOp(null);
    void onAddFriend(targetCheckinId).then((st) => {
      setBusy(false);
      if (st === null) {
        setFailedOp("add");
      } else if (st === "accepted") {
        // 對方加過我：即成好友，關係態同步翻轉，選項跟著變對
        setAddState("accepted");
        setFriendState("friend");
        onFriendAdded?.();
      } else {
        setAddState("sent");
        onFriendAdded?.();
      }
    });
  };

  const title =
    mode === "friends"
      ? t("guardTitleFriend")
      : mode === "public"
        ? t("guardTitlePublic")
        : t("guardTitle");
  const body =
    mode === "friends"
      ? t("guardBodyFriend", { action: t(ACTION_KEYS[action]) })
      : mode === "public"
        ? t("guardBodyPublic", { action: t(ACTION_KEYS[action]) })
        : t("guardBody", { action: t(ACTION_KEYS[action]) });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // DEF-20260926-008：portal 逃出一切 stacking context＋z 壓過全站浮層
      //（錨定卡／榜 z-1000、kindChooser z-998），守衛層永遠最上。
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        role="document"
        className="relative w-full max-w-sm rounded-2xl border-2 bg-card p-6 pt-7 shadow-[4px_4px_0_var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 bg-(--tape)" />
        <p className="font-hand text-center text-xl font-bold">{title}</p>
        <p className="text-muted-foreground mt-2 text-center text-sm leading-relaxed">
          {body}
        </p>
        <div
          className={`mt-5 grid gap-2 ${showFriends || fallbackDual ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {(showPublic || fallbackDual) && (
            <button
              type="button"
              onClick={() => void doSwitch("public")}
              disabled={busy}
              className="font-hand rounded-full border-2 bg-primary px-4 py-2.5 text-base font-bold text-primary-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
            >
              {busy ? t("switching") : t("switchPublic")}
            </button>
          )}
          {(showFriends || fallbackDual) && (
            <button
              type="button"
              onClick={() => void doSwitch("friends")}
              disabled={busy}
              className="font-hand rounded-full border-2 bg-card px-4 py-2.5 text-base font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
            >
              {busy ? t("switching") : t("switchFriends")}
            </button>
          )}
          {showAdd && (
            <button
              type="button"
              onClick={doAddFriend}
              disabled={busy || addState !== "idle"}
              className="font-hand rounded-full border-2 bg-card px-4 py-2.5 text-base font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
            >
              {addState === "accepted"
                ? t("becameFriends")
                : addState === "sent"
                  ? t("addFriendSent")
                  : busy
                    ? t("switching")
                    : t("addFriend")}
            </button>
          )}
        </div>
        {isNonfriend && mode !== "public" && (
          <p className="text-muted-foreground mt-3 text-center text-xs">
            {t("nonFriendNote")}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="font-hand mt-2 w-full rounded-full px-4 py-1.5 text-sm font-bold text-muted-foreground"
        >
          {t("cancel")}
        </button>
        {failedOp !== null && (
          <p role="alert" className="mt-2 text-center text-xs font-bold text-red-600">
            {failedOp === "add" ? t("addFriendFailed") : t("switchFailed")}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
