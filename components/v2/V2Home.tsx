"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dices,
  Expand,
  EyeOff,
  Flame,
  Footprints,
  Globe,
  LoaderCircle,
  LocateFixed,
  LogOut,
  Map as MapIcon,
  MapPin,
  Martini,
  MoreHorizontal,
  Radar,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  Users,
  Vibrate,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { V2Comments } from "@/components/v2/V2Comments";
import { FriendPicker, ShareDoneDialog } from "@/components/v2/FriendPicker";
import { CheckinDetailExtra } from "@/components/v2/CheckinDetailExtra";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useMyMode } from "@/hooks/useMyMode";
import { useFriendRelation } from "@/hooks/useFriendRelation";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { useLiveFriends } from "@/hooks/useLiveFriends";
import { useChatBell } from "@/hooks/useChatBell";
import { V2FriendCard } from "./V2FriendCard";
import { V2RevealOverlay } from "./V2RevealOverlay";
import { revealPhotoAt, revealPhotoCount } from "@/components/drinks/gallery";
import { pickRandomIndex } from "@/lib/reveal";
import { LOGOUT_CLEAR_EVENT, clearUserLocalCaches } from "@/lib/auth/clear";
import { displayName } from "@/lib/auth/profile";
import { setActivePeer } from "@/lib/chatPeer";
import { formatSeenAgo } from "@/lib/chat";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_CENTER,
  HK_BOUNDS,
  formatDistance,
  haversineMeters,
  isWithinHongKong,
} from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import { resolveCityCode } from "@/lib/city";
import { groupHeatCells, orderHeatCellsTour, summarizeHeatCell, connectedCellIds } from "@/lib/heatmap";
import type { HeatCell } from "@/lib/heatmap";
import { areaOf } from "@/lib/geoAreas";
import {
  BEER_CATEGORIES,
  beerByName,
  fetchBeers,
  pickNextBatch,
  pickRandomBatch,
  pickSwapBatch,
  resolveFreshBeer,
} from "@/lib/beers";
import type { Beer } from "@/lib/beers";
import {
  canCheers,
  cheersRemaining,
  loadSentToday,
  saveSentToday,
} from "@/lib/cheers";
import { MOCK_CHECKINS } from "@/lib/checkins";
import { toMineRow, mineRowToWantRecord } from "@/lib/api/checkins";
import type { PinJson } from "@/lib/api/pins";
import {
  loadWantHistory,
  removeWantAt,
  saveWantHistory,
  swapWantBeer,
  upsertWantHistory,
  formatWantCoords,
  formatWantTime,
} from "@/lib/wantRecord";
import type { WantRecord } from "@/lib/wantRecord";
import { MOCK_ME, parseGender } from "@/lib/me";
import type { Gender } from "@/lib/me";
import { trailStops, parseTrailResume, readTrailFlag, writeTrailFlag, TRAIL_ON_KEY, STOPS_OPEN_KEY } from "@/lib/trail";
import { iconForDrinkName, iconForPickId } from "@/components/marketing/beer-icons/wall";
import { WallIcon } from "@/components/marketing/beer-icons/doodle";
import { hasUnseenWall, loadWall, loadWallSeenAt } from "@/lib/posts";
import { buzz, BUZZ_CHEERS, BUZZ_FOUND } from "@/lib/haptics";
import { V2MapView } from "./V2MapView";
import type { V2MapApi } from "./V2MapView";
import { V2CameraSheet } from "./V2CameraSheet";
import type { PublishResult, PublishShot } from "./V2CameraSheet";
import { apiPinsToMarkers, mockToMarkers } from "./v2Pins";
import type { V2Marker } from "./v2Pins";
import styles from "./v2.module.css";

/** UR2.0 mock 性別標記文案 key（三態，數據源見 lib/me.ts；沿 v1 DrinkMap 同表）。 */
const GENDER_KEY = {
  male: "genderMale",
  female: "genderFemale",
  secret: "genderSecret",
} as const;

/** GPS 抖動凍結門檻（米）：小於此的 watch 更新不進 state，圖層不重建。 */
const SELF_UPDATE_MIN_M = 10;

/** v2 卡片正規形（api／mock 兩源歸一，卡片只認此形）。 */
type V2Card =
  | {
      kind: "other";
      id: string;
      title: string;
      sub: string;
      emoji: string;
      drink: string;
      online: boolean;
      lat: number;
      lng: number;
      /** UR C.10：真頭像（api avatarUrl，無則首字圓回退；MOCK 走 avatarEmoji）。 */
      avatarUrl: string | null;
      /** UR C.10：MOCK emoji 頭像（api 源為 null）。 */
      avatarEmoji: string | null;
      /** UR C.10：三態（api 自由串經 parseGender，MOCK 直用）。 */
      gender: Gender;
      /** UR C.10：打卡時間 epoch ms（無則不渲染時間行）。 */
      checkedInAt: number | null;
    };

type GuardState = {
  action: "checkin" | "cheers" | "invite";
  target: string | null;
} | null;

type FriendState = "unknown" | "checking" | "friend" | "nonfriend";

/**
 * UR C.3：品牌圖 skeleton（animate-pulse 佔位＋onLoad 淡入＋壞圖回 emoji）。
 * 純 Tailwind，無新依賴（Skeleton 裝不上，見 C.3）。模塊級組件，state 獨立。
 * UR A.20 本地優先：已畫品牌走本地 SVG（`iconForPickId` 按 id，
 * `iconForDrinkName` 按名兜底；瞬時零加載態），無本地圖才走舊鏈。
 * UR A.20 round-2：`tall` 給主角位（Sheet hero）用——本地 3:4 豎幅圖不再擠進
 * 正方框（meet 留白致視覺過小），skeleton／img 舊鏈保持正方不動。
 * UR A.20 round-3：選酒 L2＋換酒格全切 `tall`（三列不動，格子長高吃滿幅；
 * emoji／img 舊鏈同框跟長，字號同步放大一檔）。
 */
function BeerImg({ beer, tall = false }: { beer: Beer; tall?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  const frame = tall ? "aspect-[3/4]" : "aspect-square";
  const Local = iconForPickId(beer.id) ?? iconForDrinkName(beer.name);
  if (Local !== null) {
    // size-full 而非 h-full w-full：shadcn Button 自帶 `[&_svg:not([class*='size-'])]:size-4`
    // reset（無 size- 類的 svg 一律壓成 16px，專治圖標按鈕）；有 size- 即豁免。
    return (
      <span aria-hidden className={`flex w-full items-center justify-center ${frame}`}>
        <WallIcon Icon={Local} className="size-full" />
      </span>
    );
  }
  const src = beer.icon_url ?? null;
  if (src === null || src === "" || broken) {
    return (
      <span aria-hidden className={`flex w-full items-center justify-center ${frame} ${tall ? "text-4xl" : "text-3xl"}`}>
        {beer.emoji}
      </span>
    );
  }
  return (
    <span className={`relative flex w-full items-center justify-center ${frame}`}>
      {!loaded && (
        <span aria-hidden className="absolute inset-0 animate-pulse rounded-md bg-muted" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setBroken(true)}
        className={`h-full w-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}

/**
 * UR C.1 v2 首頁（Snap Map 式）：全屏原生地圖＋頂欄＋橫滑 pills＋
 * 右緣工具列＋底部 CTA 列＋五格 tab bar。全部新文件；邏輯只吃共用層
 * （lib／hooks／API），v1 組件一個不用。行為與 v1 一致
 * （守衛／限額／時效），皮是 shadcn。
 */
export function V2Home() {
  const t = useTranslations("map");
  const tn = useTranslations("nav");
  const tm = useTranslations("mode");
  const t2 = useTranslations("v2");
  const locale = useLocale();
  const router = useRouter();

  // UR A.21：watch 常開（心跳要活位置；副作用是自釘跟人走，沿 v1 live-follow 口徑）。
  const { status: geoStatus, position: geoPos } = useGeolocation({ watch: true });
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  // UR C.16：頭像資料（auth user_metadata；匿名 null 沿舊圖標）。
  const [profile, setProfile] = useState<{
    name: string;
    avatarUrl: string | null;
  } | null>(null);
  const { mode, patchMode } = useMyMode(isAuthed === true);
  const { isFriendCached, addFriendByCheckin } = useFriendRelation();
  const mapApi = useRef<V2MapApi | null>(null);

  // UR A.21 呈現態：匿名沿舊／未知 fail-closed 走隱身（心跳＋好友全停，先保隱私再談閃爍）。
  const presence: "online" | "stealth" | "anon" =
    isAuthed !== true ? "anon" : mode === "public" || mode === "friends" ? "online" : "stealth";
  useHeartbeat({
    enabled: presence === "online",
    position: geoStatus === "success" ? geoPos : null,
  });
  const { friends: liveFriends } = useLiveFriends(presence === "online");
  // UR D.4：好友列表入口（C.17 friendsOnly 地圖獨顯模式退役，見下）。
  const [friendCardId, setFriendCardId] = useState<string | null>(null);
  function goChatList(): void {
    router.push(locale === "zh-Hant" ? "/v2/chat" : `/${locale}/v2/chat`);
  }
  // UR C.18：打卡提交中（冒泡罩開關＋連點守衛；ref 防同 tick 連點，state 驅 UI）。
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // 初始中心：首個定位 fix 飛我一次（C.11 fitHk 之後不再搶鏡頭）。
  const centeredRef = useRef(false);
  useEffect(() => {
    if (centeredRef.current || geoStatus !== "success" || geoPos === null) return;
    centeredRef.current = true;
    mapApi.current?.flyTo(geoPos);
  }, [geoStatus, geoPos]);

  const [apiPins, setApiPins] = useState<PinJson[]>([]);
  const [apiPinsLoaded, setApiPinsLoaded] = useState(false);
  const [wantHistory, setWantHistory] = useState<WantRecord[]>([]);
  const [, setBeerTick] = useState(0);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [invites, setInvites] = useState<Partial<Record<string, "sent" | "accepted">>>({});
  const [card, setCard] = useState<V2Card | null>(null);
  // UR E.2：他人三件套詳情（開卡按需拉；403／空即無，不擋卡片本體）。
  const [otherDetail, setOtherDetail] = useState<{
    photoUrl: string | null;
    note: string | null;
    audioUrl: string | null;
    audioSeconds: number | null;
    /** 服务端作者身份（管理菜单按此出，不按分支，见 UR E.13）。 */
    isAuthor: boolean;
  } | null>(null);
  const otherDetailFor = useRef<string | null>(null);
  // UR E.11：三件套在飛旗（開拉置真、落定／失敗／切卡置假；id 守衛防串卡，失敗不清旗即無限骨架）。
  const [otherDetailLoading, setOtherDetailLoading] = useState(false);
  const [trailOn, setTrailOn] = useState(false);
  // UR E.6 热点模式开关（开即全纳＋无字＋纯热斑；再点退出复原，镜头不动）。
  const [heatMode, setHeatMode] = useState(false);
  // UR C.11：一鍵足跡——登入浮層開關／地圖 ready tick／?trail=1 續跑 intent／目錄 Sheet。
  const [trailLoginOpen, setTrailLoginOpen] = useState(false);
  const [stopsOpen, setStopsOpen] = useState(false);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const resumeTrailRef = useRef(false);
  const [wallDot, setWallDot] = useState(false);

  // 選酒 sheet 三段：cats → batch → kinds → login（匿名）
  const [pickOpen, setPickOpen] = useState(false);
  // UR C.22 揭曉 overlay（取代 Sheet：霓虹點即此頁；舊鏈保留給 pills 退路）
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealIdx, setRevealIdx] = useState(0);
  const [pickStage, setPickStage] = useState<"cats" | "batch" | "kinds" | "login">("cats");
  const [laneId, setLaneId] = useState<string | null>(null);
  const [batch, setBatch] = useState<Beer[]>([]);
  const [kindBeer, setKindBeer] = useState<Beer | null>(null);

  // 守衛 sheet（stealth 全攔；friends／public 非好友邀約攔；乾杯除隱身直過）
  const [guard, setGuard] = useState<GuardState>(null);
  const [friendState, setFriendState] = useState<FriendState>("unknown");
  const [addState, setAddState] = useState<"idle" | "sent" | "accepted">("idle");

  // UR C.4 自打卡底部 Sheet：按記錄 at 認正在看的條；換酒批／刪除確認隨層開關
  const [wantSheetAt, setWantSheetAt] = useState<number | null>(null);
  // DEF-20260929-006：换卡回顶（开卡／换卡即滚顶；detail 到达不触发，不打断阅读；
  // 放 state 声明后，沿 tsc 先声明后使用）。
  useEffect(() => {
    const key = card !== null && card.kind === "other" ? card.id : wantSheetAt;
    if (key === null) return;
    const raf = requestAnimationFrame(() => {
      document
        .getElementById("wtd-checkin-sheet")
        ?.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [card, wantSheetAt]);
  // UR C.14 round-2：+N 堆疊列表 Sheet（同點超 cap 組的成員 id，含代表）。
  const [stackIds, setStackIds] = useState<string[] | null>(null);
  // UR E.3：相機一页流直发（shot 随参，无 staged 中转；酒可空）。
  const [cameraOpen, setCameraOpen] = useState(false);
  // UR C.11 round-3：詳情返回目錄（目錄來才記 "stops"；地圖釘直開為 null 不帶返回鈕）。
  const [wantReturnTo, setWantReturnTo] = useState<"stops" | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapBatch, setSwapBatch] = useState<Beer[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // UR E.13 round-2：分享完成去留（成功者 uid＋失败数；单人直进房，多人进列表）。
  const [shareDone, setShareDone] = useState<{ ok: string[]; failed: number } | null>(null);
  const [otherConfirmDelete, setOtherConfirmDelete] = useState(false);
  const [shareTarget, setShareTarget] = useState<{
    checkinId: string;
    snippet: string;
    place: string;
    lat: number | null;
    lng: number | null;
  } | null>(null);

  // 輕提示（添加好友佔位／搖一搖空結果），定時自散，卸載清場
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    };
  }, []);
  function flashNote(text: string): void {
    setNote(text);
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 2500);
  }
  // UR E.10：相对时间锚点（render 内禁 Date.now impure，mount 快照一次，沿列表页口径）。
  const [nowMs] = useState(() => Date.now());
  // UR D.5：好友列表 pill 角标（用户定案 2026-10-03：任何模式都提醒，只挡匿名；
  // 未读>0 才显，点进列表看红点；新消息即轻提示一下）。
  const { total: bellTotal } = useChatBell(isAuthed === true, () => {
    flashNote(t2("chatBellNew"));
  });
  // UR D.5 round-4：有未读即好友列表 pill 定时抖（到達／反白先抖一次，之后每 5s
  // 抖 0.9s；读完即停；set-state-in-effect 沿 UR1.8 microtask 配方，
  // reduced-motion 由 CSS 全关）。
  const [pillShake, setPillShake] = useState(false);
  const hasUnread = isAuthed === true && bellTotal > 0;
  useEffect(() => {
    if (!hasUnread) {
      void Promise.resolve().then(() => setPillShake(false));
      return;
    }
    let alive = true;
    let offTimer: number | null = null;
    const shakeOnce = (): void => {
      setPillShake(true);
      if (offTimer !== null) window.clearTimeout(offTimer);
      offTimer = window.setTimeout(() => setPillShake(false), 950);
    };
    void Promise.resolve().then(() => {
      if (alive) shakeOnce();
    });
    const iv = window.setInterval(() => {
      if (alive) shakeOnce();
    }, 5000);
    return () => {
      alive = false;
      window.clearInterval(iv);
      if (offTimer !== null) window.clearTimeout(offTimer);
    };
  }, [hasUnread, bellTotal]);

  // 登入態＋牆紅點＋酒目錄＋乾杯額度（mount 各一次，沿既有配方）
  // UR C.16：頭像資料同源 auth（沿 v1 HeaderAuth 口徑：metadata 取名＋圖）。
  useEffect(() => {
    const supabase = createClient();
    const syncProfile = (user: {
      email?: string | null;
      user_metadata?: unknown;
    } | null): void => {
      setIsAuthed(user !== null);
      if (user === null) {
        setProfile(null);
        return;
      }
      const md = (user.user_metadata ?? {}) as Record<string, unknown>;
      const av = md.avatar_url;
      setProfile({
        name: displayName(md, user.email ?? null),
        avatarUrl: typeof av === "string" ? av : null,
      });
    };
    supabase.auth
      .getUser()
      .then(({ data }) => syncProfile(data.user))
      .catch(() => syncProfile(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      syncProfile(s?.user ?? null),
    );
    void Promise.resolve().then(() => {
      setWallDot(hasUnseenWall(loadWall(), loadWallSeenAt()));
      setSentIds(loadSentToday(new Date()));
    });
    void fetchBeers().then(() => setBeerTick((n) => n + 1));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const handler = (): void => {
      setWantHistory([]);
      setCard(null);
      setOtherDetail(null);
      setOtherDetailLoading(false);
      otherDetailFor.current = null;
      setSentIds([]);
      setInvites({});
      setGuard(null);
      setPickOpen(false);
      // UR C.11：登出關足跡＋登入浮層＋目錄（本地匿名態不留殘影）。
      setTrailOn(false);
      setTrailLoginOpen(false);
      setStopsOpen(false);
      setWantReturnTo(null);
    };
    window.addEventListener(LOGOUT_CLEAR_EVENT, handler);
    return () => window.removeEventListener(LOGOUT_CLEAR_EVENT, handler);
  }, []);

  // 想喝史：匿名讀本地；登入讀 DB（沿 A.10 以 DB 為準）
  // 同步寫包 microtask（set-state-in-effect 規則，沿 UR1.8 配方）。
  useEffect(() => {
    if (isAuthed === false) {
      void Promise.resolve().then(() => setWantHistory(loadWantHistory()));
    }
  }, [isAuthed]);
  useEffect(() => {
    if (isAuthed !== true) return;
    void fetch("/api/v1/checkins/mine?limit=30", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { checkins?: unknown };
        const rows = Array.isArray(json.checkins) ? json.checkins : [];
        const parsed: WantRecord[] = [];
        for (const r of rows) {
          const row = toMineRow(r);
          if (row === null) continue;
          const rec = mineRowToWantRecord(row);
          if (rec !== null) parsed.push(rec);
        }
        parsed.sort((a, b) => a.at - b.at);
        setWantHistory(parsed);
      })
      .catch(() => {});
  }, [isAuthed]);

  // UR E.13：聊天房「查看完整」深鏈（`/v2?checkin={id}`；pins 到即自開＋清參防重開）。
  // 读 window.location（effect 内，免 useSearchParams 的預渲染 Suspense 門）。
  const jumpDoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!apiPinsLoaded || typeof window === "undefined") return;
    const cid = new URLSearchParams(window.location.search).get("checkin");
    if (cid === null || cid === "" || jumpDoneRef.current === cid) return;
    if (!apiPins.some((p) => p.id === cid)) return;
    jumpDoneRef.current = cid;
    openPin(cid);
    window.history.replaceState(null, "", window.location.pathname);
  }, [apiPinsLoaded, apiPins]);

  // 他人 pins：真數據優先，非空替 MOCK（沿 A.13 配方；C.1 固定 7d＋all）
  useEffect(() => {
    let cancelled = false;
    const bbox = `${HK_BOUNDS.west},${HK_BOUNDS.south},${HK_BOUNDS.east},${HK_BOUNDS.north}`;
    void fetch(`/api/v1/map/pins?bbox=${encodeURIComponent(bbox)}&range=7d&limit=100&scope=all`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as { pins?: PinJson[] };
        if (cancelled) return;
        setApiPins(Array.isArray(j.pins) ? j.pins : []);
        setApiPinsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setApiPins([]);
        setApiPinsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const useApi = apiPinsLoaded && apiPins.length > 0;
  const others = useMemo(
    () => (useApi ? apiPinsToMarkers(apiPins) : mockToMarkers()),
    [useApi, apiPins],
  );
  const wants = useMemo(
    () =>
      // UR C.4＋A.20：釘圖與 Sheet 同源（resolveFreshBeer 目錄取新，換酒即換釘圖）；
      // 本地 SVG 組件一併帶下（地圖 createRoot 注入），無圖回 img／emoji 舊鏈
      wantHistory.map((w) => {
        // UR E.3：无酒打卡钉走照片主视觉（📷 通用钉，无品牌图链）。
        const fresh = w.beer === null ? null : resolveFreshBeer(w.beer);
        return {
          id: `want-${w.at}`,
          lat: w.position.lat,
          lng: w.position.lng,
          emoji: fresh === null ? "📷" : fresh.emoji,
          iconUrl:
            fresh !== null &&
            fresh.icon_url !== undefined && fresh.icon_url !== null && fresh.icon_url !== ""
              ? fresh.icon_url
              : null,
          Icon: fresh === null ? null : (iconForPickId(fresh.id) ?? iconForDrinkName(fresh.name)),
        };
      }),
    [wantHistory],
  );
  const trail = useMemo(
    () =>
      trailOn
        ? trailStops(wantHistory).map((s, i) => ({
            id: s.id,
            lat: s.position.lat,
            lng: s.position.lng,
            n: i + 1,
            at: s.at,
          }))
        : null,
    [trailOn, wantHistory],
  );
  // UR C.11：一鍵足跡——開足跡即飛全軌跡（沿 v1 fitBounds 口徑；等 onReady tick）。
  useEffect(() => {
    if (!trailOn || trail === null || trail.length === 0) return;
    mapApi.current?.fitPoints(trail.map((s) => ({ lat: s.lat, lng: s.lng })));
  }, [trailOn, trail, mapReadyTick]);
  // UR C.11：登入續跑——mount 讀 ?trail=1 記 intent 即清參數（防重觸）。
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!parseTrailResume(window.location.search)) return;
    window.history.replaceState(null, "", window.location.pathname);
    resumeTrailRef.current = true;
  }, []);
  // UR D.4：一鍵定位——mount 讀 ?friend=<id> 記 intent 即清參數（列表定位鈕深鏈）。
  // 消費等 liveFriends 首批非空（空即無人在線，不消費不打擾；參數已清不重觸）。
  const locateFriendRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || locateFriendRef.current !== null) return;
    const id = new URLSearchParams(window.location.search).get("friend")?.trim() ?? "";
    if (id === "") return;
    window.history.replaceState(null, "", window.location.pathname);
    locateFriendRef.current = id;
  }, []);
  useEffect(() => {
    const id = locateFriendRef.current;
    if (id === null || liveFriends.length === 0) return;
    locateFriendRef.current = null;
    const f = liveFriends.find((x) => x.user_id === id);
    // 離線／非好友：靜默消費（人不動，鏡頭不動；列表本就只給在線行定位鍵）。
    if (f === undefined) return;
    mapApi.current?.flyTo({ lat: f.lat, lng: f.lng }, 15);
    setFriendCardId(f.user_id);
  }, [liveFriends]);
  // 登入態落定＋有 intent→開足跡（fit 跟隨上 effect；microtask 包沿 UR1.8 配方）。
  useEffect(() => {
    if (isAuthed !== true || !resumeTrailRef.current) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      resumeTrailRef.current = false;
      setTrailLoginOpen(false);
      setTrailOn(true);
      setStopsOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);
  // UR C.11 round-8：開關會話持久化——mount 讀（microtask 包沿 UR1.8 配方），
  // 變更寫透（只寫存儲不寫 state，lint 安全）；HMR／手動重載不斷流。
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (readTrailFlag(TRAIL_ON_KEY)) setTrailOn(true);
      if (readTrailFlag(STOPS_OPEN_KEY)) setStopsOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    writeTrailFlag(TRAIL_ON_KEY, trailOn);
    writeTrailFlag(STOPS_OPEN_KEY, stopsOpen);
  }, [trailOn, stopsOpen]);
  const wantMarkers = useMemo(
    () =>
      wants.map((w) => ({ id: w.id, lat: w.lat, lng: w.lng, emoji: w.emoji, iconUrl: w.iconUrl, Icon: w.Icon })),
    [wants],
  );
  // UR C.11 round-9（DEF-002）：self 防抖——watch 每回調都換對象，
  // 不攔會致 markers effect 反覆重掛、CSS 動畫永遠重播（「只播一次」觀感）。
  // 10m 內抖動凍結末點（沿 UR1.2 凍結末點口徑）；真走動照跟。v2-only，hook 不動。
  const [stableSelf, setStableSelf] = useState<LatLng | null>(null);
  useEffect(() => {
    if (geoStatus !== "success" || geoPos === null) return;
    // 同步寫包 microtask（set-state-in-effect 規則，沿 UR1.8 配方）。
    const pos = geoPos;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setStableSelf((prev) => {
        if (prev === null || haversineMeters(prev, pos) > SELF_UPDATE_MIN_M)
          return pos;
        return prev;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [geoStatus, geoPos]);
  const selfPos: LatLng | null = stableSelf;
  const cityCode = resolveCityCode(selfPos, null);
  const cityLabelKey =
    cityCode === null ? "cityName" : (`cityName_${cityCode}` as const);
  // UR C.16：精確地名——20km 內有商圈錨即 `{區} · {市}`（港澳；錨名沿用繁中，
  // en 暫混排另議）；之外沿舊城市 key，海外無命中回 cityName。
  const nearbyAnchor =
    selfPos === null
      ? null
      : (() => {
          const a = areaOf(selfPos.lat, selfPos.lng);
          if (a === null) return null;
          if (haversineMeters(selfPos, { lat: a.lat, lng: a.lng }) > 20000)
            return null;
          return a;
        })();
  const placeTitle =
    nearbyAnchor === null
      ? t(cityLabelKey)
      : `${nearbyAnchor.name} · ${
          nearbyAnchor.city === "澳門"
            ? t("cityName_mo")
            : nearbyAnchor.city === "香港"
              ? t("cityName_hk")
              : nearbyAnchor.city
        }`;

  // UR C.16：登出（沿 v1 HeaderAuth 配方：signOut＋清緩存（事件自動清 v2 殘影）
  // ＋refresh；isAuthed／profile 由 auth 訂閱自動回匿名）。
  async function handleLogout(): Promise<void> {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      clearUserLocalCaches();
      router.refresh();
    }
  }

  // UR C.11：一鍵足跡——面板與足跡解耦（round-7）：關面板留動畫；
  // 首點開面板（足跡未開順手開＋fit），面板關時再點 tab 才顯式關足跡；
  // 清足跡只走地圖本體點／tab 二次關／登出。匿名先登入浮層，fit 跟隨 effect。
  function handleTrailTab(): void {
    if (stopsOpen) {
      setStopsOpen(false);
      return;
    }
    if (trailOn) {
      setTrailOn(false);
      return;
    }
    if (isAuthed !== true) {
      setTrailLoginOpen(true);
      return;
    }
    setTrailOn(true);
    setStopsOpen(true);
  }

  // UR C.11 round-7：點地圖本體清足跡＋面板＋登入浮層（pin 上點不進此分支）。
  function handleMapTap(): void {
    if (!trailOn && !stopsOpen && !trailLoginOpen) return;
    setTrailOn(false);
    setStopsOpen(false);
    setTrailLoginOpen(false);
  }

  // UR C.11：Google 一鍵登入（沿 LoginPanel OAuth 配方；next 帶 ?trail=1 續跑）。
  async function handleTrailLogin(): Promise<void> {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/v2?trail=1`,
        },
      });
      if (error !== null)
        console.error("[trail] signInWithOAuth error:", error);
    } catch (err) {
      console.error("[trail] handleTrailLogin threw:", err);
    }
  }

  // UR C.11 返工 R-A：行點即飛＋開 want Sheet（詳情管理一步到位）。
  function openStopRecord(at: number): void {
    const rec = wantHistory.find((w) => w.at === at);
    if (rec === undefined) return;
    setStopsOpen(false);
    mapApi.current?.flyTo(rec.position);
    openWant(`want-${at}`);
    // openWant 默認清返回（直開口徑）；目錄來才記，關詳情／點返回即回目錄。
    setWantReturnTo("stops");
  }

  function openPin(id: string): void {
    // 他人卡進 Sheet：關自家 Sheet（互斥， latest tap 贏）。
    setWantSheetAt(null);
    const api = apiPins.find((p) => p.id === id);
    if (api !== undefined) {
      setCard({
        kind: "other",
        id: api.id,
        title: api.nickname ?? api.drinkName ?? "酒友",
        sub: api.area ?? "",
        emoji: api.drinkEmoji ?? "🍺",
        drink: api.drinkName ?? "",
        online: api.isOnline,
        lat: api.lat,
        lng: api.lng,
        // UR C.10：PinJson 字段全用上（此前丟棄致信息不全）。
        avatarUrl: api.avatarUrl,
        avatarEmoji: null,
        gender: parseGender(api.gender),
        checkedInAt:
          typeof api.checkedInAt === "number" &&
          Number.isFinite(api.checkedInAt)
            ? api.checkedInAt
            : null,
      });
      mapApi.current?.flyTo({ lat: api.lat, lng: api.lng });
      // UR E.2：三件套按需拉（pins 不帶，開卡才取；id 守衛防串卡）。
      setOtherDetail(null);
      setOtherDetailLoading(true);
      otherDetailFor.current = api.id;
      void fetch(`/api/v1/checkins/${encodeURIComponent(api.id)}`, {
        credentials: "include",
      })
        .then(async (res) => {
          if (otherDetailFor.current !== api.id) return;
          if (!res.ok) {
            setOtherDetailLoading(false);
            return;
          }
          const j = (await res.json()) as {
            checkin?: {
              photo_url?: string | null;
              note?: string | null;
              audio_url?: string | null;
              audio_seconds?: number | null;
              is_author?: boolean;
            };
          };
          if (otherDetailFor.current !== api.id) return;
          const c = j.checkin;
          if (c === undefined) {
            setOtherDetailLoading(false);
            return;
          }
          setOtherDetail({
            photoUrl: c.photo_url ?? null,
            note: c.note ?? null,
            audioUrl: c.audio_url ?? null,
            audioSeconds:
              typeof c.audio_seconds === "number" ? c.audio_seconds : null,
            isAuthor: c.is_author === true,
          });
          setOtherDetailLoading(false);
        })
        .catch(() => {
          if (otherDetailFor.current === api.id) setOtherDetailLoading(false);
        });
      return;
    }
    const m = MOCK_CHECKINS.find((c) => c.id === id);
    if (m !== undefined) {
      setCard({
        kind: "other",
        id: m.id,
        title: m.nickname,
        sub: m.area,
        emoji: m.drinkEmoji,
        drink: m.drinkName,
        online: false,
        lat: m.position.lat,
        lng: m.position.lng,
        // UR C.10：MOCK 源字段直用（avatarEmoji／gender／checkedInAt 既有）。
        avatarUrl: null,
        avatarEmoji: m.avatarEmoji,
        gender: m.gender,
        checkedInAt: m.checkedInAt,
      });
      // UR E.2：MOCK 無詳情端點，清殘留防串卡。
      setOtherDetail(null);
      setOtherDetailLoading(false);
      otherDetailFor.current = null;
      mapApi.current?.flyTo({ lat: m.position.lat, lng: m.position.lng });
    }
  }

  // UR C.4：自家想喝釘改開底部 Sheet（浮動卡只留他人 kind）。
  function openWant(id: string): void {
    const at = Number(id.replace("want-", ""));
    const rec = wantHistory.find((w) => w.at === at);
    if (rec === undefined) return;
    // 自家 Sheet 開時關他人卡（互斥）。
    setCard(null);
    setOtherDetail(null);
    setOtherDetailLoading(false);
    otherDetailFor.current = null;
    // 地圖釘直開不帶返回（目錄來由 openStopRecord 事後記）。
    setWantReturnTo(null);
    setSwapOpen(false);
    setSwapBatch([]);
    setConfirmDelete(false);
    setOtherConfirmDelete(false);
    setWantSheetAt(at);
    mapApi.current?.flyTo(rec.position);
  }

  /* ---- UR C.4 自打卡可編輯（沿 v1 UR3.7／UR3.9 配方） ----
   * 換酒：只換 beer（at／位置／地名不动，pin 不挪位）；候選是同類批次
   * （`pickSwapBatch`，當前除外），點格即換。持久化：離線記錄（無 DB id）
   * 寫本地；已登入走 session 即時換（無改酒端點，server 換酒另開 UR）。 */
  function handleSwapToggle(): void {
    if (wantSheetAt === null) return;
    if (swapOpen) {
      setSwapOpen(false);
      return;
    }
    const rec = wantHistory.find((w) => w.at === wantSheetAt);
    if (rec === undefined || rec.beer === null) return;
    setSwapBatch(pickSwapBatch(resolveFreshBeer(rec.beer), 6));
    setSwapOpen(true);
  }
  function handleSwapRefresh(): void {
    if (wantSheetAt === null || !swapOpen) return;
    const rec = wantHistory.find((w) => w.at === wantSheetAt);
    if (rec === undefined || rec.beer === null) return;
    const fresh = resolveFreshBeer(rec.beer);
    const prevKey = swapBatch.map((b) => b.id).join(",");
    let next = pickSwapBatch(fresh, 6);
    for (
      let i = 0;
      i < 3 && next.map((b) => b.id).join(",") === prevKey && next.length > 1;
      i += 1
    ) {
      next = pickSwapBatch(fresh, 6);
    }
    setSwapBatch(next);
  }
  function handleSwapTo(beer: Beer): void {
    if (wantSheetAt === null) return;
    const at = wantSheetAt;
    const next = swapWantBeer(wantHistory, at, beer);
    setWantHistory(next);
    const rec = next.find((w) => w.at === at);
    // 離線記錄才寫本地（沿 A.10：登入以 DB 為準，session 即時換）
    if (rec !== undefined && rec.id === undefined) saveWantHistory(next);
    setSwapOpen(false);
  }
  // DEF-20260929-003：有 DB id 先删库（失败留本地＋toast），再清本地；无 id 纯本地。
  // 此前只清本地，刷新即被 mine 复活，且根本没有 DELETE 端点。
  async function handleDeleteWant(): Promise<void> {
    if (wantSheetAt === null) return;
    const at = wantSheetAt;
    const doomed = wantHistory.find((w) => w.at === at);
    if (doomed?.id !== undefined) {
      try {
        const res = await fetch(`/api/v1/checkins/${encodeURIComponent(doomed.id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          flashNote(t("deleteFailed"));
          return;
        }
      } catch {
        flashNote(t("deleteFailed"));
        return;
      }
    }
    const next = removeWantAt(wantHistory, at);
    setWantHistory(next);
    if (doomed !== undefined && doomed.id === undefined) saveWantHistory(next);
    setConfirmDelete(false);
    setSwapOpen(false);
    setWantSheetAt(null);
  }

  // UR E.13：他人分支自家卡删除（沿 handleDeleteWant 两段确认；api 钉本地摘除免重拉）。
  async function handleDeleteOther(id: string): Promise<void> {
    try {
      const res = await fetch(`/api/v1/checkins/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        flashNote(t("deleteFailed"));
        return;
      }
    } catch {
      flashNote(t("deleteFailed"));
      return;
    }
    setApiPins((prev) => prev.filter((p) => p.id !== id));
    setOtherConfirmDelete(false);
    setOtherDetail(null);
    otherDetailFor.current = null;
    setCard(null);
  }

  function handleCheers(id: string): void {
    // DEF-009 修正：乾杯除隱身直過（加好友門只攔邀約）。
    if (mode === "stealth") {
      setFriendState("unknown");
      setAddState("idle");
      setGuard({ action: "cheers", target: id });
      return;
    }
    if (sentIds.includes(id) || !canCheers(sentIds)) return;
    buzz(BUZZ_CHEERS);
    const next = [...sentIds, id];
    setSentIds(next);
    saveSentToday(next, new Date());
  }

  function fireInvite(id: string): void {
    if (invites[id] !== undefined) return;
    setInvites((prev) => ({ ...prev, [id]: "sent" as const }));
    window.setTimeout(() => {
      buzz(BUZZ_FOUND);
      setInvites((prev) => ({ ...prev, [id]: "accepted" as const }));
    }, 3000);
  }

  function handleInvite(id: string): void {
    // 隱身全攔；匿名直過；authed 查關係（好友／未知直過，非好友彈加好友層）。
    if (mode === "stealth") {
      setFriendState("unknown");
      setAddState("idle");
      setGuard({ action: "invite", target: id });
      return;
    }
    if (isAuthed === false) {
      fireInvite(id);
      return;
    }
    void isFriendCached(id).then((rel) => {
      if (rel !== false) {
        fireInvite(id);
        return;
      }
      setFriendState("nonfriend");
      setAddState("idle");
      setGuard({ action: "invite", target: id });
    });
  }

  // 守衛層開層即查關係（有 target 才查；checking 期間 fail-open）。
  useEffect(() => {
    if (guard === null || guard.target === null) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setFriendState("checking");
    });
    void isFriendCached(guard.target)
      .then((rel) => {
        if (!cancelled) setFriendState(rel === true ? "friend" : rel === null ? "unknown" : "nonfriend");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // isFriendCached 會話緩存引用穩定，不列入 deps。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard]);

  function handleAddFriend(): void {
    if (guard === null || guard.target === null) return;
    const target = guard.target;
    const act = guard.action;
    void addFriendByCheckin(target).then((st) => {
      if (st === null) return;
      setAddState(st === "accepted" ? "accepted" : "sent");
      // 公開邀約：加完即發（卡不關，原地續操作；等接受會死胡同）。
      if (mode === "public" && act === "invite") {
        setGuard(null);
        fireInvite(target);
      }
      if (st === "accepted") {
        // 即成好友：關係翻轉（層內選項跟著變對，由 friendState 驅動）。
        setFriendState("friend");
      }
    });
  }

  // UR C.17：點好友呼吸釘先看信息卡（聊天鍵在卡內進完整頁）。
  // UR D.7：進房改零 id（peer 寫 session，路由固定 `/v2/chat/room`）。
  function openChat(userId: string): void {
    if (liveFriends.some((x) => x.user_id === userId)) setFriendCardId(userId);
  }

  // UR D.7：零 id 路由——peer 寫 session，URL 永遠是乾淨的 `/v2/chat/room`。
  function goChat(userId: string): void {
    const prefix = locale === "zh-Hant" ? "" : `/${locale}`;
    setActivePeer(userId);
    router.push(`${prefix}/v2/chat/room`);
  }

  const friendMarkers = useMemo(
    () =>
      liveFriends.map((f) => ({
        id: f.user_id,
        lat: f.lat,
        lng: f.lng,
        label: f.nickname.slice(0, 1),
      })),
    [liveFriends],
  );

  function openPick(): void {
    setPickStage("cats");
    setLaneId(null);
    setBatch([]);
    setKindBeer(null);
    setPickOpen(true);
  }

  /** UR C.22：霓虹點開揭曉 overlay——開時抽一次 index 存 state（render 內不抽，防閃爍）。 */
  function openReveal(): void {
    setRevealIdx(pickRandomIndex(revealPhotoCount()));
    setRevealOpen(true);
  }

  /** UR E.3 verdict：ok 落版；message 行内报错；guard 守卫已弹调用方让路。 */
  type DropWantResult =
    | { ok: true }
    | { ok: false; message: string }
    | { ok: false; guard: true };

  function dropWant(
    beer: Beer | null,
    kind: "flash" | "post",
    shot: { photoDataUrl: string; note: string } | null,
  ): Promise<DropWantResult> {
    if (isAuthed === false) {
      setPickStage("login");
      return Promise.resolve({ ok: false, message: "" });
    }
    // UR E.3：照片＋文字随单（录音已退役；空值不送，沿旧口径）。
    const shotExtra =
      shot === null
        ? {}
        : {
            ...(shot.photoDataUrl !== "" ? { photoDataUrl: shot.photoDataUrl } : {}),
            ...(shot.note !== "" ? { note: shot.note } : {}),
          };
    // UR E.2：POST 同款三件套（server 字段名；空值不送，沿上）。
    const postExtra =
      shot === null
        ? {}
        : {
            ...(shot.photoDataUrl !== ""
              ? { photo_url: shot.photoDataUrl }
              : {}),
            ...(shot.note !== "" ? { note: shot.note } : {}),
          };
    // UR C.18：同 tick 連點只收一次（ref 即時，state 慢半拍擋不住）。
    if (submittingRef.current) return Promise.resolve({ ok: true });
    submittingRef.current = true;
    setCheckinSubmitting(true);
    return (async (): Promise<DropWantResult> => {
      const center = mapApi.current?.getCenter() ?? DEFAULT_CENTER;
      const position =
        geoStatus === "success" && geoPos !== null && isWithinHongKong(geoPos)
          ? geoPos
          : center;
      // UR C.18：成功必飛新釘（一律飛，用戶拍板；dismiss 罩＋解鎖走 finally 語義——
      // 各 return／catch 逐一收尾，不用外層 try（內層 try 已佔 POST 語義）。
      const done = () => {
        submittingRef.current = false;
        setCheckinSubmitting(false);
      };
      try {
        const res = await fetch("/api/v1/checkins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          // UR E.2 發送工作流：三件套隨單（server 即時審核，見 POST 路由）。
          body: JSON.stringify({
            beer_id: beer === null ? null : beer.id,
            lat: position.lat,
            lng: position.lng,
            place_name: null,
            kind,
            ...postExtra,
          }),
        });
        if (res.status === 403) {
          // UR E.3：rejected 行内报错（调用方决定提示面；此层不 toast，
          // 不进离线回退——被拦内容不可落地，fail-closed）。
          const rej = (await res.json().catch(() => null)) as {
            error?: { code?: string; message?: string };
          } | null;
          if (rej?.error?.code === "rejected") {
            done();
            return {
              ok: false,
              message:
                typeof rej.error.message === "string" && rej.error.message !== ""
                  ? rej.error.message
                  : t2("camPublishFailed"),
            };
          }
          setFriendState("unknown");
          setAddState("idle");
          setGuard({ action: "checkin", target: null });
          done();
          return { ok: false, guard: true };
        }
        if (!res.ok) throw new Error(`checkins ${res.status}`);
        const json = (await res.json()) as {
          checkin?: {
            id: string;
            kind: "flash" | "post";
            visibility: "private" | "public" | "friends";
            expires_at: string | null;
            created_at: string;
          };
        };
        const row = json.checkin;
        if (row === undefined) throw new Error("bad checkin json");
        const at = Date.parse(row.created_at);
        const record: WantRecord = {
          beer,
          at,
          position,
          kind: row.kind,
          visibility: row.visibility,
          expiresAt: row.expires_at !== null ? Date.parse(row.expires_at) : null,
          id: row.id,
          ...shotExtra,
        };
        // 登入以 DB 為準：只進會話態，不寫本地（沿 A.10）。
        setWantHistory((prev) => [...prev, record].sort((a, b) => a.at - b.at));
        setPickOpen(false);
        mapApi.current?.flyTo(position, 15);
        done();
        return { ok: true };
      } catch {
        // 離線回退：本地快照（沿 v1 同配方）。
        const record: WantRecord = {
          beer,
          at: Date.now(),
          position,
          kind,
          visibility: "public",
          expiresAt: kind === "flash" ? Date.now() + 24 * 3600_000 : null,
          ...shotExtra,
        };
        const next = upsertWantHistory(wantHistory, record);
        setWantHistory(next);
        saveWantHistory(next);
        setPickOpen(false);
        mapApi.current?.flyTo(position, 15);
        done();
        return { ok: true };
      }
    })();
  }

  // UR E.3 round-2：compose 直发桥（酒已退场，一律纯照片打卡；匿名走登录；守卫已弹关相机让路）。
  async function publishShot(args: PublishShot): Promise<PublishResult> {
    if (isAuthed === false) {
      setCameraOpen(false);
      setPickStage("login");
      setPickOpen(true);
      return { ok: true };
    }
    const r = await dropWant(null, args.kind, {
      photoDataUrl: args.photoDataUrl,
      note: args.note,
    });
    if (r.ok) return { ok: true };
    if ("guard" in r) {
      setCameraOpen(false);
      return { ok: true };
    }
    return { ok: false, message: r.message };
  }

  // UR E.6 round-4 热点巡游：起点离我最近，之后基于当前格跳最近未访格；
  // 末格按钮变返回（回我位置），单格直接返回。
  // round-5：每站信息卡（地点众数＋计数＋距离，点即开成员 Sheet）。
  // round-8：图上钻取退役——查看打卡回 Sheet，列连通片全部打卡（行点开卡）。
  const [heatCells, setHeatCells] = useState<HeatCell[]>([]);
  const [heatIdx, setHeatIdx] = useState(0);
  const [heatOrigin, setHeatOrigin] = useState<LatLng | null>(null);
  const [heatSheetOpen, setHeatSheetOpen] = useState(false);

  function exitHeatTour(): void {
    // 退出回当前定位（沿回位口径）。
    setHeatMode(false);
    setHeatCells([]);
    setHeatIdx(0);
    setHeatOrigin(null);
    setHeatSheetOpen(false);
    mapApi.current?.recenter();
  }

  function flyHeatCell(cells: HeatCell[], i: number): void {
    const c = cells[i];
    if (c === undefined) return;
    const pts = c.ids.flatMap((id) => {
      const m = others.find((o) => o.id === id);
      return m === undefined ? [] : [{ lat: m.lat, lng: m.lng }];
    });
    if (pts.length > 0) mapApi.current?.fitPoints(pts);
    setHeatIdx(i);
  }

  function toggleHeatMode(): void {
    if (heatMode) {
      exitHeatTour();
      return;
    }
    const origin = selfPos ?? mapApi.current?.getCenter() ?? null;
    const cells = groupHeatCells(
      others.map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, at: m.at })),
    );
    if (cells.length === 0) {
      flashNote(t2("hotspotEmpty"));
      return;
    }
    const ordered = orderHeatCellsTour(cells, origin);
    setHeatCells(ordered);
    setHeatOrigin(origin);
    setHeatSheetOpen(false);
    setHeatMode(true);
    flyHeatCell(ordered, 0);
  }

  // 巡游下一格（末格即返回我的位置，不再绕回；跳格即关 Sheet）。
  function nextHeatCell(): void {
    if (heatCells.length === 0) return;
    if (heatIdx >= heatCells.length - 1) {
      exitHeatTour();
      return;
    }
    setHeatSheetOpen(false);
    flyHeatCell(heatCells, heatIdx + 1);
  }

  // UR E.6 round-8 当前站派生（信息卡＋成员 Sheet 共用；成员＝连通片全员，
  // 沿 openPin 双源口径；摘要口径同成员，卡与 Sheet 一致）。
  const heatCell = heatMode ? (heatCells[heatIdx] ?? null) : null;
  const heatSheetIds =
    heatCell === null ? [] : connectedCellIds(heatCell, heatCells);
  const heatMembers = heatSheetIds.flatMap((id) => {
          const api = apiPins.find((p) => p.id === id);
          if (api !== undefined) {
            return [
              {
                id,
                area: api.area,
                title: api.nickname ?? api.drinkName ?? "酒友",
                emoji: api.drinkEmoji ?? "🍺",
                drink: api.drinkName ?? "",
                lat: api.lat,
                lng: api.lng,
              },
            ];
          }
          const m = MOCK_CHECKINS.find((c) => c.id === id);
          if (m !== undefined) {
            return [
              {
                id,
                area: m.area,
                title: m.nickname,
                emoji: m.drinkEmoji,
                drink: m.drinkName,
                lat: m.position.lat,
                lng: m.position.lng,
              },
            ];
          }
          return [];
        });
  const heatSummary =
    heatCell === null
      ? null
      : summarizeHeatCell({ ...heatCell, ids: heatSheetIds }, heatMembers, heatOrigin);

  function doShake(): void {
    const now = Date.now();
    const from = selfPos ?? mapApi.current?.getCenter() ?? DEFAULT_CENTER;
    let best: { id: string; d: number } | null = null;
    for (const p of apiPins) {
      const at = p.checkedInAt;
      if (!Number.isFinite(at) || now - at > 24 * 3600_000) continue;
      const d = haversineMeters(from, { lat: p.lat, lng: p.lng });
      if (best === null || d < best.d) best = { id: p.id, d };
    }
    if (best === null) {
      flashNote(t("shakeNoneNearby"));
      return;
    }
    openPin(best.id);
  }

  const isNonfriend = friendState === "nonfriend";
  // UR C.2：常駐 pill 文案（匿名／未知走通用態）
  const modeLabel =
    mode === "stealth"
      ? tm("modeStealth")
      : mode === "friends"
        ? tm("modeFriends")
        : mode === "public"
          ? tm("modePublic")
          : tm("switcherLabel");
  const guardActKey =
    guard === null || guard.action === "checkin"
      ? "actCheckin"
      : guard.action === "cheers"
        ? "actCheers"
        : "actInvite";

  return (
    <div data-ui="v2" className={`fixed inset-0 isolate overflow-hidden bg-background ${styles.v2scope}`}>
      <V2MapView
        ref={mapApi}
        others={others}
        wants={wantMarkers}
        trail={trail}
        self={selfPos}
        onPinClick={openPin}
        onWantClick={openWant}
        onReady={() => setMapReadyTick((n) => n + 1)}
        onMapTap={handleMapTap}
        presence={presence}
        friends={friendMarkers}
        onFriendClick={openChat}
        onStackClick={(ids) => setStackIds(ids)}
        heatMode={heatMode}
        heatFocusIds={heatMode ? (heatCells[heatIdx]?.ids ?? null) : null}
      />

      {/* UR C.17 好友信息卡（點釘先看人，卡內聊天鍵進完整頁；對方離線即自動收卡 fail-closed） */}
      <V2FriendCard
        friend={liveFriends.find((x) => x.user_id === friendCardId) ?? null}
        onClose={() => setFriendCardId(null)}
        onChat={goChat}
      />

      {/* UR C.18 打卡提交罩（POST 期唯一反饋；成功／失敗／403 全 dismiss，見 dropWant）。
          DEF-012 同款坑：V2Home 根 `isolate` 自建 stacking context，罩放裡面再大也壓不住
          body 級 Sheet portal——走 portal 逃出＋z1100（沿 ModePrompt DEF-008 口徑）。
          初幀 false 故 SSR 無 document 問題（開罩只發生在客戶端交互後）。
          UR E.3 round-2：去 v1 啤酒泡味——中性 spinner＋文案，v2scope token。 */}
      {checkinSubmitting &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            aria-label={t2("checkinSubmitting")}
            className={`fixed inset-0 z-[1100] flex items-center justify-center bg-background/60 backdrop-blur-[2px] ${styles.v2scope}`}
          >
            <div className="flex items-center gap-3 rounded-full bg-card py-3 pr-6 pl-4 shadow-xl ring-1 ring-foreground/10">
              <LoaderCircle size={20} aria-hidden className="animate-spin text-muted-foreground" />
              <p className="text-sm font-bold">{t2("checkinSubmitting")}</p>
            </div>
          </div>,
          document.body,
        )}

      {/* 頂部簇：頭像＋城市＋模式一行，pills 緊貼下方（DEF-012 round-2：
          之前兩段 absolute 留大縫＋不對齊，收進同一容器沿 Snap 緊湊左對齊） */}
      <div className="absolute inset-x-0 top-0 z-[1000] flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          {/* UR C.16：真頭像＋shadcn DropdownMenu（Avatar 作 trigger 正統）；
              模式三檔＋登出收進菜單（C.2 pill 退役）；匿名點頭像去登入。 */}
          {isAuthed === true ? (
            <DropdownMenu>
              {/* Base UI Trigger 原生即 <button>：className／aria 直下，不用 asChild。 */}
              <DropdownMenuTrigger
                aria-label={profile?.name ?? t("logout")}
                className="h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full shadow-md ring-1 ring-foreground/10"
              >
                <Avatar className="h-11 w-11">
                  {profile?.avatarUrl ? (
                    <AvatarImage
                      src={profile.avatarUrl}
                      alt={profile.name}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="font-bold">
                    {profile?.name?.slice(0, 1) ?? (
                      <Users size={18} aria-hidden className="text-muted-foreground" />
                    )}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className={styles.v2scope}>
                {/* DEF-009：Label 必須在 Group 內（base-ui GroupLabel 硬性要求，游離即炸） */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="max-w-48 truncate">
                    {profile?.name ?? ""}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {(
                    [
                      { key: "stealth", label: tm("modeStealth"), Icon: EyeOff },
                      { key: "friends", label: tm("modeFriends"), Icon: Users },
                      { key: "public", label: tm("modePublic"), Icon: Globe },
                    ] as const
                  ).map(({ key, label, Icon }) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => {
                        void patchMode(key);
                      }}
                    >
                      <Icon size={15} aria-hidden />
                      {label}
                      {mode === key && <span aria-hidden>✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void handleLogout()}
                >
                  <LogOut size={15} aria-hidden />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              aria-label={tm("switcherLabel")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card shadow-md ring-1 ring-foreground/10"
            >
              <Users size={18} aria-hidden className="text-muted-foreground" />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl leading-tight font-bold tracking-tight">
              {placeTitle}
            </p>
            {/* UR C.16 去重：登入只留一處狀態（燈＋模式字）；匿名沿舊 geo 行
               （無燈無菜單，不重）。未知 mode fail-closed 灰＋通用文案。 */}
            {isAuthed === true ? (
              <p className="flex items-center gap-1.5 pt-0.5 text-xs font-bold">
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${mode === "stealth" ? "bg-muted-foreground" : "bg-green-600"}`}
                />
                <span className={mode === "stealth" ? "text-muted-foreground" : "text-green-700 dark:text-green-400"}>
                  {mode === "stealth"
                    ? tm("modeStealth")
                    : mode === "friends"
                      ? tm("modeFriends")
                      : mode === "public"
                        ? tm("modePublic")
                        : tm("switcherLabel")}
                </span>
              </p>
            ) : (
              <p className="text-xs font-medium text-muted-foreground">
                {geoStatus === "success"
                  ? t("meOnline")
                  : geoStatus === "locating"
                    ? t("meLocating")
                    : t("meOffline")}
              </p>
            )}
          </div>
        </div>

      {/* 橫滑 pills（容器內緊貼頂欄行，同一左對齊；UR C.12：橫滑保留，禁雙擊縮放） */}
      <div className={`flex touch-manipulation gap-2 overflow-x-auto pt-2 pb-1 ${styles.v2noscroll}`}>
        <Button size="sm" variant="outline" className="shrink-0 rounded-full bg-card shadow-md ring-1 ring-foreground/10" onClick={openPick}>
          <Dices aria-hidden />
          {tn("randomPick")}
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 rounded-full bg-card shadow-md ring-1 ring-foreground/10" onClick={doShake}>
          <Vibrate aria-hidden />
          {t("shakeHint")}
        </Button>
        {/* UR D.5：未读角标直接挂好友列表 pill 右上角（总未读>0 才显，99+ 封顶；
            点进列表看各行红点，读完即灭；只挡匿名，任何模式都显）。 */}
        <span className={`relative shrink-0 ${pillShake ? styles.v2pillShake : ""}`}>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 rounded-full bg-card shadow-md ring-1 ring-foreground/10"
            onClick={goChatList}
            aria-label={
              isAuthed === true && bellTotal > 0
                ? `${t2("chatBellLabel")} (${bellTotal > 99 ? "99+" : bellTotal})`
                : undefined
            }
          >
            <Users aria-hidden />
            {t2("chatFriendsOnly")}
          </Button>
          {isAuthed === true && bellTotal > 0 && (
            <span aria-hidden className={styles.v2beerMug}>
              <span aria-hidden className={styles.v2mugBubble} />
              <span aria-hidden className={styles.v2mugBubble} />
              <span className={styles.v2beerCount}>{bellTotal > 99 ? "99+" : bellTotal}</span>
            </span>
          )}
        </span>
        <Button
          size="sm"
          variant={heatMode ? "secondary" : "outline"}
          className={`shrink-0 rounded-full shadow-md ring-1 ring-foreground/10 ${heatMode ? "" : "bg-card"}`}
          onClick={toggleHeatMode}
        >
          <Radar aria-hidden />
          {t2("hotspot")}
        </Button>
      </div>
      {/* 足跡浮條（頂部容器內流式排布，永不與 pills 重疊） */}
      {trailOn && (
        <div className="flex w-max max-w-full items-center gap-2 self-center rounded-full bg-card py-1 pr-1 pl-4 shadow-md ring-1 ring-foreground/10">
          <p className="text-sm font-bold whitespace-nowrap">
            {trail !== null && trail.length > 0
              ? t("trailTitle", { n: trail.length })
              : t("trailEmpty")}
          </p>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => { setTrailOn(false); setStopsOpen(false); }}>
            {t("trailBack")}
          </Button>
        </div>
      )}
      </div>

      {/* 右緣工具列 */}
      <div className="absolute top-1/3 right-3 z-[1000] flex flex-col gap-2">
        <Button
          size="icon"
          variant="outline"
          aria-label={t("recenter")}
          className="rounded-full bg-card shadow-md ring-1 ring-foreground/10"
          onClick={() => {
            // DEF-005：無定位也調（`recenter` 內部 null 即飛香港中心；守衛攔掉等於殺逃生口）。
            mapApi.current?.recenter();
          }}
        >
          <LocateFixed aria-hidden />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label={t("hkWide")}
          className="rounded-full bg-card shadow-md ring-1 ring-foreground/10"
          onClick={() => mapApi.current?.fitHk()}
        >
          <Expand aria-hidden />
        </Button>
      </div>

      {/* UR C.11：匿名點足跡先登入（浮層；登入後 ?trail=1 續跑不斷） */}
      {trailLoginOpen && (
        <div className="absolute inset-x-3 bottom-24 z-[1000] rounded-2xl border bg-card p-4 shadow-lg">
          <p className="text-base font-bold">{t("loginRequiredTitle")}</p>
          <p className="pt-1 text-sm text-muted-foreground">{t("loginRequiredBody")}</p>
          <div className="flex gap-2 pt-3">
            <Button size="sm" onClick={() => void handleTrailLogin()}>
              {t("loginCta")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTrailLoginOpen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* 輕提示 */}
      {note !== null && (
        <p role="status" className="absolute bottom-40 left-1/2 z-[1000] w-max max-w-[92%] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-md">
          {note}
        </p>
      )}

      {/* UR E.6 round-8 巡游信息卡：地点＋计数＋距离，点即开成员 Sheet
          （连通片全部打卡）；下方查看键＋巡游键（非末＝下一格＋进度，
          末／单＝返回）。 */}
      {heatMode && heatCell !== null && heatSummary !== null && (
        <div className="pointer-events-none absolute inset-x-3 bottom-36 z-[1000] flex justify-center">
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-card p-3 shadow-lg ring-1 ring-foreground/10">
            <button
              type="button"
              onClick={() => setHeatSheetOpen(true)}
              className="flex w-full items-center gap-2.5 text-left"
              aria-label={t2("hotspotView")}
            >
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <MapPin size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {heatSummary.area ?? t2("hotspotUnknown")}
                </span>
                <span className="block truncate pt-0.5 text-xs text-muted-foreground">
                  {t2("hotspotInfo", {
                    n: heatSummary.count,
                    d:
                      heatSummary.distanceM === null
                        ? "—"
                        : formatDistance(heatSummary.distanceM),
                  })}
                </span>
              </span>
              <ChevronRight size={16} aria-hidden className="shrink-0 text-muted-foreground" />
            </button>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => setHeatSheetOpen(true)}
              >
                {t2("hotspotView")}
              </Button>
              {heatIdx >= heatCells.length - 1 ? (
                <Button
                  size="sm"
                  className="flex-1 rounded-full"
                  onClick={nextHeatCell}
                >
                  {t2("hotspotBack")} · {heatCells.length}/{heatCells.length}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="flex-1 rounded-full"
                  onClick={nextHeatCell}
                >
                  {t2("hotspotNext")} · {heatIdx + 1}/{heatCells.length}
                  <ChevronRight size={15} aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 底部 CTA 列（UR C.20：只留選酒大鈕——主要賣點；相機走 TabBar 大圓，
          加好友 toast（死鈕）退役，EPIC B/E 線再上）
          UR C.21：整顆換霓虹 webm（透明底透出地圖）；button 語義／openPick／aria-label 沿舊，
          影片純裝飾 aria-hidden；reduced-motion 掛載即暫停顯首幀（無 poster 檔，paused video 即首幀）。
          UR C.21 round-2：與 TabBar 中央對調——霓虹進中央大圓，此列改相機 pill（`setCameraOpen` 沿 E.1 口徑）。 */}
      {card === null && (
        <div className="absolute inset-x-3 bottom-20 z-[1000] flex touch-manipulation items-end justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t2("tabShoot")}
            className="h-12 w-12 rounded-full bg-card shadow-md ring-1 ring-foreground/10"
            onClick={() => setCameraOpen(true)}
          >
            <Camera aria-hidden />
          </Button>
          {/* POC 酒吧入口（Ivy）：琥珀药丸（图标＋字），贴着相机 pill，
              正下方就是选酒霓虹大圆；呼吸光＋扫光自己会发光。 */}
          <Link
            href="/bar-room"
            aria-label={tn("barRoom")}
            className={`${styles.v2barEntry} flex h-12 shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-300 px-4 text-sm font-bold whitespace-nowrap text-amber-950 shadow-md transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`}
          >
            <Martini size={18} aria-hidden strokeWidth={2.5} />
            {tn("barRoom")}
          </Link>
        </div>
      )}

      {/* UR C.22 揭曉 overlay（fixed 全屏，與 DOM 位置無關；放 TabBar 前可讀性最高） */}
      {revealOpen && (
        <V2RevealOverlay
          photo={revealPhotoAt(revealIdx)}
          onReshuffle={() => setRevealIdx(pickRandomIndex(revealPhotoCount()))}
          onClose={() => setRevealOpen(false)}
        />
      )}

      {/* 底部 TabBar */}
      <nav aria-label={tn("menu")} className="absolute inset-x-0 bottom-0 z-[1000] touch-manipulation border-t bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 px-2 pt-1">
          <span className="flex flex-col items-center gap-0.5 py-1.5 text-xs font-bold" aria-current="page">
            <MapIcon size={20} aria-hidden />
            {t2("tabMap")}
          </span>
          <Link href="/wall" className="relative flex flex-col items-center gap-0.5 py-1.5 text-xs font-medium text-muted-foreground">
            <Flame size={20} aria-hidden />
            {t2("tabHot")}
            {wallDot && <Badge className="absolute top-0.5 right-1/3 h-2 min-w-2 p-0" />}
          </Link>
          {/* UR E.1：TabBar 拍照改開相機 Sheet（不跳頁；舊 /camera 路由保留直接訪問）。
              UR C.21 round-2：中央大圓改霓虹選酒（`openPick`；圓形 object-cover，透明像素透出圓底；
              reduced-motion 掛載暫停顯首幀）；相機上浮至底部 CTA 列。 */}
          <Button
            variant="ghost"
            aria-label={t("pickTitle")}
            onClick={openReveal}
            className="flex touch-manipulation justify-center"
          >
            <span className="-mt-5 flex h-[4.24rem] w-[4.24rem] items-center justify-center overflow-hidden rounded-full">
              <video
                className="h-full w-full object-cover"
                src="/neon-pick.webm"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                aria-hidden
                tabIndex={-1}
                disablePictureInPicture
                ref={(el) => {
                  if (el !== null && window.matchMedia("(prefers-reduced-motion: reduce)").matches) el.pause();
                }}
              />
            </span>
          </Button>
          {/* UR C.11：足跡與心情換位（地圖／熱門／拍照／足跡／心情） */}
          <Button
            variant="ghost"
            aria-pressed={trailOn}
            onClick={handleTrailTab}
            className={`flex h-auto flex-col items-center gap-0.5 rounded-none py-1.5 text-xs font-medium ${trailOn ? "font-bold" : "text-muted-foreground"}`}
          >
            <Footprints size={20} aria-hidden />
            {t2("tabTrail")}
          </Button>
          <Link href="/mood" className="flex flex-col items-center gap-0.5 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles size={20} aria-hidden />
            {t2("tabMood")}
          </Link>
        </div>
      </nav>

      {/* 選酒 Sheet */}
      <Sheet
        open={pickOpen}
        onOpenChange={(v) => {
          setPickOpen(v);
          if (!v) {
            setPickStage("cats");
            setLaneId(null);
            setBatch([]);
            setKindBeer(null);
          }
        }}
      >
        {/* UR C.3 round-2：portal 掛 body 逃出頁面 .v2scope，Sheet 根自帶 scope
            把淺色現代 token 帶進彈窗子樹（doodle 灌 html 的舊 token 蓋掉） */}
        <SheetContent side="bottom" showCloseButton={false} className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}>
          {/* UR C.3：抓手＋標準頭（Title 必備，無障礙＋去原生 h2） */}
          <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
          {/* UR C.5 導航行：左返回（根段佔位保右 X 永遠右對齊）＋右 in-flow X；
              默認角落 X 已關（showCloseButton={false}），Esc 照走 */}
          <div className="flex items-center justify-between">
            {pickStage === "batch" ? (
              <Button
                variant="ghost"
                size="sm"
                className="px-1 text-muted-foreground"
                onClick={() => setPickStage("cats")}
              >
                <ChevronLeft size={16} aria-hidden />
                {t2("back")}
              </Button>
            ) : pickStage === "kinds" || pickStage === "login" ? (
              <Button
                variant="ghost"
                size="sm"
                className="px-1 text-muted-foreground"
                onClick={() => setPickStage(pickStage === "kinds" ? "batch" : "kinds")}
              >
                <ChevronLeft size={16} aria-hidden />
                {t2("back")}
              </Button>
            ) : (
              <span aria-hidden className="w-8" />
            )}
            <SheetClose
              render={
                <Button variant="ghost" size="icon-sm" aria-label={t("close")}>
                  <X aria-hidden />
                </Button>
              }
            />
          </div>
          <SheetHeader className="text-left">
            <SheetTitle>{t("pickTitle")}</SheetTitle>
            <SheetDescription>
              {pickStage === "cats"
                ? t("pickCategoriesTitle")
                : pickStage === "batch"
                  ? (BEER_CATEGORIES.find((c) => c.id === laneId)?.labelKey !== undefined
                      ? t(BEER_CATEGORIES.find((c) => c.id === laneId)?.labelKey as string)
                      : "")
                  : pickStage === "kinds" && kindBeer !== null
                    ? kindBeer.name
                    : ""}
            </SheetDescription>
          </SheetHeader>
          {pickStage === "cats" && (
            <div className="flex flex-col gap-2">
              {BEER_CATEGORIES.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="h-auto justify-between rounded-xl p-3"
                  onClick={() => {
                    setLaneId(c.id);
                    setBatch(pickRandomBatch(c.id, 6));
                    setPickStage("batch");
                  }}
                >
                  <span className="flex items-center gap-3">
                    <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl">
                      {c.emoji}
                    </span>
                    <span className="text-sm font-bold">{t(c.labelKey)}</span>
                  </span>
                  <ChevronRight size={16} aria-hidden className="text-muted-foreground" />
                </Button>
              ))}
            </div>
          )}
          {pickStage === "batch" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                {batch.map((b) => (
                  <Card size="sm" key={b.id} className="overflow-hidden p-0">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setKindBeer(b);
                        setPickStage("kinds");
                      }}
                      className="flex h-auto w-full flex-col items-center gap-1 rounded-none p-2"
                    >
                      <BeerImg beer={b} tall />
                      <span className="w-full truncate text-center text-xs font-medium">{b.name}</span>
                    </Button>
                  </Card>
                ))}
              </div>
              <div className="flex gap-2 pt-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => laneId !== null && setBatch(pickNextBatch(batch, laneId, 6))}
                >
                  {t("pickNextBatch")}
                </Button>
                <Button variant="ghost" onClick={() => setPickStage("cats")}>
                  {t("pickChangeCategory")}
                </Button>
              </div>
            </div>
          )}
          {pickStage === "kinds" && kindBeer !== null && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-auto flex-col items-start gap-2 rounded-xl p-3"
                onClick={() => {
                  void dropWant(kindBeer, "flash", null).then((r) => {
                    if (!r.ok && "message" in r && r.message !== "") flashNote(r.message);
                  });
                }}
              >
                <span className="flex items-center gap-2 font-bold">
                  <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <Clock size={15} />
                  </span>
                  {t2("flashTitle")}
                </span>
                <span className="text-xs font-normal text-muted-foreground">{t2("flashDesc")}</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col items-start gap-2 rounded-xl p-3"
                onClick={() => {
                  void dropWant(kindBeer, "post", null).then((r) => {
                    if (!r.ok && "message" in r && r.message !== "") flashNote(r.message);
                  });
                }}
              >
                <span className="flex items-center gap-2 font-bold">
                  <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <MapPin size={15} />
                  </span>
                  {t2("postTitle")}
                </span>
                <span className="text-xs font-normal opacity-90">{t2("postDesc")}</span>
              </Button>
              </div>
            </div>
          )}
          {pickStage === "login" && (
            <div className="flex flex-col items-center gap-3 pt-2 text-center">
              <p className="text-sm text-muted-foreground">{t("loginRequiredBody")}</p>
              <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>{t("loginCta")}</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 守衛 Sheet（矩陣：stealth 雙鈕／加鈕；friends 非好友公開＋加鈕；
          公開邀約非好友僅加鈕（加完即發）；乾杯除隱身直過不開層） */}
      <Sheet open={guard !== null} onOpenChange={(v) => !v && setGuard(null)}>
        <SheetContent side="bottom" className={`${styles.v2scope} rounded-t-2xl sm:mx-auto sm:w-full sm:max-w-md`}>
          {guard !== null &&
            (() => {
              const showPublic = mode === "stealth" || mode === "friends";
              const showFriends =
                (mode === "stealth" || mode === "friends") && !isNonfriend;
              const showAdd = guard.target !== null && isNonfriend;
              const fallback = !showPublic && !showFriends && !showAdd;
              return (
                <div className="flex flex-col gap-3">
                  <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
                  <SheetHeader className="text-left">
                    <SheetTitle>
                      {mode === "friends" ? tm("guardTitleFriend") : tm("guardTitle")}
                    </SheetTitle>
                    <SheetDescription>
                      {mode === "friends"
                        ? tm("guardBodyFriend", { action: tm(guardActKey) })
                        : tm("guardBody", { action: tm(guardActKey) })}
                    </SheetDescription>
                  </SheetHeader>
                  <div
                    className={`grid gap-2 ${showFriends || fallback ? "grid-cols-2" : "grid-cols-1"}`}
                  >
                    {(showPublic || fallback) && (
                      <Button
                        variant="outline"
                        onClick={() => void patchMode("public").then(() => setGuard(null))}
                      >
                        {tm("switchPublic")}
                      </Button>
                    )}
                    {(showFriends || fallback) && (
                      <Button
                        variant="outline"
                        onClick={() => void patchMode("friends").then(() => setGuard(null))}
                      >
                        {tm("switchFriends")}
                      </Button>
                    )}
                    {showAdd && (
                      <Button
                        variant="outline"
                        disabled={addState !== "idle"}
                        onClick={handleAddFriend}
                      >
                        {addState === "accepted"
                          ? tm("becameFriends")
                          : addState === "sent"
                            ? tm("addFriendSent")
                            : tm("addFriend")}
                      </Button>
                    )}
                  </div>
                  {isNonfriend && mode !== "public" && (
                    <p className="text-center text-xs text-muted-foreground">
                      {tm("nonFriendNote")}
                    </p>
                  )}
                  <Button variant="ghost" onClick={() => setGuard(null)}>
                    {t("cancel")}
                  </Button>
                </div>
              );
            })()}
        </SheetContent>
      </Sheet>

      {/* UR C.4 自打卡底部 Sheet（snapshot 式：品牌圖＋用戶資訊＋換酒＋刪除＋圖片佔位槽） */}
      <Sheet
        open={wantSheetAt !== null || (card !== null && card.kind === "other")}
        onOpenChange={(v) => {
          if (v) return;
          setWantSheetAt(null);
          setCard(null);
          setOtherDetail(null);
          setOtherDetailLoading(false);
          otherDetailFor.current = null;
          setSwapOpen(false);
          setConfirmDelete(false);
          setOtherConfirmDelete(false);
          // UR C.11 round-3：關詳情自動回目錄（直開時 returnTo 為 null，不回）。
          if (wantReturnTo === "stops") {
            setWantReturnTo(null);
            setStopsOpen(true);
          }
        }}
      >
        {/* DEF-20260929-006：此前 key 随卡变 remount Popup，开着换卡直接搞乱
            base-ui Dialog 开关机（残留吞点击）——改 id＋effect 回顶，身份稳定。 */}
        {/* DEF-20261003-004：in-flow 關閉行接管出口（默認角落 X 關掉防疊字）；
            固定高方案已撤（max-h 上限保留，面板永不超視口）。
            DEF-20261003-007：關自動搶焦（默認搶底部輸入框致開即到底）。 */}
        <SheetContent
          id="wtd-checkin-sheet"
          side="bottom"
          showCloseButton={false}
          initialFocus={false}
          className={`${styles.v2scope} max-h-[85svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
        >
          {/* DEF-20261003-004：頂部常駐關閉行（文檔流內，滾不到頂也能回來；
              抓手沿舊樣式，X 走 SheetClose，Esc／點遮罩照走）。 */}
          <div className="flex shrink-0 items-center gap-2">
            <span aria-hidden className="flex-1" />
            <div aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            <span aria-hidden className="flex-1" />
            <SheetClose
              render={
                <Button variant="ghost" size="icon-sm" aria-label={t("close")}>
                  <X aria-hidden />
                </Button>
              }
            />
          </div>
          {(() => {
            // UR C.10 返工：他人卡進同一 Sheet（grabber／Header／X 共用，
            // 與自家同容器，錯位按構造消失；浮動卡退役）。
            if (card !== null && card.kind === "other") {
              return (
                <>
                  {/* 抓手已上移共用關閉行（DEF-20261003-004），此處不再重複。 */}
                  <SheetHeader className="text-left">
                    <SheetTitle className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate">{card.title}</span>
                      <Badge variant="outline">{t(GENDER_KEY[card.gender])}</Badge>
                      {card.online && <Badge>{t("onlineNow")}</Badge>}
                    </SheetTitle>
                    <SheetDescription>
                      {card.checkedInAt !== null
                        ? formatSeenAgo(card.checkedInAt, nowMs, locale)
                        : ""}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 pt-1.5 text-sm text-muted-foreground">
                        {card.avatarUrl !== null &&
                        /^https?:\/\//.test(card.avatarUrl) ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={card.avatarUrl}
                            alt=""
                            loading="lazy"
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-sm">
                            {card.avatarEmoji ?? card.title.slice(0, 1)}
                          </span>
                        )}
                        {card.title}
                      </p>
                    </div>
                    {/* UR E.13：他人分支自家卡管理（身份走 GET is_author；删除两段＋站内分享）。 */}
                    {otherDetail?.isAuthor === true && (
                      <span className="shrink-0">
                        {otherConfirmDelete ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive text-destructive"
                            onClick={() => {
                              void handleDeleteOther(card.id);
                            }}
                          >
                            <Trash2 size={15} aria-hidden />
                            {t("confirmDelete")}
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={t2("checkinMore")}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal size={16} aria-hidden />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className={styles.v2scope}>
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setOtherConfirmDelete(true)}
                                >
                                  <Trash2 size={15} aria-hidden />
                                  {t("deleteEntry")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setShareTarget({
                                      checkinId: card.id,
                                      snippet:
                                        card.sub !== "" ? card.sub : card.drink !== "" ? card.drink : card.title,
                                      place: card.sub,
                                      lat: card.lat,
                                      lng: card.lng,
                                    })
                                  }
                                >
                                  <Share2 size={15} aria-hidden />
                                  {t2("checkinShareToFriend")}
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </span>
                    )}
                  </div>
                  {/* UR E.3 round-3 IG 式单视觉槽：有实拍即主视觉（限高），酒 hero 只在无图时垫底，不再双图三明治。 */}
                  {/* UR E.11：三件套在飛即骨架佔位（照片＋文字；語音稀有段到才掛，不佔位）；
                      落定／失敗走舊口徑（真圖／hero／藏行），不無限骨架。 */}
                  {otherDetailLoading ? (
                    <div className="flex flex-col gap-2" aria-hidden>
                      <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
                      <div className="h-44 max-h-[25svh] w-full animate-pulse rounded-xl bg-muted" />
                    </div>
                  ) : (
                    <>
                      {otherDetail?.note && (
                        <p className="pt-1 text-sm">{otherDetail.note}</p>
                      )}
                      {otherDetail?.photoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={otherDetail.photoUrl}
                          alt=""
                          loading="lazy"
                          className="max-h-[25svh] w-full rounded-xl object-cover"
                        />
                      ) : (
                        <span className="w-full shrink-0 overflow-hidden rounded-xl border bg-card p-1">
                          {(() => {
                            const hero =
                              card.drink !== "" ? beerByName(card.drink) : null;
                            return hero !== null ? (
                              <BeerImg key={hero.id} beer={hero} tall />
                            ) : (
                              <span aria-hidden className="flex aspect-[3/4] w-full items-center justify-center text-4xl">
                                {card.emoji}
                              </span>
                            );
                          })()}
                        </span>
                      )}
                    </>
                  )}
                  {/* 主行动双排（问答定案A）：对人的乾杯／约酒放大紧贴照片，半宽主钮；
                      对内容的赞／评／想喝／分享留 Extra 第二排。 */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleCheers(card.id)}
                      disabled={!canCheers(sentIds)}
                      className="h-11 flex-1 rounded-full text-[15px] font-bold"
                    >
                      {sentIds.includes(card.id)
                        ? t("cheersSent")
                        : t("cheers")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleInvite(card.id)}
                      className="h-11 flex-1 rounded-full text-[15px] font-bold"
                    >
                      {invites[card.id] === "accepted"
                        ? t("inviteAccepted")
                        : invites[card.id] === "sent"
                          ? t("inviteSent")
                          : t("inviteCta")}
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {canCheers(sentIds)
                      ? t("cheersLeft", { n: cheersRemaining(sentIds) })
                      : t("cheersLimitReached")}
                  </span>
                  <div className="flex flex-col gap-1.5 text-sm">
                    {card.sub !== "" && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={15} aria-hidden />
                        <span className="min-w-0 truncate">{card.sub}</span>
                      </span>
                    )}
                    {selfPos !== null && (
                      <span className="flex items-center gap-1.5">
                        <Footprints size={15} aria-hidden />
                        {formatDistance(
                          haversineMeters(selfPos, {
                            lat: card.lat,
                            lng: card.lng,
                          }),
                        )}
                      </span>
                    )}
                  </div>
                  {/* UR E.10：酒 pills＋互动栏（DB 真行才挂；品牌／评分／地点＋赞／评数／想喝／分享，沿原型 §3–4）。 */}
                  {apiPins.some((p) => p.id === card.id) ? (
                    <CheckinDetailExtra
                      checkinId={card.id}
                      fallbackBeerName={card.drink === "" ? null : card.drink}
                      fallbackPlace={card.sub === "" ? null : card.sub}
                      lat={card.lat}
                      lng={card.lng}
                      commentsAnchorId="v2c-other"
                    />
                  ) : null}
                  {/* UR E.7：留言（真釘才有 DB id；MOCK 無行不掛）。 */}
                  {apiPins.some((p) => p.id === card.id) ? (
                    <V2Comments checkinId={card.id} anchorId="v2c-other" />
                  ) : null}
                  {/* UR E.2：他人三件套（詳情按需拉；照片已上移主视觉，此处只剩文字——IG 式 caption 紧贴照片下）。 */}
                  {otherDetail?.audioUrl ? (
                    <audio controls src={otherDetail.audioUrl} className="h-9 w-full" />
                  ) : null}
                </>
              );
            }
            const rec =
              wantSheetAt === null
                ? undefined
                : wantHistory.find((w) => w.at === wantSheetAt);
            if (rec === undefined) return null;
            // DEF-014：渲染前對活目錄取新（DB 回退行按 beer_id 恢復正名正圖；UR E.3 无酒即 null）
            const fresh = rec.beer === null ? null : resolveFreshBeer(rec.beer);
            const dist =
              selfPos !== null
                ? formatDistance(haversineMeters(selfPos, rec.position))
                : null;
            return (
              <>
                {/* 抓手已上移共用關閉行（DEF-20261003-004），此處不再重複。 */}
                {/* UR C.11 round-3：目錄來才有返回（沿 C.5 返回鍵口徑，文案复用 trailBack） */}
                {wantReturnTo === "stops" && (
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-1 text-muted-foreground"
                      onClick={() => {
                        setWantSheetAt(null);
                        setSwapOpen(false);
                        setConfirmDelete(false);
                        setOtherConfirmDelete(false);
                        setStopsOpen(true);
                      }}
                    >
                      <ChevronLeft size={16} aria-hidden />
                      {t("trailBack")}
                    </Button>
                  </div>
                )}
                <SheetHeader className="text-left">
                  <SheetTitle className="flex flex-wrap items-center gap-1.5">
                    {t("wantTitle")}
                    <Badge variant="outline">{t(GENDER_KEY[MOCK_ME.gender])}</Badge>
                    <Badge variant="secondary">{modeLabel}</Badge>
                  </SheetTitle>
                  <SheetDescription>{formatSeenAgo(rec.at, nowMs, locale)}</SheetDescription>
                </SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold">
                      {fresh === null ? t("you") : fresh.name}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 pt-1.5 text-sm text-muted-foreground">
                      <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-sm">
                        {MOCK_ME.avatarEmoji}
                      </span>
                      {t("you")}
                      {rec.kind !== undefined && (
                        <Badge variant="outline">
                          {rec.kind === "flash" ? t2("flashTitle") : t2("postTitle")}
                        </Badge>
                      )}
                    </p>
                  </div>
                  {/* DEF-20261003-008：管理⋯统一到頂部頭像行（与他人分支自家卡同位；
                      删除两段确认同行，底部按钮行只留换酒）。 */}
                  <span className="shrink-0">
                    {confirmDelete ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive text-destructive"
                        onClick={() => {
                          void handleDeleteWant();
                        }}
                      >
                        <Trash2 size={15} aria-hidden />
                        {t("confirmDelete")}
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={t2("checkinMore")}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal size={16} aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={styles.v2scope}>
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setConfirmDelete(true)}
                            >
                              <Trash2 size={15} aria-hidden />
                              {t("deleteEntry")}
                            </DropdownMenuItem>
                            {rec.id !== undefined && rec.id !== "" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setShareTarget({
                                    checkinId: rec.id as string,
                                    snippet: rec.placeName ?? fresh?.name ?? t("you"),
                                    place: rec.placeName ?? "",
                                    lat: rec.position.lat,
                                    lng: rec.position.lng,
                                  })
                                }
                              >
                                <Share2 size={15} aria-hidden />
                                {t2("checkinShareToFriend")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </span>
                </div>
                {/* DEF-20260929-007 round-4：文案压图（作者视角不加名字，header 已有作者）。 */}
                {rec.note && (
                  <p className="pt-1 text-sm">{rec.note}</p>
                )}
                {rec.photoDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={rec.photoDataUrl}
                    alt=""
                    className="max-h-[25svh] w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    <Camera size={16} aria-hidden />
                    {t2("wantPhotoSoon")}
                  </div>
                )}
                <div className="flex flex-col gap-1.5 text-sm">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={15} aria-hidden />
                    {rec.placeName ?? formatWantCoords(rec.position)}
                  </span>
                  {dist !== null && (
                    <span className="flex items-center gap-1.5">
                      <Footprints size={15} aria-hidden />
                      {dist}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{t("wantFrozenNote")}</span>
                </div>
                {/* UR E.10：酒 pills＋互动栏＋作者评分（DB 真行才挂；自家可设星，他人只读）。 */}
                {rec.id !== undefined && rec.id !== "" ? (
                  <CheckinDetailExtra
                    checkinId={rec.id}
                    fallbackBeerName={fresh?.name ?? null}
                    fallbackPlace={rec.placeName ?? null}
                    lat={rec.position.lat}
                    lng={rec.position.lng}
                    commentsAnchorId="v2c-self"
                  />
                ) : null}
                {rec.audio && (
                  <audio controls src={rec.audio.url} className="h-9 w-full" />
                )}
                {/* 底部只留换酒（管理⋯已上移頭像行，见 DEF-20261003-008）。 */}
                {fresh !== null && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleSwapToggle}>
                      <Dices size={15} aria-hidden />
                      {t("swapBeer")}
                    </Button>
                  </div>
                )}
                {/* UR E.7：留言（mine 回顯有 DB id 才掛；本地單機記錄無行不掛）。 */}
                {rec.id !== undefined && rec.id !== "" ? (
                  <V2Comments checkinId={rec.id} anchorId="v2c-self" />
                ) : null}
                {swapOpen && (
                  <div>
                    <div className="grid grid-cols-3 gap-2">
                      {swapBatch.map((b) => (
                        <Card size="sm" key={b.id} className="overflow-hidden p-0">
                          <Button
                            variant="ghost"
                            onClick={() => handleSwapTo(b)}
                            className="flex h-auto w-full flex-col items-center gap-1 rounded-none p-2"
                          >
                            <BeerImg beer={b} tall />
                            <span className="w-full truncate text-center text-xs font-medium">{b.name}</span>
                          </Button>
                        </Card>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 w-full" onClick={handleSwapRefresh}>
                      <RefreshCw size={15} aria-hidden />
                      {t("pickNextBatch")}
                    </Button>
                  </div>
                )}
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* UR E.13：站内分享好友选择器（自家两入口共用；发完去留问）。 */}
      {shareTarget !== null && (
        <FriendPicker
          open
          checkinId={shareTarget.checkinId}
          snippet={shareTarget.snippet}
          place={shareTarget.place}
          lat={shareTarget.lat}
          lng={shareTarget.lng}
          onClose={() => setShareTarget(null)}
          onSent={(result) => setShareDone(result)}
        />
      )}
      {/* UR E.13 round-2：微信式去留（成功数＋去聊天／留当前）。 */}
      {shareDone !== null && (
        <ShareDoneDialog result={shareDone} onClose={() => setShareDone(null)} />
      )}

      {/* UR C.11 返工 R-A：記錄目錄 Sheet（目錄；行點即飛＋開 want Sheet 詳情管理） */}
      <Sheet
        open={stopsOpen}
        onOpenChange={(v) => {
          if (!v) setStopsOpen(false);
        }}
      >
        <SheetContent side="bottom" className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}>
          <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
          {(() => {
            const rows = [...wantHistory].sort((a, b) => b.at - a.at);
            if (rows.length === 0) {
              return (
                <>
                  <SheetHeader className="text-left">
                    <SheetTitle>{t("trailTitle", { n: 0 })}</SheetTitle>
                  </SheetHeader>
                  <p className="text-sm text-muted-foreground">{t("trailEmpty")}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStopsOpen(false);
                      openPick();
                    }}
                  >
                    <Dices size={15} aria-hidden />
                    {t("pickTitle")}
                  </Button>
                </>
              );
            }
            const newest = rows[0] as WantRecord;
            return (
              <>
                <SheetHeader className="text-left">
                  <SheetTitle>{t("trailTitle", { n: rows.length })}</SheetTitle>
                  <SheetDescription>
                    {formatWantTime(newest.at, locale)}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-2">
                  {rows.map((r) => (
                    <Button
                      key={r.at}
                      variant="outline"
                      onClick={() => openStopRecord(r.at)}
                      className="h-auto w-full justify-start gap-3 p-2"
                    >
                      <span className="w-14 shrink-0 overflow-hidden rounded-lg border bg-card p-0.5">
                        {r.beer === null ? (
                          <span aria-hidden className="flex aspect-square w-full items-center justify-center text-2xl">
                            📷
                          </span>
                        ) : (
                          <BeerImg beer={r.beer} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-bold">
                          {r.beer === null ? (r.note && r.note !== "" ? r.note : t("you")) : r.beer.name}
                        </span>
                        <span className="block truncate pt-0.5 text-xs font-normal text-muted-foreground">
                          {formatWantTime(r.at, locale)} ·{" "}
                          {r.placeName ?? formatWantCoords(r.position)}
                        </span>
                      </span>
                      <ChevronRight size={16} aria-hidden className="shrink-0 text-muted-foreground" />
                    </Button>
                  ))}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* UR C.14 round-2：+N 堆疊列表 Sheet（同點超 cap 組；行點開卡，另可一鍵散開） */}
      <Sheet
        open={stackIds !== null}
        onOpenChange={(v) => {
          if (!v) setStackIds(null);
        }}
      >
        <SheetContent side="bottom" className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}>
          {(() => {
            if (stackIds === null) return null;
            const rows = stackIds
              .map((id) => others.find((o) => o.id === id))
              .filter((r): r is V2Marker => r !== undefined);
            return (
              <>
                <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
                <SheetHeader className="text-left">
                  <SheetTitle>{t("stackTitle", { n: rows.length })}</SheetTitle>
                  <SheetDescription>{t("stackHint")}</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-2">
                  {rows.map((m) => (
                    <Button
                      key={m.id}
                      variant="outline"
                      onClick={() => {
                        setStackIds(null);
                        openPin(m.id);
                      }}
                      className="h-auto w-full justify-start gap-3 p-2"
                    >
                      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xl">
                        {m.drinkEmoji ?? m.label}
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-bold">
                          {m.drink ?? m.label}
                        </span>
                        {m.online && (
                          <span className="block truncate pt-0.5 text-xs font-normal text-muted-foreground">
                            {t("onlineNow")}
                          </span>
                        )}
                      </span>
                      <ChevronRight size={16} aria-hidden className="shrink-0 text-muted-foreground" />
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (stackIds !== null) mapApi.current?.spreadStack(stackIds);
                    setStackIds(null);
                  }}
                >
                  {t("stackSpread")}
                </Button>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* UR E.6 round-8：热点成员 Sheet（查看打卡：连通片全部打卡列表，行点开卡沿 openPin 全量详情） */}
      <Sheet
        open={heatSheetOpen && heatCell !== null}
        onOpenChange={(v) => {
          if (!v) setHeatSheetOpen(false);
        }}
      >
        <SheetContent side="bottom" className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}>
          {(() => {
            if (heatCell === null || heatSummary === null) return null;
            return (
              <>
                <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
                <SheetHeader className="text-left">
                  <SheetTitle>{heatSummary.area ?? t2("hotspotUnknown")}</SheetTitle>
                  <SheetDescription>
                    {t2("hotspotInfo", {
                      n: heatSummary.count,
                      d:
                        heatSummary.distanceM === null
                          ? "—"
                          : formatDistance(heatSummary.distanceM),
                    })}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-2">
                  {heatMembers.map((m) => {
                    const parts = [
                      m.drink !== "" ? m.drink : null,
                      m.area,
                      heatOrigin !== null
                        ? formatDistance(
                            haversineMeters(heatOrigin, { lat: m.lat, lng: m.lng }),
                          )
                        : null,
                    ].filter((x): x is string => x !== null && x !== "");
                    return (
                      <Button
                        key={m.id}
                        variant="outline"
                        onClick={() => {
                          setHeatSheetOpen(false);
                          openPin(m.id);
                        }}
                        className="h-auto w-full justify-start gap-3 p-2"
                      >
                        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xl">
                          {m.emoji}
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-bold">
                            {m.title}
                          </span>
                          {parts.length > 0 && (
                            <span className="block truncate pt-0.5 text-xs font-normal text-muted-foreground">
                              {parts.join(" · ")}
                            </span>
                          )}
                        </span>
                        <ChevronRight size={16} aria-hidden className="shrink-0 text-muted-foreground" />
                      </Button>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* UR E.3 相機一页流直发（compose 内 kind＋酒已定；匿名／守卫走导航，行内不报错）。 */}
      <V2CameraSheet
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onPublish={publishShot}
      />

    </div>
  );
}
