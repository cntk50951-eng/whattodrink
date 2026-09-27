/**
 * UR2.0 本地 "我" 占位档案（纯 UI 先行，无 DB/API 阶段）。
 *
 * ⚠️ MOCK，和 MOCK_CHECKINS 同级：头像 emoji＋性别三态全部写死，
 * 只为把回看卡片的版式跑通。EPIC 3.0 真用户体系落地时删掉，
 * 换 `users` 表（avatar_url, gender）——字段名已在 docs/data/future-schema.md
 * 对齐。默认性别 `secret`：占位即占位的样子，不替用户定性别。
 */

export type Gender = "male" | "female" | "secret";

export type MeProfile = {
  /** Emoji 头像占位（涂鸦语言；真头像上传是 EPIC 3.0 的事）。 */
  avatarEmoji: string;
  gender: Gender;
  /** 恒为 true —— 让 UI 和调用方一眼认出这是假数据。 */
  mock: true;
};

export const MOCK_ME: MeProfile = {
  avatarEmoji: "😎",
  gender: "secret",
  mock: true,
};

/**
 * UR C.10：api 回的 gender 是自由串，轉三態。非法／空／缺一律 `secret`
 * （沿 MOCK_ME 占位口徑：不替用戶定性別；卡片性別 pill 永遠可渲染）。
 */
export function parseGender(raw: unknown): Gender {
  return raw === "male" || raw === "female" ? raw : "secret";
}
