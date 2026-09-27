"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  LocateFixed,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  Vibrate,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useMyMode } from "@/hooks/useMyMode";
import { useFriendRelation } from "@/hooks/useFriendRelation";
import { LOGOUT_CLEAR_EVENT } from "@/lib/auth/clear";
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
import {
  BEER_CATEGORIES,
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
import { MOCK_ME } from "@/lib/me";
import { trailStops } from "@/lib/trail";
import { iconForDrinkName, iconForPickId } from "@/components/marketing/beer-icons/wall";
import { WallIcon } from "@/components/marketing/beer-icons/doodle";
import { hasUnseenWall, loadWall, loadWallSeenAt } from "@/lib/posts";
import { buzz, BUZZ_CHEERS, BUZZ_FOUND } from "@/lib/haptics";
import { V2MapView } from "./V2MapView";
import type { V2MapApi } from "./V2MapView";
import { apiPinsToMarkers, mockToMarkers } from "./v2Pins";
import styles from "./v2.module.css";

/** UR2.0 mock 性別標記文案 key（三態，數據源見 lib/me.ts；沿 v1 DrinkMap 同表）。 */
const GENDER_KEY = {
  male: "genderMale",
  female: "genderFemale",
  secret: "genderSecret",
} as const;

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

  const { status: geoStatus, position: geoPos } = useGeolocation();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const { mode, patchMode } = useMyMode(isAuthed === true);
  const { isFriendCached, addFriendByCheckin } = useFriendRelation();
  const mapApi = useRef<V2MapApi | null>(null);

  const [apiPins, setApiPins] = useState<PinJson[]>([]);
  const [apiPinsLoaded, setApiPinsLoaded] = useState(false);
  const [wantHistory, setWantHistory] = useState<WantRecord[]>([]);
  const [, setBeerTick] = useState(0);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [invites, setInvites] = useState<Partial<Record<string, "sent" | "accepted">>>({});
  const [card, setCard] = useState<V2Card | null>(null);
  const [trailOn, setTrailOn] = useState(false);
  const [wallDot, setWallDot] = useState(false);

  // 選酒 sheet 三段：cats → batch → kinds → login（匿名）
  const [pickOpen, setPickOpen] = useState(false);
  // UR C.2：模式 pill 展開態（再點／選後自動收）
  const [modeOpen, setModeOpen] = useState(false);
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
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapBatch, setSwapBatch] = useState<Beer[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  // 登入態＋牆紅點＋酒目錄＋乾杯額度（mount 各一次，沿既有配方）
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user)).catch(() => setIsAuthed(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setIsAuthed(!!s?.user));
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
      setSentIds([]);
      setInvites({});
      setGuard(null);
      setPickOpen(false);
      setModeOpen(false);
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
        const fresh = resolveFreshBeer(w.beer);
        return {
          id: `want-${w.at}`,
          lat: w.position.lat,
          lng: w.position.lng,
          emoji: fresh.emoji,
          iconUrl:
            fresh.icon_url !== undefined && fresh.icon_url !== null && fresh.icon_url !== ""
              ? fresh.icon_url
              : null,
          Icon: iconForPickId(fresh.id) ?? iconForDrinkName(fresh.name),
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
          }))
        : null,
    [trailOn, wantHistory],
  );
  const wantMarkers = useMemo(
    () =>
      wants.map((w) => ({ id: w.id, lat: w.lat, lng: w.lng, emoji: w.emoji, iconUrl: w.iconUrl, Icon: w.Icon })),
    [wants],
  );
  const selfPos: LatLng | null =
    geoStatus === "success" && geoPos !== null ? geoPos : null;
  const cityCode = resolveCityCode(selfPos, null);
  const cityLabelKey =
    cityCode === null ? "cityName" : (`cityName_${cityCode}` as const);

  function openPin(id: string): void {
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
      });
      mapApi.current?.flyTo({ lat: api.lat, lng: api.lng });
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
      });
      mapApi.current?.flyTo({ lat: m.position.lat, lng: m.position.lng });
    }
  }

  // UR C.4：自家想喝釘改開底部 Sheet（浮動卡只留他人 kind）。
  function openWant(id: string): void {
    const at = Number(id.replace("want-", ""));
    const rec = wantHistory.find((w) => w.at === at);
    if (rec === undefined) return;
    setSwapOpen(false);
    setSwapBatch([]);
    setConfirmDelete(false);
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
    if (rec === undefined) return;
    setSwapBatch(pickSwapBatch(resolveFreshBeer(rec.beer), 6));
    setSwapOpen(true);
  }
  function handleSwapRefresh(): void {
    if (wantSheetAt === null || !swapOpen) return;
    const rec = wantHistory.find((w) => w.at === wantSheetAt);
    if (rec === undefined) return;
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
  function handleDeleteWant(): void {
    if (wantSheetAt === null) return;
    const at = wantSheetAt;
    const doomed = wantHistory.find((w) => w.at === at);
    const next = removeWantAt(wantHistory, at);
    setWantHistory(next);
    if (doomed !== undefined && doomed.id === undefined) saveWantHistory(next);
    setConfirmDelete(false);
    setSwapOpen(false);
    setWantSheetAt(null);
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

  function openPick(): void {
    setPickStage("cats");
    setLaneId(null);
    setBatch([]);
    setKindBeer(null);
    setPickOpen(true);
  }

  function dropWant(beer: Beer, kind: "flash" | "post"): void {
    if (isAuthed === false) {
      setPickStage("login");
      return;
    }
    void (async () => {
      const center = mapApi.current?.getCenter() ?? DEFAULT_CENTER;
      const position =
        geoStatus === "success" && geoPos !== null && isWithinHongKong(geoPos)
          ? geoPos
          : center;
      try {
        const res = await fetch("/api/v1/checkins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            beer_id: beer.id,
            lat: position.lat,
            lng: position.lng,
            place_name: null,
            kind,
          }),
        });
        if (res.status === 403) {
          setFriendState("unknown");
          setAddState("idle");
          setGuard({ action: "checkin", target: null });
          return;
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
        };
        // 登入以 DB 為準：只進會話態，不寫本地（沿 A.10）。
        setWantHistory((prev) => [...prev, record].sort((a, b) => a.at - b.at));
        setPickOpen(false);
      } catch {
        // 離線回退：本地快照（沿 v1 同配方）。
        const record: WantRecord = {
          beer,
          at: Date.now(),
          position,
          kind,
          visibility: "public",
          expiresAt: kind === "flash" ? Date.now() + 24 * 3600_000 : null,
        };
        const next = upsertWantHistory(wantHistory, record);
        setWantHistory(next);
        saveWantHistory(next);
        setPickOpen(false);
      }
    })();
  }

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
  const modeIcon =
    mode === "stealth" ? EyeOff : mode === "friends" ? Users : Globe;
  const ModeIcon = modeIcon;

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
      />

      {/* 頂部簇：頭像＋城市＋模式一行，pills 緊貼下方（DEF-012 round-2：
          之前兩段 absolute 留大縫＋不對齊，收進同一容器沿 Snap 緊湊左對齊） */}
      <div className="absolute inset-x-0 top-0 z-[1000] flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card shadow-md ring-1 ring-foreground/10">
            <Users size={18} aria-hidden className="text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl leading-tight font-bold tracking-tight">
              {t(cityLabelKey)}
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              {geoStatus === "success"
                ? t("meOnline")
                : geoStatus === "locating"
                  ? t("meLocating")
                  : t("meOffline")}
            </p>
          </div>
        {/* UR C.2 模式 pill：常駐圖標＋文字；點開 inline 三檔直切
            （選後自動收／再點收；匿名走登入）。Popover 已退役（入口隱形即死）。 */}
        <div className="relative flex shrink-0 flex-col items-end">
          {isAuthed === false ? (
            <Button
              size="sm"
              variant="outline"
              className="h-11 rounded-full bg-card px-3 font-bold shadow-md ring-1 ring-foreground/10"
              nativeButton={false}
              render={<Link href="/login" />}
            >
              <Users size={15} aria-hidden />
              {tm("switcherLabel")}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              aria-expanded={modeOpen}
              onClick={() => setModeOpen((v) => !v)}
              className="h-11 rounded-full bg-card px-3 font-bold shadow-md ring-1 ring-foreground/10"
            >
              <ModeIcon size={15} aria-hidden />
              {modeLabel}
            </Button>
          )}
          {modeOpen && isAuthed === true && (
            <Card size="sm" className="absolute top-full right-0 z-10 mt-1.5 w-44 p-1.5">
              {(
                [
                  { key: "stealth", label: tm("modeStealth"), Icon: EyeOff },
                  { key: "friends", label: tm("modeFriends"), Icon: Users },
                  { key: "public", label: tm("modePublic"), Icon: Globe },
                ] as const
              ).map(({ key, label, Icon }) => (
                <Button
                  key={key}
                  variant="ghost"
                  aria-pressed={mode === key}
                  onClick={() => {
                    void patchMode(key);
                    setModeOpen(false);
                  }}
                  className="w-full justify-start gap-2 px-2 py-2 font-medium"
                >
                  <Icon size={15} aria-hidden />
                  {label}
                  {mode === key && <span aria-hidden>✓</span>}
                </Button>
              ))}
            </Card>
          )}
        </div>
      </div>

      {/* 橫滑 pills（容器內緊貼頂欄行，同一左對齊） */}
      <div className={`flex gap-2 overflow-x-auto pb-1 ${styles.v2noscroll}`}>
        <Button size="sm" variant="outline" className="shrink-0 rounded-full bg-card shadow-md ring-1 ring-foreground/10" onClick={openPick}>
          <Dices aria-hidden />
          {tn("randomPick")}
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 rounded-full bg-card shadow-md ring-1 ring-foreground/10" nativeButton={false} render={<Link href="/camera" />}>
          <Camera aria-hidden />
          {tn("photoPick")}
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 rounded-full bg-card shadow-md ring-1 ring-foreground/10" nativeButton={false} render={<Link href="/wall" />}>
          <Flame aria-hidden />
          {tn("wallPick")}
        </Button>
        <Button
          size="sm"
          variant={trailOn ? "secondary" : "outline"}
          className={`shrink-0 rounded-full shadow-md ring-1 ring-foreground/10 ${trailOn ? "" : "bg-card"}`}
          onClick={() => setTrailOn((v) => !v)}
        >
          <Footprints aria-hidden />
          {t("footprints")}
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 rounded-full bg-card shadow-md ring-1 ring-foreground/10" onClick={doShake}>
          <Vibrate aria-hidden />
          {t("shakeHint")}
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
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setTrailOn(false)}>
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
            if (selfPos !== null) mapApi.current?.recenter();
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
        <Button
          size="icon"
          variant={trailOn ? "secondary" : "outline"}
          aria-label={t("footprints")}
          aria-pressed={trailOn}
          className={`rounded-full shadow-md ${trailOn ? "" : "bg-card"}`}
          onClick={() => setTrailOn((v) => !v)}
        >
          <Footprints aria-hidden />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label={t("shakeHint")}
          className="rounded-full bg-card shadow-md ring-1 ring-foreground/10"
          onClick={doShake}
        >
          <Vibrate aria-hidden />
        </Button>
      </div>

      {/* 輕提示 */}
      {note !== null && (
        <p role="status" className="absolute bottom-40 left-1/2 z-[1000] w-max max-w-[92%] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-md">
          {note}
        </p>
      )}

      {/* pin 卡（底部浮層，非錨定） */}
      {card !== null && (
        <Card className="absolute inset-x-3 bottom-24 z-[1000] shadow-lg">
          <CardHeader className="flex-row items-center gap-3">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-xl ring-1 ring-foreground/10">
              {card.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{card.title}</CardTitle>
              <CardDescription className="truncate">{card.sub}</CardDescription>
            </div>
            <Button size="icon-sm" variant="ghost" aria-label={t("close")} onClick={() => setCard(null)}>
              <X aria-hidden />
            </Button>
          </CardHeader>
          <Separator />
          <CardContent className="flex flex-wrap items-center gap-2">
            {card.kind === "other" && (
              <>
                <span className="text-sm font-medium">
                  {card.drink}
                  {selfPos !== null && (
                    <> · {formatDistance(haversineMeters(selfPos, { lat: card.lat, lng: card.lng }))}</>
                  )}
                </span>
                {card.online && <Badge>{t("onlineNow")}</Badge>}
                <span className="flex w-full gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => handleCheers(card.id)}
                    disabled={!canCheers(sentIds)}
                  >
                    {sentIds.includes(card.id) ? t("cheersSent") : t("cheers")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleInvite(card.id)}>
                    {invites[card.id] === "accepted"
                      ? t("inviteAccepted")
                      : invites[card.id] === "sent"
                        ? t("inviteSent")
                        : t("inviteCta")}
                  </Button>
                </span>
                <span className="w-full text-xs text-muted-foreground">
                  {canCheers(sentIds) ? t("cheersLeft", { n: cheersRemaining(sentIds) }) : t("cheersLimitReached")}
                </span>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 底部 CTA 列 */}
      {card === null && (
        <div className="absolute inset-x-3 bottom-20 z-[1000] flex items-end gap-2">
          <Button size="icon-lg" variant="outline" aria-label={tn("photoPick")} className="rounded-full bg-card shadow-md ring-1 ring-foreground/10" nativeButton={false} render={<Link href="/camera" />}>
            <Camera aria-hidden />
          </Button>
          <Button variant="outline" className="h-12 flex-1 rounded-full bg-card text-base font-bold shadow-md ring-1 ring-foreground/10" onClick={openPick}>
            <Dices aria-hidden />
            {t("pickTitle")}
          </Button>
          <Button
            variant="outline"
            aria-label={t2("addFriendSoon")}
            className="h-12 shrink-0 rounded-full bg-card px-4 font-bold shadow-md"
            onClick={() => flashNote(t2("addFriendSoon"))}
          >
            <Users aria-hidden />
            {t2("addFriendSoon")}
          </Button>
        </div>
      )}

      {/* 底部 TabBar */}
      <nav aria-label={tn("menu")} className="absolute inset-x-0 bottom-0 z-[1000] border-t bg-card pb-[env(safe-area-inset-bottom)]">
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
          <Link href="/camera" aria-label={t2("tabShoot")} className="flex justify-center">
            <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-md ring-1 ring-foreground/10">
              <Camera size={22} aria-hidden />
            </span>
          </Link>
          <Link href="/mood" className="flex flex-col items-center gap-0.5 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles size={20} aria-hidden />
            {t2("tabMood")}
          </Link>
          <Button
            variant="ghost"
            aria-pressed={trailOn}
            onClick={() => setTrailOn((v) => !v)}
            className={`flex h-auto flex-col items-center gap-0.5 rounded-none py-1.5 text-xs font-medium ${trailOn ? "font-bold" : "text-muted-foreground"}`}
          >
            <Footprints size={20} aria-hidden />
            {t2("tabTrail")}
          </Button>
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
                onClick={() => dropWant(kindBeer, "flash")}
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
                onClick={() => dropWant(kindBeer, "post")}
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
        open={wantSheetAt !== null}
        onOpenChange={(v) => {
          if (v) return;
          setWantSheetAt(null);
          setSwapOpen(false);
          setConfirmDelete(false);
        }}
      >
        <SheetContent side="bottom" className={`${styles.v2scope} max-h-[85svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}>
          {(() => {
            const rec =
              wantSheetAt === null
                ? undefined
                : wantHistory.find((w) => w.at === wantSheetAt);
            if (rec === undefined) return null;
            // DEF-014：渲染前對活目錄取新（DB 回退行按 beer_id 恢復正名正圖）
            const fresh = resolveFreshBeer(rec.beer);
            const dist =
              selfPos !== null
                ? formatDistance(haversineMeters(selfPos, rec.position))
                : null;
            return (
              <>
                <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
                <SheetHeader className="text-left">
                  <SheetTitle className="flex flex-wrap items-center gap-1.5">
                    {t("wantTitle")}
                    <Badge variant="outline">{t(GENDER_KEY[MOCK_ME.gender])}</Badge>
                    <Badge variant="secondary">{modeLabel}</Badge>
                  </SheetTitle>
                  <SheetDescription>{formatWantTime(rec.at, locale)}</SheetDescription>
                </SheetHeader>
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 overflow-hidden rounded-xl border bg-card p-1">
                    <BeerImg key={fresh.id} beer={fresh} tall />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold">{fresh.name}</p>
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
                </div>
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
                {/* 未來快拍入口佔位（純展示，不發請求） */}
                <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  <Camera size={16} aria-hidden />
                  {t2("wantPhotoSoon")}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSwapToggle}>
                    <Dices size={15} aria-hidden />
                    {t("swapBeer")}
                  </Button>
                  {confirmDelete ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive text-destructive"
                      onClick={handleDeleteWant}
                    >
                      <Trash2 size={15} aria-hidden />
                      {t("confirmDelete")}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={15} aria-hidden />
                      {t("deleteEntry")}
                    </Button>
                  )}
                </div>
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
    </div>
  );
}
