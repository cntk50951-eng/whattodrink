/**
 * UR4.1 公開牆貼文 — localStorage 本地持久化（Web POC 水位；UI 先行 mock，
 * 後端落地時整塊換 Supabase，見 docs/data/future-schema.md `post_likes`／
 * `post_reports`）。配方沿 UR1.8 `wantRecord`：localStorage 不可信，
 * 一律經 parseWallPost 校驗才進 state；種子時間相對模組加載時刻，
 * 保證「24h 熱門」窗口永遠有活數據（沿 MOCK_CHECKINS 口徑）。
 */

import type { Gender } from "./me";

export type PostAuthor = {
  nickname: string;
  avatarEmoji: string;
  gender: Gender;
  /** true＝我發的（可刪），false＝種子／他人（可檢舉）。 */
  me: boolean;
};

export type WallPost = {
  id: string;
  /** 下採樣後 dataURL（拍攝時壓到 ≤1024px，見 camera-flow capture）。 */
  photo: string;
  /** 分享文字（可空，空即純圖）。 */
  note: string;
  /** 語音秒數（可空）。blob 只活在會話內存（audioUrls），不進 localStorage。 */
  audioSeconds: number | null;
  /**
   * 小段語音的 dataURL 持久化（≤400KB 才存；會話 object URL 優先，
   * 這個只管 reload 後還能播；存不下就 null，會話照播）。
   */
  audioDataUrl: string | null;
  transcript: string;
  likes: number;
  likedByMe: boolean;
  /** Epoch ms。 */
  createdAt: number;
  author: PostAuthor;
  /** true＝被我檢舉 → 牆上過濾掉（mock 安全網，V1 最低限度）。 */
  reported: boolean;
};

export const WALL_STORAGE_KEY = "wtd-wall-my-posts";
export const WALL_SEEN_KEY = "wtd-wall-seen-at";
/** 語音 dataURL 持久化上限（400KB；超了只活會話，不擋分享）。 */
export const AUDIO_DATAURL_MAX = 400 * 1024;

/** 超 cap 回 null（配額保命；調用方不分支，會話播放照常）。 */
export function fitAudioDataUrl(dataUrl: string | null): string | null {
  if (dataUrl === null) return null;
  return dataUrl.length <= AUDIO_DATAURL_MAX ? dataUrl : null;
}
/** 本地最多留 20 篇（照片 dataURL 吃空間，保 localStorage 配額）。 */
export const MAX_STORED_POSTS = 20;
/** 「今日熱門」窗口：過去 24h。 */
export const HOT_WINDOW_MS = 24 * 3600_000;

/* ---- 會話內語音 object URL（不持久化，reload 即失，mock 誠實口徑） ---- */

const audioUrls = new Map<string, string>();

export function setPostAudioUrl(id: string, url: string): void {
  audioUrls.set(id, url);
}

/**
 * 牆擁有的 URL：調用方傳 blob，另開一條 object URL 登記。
 * 不跟 composer 的錄音 URL 共用——重錄／再來一張 revoke 掉那邊，
 * 已發表的貼文不受牽連（v6 416 第二兇手）。
 */
export function ownPostAudioUrl(id: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  audioUrls.set(id, url);
  return url;
}

export function getPostAudioUrl(id: string): string | null {
  return audioUrls.get(id) ?? null;
}

/* ---- 種子照片：程序化 SVG dataURL（離線可用，免外鏈，不碰真人圖） ---- */

function seedPhoto(hue: number, glyph: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">` +
    `<rect width="300" height="400" fill="hsl(${hue},45%,88%)"/>` +
    `<circle cx="60" cy="70" r="26" fill="hsl(${hue},60%,72%)"/>` +
    `<circle cx="248" cy="330" r="34" fill="hsl(${(hue + 40) % 360},55%,75%)"/>` +
    `<text x="150" y="225" text-anchor="middle" font-size="110">${glyph}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SEED_AT = Date.now();
const HOURS = 3600_000;

/** 6 篇種子：時間散在 24h 內外，讚數拉開差距，熱門／最新兩檔都有戲。 */
export const MOCK_POSTS: WallPost[] = [
  {
    id: "seed-post-01",
    photo: seedPhoto(18, "🍺"),
    note: "收工！第一杯永遠最好飲",
    audioSeconds: null,
    audioDataUrl: null,
    transcript: "",
    likes: 24,
    likedByMe: false,
    createdAt: SEED_AT - 2 * HOURS,
    author: { nickname: "阿怡", avatarEmoji: "👩", gender: "female", me: false },
    reported: false,
  },
  {
    id: "seed-post-02",
    photo: seedPhoto(210, "🍶"),
    note: "",
    audioSeconds: null,
    audioDataUrl: null,
    transcript: "",
    likes: 18,
    likedByMe: false,
    createdAt: SEED_AT - 5 * HOURS,
    author: { nickname: "Ken", avatarEmoji: "🧑", gender: "male", me: false },
    reported: false,
  },
  {
    id: "seed-post-03",
    photo: seedPhoto(340, "🍷"),
    note: "一個人的儀式感",
    audioSeconds: null,
    audioDataUrl: null,
    transcript: "",
    likes: 31,
    likedByMe: false,
    createdAt: SEED_AT - 8 * HOURS,
    author: { nickname: "Mandy", avatarEmoji: "👧", gender: "female", me: false },
    reported: false,
  },
  {
    id: "seed-post-04",
    photo: seedPhoto(150, "🍸"),
    note: "朋友突然約的夜晚",
    audioSeconds: null,
    audioDataUrl: null,
    transcript: "",
    likes: 7,
    likedByMe: false,
    createdAt: SEED_AT - 26 * HOURS,
    author: { nickname: "大佬", avatarEmoji: "👨", gender: "male", me: false },
    reported: false,
  },
  {
    id: "seed-post-05",
    photo: seedPhoto(45, "🥃"),
    note: "值得為自己慶祝",
    audioSeconds: null,
    audioDataUrl: null,
    transcript: "",
    likes: 15,
    likedByMe: false,
    createdAt: SEED_AT - 12 * HOURS,
    author: { nickname: "阿K", avatarEmoji: "🧒", gender: "secret", me: false },
    reported: false,
  },
  {
    id: "seed-post-06",
    photo: seedPhoto(280, "🍹"),
    note: "",
    audioSeconds: null,
    audioDataUrl: null,
    transcript: "",
    likes: 3,
    likedByMe: false,
    createdAt: SEED_AT - 40 * HOURS,
    author: { nickname: "Suki", avatarEmoji: "👱‍♀️", gender: "female", me: false },
    reported: false,
  },
];

/* ---- 校驗＋持久化（storage 內容不可信） ---- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAuthor(raw: unknown): PostAuthor | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.nickname !== "string" ||
    typeof raw.avatarEmoji !== "string" ||
    (raw.gender !== "male" && raw.gender !== "female" && raw.gender !== "secret") ||
    typeof raw.me !== "boolean"
  ) {
    return null;
  }
  return {
    nickname: raw.nickname,
    avatarEmoji: raw.avatarEmoji,
    gender: raw.gender,
    me: raw.me,
  };
}

/**
 * v5 時代的空包（0-byte blob 存成的 `data:audio/…;base64,`）——
 * 播出來就是 416。逗號後無 payload 即視為「從沒錄到」，不進數據。
 */
export function isEmptyAudioDataUrl(url: string): boolean {
  const comma = url.indexOf(",");
  return comma >= 0 && url.slice(comma + 1).length === 0;
}

/** Pure validator — storage content is untrusted input. */
export function parseWallPost(raw: unknown): WallPost | null {
  if (!isRecord(raw)) return null;
  const author = parseAuthor(raw.author);
  if (
    typeof raw.id !== "string" ||
    raw.id.length === 0 ||
    typeof raw.photo !== "string" ||
    !raw.photo.startsWith("data:image/") ||
    typeof raw.note !== "string" ||
    (typeof raw.audioSeconds !== "number" && raw.audioSeconds !== null) ||
    (raw.audioDataUrl !== undefined &&
      raw.audioDataUrl !== null &&
      (typeof raw.audioDataUrl !== "string" ||
        !raw.audioDataUrl.startsWith("data:audio/"))) ||
    typeof raw.transcript !== "string" ||
    typeof raw.likes !== "number" ||
    !Number.isFinite(raw.likes) ||
    typeof raw.likedByMe !== "boolean" ||
    typeof raw.createdAt !== "number" ||
    !Number.isFinite(raw.createdAt) ||
    author === null ||
    typeof raw.reported !== "boolean"
  ) {
    return null;
  }
  // 空包字符串才中和秒數；null（會話 URL／無錄音）保持原樣。
  const storedUrl =
    typeof raw.audioDataUrl === "string" ? raw.audioDataUrl : null;
  const emptyClip = storedUrl !== null && isEmptyAudioDataUrl(storedUrl);
  return {
    id: raw.id,
    photo: raw.photo,
    note: raw.note,
    audioSeconds: emptyClip ? null : raw.audioSeconds,
    transcript: raw.transcript,
    audioDataUrl: emptyClip ? null : storedUrl,
    likes: Math.max(0, Math.floor(raw.likes)),
    likedByMe: raw.likedByMe,
    createdAt: raw.createdAt,
    author,
    reported: raw.reported,
  };
}

function readStorage(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function loadMyPosts(): WallPost[] {
  const raw = readStorage(WALL_STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  const posts: WallPost[] = [];
  for (const item of raw) {
    const post = parseWallPost(item);
    if (post !== null) posts.push(post);
  }
  return posts;
}

export function saveMyPosts(posts: WallPost[]): void {
  const write = (list: WallPost[]): void => {
    localStorage.setItem(
      WALL_STORAGE_KEY,
      JSON.stringify(list.slice(0, MAX_STORED_POSTS)),
    );
  };
  try {
    write(posts);
  } catch {
    try {
      // 配額爆了：丟語音 dataURL 保照片＋文字（mock 退化，不丟整牆）。
      write(posts.map((p) => ({ ...p, audioDataUrl: null })));
    } catch {
      /* 全丟也認，會話內牆照常（mock 水位；真後端不走這條）。 */
    }
  }
}

/** 牆＝我的（未檢舉）＋種子（未檢舉）。檢舉只藏不刪（mock 安全網）。 */
export function loadWall(): WallPost[] {
  const overrides = loadOverrides();
  return [...loadMyPosts(), ...MOCK_POSTS]
    .map((p) => {
      const o = overrides[p.id];
      return o === undefined
        ? p
        : { ...p, likes: o.likes, likedByMe: o.likedByMe, reported: o.reported };
    })
    .filter((p) => !p.reported);
}

export type PostOverride = {
  likes: number;
  likedByMe: boolean;
  reported: boolean;
};

export const WALL_OVERRIDES_KEY = "wtd-wall-overrides";

/**
 * 種子／他人貼文的本地覆寫（讚／檢舉 reload 不丟；種子本身是常量）。
 * 自己的貼文直接改 my-posts，不走這裡。
 */
export function loadOverrides(): Record<string, PostOverride> {
  const raw = readStorage(WALL_OVERRIDES_KEY);
  if (!isRecord(raw)) return {};
  const out: Record<string, PostOverride> = {};
  for (const [id, o] of Object.entries(raw)) {
    if (
      isRecord(o) &&
      typeof o.likes === "number" &&
      Number.isFinite(o.likes) &&
      typeof o.likedByMe === "boolean" &&
      typeof o.reported === "boolean"
    ) {
      out[id] = {
        likes: Math.max(0, Math.floor(o.likes)),
        likedByMe: o.likedByMe,
        reported: o.reported,
      };
    }
  }
  return out;
}

/**
 * 統一落盤：自己的改 my-posts，他人的記 overrides。UI 只調這一個。
 * @returns false＝兩邊都找不到（不該發生，調用方當 no-op）。
 */
export function persistPost(post: WallPost): boolean {
  if (post.author.me) {
    const mine = loadMyPosts();
    if (!mine.some((p) => p.id === post.id)) return false;
    saveMyPosts(mine.map((p) => (p.id === post.id ? post : p)));
    return true;
  }
  saveOverride(post.id, post);
  return true;
}

/** 刪自己的貼文（牆上即消失；種子刪不掉，調用方先判 me）。 */
export function deleteMyPost(id: string): void {
  saveMyPosts(loadMyPosts().filter((p) => p.id !== id));
}

export function saveOverride(id: string, post: WallPost): void {
  try {
    const all = loadOverrides();
    all[id] = { likes: post.likes, likedByMe: post.likedByMe, reported: post.reported };
    localStorage.setItem(WALL_OVERRIDES_KEY, JSON.stringify(all));
  } catch {
    /* 記不住讚而已，不擋路。 */
  }
}

/* ---- 排序＋紅點（純函數，可測） ---- */

/** 今日熱門：24h 內按讚排序（每天自然洗牌，老霸榜沉底）。 */
export function sortHot(posts: WallPost[], now: number): WallPost[] {
  return posts
    .filter((p) => now - p.createdAt < HOT_WINDOW_MS)
    .sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt);
}

/** 最新：純時間倒序。 */
export function sortLatest(posts: WallPost[]): WallPost[] {
  return [...posts].sort((a, b) => b.createdAt - a.createdAt);
}

/** 讚切換（樂觀更新即調它）：開→＋1，關→−1（ floor 0）。 */
export function toggleLike(post: WallPost): WallPost {
  const likedByMe = !post.likedByMe;
  return {
    ...post,
    likedByMe,
    likes: Math.max(0, post.likes + (likedByMe ? 1 : -1)),
  };
}

export function loadWallSeenAt(): number {
  const raw = readStorage(WALL_SEEN_KEY);
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

export function saveWallSeenAt(at: number): void {
  try {
    localStorage.setItem(WALL_SEEN_KEY, JSON.stringify(at));
  } catch {
    /* 記不住已讀而已，不擋路。 */
  }
}

/** 有比上次已讀更新的貼文 → 選單紅點。 */
export function hasUnseenWall(posts: WallPost[], seenAt: number): boolean {
  return posts.some((p) => p.createdAt > seenAt);
}

export function newPostId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `post-${crypto.randomUUID()}`;
  }
  return `post-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
