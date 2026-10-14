/**
 * UR G.6 遇見 AI 找人（v2-only；純 UI 展示層，可單測）。
 * 口徑對標 iOS `MeetModels.swift`（chips／移除／分數／距離／進度／空態解釋／錯誤映射）；
 * 網路形狀對 `GET /meet/status`、`POST /meet/search`（裸數據，openapi 1.46.0）。
 * 語言無關的 key 標籤（gender／age／height／nearby／online）由調用方經 i18n 傳入，
 * 列表類 key（職業／語言／興趣／口味）顯示 raw key（服務端白名單 key，全端一致）。
 */

import type { MeetCriteria } from "./meet";

export type MeetChipKind =
  | "gender"
  | "age"
  | "height"
  | "nearby"
  | "online"
  | { list: "occupations" | "languages" | "interests" | "taste_groups" | "taste_keys"; key: string };

export type MeetChip = {
  kind: MeetChipKind;
  label: string;
};

export type MeetChipLabels = {
  female: string;
  male: string;
  ageBelow: (hi: number) => string;
  ageAbove: (lo: number) => string;
  ageExact: (n: number) => string;
  ageRange: (lo: number, hi: number) => string;
  heightBelow: (hi: number) => string;
  heightAbove: (lo: number) => string;
  heightRange: (lo: number, hi: number) => string;
  nearby: (km: number) => string;
  online: string;
};

/** 條件→chips（只列生效條件；順序固定：性別／年齡／身高／列表／距離／在線）。 */
export function meetChips(c: MeetCriteria, L: MeetChipLabels): MeetChip[] {
  const out: MeetChip[] = [];
  if (c.gender === "female") out.push({ kind: "gender", label: L.female });
  else if (c.gender === "male") out.push({ kind: "gender", label: L.male });
  if (c.age_min !== undefined || c.age_max !== undefined) {
    const lo = c.age_min;
    const hi = c.age_max;
    const label =
      lo === undefined
        ? L.ageBelow(hi as number)
        : hi === undefined
          ? L.ageAbove(lo)
          : lo === hi
            ? L.ageExact(lo)
            : L.ageRange(lo, hi);
    out.push({ kind: "age", label });
  }
  if (c.height_min !== undefined || c.height_max !== undefined) {
    const lo = c.height_min;
    const hi = c.height_max;
    const label =
      lo === undefined
        ? L.heightBelow(hi as number)
        : hi === undefined
          ? L.heightAbove(lo)
          : L.heightRange(lo, hi);
    out.push({ kind: "height", label });
  }
  for (const k of c.occupations ?? []) out.push({ kind: { list: "occupations", key: k }, label: k });
  for (const k of c.languages ?? []) out.push({ kind: { list: "languages", key: k }, label: k });
  for (const k of c.interests ?? []) out.push({ kind: { list: "interests", key: k }, label: k });
  for (const k of c.taste_groups ?? []) out.push({ kind: { list: "taste_groups", key: k }, label: k });
  for (const k of c.taste_keys ?? []) out.push({ kind: { list: "taste_keys", key: k }, label: k });
  if (c.nearby_km !== undefined) out.push({ kind: "nearby", label: L.nearby(c.nearby_km) });
  if (c.online_only === true) out.push({ kind: "online", label: L.online });
  return out;
}

function dropKey(list: string[] | undefined, key: string): string[] | undefined {
  const rest = (list ?? []).filter((x) => x !== key);
  return rest.length > 0 ? rest : undefined;
}

/** 點掉一個 chip 後的新條件（走 criteria 重搜，不扣次數）。 */
export function meetCriteriaWithout(c: MeetCriteria, kind: MeetChipKind): MeetCriteria {
  const n: MeetCriteria = { ...c };
  if (kind === "gender") delete n.gender;
  else if (kind === "age") {
    delete n.age_min;
    delete n.age_max;
  } else if (kind === "height") {
    delete n.height_min;
    delete n.height_max;
  } else if (kind === "nearby") delete n.nearby_km;
  else if (kind === "online") delete n.online_only;
  else if (kind.list === "occupations") n.occupations = dropKey(n.occupations, kind.key);
  else if (kind.list === "languages") n.languages = dropKey(n.languages, kind.key);
  else if (kind.list === "interests") n.interests = dropKey(n.interests, kind.key);
  else if (kind.list === "taste_groups") n.taste_groups = dropKey(n.taste_groups, kind.key);
  else if (kind.list === "taste_keys") n.taste_keys = dropKey(n.taste_keys, kind.key);
  return n;
}

export function meetScoreText(score: number, suffix: string): string {
  return `${Math.min(100, Math.max(0, Math.round(score)))}${suffix}`;
}

/** 距離行（陌生人 null 即無行；iOS 口徑：<1km 取整 100m，否則 1 位小數 km）。 */
export function meetDistanceText(meters: number | null | undefined, near: string, kmUnit: string): string | null {
  if (meters === null || meters === undefined || !Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) return `${near} ${Math.max(100, Math.floor(meters / 100) * 100)}m`;
  return `${near} ${(meters / 1000).toFixed(1)}${kmUnit}`;
}

/** 搜索中輪播提示（按經過秒數；iOS meetProgressText 口徑）。 */
export function meetProgressText(elapsedSec: number, stages: [string, string, string, string]): string {
  if (elapsedSec < 2.5) return stages[0];
  if (elapsedSec < 6) return stages[1];
  if (elapsedSec < 12) return stages[2];
  return stages[3];
}

export type MeetErrorKind =
  | "unauthorized"
  | "onboardingRequired"
  | "ageRestricted"
  | "rejected"
  | "quotaExhausted"
  | "aiUnavailable"
  | "notDeployed"
  | "other";

/** 狀態碼＋錯誤碼→類型（iOS meetError 口徑；message 只用於 rejected／other 透傳）。 */
export function meetErrorKind(status: number, code: string | null): MeetErrorKind {
  const c = code ?? "";
  if (status === 401) return "unauthorized";
  if (status === 403 && c === "onboarding_required") return "onboardingRequired";
  if (status === 403 && c === "age_restricted") return "ageRestricted";
  if (status === 403) return "rejected";
  if (status === 404 || status === 405) return "notDeployed";
  if (status === 429) return "quotaExhausted";
  if (status === 503) return "aiUnavailable";
  return "other";
}

export type MeetStats = { pool: number; passed: number };

/** 空結果解釋（只用匿名統計，不編造；iOS meetEmptyExplanation 口徑）。 */
export function meetEmptyExplanation(
  stats: MeetStats | null,
  friendsNotDiscoverable: number | null,
  hasCriteria: boolean,
  T: {
    poolEmpty: string;
    nonePassed: (pool: number) => string;
    somePassed: (pool: number, passed: number) => string;
    friendsHint: (n: number) => string;
    fallbackWithCriteria: string;
    fallbackNoCriteria: string;
  },
): string {
  const parts: string[] = [];
  if (stats !== null) {
    if (stats.pool === 0) parts.push(T.poolEmpty);
    else if (stats.passed === 0) parts.push(T.nonePassed(stats.pool));
    else parts.push(T.somePassed(stats.pool, stats.passed));
  }
  if (friendsNotDiscoverable !== null && friendsNotDiscoverable > 0) {
    parts.push(T.friendsHint(friendsNotDiscoverable));
  }
  if (parts.length === 0) parts.push(hasCriteria ? T.fallbackWithCriteria : T.fallbackNoCriteria);
  return parts.join("\n");
}
