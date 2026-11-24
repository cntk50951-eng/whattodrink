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
export type LegalSlug = "privacy" | "terms" | "delete-account" | "support" | "child-safety";

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
    support: string;
    childSafety: string;
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
    support: "客服與支援",
    childSafety: "兒少安全",
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
    support: "客服与支持",
    childSafety: "儿童安全",
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
    support: "Support",
    childSafety: "Child safety",
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
  /** 站外申請刪帳的步驟（Google Play 要求：不裝 App 也能發起刪除）。 */
  requestSteps: string[];
  requestNote: string;
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
      "如果你是用 Apple 登入的：在 App 裡刪除帳號時，我們會請你再用 Apple 授權一次，並替你向 Apple 撤銷登入授權。如果你是用郵件申請刪除、沒辦法在 App 裡操作，請自己在 iPhone「設定」→ 你的 Apple ID →「登入與安全性」→「使用 Apple 登入」裡找到「嗨飲」，選擇停止使用 Apple ID，這樣 Apple 那邊的授權也會移除。",
    ],
    cantTitle: "登入不了，或已經解除安裝 App？",
    cantBody: "你不需要重新安裝 App。請按下面的步驟寄信給我們，核對是你本人後，我們會替你刪除。",
    requestSteps: [
      `用註冊嗨飲時的電郵，寄信到 ${SUPPORT_EMAIL}。`,
      "標題寫「刪除我的帳號」，內文寫上你的暱稱。",
      "我們會回信請你確認這是你本人的要求；如果來信電郵與註冊電郵不同，我們可能請你補充資料。",
      "確認身分後 30 天內，我們會按「立即永久刪除」的範圍處理，完成後回信通知你。",
    ],
    requestNote: "為了保護你的帳號，我們不會在沒有核對身分的情況下刪除資料。",
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
      "如果你是用 Apple 登录的：在 App 里删除账号时，我们会请你再用 Apple 授权一次，并替你向 Apple 撤销登录授权。如果你是用邮件申请删除、没办法在 App 里操作，请自己在 iPhone“设置”→ 你的 Apple ID →“登录与安全性”→“使用 Apple 登录”里找到“嗨饮”，选择停止使用 Apple ID，这样 Apple 那边的授权也会移除。",
    ],
    cantTitle: "登录不了，或已经卸载 App？",
    cantBody: "你不需要重新安装 App。请按下面的步骤寄信给我们，核对是你本人后，我们会替你删除。",
    requestSteps: [
      `用注册嗨饮时的电邮，寄信到 ${SUPPORT_EMAIL}。`,
      "标题写“删除我的帐号”，内文写上你的昵称。",
      "我们会回信请你确认这是你本人的要求；如果来信电邮与注册电邮不同，我们可能请你补充资料。",
      "确认身份后 30 天内，我们会按“立即永久删除”的范围处理，完成后回信通知你。",
    ],
    requestNote: "为了保护你的帐号，我们不会在没有核对身份的情况下删除资料。",
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
      "If you signed in with Apple: when you delete your account in the app, we ask you to authorize with Apple once more and revoke the sign-in authorization for you. If you request deletion by email and cannot use the app, please also remove it yourself on your iPhone: Settings → your Apple ID → Sign-In & Security → Sign in with Apple, find hi drink and choose to stop using Apple ID, so the authorization on Apple’s side is removed too.",
    ],
    cantTitle: "Can’t sign in, or already uninstalled the app?",
    cantBody: "You do not need to reinstall the app. Email us using the steps below and, once we have confirmed it is you, we will delete the account for you.",
    requestSteps: [
      `Email ${SUPPORT_EMAIL} from the email address you signed up with.`,
      "Use the subject “Delete my account” and include your nickname in the message.",
      "We will reply to ask you to confirm the request is yours. If you wrote from a different address we may ask for more detail.",
      "Within 30 days of confirming your identity we will delete the account as in “Delete permanently now”, and email you when it is done.",
    ],
    requestNote: "To protect your account we will not delete anything before we have checked it is you.",
    privacyNote: "For how we handle your personal data, see the",
  },
};

export type SupportCopy = {
  title: string;
  effective: string;
  intro: string;
  contactTitle: string;
  contactBody: string;
  includeTitle: string;
  include: string[];
  topicsTitle: string;
  /** slug 有值＝附站內連結到該頁。 */
  topics: { title: string; body: string; slug?: LegalSlug }[];
};

/**
 * 公開客服與支援頁（App Store「Support URL」／Google Play 客服資料用）。
 * 只寫已存在的事實：客服信箱、App 內的檢舉／封鎖入口、刪號與私隱頁。不承諾回覆時限。
 */
export const SUPPORT: Record<LegalLocale, SupportCopy> = {
  "zh-Hant": {
    title: "客服與支援",
    effective: "2026年11月24日",
    intro: "嗨飲（hi drink）遇到問題，或想問帳號、私隱、檢舉的事，都可以聯絡我們。",
    contactTitle: "聯絡我們",
    contactBody: `請寄信到 ${SUPPORT_EMAIL}。我們會盡快回覆。`,
    includeTitle: "來信時請寫上",
    include: [
      "你註冊用的電郵和暱稱（方便我們找到帳號）。",
      "手機型號和系統版本，以及 App 版本（在 App 內可以看到）。",
      "發生了什麼事、在哪個畫面；如有截圖更好。",
    ],
    topicsTitle: "常見問題",
    topics: [
      { title: "刪除帳號", body: "可以在 App 內刪除；打不開 App 時也可以用電郵申請。", slug: "delete-account" },
      { title: "檢舉與封鎖", body: "在貼文、聊天、個人頁、邀請和遊戲房的選單裡，點「檢舉」或「封鎖」。涉及人身安全的個案我們會優先處理。" },
      { title: "兒少安全", body: "我們對任何涉及未成年人的性化或剝削內容零容忍。", slug: "child-safety" },
      { title: "私隱與條款", body: "我們收集什麼資料、交給哪些服務處理。", slug: "privacy" },
    ],
  },
  "zh-Hans": {
    title: "客服与支持",
    effective: "2026年11月24日",
    intro: "嗨饮（hi drink）遇到问题，或想问帐号、隐私、举报的事，都可以联系我们。",
    contactTitle: "联系我们",
    contactBody: `请寄信到 ${SUPPORT_EMAIL}。我们会尽快回复。`,
    includeTitle: "来信时请写上",
    include: [
      "你注册用的电邮和昵称（方便我们找到帐号）。",
      "手机型号和系统版本，以及 App 版本（在 App 内可以看到）。",
      "发生了什么事、在哪个画面；如有截图更好。",
    ],
    topicsTitle: "常见问题",
    topics: [
      { title: "删除帐号", body: "可以在 App 内删除；打不开 App 时也可以用电邮申请。", slug: "delete-account" },
      { title: "举报与封锁", body: "在帖子、聊天、个人页、邀请和游戏房的菜单里，点“举报”或“封锁”。涉及人身安全的个案我们会优先处理。" },
      { title: "儿童安全", body: "我们对任何涉及未成年人的性化或剥削内容零容忍。", slug: "child-safety" },
      { title: "隐私与条款", body: "我们收集什么资料、交给哪些服务处理。", slug: "privacy" },
    ],
  },
  en: {
    title: "Support",
    effective: "24 November 2026",
    intro: "If something goes wrong in hi drink, or you have a question about your account, privacy or a report, contact us.",
    contactTitle: "Contact us",
    contactBody: `Email ${SUPPORT_EMAIL}. We will reply as soon as we can.`,
    includeTitle: "Please include",
    include: [
      "The email address and nickname you signed up with, so we can find your account.",
      "Your phone model, system version and the app version (shown inside the app).",
      "What happened and on which screen. A screenshot helps.",
    ],
    topicsTitle: "Common questions",
    topics: [
      { title: "Delete your account", body: "You can delete it inside the app, or ask by email if you cannot open the app.", slug: "delete-account" },
      { title: "Reports and blocking", body: "Open the menu on a post, chat, profile, invite or game room and tap Report or Block. Cases involving personal safety are handled first." },
      { title: "Child safety", body: "We have zero tolerance for content that sexualises or exploits minors.", slug: "child-safety" },
      { title: "Privacy and terms", body: "What we collect and which services process it.", slug: "privacy" },
    ],
  },
};

export type ChildSafetyCopy = {
  title: string;
  effective: string;
  intro: string;
  sections: LegalSection[];
};

/**
 * 兒少安全標準（Google Play 要求社交／約會類 App 公開 CSAE 標準、聯絡窗口與通報程序）。
 * 只寫已存在的機制：18+ 生日檢核、App 內檢舉／封鎖、內容自動安全檢查、人工審核處置。
 */
export const CHILD_SAFETY: Record<LegalLocale, ChildSafetyCopy> = {
  "zh-Hant": {
    title: "兒少安全標準",
    effective: "2026年11月24日",
    intro: "嗨飲（hi drink）只供年滿 18 歲的人使用。這一頁說明我們如何防止兒童性剝削與虐待（CSAE），以及你可以怎樣舉報。",
    sections: [
      {
        title: "我們的標準",
        paragraphs: [
          "我們對任何涉及未滿 18 歲人士的性化、剝削、虐待或危害內容零容忍，包括兒童性虐待素材（CSAM）、誘騙、索取或交換相關內容，以及試圖接觸未成年人的行為。這些行為一律禁止，違者會被永久移除。",
        ],
      },
      {
        title: "我們怎樣預防",
        paragraphs: [],
        bullets: [
          "註冊時要填生日並確認年滿 18 歲，未滿 18 歲不能繼續使用。",
          "發佈的貼文、相片、評論和暱稱會經自動安全檢查。",
          "任何用戶都可以在 App 內檢舉內容或用戶，也可以封鎖對方。",
          "我們一發現用戶未滿 18 歲，會停用或刪除其帳號。",
        ],
      },
      {
        title: "怎樣檢舉",
        paragraphs: [
          `在貼文、聊天、個人頁、邀請和遊戲房的選單裡點「檢舉」。你也可以寄信到 ${SUPPORT_EMAIL}，標題寫「兒少安全」。`,
        ],
      },
      {
        title: "我們怎樣處理",
        paragraphs: [
          "涉及兒少安全的檢舉會優先處理。我們會審核檢舉、移除內容、停用帳號；確認涉及兒童性虐待素材時，我們會向主管的執法機關通報。",
        ],
      },
      {
        title: "兒少安全聯絡窗口",
        paragraphs: [`${SUPPORT_EMAIL}（標題寫「兒少安全」）。`],
      },
    ],
  },
  "zh-Hans": {
    title: "儿童安全标准",
    effective: "2026年11月24日",
    intro: "嗨饮（hi drink）只供年满 18 岁的人使用。这一页说明我们如何防止儿童性剥削与虐待（CSAE），以及你可以怎样举报。",
    sections: [
      {
        title: "我们的标准",
        paragraphs: [
          "我们对任何涉及未满 18 岁人士的性化、剥削、虐待或危害内容零容忍，包括儿童性虐待素材（CSAM）、诱骗、索取或交换相关内容，以及试图接触未成年人的行为。这些行为一律禁止，违者会被永久移除。",
        ],
      },
      {
        title: "我们怎样预防",
        paragraphs: [],
        bullets: [
          "注册时要填生日并确认年满 18 岁，未满 18 岁不能继续使用。",
          "发布的帖子、照片、评论和昵称会经自动安全检查。",
          "任何用户都可以在 App 内举报内容或用户，也可以封锁对方。",
          "我们一发现用户未满 18 岁，会停用或删除其帐号。",
        ],
      },
      {
        title: "怎样举报",
        paragraphs: [
          `在帖子、聊天、个人页、邀请和游戏房的菜单里点“举报”。你也可以寄信到 ${SUPPORT_EMAIL}，标题写“儿童安全”。`,
        ],
      },
      {
        title: "我们怎样处理",
        paragraphs: [
          "涉及儿童安全的举报会优先处理。我们会审核举报、移除内容、停用帐号；确认涉及儿童性虐待素材时，我们会向主管的执法机关通报。",
        ],
      },
      {
        title: "儿童安全联系窗口",
        paragraphs: [`${SUPPORT_EMAIL}（标题写“儿童安全”）。`],
      },
    ],
  },
  en: {
    title: "Child Safety Standards",
    effective: "24 November 2026",
    intro: "hi drink is only for people aged 18 or over. This page explains how we prevent child sexual abuse and exploitation (CSAE) and how you can report it.",
    sections: [
      {
        title: "Our standard",
        paragraphs: [
          "We have zero tolerance for content that sexualises, exploits, abuses or endangers anyone under 18. That includes child sexual abuse material (CSAM), grooming, asking for or trading such material, and any attempt to contact minors. All of it is banned and leads to permanent removal.",
        ],
      },
      {
        title: "How we prevent it",
        paragraphs: [],
        bullets: [
          "At sign-up you enter your date of birth and confirm you are 18 or over. Under-18s cannot continue.",
          "Posts, photos, comments and nicknames go through automatic safety checks.",
          "Anyone can report content or a user inside the app, and block the other person.",
          "If we learn that a user is under 18 we suspend or delete the account.",
        ],
      },
      {
        title: "How to report",
        paragraphs: [
          `Open the menu on a post, chat, profile, invite or game room and tap Report. You can also email ${SUPPORT_EMAIL} with the subject “Child safety”.`,
        ],
      },
      {
        title: "How we respond",
        paragraphs: [
          "Child-safety reports are handled first. We review reports, remove content and suspend accounts. When we confirm child sexual abuse material, we report it to the competent law enforcement authorities.",
        ],
      },
      {
        title: "Child safety contact",
        paragraphs: [`${SUPPORT_EMAIL} (subject “Child safety”).`],
      },
    ],
  },
};
