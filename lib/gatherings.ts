/**
 * UR F.1 组局发布核心纯函数（v2-only 新增，零改旧签名，F.7 审核前置可复用）。
 * 以交友聚会为导向，地点仅地图选点，描述必填，年龄一票否决。
 */

export const GATHERING_THEMES = [
  "friend_new",
  "casual",
  "party",
  "outdoor",
  "game",
  "soft",
] as const;
export type GatheringTheme = (typeof GATHERING_THEMES)[number];

export const GATHERING_VISIBILITY = ["public", "friends"] as const;
export type GatheringVisibility = (typeof GATHERING_VISIBILITY)[number];

export const GATHERING_APPROVAL = ["manual", "auto"] as const;
export type GatheringApproval = (typeof GATHERING_APPROVAL)[number];

export type GatheringStatus =
  | "open"
  | "full"
  | "ongoing"
  | "completed"
  | "cancelled"
  | "pending_review"
  | "expired";

export type GatheringInput = {
  title: string;
  theme: GatheringTheme;
  description: string;
  // 地点仅地图选点
  location_text: string;
  place_id: string;
  lat: number;
  lng: number;
  venue_id?: string | null;
  starts_at: string; // ISO
  capacity: number;
  visibility: GatheringVisibility;
  approval_mode: GatheringApproval;
  bring_text?: string | null;
  age_has_minor: boolean | null; // 必须申明
  agreed: boolean; // 免责勾选
};

// F.1 五项审查条件
export type GatheringValidationError = {
  field: "title" | "theme" | "description" | "location" | "time" | "capacity" | "age" | "agreed";
  reason: string;
};

const PRIVATE_KEYWORDS = ["私宅", "住宅", "酒店", "房间", "民宿", "上楼", "私宅", "apartment", "hotel", "residence"];

function containsPrivateKeyword(s: string): boolean {
  const lower = s.toLowerCase();
  return PRIVATE_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}

export function validateGatheringInput(
  input: GatheringInput,
  now: number = Date.now(),
): GatheringValidationError[] {
  const errs: GatheringValidationError[] = [];

  // 主题
  if (!GATHERING_THEMES.includes(input.theme)) {
    errs.push({ field: "theme", reason: "请选择交友聚会主题" });
  }

  // 标题
  const title = input.title.trim();
  if (title.length < 2 || title.length > 30) {
    errs.push({ field: "title", reason: "标题需 2–30 字" });
  } else if (containsPrivateKeyword(title)) {
    errs.push({ field: "title", reason: "标题含私宅/酒店等关键词，请改为公开场所" });
  }

  // 描述必填
  const desc = input.description.trim();
  if (desc.length === 0) {
    errs.push({ field: "description", reason: "请填写聚会简介" });
  } else if (desc.length < 10 || desc.length > 200) {
    errs.push({ field: "description", reason: "简介需 10–200 字" });
  } else if (containsPrivateKeyword(desc)) {
    errs.push({ field: "description", reason: "简介含私宅/酒店等关键词，请改为公开餐饮/户外场所" });
  }

  // 地点：仅地图选点
  if (!input.place_id || !input.location_text.trim() || Number.isNaN(input.lat) || Number.isNaN(input.lng)) {
    errs.push({ field: "location", reason: "请选择地图中的地点（不支持手输）" });
  } else if (containsPrivateKeyword(input.location_text)) {
    errs.push({ field: "location", reason: "该地点不适合公开组局，请选择持牌餐饮或公开户外场所" });
  }

  // 时间：未来 2h–14天
  const starts = Date.parse(input.starts_at);
  if (Number.isNaN(starts)) {
    errs.push({ field: "time", reason: "请选择有效时间" });
  } else {
    const min = now + 2 * 60 * 60 * 1000;
    const max = now + 14 * 24 * 60 * 60 * 1000;
    if (starts < min) errs.push({ field: "time", reason: "需至少 2 小时后" });
    if (starts > max) errs.push({ field: "time", reason: "需在 14 天内" });
  }

  // 人数
  if (!Number.isInteger(input.capacity) || input.capacity < 2 || input.capacity > 8) {
    errs.push({ field: "capacity", reason: "人数需 2–8 人" });
  }

  // 年龄申明：一票否决
  if (input.age_has_minor === null || input.age_has_minor === undefined) {
    errs.push({ field: "age", reason: "请申明是否有未成年人参与" });
  } else if (input.age_has_minor === true) {
    errs.push({ field: "age", reason: "组局不允许未成年人参与，请确认参与者均已年满 18 岁" });
  }

  // 免责
  if (!input.agreed) {
    errs.push({ field: "agreed", reason: "请勾选并同意免责声明" });
  }

  // 带的酒/食物全非必填，仅长度校验
  if (input.bring_text !== null && input.bring_text !== undefined && input.bring_text.trim().length > 30) {
    errs.push({ field: "title", reason: "带的酒/食物需 ≤30 字" });
  }

  return errs;
}

// 供 API 校验未成年与五项审查快速判定
export function shouldBlockForMinor(input: GatheringInput): boolean {
  return input.age_has_minor === true;
}

// 频控：周发 2 局、同时进行中 ≤1（纯函数，需传入现有局数）
export function checkRateLimit(
  weeklyCount: number,
  ongoingCount: number,
): GatheringValidationError[] {
  const errs: GatheringValidationError[] = [];
  if (weeklyCount >= 2) errs.push({ field: "capacity", reason: "本周发局已达上限（2 局）" });
  if (ongoingCount >= 1) errs.push({ field: "capacity", reason: "已有进行中的组局，请先完成或取消" });
  return errs;
}

// 主题展示信息（供 UI）
export const THEME_META: Record<GatheringTheme, { label: string; desc: string; icon: string }> = {
  friend_new: { label: "认识新朋友", desc: "主打破冰，认识同城新朋友", icon: "🤝" },
  casual: { label: "微醺小聚", desc: "2–6 人轻酌聊天", icon: "🥂" },
  party: { label: "主题派对", desc: "生日/节日/庆祝", icon: "🎉" },
  outdoor: { label: "户外漫游", desc: "CityWalk / 海边/公园日间", icon: "🏙️" },
  game: { label: "游戏破冰", desc: "酒桌游戏/桌游", icon: "🎲" },
  soft: { label: "轻饮/无酒精", desc: "不饮酒也欢迎", icon: "🧊" },
};
