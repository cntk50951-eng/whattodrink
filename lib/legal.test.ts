import { describe, expect, it } from "vitest";
import { CHILD_SAFETY, DELETE_ACCOUNT, LEGAL_CHROME, SUPPORT, SUPPORT_EMAIL, getLegalDoc, isLegalLocale, legalPath, type LegalLocale } from "./legal";

const LOCALES: LegalLocale[] = ["zh-Hant", "zh-Hans", "en"];

describe("公開法律頁內容", () => {
  it("私隱政策／條款三語都有內容，且章節數三語一致", () => {
    for (const slug of ["privacy", "terms"] as const) {
      const counts = LOCALES.map((l) => getLegalDoc(slug, l).sections.length);
      expect(new Set(counts).size).toBe(1);
      for (const l of LOCALES) {
        const d = getLegalDoc(slug, l);
        expect(d.title).not.toBe("");
        expect(d.summary.length).toBeGreaterThan(0);
        for (const s of d.sections) expect(s.paragraphs.length).toBeGreaterThan(0);
      }
    }
  });

  it("用戶可見文字不得殘留內部審閱標記或占位", () => {
    const all = JSON.stringify(
      (["privacy", "terms"] as const).flatMap((slug) => LOCALES.map((l) => getLegalDoc(slug, l))),
    );
    expect(all).not.toMatch(/法律審閱|時限：待|\[\?\]|TODO|TBD|待確認|【待/);
  });

  it("私隱政策與條款都寫明客服信箱（與 App 內一致）", () => {
    for (const slug of ["privacy", "terms"] as const) {
      for (const l of LOCALES) {
        expect(JSON.stringify(getLegalDoc(slug, l))).toContain(SUPPORT_EMAIL);
      }
    }
  });

  it("刪號說明：三語都有兩種刪除方式與四步入口，且只出現已核實的 30 天", () => {
    for (const l of LOCALES) {
      const d = DELETE_ACCOUNT[l];
      expect(d.options).toHaveLength(2);
      expect(d.steps).toHaveLength(4);
      expect(d.options[0]?.body).toContain("30");
      // 不新增任何其他天數承諾（用戶 2026-11-18 要求移除未確認的刪除時限）
      const rest = Object.fromEntries(Object.entries(d).filter(([k]) => k !== "effective")); // 生效日期（…18日）不是時限
      const nums = JSON.stringify(rest).match(/\d+\s*(天|日|days?)/gi) ?? [];
      expect(nums.length).toBeGreaterThan(0);
      expect(nums.every((n) => n.startsWith("30"))).toBe(true);
    }
  });

  it("刪號頁寫明站外郵件申請（Google Play：不裝 App 也能發起），且不再要求重新安裝", () => {
    for (const l of LOCALES) {
      const d = DELETE_ACCOUNT[l];
      expect(d.requestSteps).toHaveLength(4);
      expect(d.requestSteps[0]).toContain(SUPPORT_EMAIL);
      expect(d.requestSteps.join("")).toContain("30");
      expect(d.cantBody).not.toMatch(/重新安裝嗨飲並登入|重新安装嗨饮并登录|^Reinstall hi drink/);
      // 整頁只出現這一個信箱
      const emails = JSON.stringify(d).match(/[\w.+-]+@[\w.-]+/g) ?? [];
      expect(emails.every((e) => e === SUPPORT_EMAIL)).toBe(true);
    }
  });

  it("客服頁與兒少安全頁：三語都有，寫明信箱，客服頁連到刪號／兒少安全／私隱", () => {
    for (const l of LOCALES) {
      expect(SUPPORT[l].contactBody).toContain(SUPPORT_EMAIL);
      expect(SUPPORT[l].topics.map((t) => t.slug).filter(Boolean)).toEqual(["delete-account", "child-safety", "privacy"]);
      expect(CHILD_SAFETY[l].sections.length).toBe(CHILD_SAFETY["zh-Hant"].sections.length);
      expect(JSON.stringify(CHILD_SAFETY[l])).toContain(SUPPORT_EMAIL);
      expect(JSON.stringify([SUPPORT[l], CHILD_SAFETY[l]])).not.toMatch(/TODO|TBD|待確認|【待/);
    }
  });

  it("私隱政策具名第三方 AI，並寫明 Sign in with Apple 的資料處理（2026-11-24 起 Apple 登入上線，版本 1.2）", () => {
    const APPLE_SIGNIN: Record<string, RegExp> = { "zh-Hant": /Apple 登入/, "zh-Hans": /Apple 登录/, en: /sign in with Apple/i };
    const NO_TOKEN: Record<string, string> = { "zh-Hant": "我們不保存任何 Apple 令牌", "zh-Hans": "我们不保存任何 Apple 令牌", en: "We do not store any Apple tokens" };
    for (const l of LOCALES) {
      const all = JSON.stringify(getLegalDoc("privacy", l));
      expect(all).toContain("MiniMax");
      expect(all).toContain("OpenAI");
      expect(all).toMatch(APPLE_SIGNIN[l]);            // 帳號資料、第三方服務、刪除帳號三處都要提到
      expect(all).toContain(NO_TOKEN[l]);              // 與實現一致：刪帳號時用一次性授權碼撤銷，不保存 Apple token
    }
  });

  it("條款含 Ivy 與兒少安全兩節，三語章節數一致；兩份文件版本都是 1.2（與 iOS currentVersion／AOS CURRENT_VERSION 同步）", () => {
    for (const l of LOCALES) {
      const t = getLegalDoc("terms", l);
      expect(t.version).toBe("1.2");
      expect(getLegalDoc("privacy", l).version).toBe("1.2");
      expect(JSON.stringify(t)).toContain("Ivy");
      expect(JSON.stringify(t)).toContain("/legal/child-safety");
    }
  });

  it("私隱政策寫明負責人與通訊地址（PCPD 指引）", () => {
    expect(JSON.stringify(getLegalDoc("privacy", "zh-Hant"))).toContain("香港沙田");
    expect(JSON.stringify(getLegalDoc("privacy", "zh-Hans"))).toContain("香港沙田");
    expect(JSON.stringify(getLegalDoc("privacy", "en"))).toContain("Sha Tin, Hong Kong");
  });

  it("不再出現不存在的「設定 › 刪除帳號」路徑", () => {
    const all = JSON.stringify((["privacy", "terms"] as const).flatMap((slug) => LOCALES.map((l) => getLegalDoc(slug, l))));
    expect(all).not.toMatch(/設定 ›|设置 ›|Settings >/);
  });

  it("路徑：預設語言不帶前綴，其餘帶前綴；語言判斷", () => {
    expect(legalPath("privacy", "zh-Hant")).toBe("/legal/privacy");
    expect(legalPath("delete-account", "en")).toBe("/en/legal/delete-account");
    expect(isLegalLocale("zh-Hans")).toBe(true);
    expect(isLegalLocale("fr")).toBe(false);
    expect(LEGAL_CHROME.en.privacy).toBe("Privacy Policy");
  });
});
