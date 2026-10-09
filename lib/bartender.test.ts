import { describe, expect, it } from "vitest";

import {
  BARTENDER_NAME,
  BAR_LANG_LINES,
  IVY_EVENT_INSTRUCTIONS,
  IVY_SYSTEM_PROMPT,
  parseBarLang,
  toMinimaxMessages,
} from "./bartender";

describe("ivy persona", () => {
  it("人设有名字和底线（英文默认、大胆调情但不露骨、叫停就收）", () => {
    expect(IVY_SYSTEM_PROMPT).toContain(BARTENDER_NAME);
    expect(IVY_SYSTEM_PROMPT).toContain("Always reply in English");
    expect(IVY_SYSTEM_PROMPT).toContain("never explicit");
    expect(IVY_SYSTEM_PROMPT).toContain("never clingy");
  });

  it("三个事件都有指令（非台词）", () => {
    expect(Object.keys(IVY_EVENT_INSTRUCTIONS).sort()).toEqual(["cheers", "greet", "pat"]);
  });
});

describe("toMinimaxMessages", () => {
  it("system 打头＋历史映射角色", () => {
    const msgs = toMinimaxMessages(
      [
        { from: "me", text: "有推荐吗" },
        { from: "her", text: "有的" },
      ],
      { message: "来杯淡的" },
    );
    expect(msgs[0]).toMatchObject({ role: "system" });
    expect(msgs.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(msgs[msgs.length - 1]?.content).toBe("来杯淡的");
  });

  it("历史只取最后 10 条", () => {
    const history = Array.from({ length: 14 }, (_, i) => ({
      from: "me" as const,
      text: `msg${i}`,
    }));
    const msgs = toMinimaxMessages(history, { message: "hi" });
    // system＋10 条历史＋1 输入
    expect(msgs).toHaveLength(12);
    expect(msgs[1]?.content).toBe("msg4");
  });

  it("event 转临时指令（message 为空也行）", () => {
    const msgs = toMinimaxMessages([], { event: "pat" });
    expect(msgs).toHaveLength(2);
    expect(msgs[1]?.content).toBe(IVY_EVENT_INSTRUCTIONS.pat);
  });

  it("空历史空输入只有 system（路由层拦，组装不炸）", () => {
    expect(toMinimaxMessages([], {})).toHaveLength(1);
  });
});

describe("parseBarLang", () => {
  it("en 缺省；非法回落 en", () => {
    expect(parseBarLang("yue")).toBe("yue");
    expect(parseBarLang("zh")).toBe("zh");
    expect(parseBarLang("en")).toBe("en");
    expect(parseBarLang(undefined)).toBe("en");
    expect(parseBarLang("jp")).toBe("en");
    expect(parseBarLang(null)).toBe("en");
  });
});

describe("toMinimaxMessages lang", () => {
  it("system 末尾追加语言覆盖行（yue／zh／缺省 en）", () => {
    const yue = toMinimaxMessages([], { message: "有咩推介", lang: "yue" });
    expect(yue[0]?.content).toContain(BAR_LANG_LINES.yue);
    expect(yue[0]?.content).toContain("Always reply in English");
    const zh = toMinimaxMessages([], { message: "推荐", lang: "zh" });
    expect(zh[0]?.content).toContain(BAR_LANG_LINES.zh);
    const def = toMinimaxMessages([], { message: "hi" });
    expect(def[0]?.content).toContain(BAR_LANG_LINES.en);
  });
});
