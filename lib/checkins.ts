/**
 * MOCK check-in seed data for the UR1.1 drink map prototype.
 *
 * ⚠️ Everything here is FAKE — placeholder avatars so the map feels alive
 * while there is no backend. EPIC 3 wires this up to Supabase; when that
 * lands, delete MOCK_CHECKINS and fetch real check-ins instead.
 * The map UI labels these entries with the i18n `map.mockNote` string.
 */

import type { LatLng } from "./geo";
import type { Gender } from "./me";

export type Checkin = {
  /** Stable id. Real backend will use row UUIDs. */
  id: string;
  nickname: string;
  /** UR2.0 mock avatar (emoji placeholder) + gender — future `users` join. */
  avatarEmoji: string;
  gender: Gender;
  /** Drink emoji — matches the product's existing emoji language (lib/beers.ts). */
  drinkEmoji: string;
  drinkName: string;
  area: string;
  position: LatLng;
  cheers: number;
  /**
   * UR2.5 打卡时刻（epoch ms）。种子按模块加载时算相对时间，
   * 保证"24h 内"窗口永远有活数据；真后端用 row 的 created_at。
   */
  checkedInAt: number;
  /**
   * UR3.3 上线时刻（epoch ms，同种子相对时间）：真后端是打开 APP 的心跳
   * （`users.last_seen_at`），5 分钟内算在线（见 lib/nearby.ts）。
   */
  onlineAt: number;
  /**
   * UR3.3 mock 邀约剧本：true＝对方婉拒（Mandy，验收拒绝态），false＝接受。
   * 真后端由对方点接受／拒绝，无此字段。
   */
  declinesInvite: boolean;
  /** Always true for seed data — lets the UI badge mock entries. */
  mock: true;
};

/** 模块加载时刻 —— 种子时间全是相对它算的，不会放久过期。 */
const SEED_AT = Date.now();
const HOURS = 3600_000;
const MINUTES = 60_000;

export const MOCK_CHECKINS: Checkin[] = [
  {
    id: "mock-cwb-01",
    nickname: "阿怡",
    avatarEmoji: "👩",
    gender: "female",
    drinkEmoji: "🍻",
    drinkName: "Asahi 生啤",
    area: "銅鑼灣",
    position: { lat: 22.2783, lng: 114.1827 },
    cheers: 12,
    checkedInAt: SEED_AT - 2 * HOURS,
    onlineAt: SEED_AT - 1 * MINUTES,
    declinesInvite: false,
    mock: true,
  },
  {
    id: "mock-central-01",
    nickname: "Kelvin",
    avatarEmoji: "🧑",
    gender: "male",
    drinkEmoji: "🥃",
    drinkName: "角嗨 Highball",
    area: "中環",
    position: { lat: 22.2819, lng: 114.1577 },
    cheers: 8,
    checkedInAt: SEED_AT - 5 * HOURS,
    onlineAt: SEED_AT - 2 * MINUTES,
    declinesInvite: false,
    mock: true,
  },
  {
    id: "mock-tst-01",
    nickname: "Mandy",
    avatarEmoji: "👧",
    gender: "female",
    drinkEmoji: "🍹",
    drinkName: "Mojito",
    area: "尖沙咀",
    position: { lat: 22.2976, lng: 114.1722 },
    cheers: 21,
    // 故意放过期（26h）：证明 24h 窗口真的会过滤，不是摆设。
    checkedInAt: SEED_AT - 26 * HOURS,
    onlineAt: SEED_AT - 3 * MINUTES,
    declinesInvite: true,
    mock: true,
  },
  {
    id: "mock-mk-01",
    nickname: "大佬明",
    avatarEmoji: "👨",
    gender: "male",
    drinkEmoji: "🍺",
    drinkName: "本地精釀 IPA",
    area: "旺角",
    position: { lat: 22.3193, lng: 114.1694 },
    cheers: 5,
    checkedInAt: SEED_AT - 0.5 * HOURS,
    onlineAt: SEED_AT - 4 * MINUTES,
    declinesInvite: false,
    mock: true,
  },
];
