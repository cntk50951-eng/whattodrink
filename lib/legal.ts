import privacyEn from "../content/legal/legal-privacy.en.json";
import privacyHans from "../content/legal/legal-privacy.zh-Hans.json";
import privacyHant from "../content/legal/legal-privacy.zh-Hant.json";
import termsEn from "../content/legal/legal-terms.en.json";
import termsHans from "../content/legal/legal-terms.zh-Hans.json";
import termsHant from "../content/legal/legal-terms.zh-Hant.json";

/**
 * 公開法律頁的內容層（`/legal/privacy`｜`/legal/terms`｜`/legal/delete-account`）。
 *
 * 私隱政策與條款：`content/legal/*.json` 是 iOS／AOS App 內那六份的**逐字節副本**（單一來源）。
 * 不要在這裡改字：要改先改 App 內 JSON，再用 `scripts/check-legal-sync.sh` 對齊三個倉。
 * 刪除帳號說明：App 內沒有對應文件，內容全部來自 `lib/accountDeletion.ts` 與 App 內刪除流程的現有字串，
 * 不新增任何刪除時限／保留期的承諾（用戶 2026-11-18 已要求移除未確認的時限）。
 */

export type LegalLocale = "zh-Hant" | "zh-Hans" | "en";
export type LegalSlug = "privacy" | "terms" | "delete-account";

export type LegalSection = {
  title: string;
  tag?: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDoc = {
  title: string;
  effective: string;
  summaryTitle: string;
  summary: string[];
  note: string;
  sections: LegalSection[];
  version: string;
};

const DOCS: Record<"privacy" | "terms", Record<LegalLocale, LegalDoc>> = {
  privacy: { "zh-Hant": privacyHant, "zh-Hans": privacyHans, en: privacyEn },
  terms: { "zh-Hant": termsHant, "zh-Hans": termsHans, en: termsEn },
};

export function isLegalLocale(v: string): v is LegalLocale {
  return v === "zh-Hant" || v === "zh-Hans" || v === "en";
}

export function getLegalDoc(slug: "privacy" | "terms", locale: LegalLocale): LegalDoc {
  return DOCS[slug][locale];
}

export const SUPPORT_EMAIL = "support@whattodrink.app";

/** 頁面外框用字（不放進 messages/*.json：避免與他人未提交的改動撞檔）。 */
export const LEGAL_CHROME: Record<
  LegalLocale,
  {
    effective: string;
    version: string;
    languageLabel: string;
    otherDocs: string;
    privacy: string;
    terms: string;
    deleteAccount: string;
    contact: string;
  }
> = {
  "zh-Hant": {
    effective: "生效日期",
    version: "版本",
    languageLabel: "語言",
    otherDocs: "其他文件",
    privacy: "私隱政策",
    terms: "服務條款",
    deleteAccount: "刪除帳號",
    contact: "聯絡",
  },
  "zh-Hans": {
    effective: "生效日期",
    version: "版本",
    languageLabel: "语言",
    otherDocs: "其他文件",
    privacy: "隐私政策",
    terms: "服务条款",
    deleteAccount: "删除帐号",
    contact: "联系",
  },
  en: {
    effective: "Effective",
    version: "Version",
    languageLabel: "Language",
    otherDocs: "Other documents",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    deleteAccount: "Delete your account",
    contact: "Contact",
  },
};

export const LOCALE_NAMES: Record<LegalLocale, string> = {
  "zh-Hant": "繁體中文",
  "zh-Hans": "简体中文",
  en: "English",
};

/** 某語言下某頁的公開路徑（zh-Hant 是預設語言，不帶前綴）。 */
export function legalPath(slug: LegalSlug, locale: LegalLocale): string {
  return locale === "zh-Hant" ? `/legal/${slug}` : `/${locale}/legal/${slug}`;
}

export type DeleteAccountCopy = {
  title: string;
  effective: string;
  intro: string;
  inAppTitle: string;
  steps: string[];
  chooseTitle: string;
  options: { title: string; body: string }[];
  afterTitle: string;
  after: string[];
  cantTitle: string;
  cantBody: string;
  privacyNote: string;
};

/**
 * 刪號說明（Google Play 要求「網頁版刪除帳號說明」，Apple 要求 App 內可刪除）。
 * 兩個選項的文字與兩端 App 內 `account.delete.*` 字串逐字一致；入口路徑已對照
 * iOS `NightAvatarSheet.deleteAccountButton`／AOS `AvatarSheet.kt`（頭像面板最底部，沒有叫「設定」的頁面）。
 */
export const DELETE_ACCOUNT: Record<LegalLocale, DeleteAccountCopy> = {
  "zh-Hant": {
    title: "刪除帳號",
    effective: "2026年11月18日",
    intro: "你可以隨時刪除嗨飲（hi drink）帳號。iPhone 與 Android 的做法相同。",
    inAppTitle: "在 App 內刪除",
    steps: [
      "打開嗨飲，登入你要刪除的帳號。",
      "點首頁上的頭像，打開個人面板。",
      "捲到面板最底部，點「刪除帳號」。",
      "選擇刪除方式，再確認一次。",
    ],
    chooseTitle: "兩種刪除方式",
    options: [
      {
        title: "刪除，30 天內可恢復",
        body: "立即對其他人隱藏。30 天內用同一個帳號登入即可恢復個人資料和你發佈的內容；好友、聊天、碰杯和酒局不會恢復。30 天後將永久刪除。",
      },
      {
        title: "立即永久刪除",
        body: "馬上刪除你的資料、內容和登入帳號，無法恢復。",
      },
    ],
    afterTitle: "刪除之後",
    after: [
      "你的頭像、貼文、評論等資料會從 App 移除。",
      "選「30 天內可恢復」：30 天一到，我們會刪除你的登入帳號和你上傳的檔案（頭像、聊天圖片與語音、酒局封面）。",
      "選「立即永久刪除」：資料、你上傳的檔案和登入帳號會馬上刪除，沒有恢復期。",
    ],
    cantTitle: "登入不了，或已經解除安裝 App？",
    cantBody: "重新安裝嗨飲並登入同一個帳號，就可以按上面的步驟刪除。",
    privacyNote: "我們如何處理你的個人資料，請見",
  },
  "zh-Hans": {
    title: "删除帐号",
    effective: "2026年11月18日",
    intro: "你可以随时删除嗨饮（hi drink）帐号。iPhone 与 Android 的做法相同。",
    inAppTitle: "在 App 内删除",
    steps: [
      "打开嗨饮，登录你要删除的帐号。",
      "点首页上的头像，打开个人面板。",
      "滚动到面板最底部，点“删除帐号”。",
      "选择删除方式，再确认一次。",
    ],
    chooseTitle: "两种删除方式",
    options: [
      {
        title: "删除，30 天内可恢复",
        body: "立即对其他人隐藏。30 天内用同一个帐号登录即可恢复个人资料和你发布的内容；好友、聊天、碰杯和酒局不会恢复。30 天后将永久删除。",
      },
      {
        title: "立即永久删除",
        body: "马上删除你的资料、内容和登录帐号，无法恢复。",
      },
    ],
    afterTitle: "删除之后",
    after: [
      "你的头像、帖子、评论等资料会从 App 移除。",
      "选“30 天内可恢复”：30 天一到，我们会删除你的登录帐号和你上传的文件（头像、聊天图片与语音、酒局封面）。",
      "选“立即永久删除”：资料、你上传的文件和登录帐号会马上删除，没有恢复期。",
    ],
    cantTitle: "登录不了，或已经卸载 App？",
    cantBody: "重新安装嗨饮并登录同一个帐号，就可以按上面的步骤删除。",
    privacyNote: "我们如何处理你的个人资料，请见",
  },
  en: {
    title: "Delete your account",
    effective: "18 November 2026",
    intro: "You can delete your hi drink account at any time. The steps are the same on iPhone and Android.",
    inAppTitle: "Delete in the app",
    steps: [
      "Open hi drink and sign in to the account you want to delete.",
      "Tap your avatar on the home screen to open your profile panel.",
      "Scroll to the bottom of the panel and tap “Delete account”.",
      "Choose how to delete, then confirm.",
    ],
    chooseTitle: "Two ways to delete",
    options: [
      {
        title: "Delete, restorable for 30 days",
        body: "Hidden from others immediately. Sign in with the same account within 30 days to restore your profile and the content you posted; friends, chats, cheers and parties are not restored. After 30 days it is deleted permanently.",
      },
      {
        title: "Delete permanently now",
        body: "Your data, content and login account are deleted right away and cannot be recovered.",
      },
    ],
    afterTitle: "What happens next",
    after: [
      "Your avatar, posts, comments and other data are removed from the app.",
      "If you chose “restorable for 30 days”: when the 30 days end, we delete your login account and the files you uploaded (avatar, chat images and voice, party covers).",
      "If you chose “delete permanently now”: your data, uploaded files and login account are deleted immediately, with no restore period.",
    ],
    cantTitle: "Can’t sign in, or already uninstalled the app?",
    cantBody: "Reinstall hi drink and sign in with the same account, then follow the steps above.",
    privacyNote: "For how we handle your personal data, see the",
  },
};
