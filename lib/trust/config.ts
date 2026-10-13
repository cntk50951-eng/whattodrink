/**
 * UR E.30 誠信積分配置（全部数值放这里，上线后按数据调；B 先上，限制默认全关）。
 * C 阶段（投诉／AI 判定）沿用本文件加键，不另起。
 */

export const TRUST_CONFIG = {
  /** 基础分。 */
  base_score: 70,
  /** 每周加分上限（attend 组／hosted 组各算）。 */
  weekly_bonus_cap: 6,
  /** 互刷递减窗口（同一对账号 30 天内互约局数：第 2 局 ×0.5，第 3 局起 0）。 */
  mutual_window_days: 30,
  /** 连 5 局无违约奖励（每 90 天一次）。 */
  streak_bonus: 5,
  streak_bonus_cooldown_days: 90,
  streak_clean_days: 5,
  /** 救濟：连续 60 天无新违约且完成 ≥3 局，一般违约提前到期（读时生效，不改行）。 */
  relief_clean_days: 60,
  relief_min_completed: 3,
  /** 通知阈值（|delta|≥3 才发 trust_changed）。 */
  notify_threshold: 3,
  /** 等级线。 */
  tier_trusted: 80,
  tier_normal: 50,
  tier_watch: 30,
  /** 新手线（完成局数 <3 不外露分数）。 */
  newbie_completed: 3,
  /** 限制默认关闭（观察 2 周再开，防初期误伤）。 */
  enforce_watch_limit: false,
  enforce_restricted: false,
  /** watch：每日最多发局数。restricted：暂停发起天数。 */
  watch_daily_parties: 1,
  restricted_days: 14,
  /** C 预留：AI 自动判定总开关（初期 false，只建议不处罚）。 */
  ai_auto_decide: false,
  /** C1 到场窗口（开局前后分钟）＋半径（米）＋每人每局尝试上限。 */
  arrive_before_min: 30,
  arrive_after_min: 30,
  arrive_radius_m: 300,
  arrive_attempts_cap: 10,
  /** C1 出席窗口（局结束后小时）。 */
  attendance_window_h: 24,
  /** C1 结算 dry-run（true＝只记 outcome 不写账本；观察一周再开）。 */
  settle_write_ledger: false,
} as const;

export type TrustTier = "newbie" | "trusted" | "normal" | "watch" | "restricted";

/** kind→展示文案（通知 reason_text；iOS 原文显示）。 */
export const TRUST_KIND_TEXT: Record<string, string> = {
  cancel_24h_3h: "臨近開局撤銷酒局",
  cancel_3h_1h: "開局前 3 小時內撤銷酒局",
  leave_24h_3h: "開局前退出酒局",
  leave_3h_1h: "開局前 3 小時內退出酒局",
  leave_late: "臨近開局退出酒局",
  attend: "出席酒局",
  hosted_completed: "發起的酒局成局",
  streak_bonus: "連續守約獎勵",
};
