import { describe, expect, it } from "vitest";

import { chatFilterEnabled, filterChatText, parseWordEnv } from "./chatFilter";

const f = (s: string, o = {}) => filterChatText(s, o);
const masked = (s: string) => {
  const v = f(s);
  return v.action === "mask" ? v.text : null;
};

describe("英文：一般粗口 → 打码照发", () => {
  it("基础词与词形", () => {
    expect(masked("what the fuck")).toBe("what the ★★★★");
    expect(masked("you are a bitch")).toBe("you are a ★★★★★");
    expect(masked("this is bullshit")).toBe("this is ★★★★★★★★");
    expect(masked("fucking hell")).toBe("★★★★★★★ hell");
    expect(masked("shitty luck")).toBe("★★★★★★ luck");
    expect(masked("Asshole!")).toBe("★★★★★★★!");
    expect(masked("FUCK YOU")).toBe("★★★★ YOU");
  });
  it("叠字／夹符号／空格／数字符号替换", () => {
    expect(masked("fuuuuck")).toBe("★★★★★★★");
    expect(masked("f*ck")).toBe("★★★★");
    expect(masked("f**k off")).toBe("★★★★ off");
    expect(masked("sh1t")).toBe("★★★★");
    expect(masked("$hit")).toBe("★★★★");
    expect(masked("@sshole")).toBe("★★★★★★★");
    expect(masked("f u c k")).toBe("★ ★ ★ ★");
    expect(masked("f.u.c.k")).toBe("★.★.★.★");
    expect(masked("ｆｕｃｋ")).toBe("★★★★"); // 全角
    expect(masked("fu​ck")).toBe("★★★★"); // 零宽
  });
  it("粤语拼音缩写", () => {
    expect(masked("you on9")).toBe("you ★★★");
    expect(masked("dllm")).toBe("★★★★");
  });
});

describe("英文：严重词 → 拒发", () => {
  it("仇恨／威胁／性骚扰", () => {
    expect(f("you faggot").action).toBe("block");
    expect(f("n i g g e r").action).toBe("block");
    expect(f("go kill yourself").action).toBe("block");
    expect(f("KYS").action).toBe("block");
    expect(f("send nudes pls").action).toBe("block");
    expect(f("i will rape you").action).toBe("block");
  });
  it("严重优先于粗口", () => {
    expect(f("fuck you faggot").action).toBe("block");
  });
});

describe("不误伤（Scunthorpe／酒名／日常）", () => {
  const ok = [
    "class", "assassin", "Scunthorpe", "grass", "bass guitar", "classic", "cocktail", "Dickens", "bassist",
    "pass it", "I'm a hit", "shiitake", "document", "analysis", "button", "peacock", "Hancock", "title",
    "輪到你", "大家乾杯", "好嘢", "再嚟一局", "OK", "1 2 3 4", "u r a fool", "f u n", "fun fun fun",
    "I will kill you in the next round", // 游戏骂战，不拦
  ];
  for (const t of ok) it(`放行：${t}`, () => expect(f(t).action).toBe("allow"));
  it("酒名白名单", () => {
    for (const t of ["Sex on the Beach please", "one Slippery Nipple", "Blow Job shot", "Screaming Orgasm", "redheaded slut shot"]) {
      expect(f(t).action, t).toBe("allow");
    }
  });
  it("白名单只放行那一段，旁边的粗口照常处理", () => {
    expect(masked("Sex on the Beach you shit")).toBe("Sex on the Beach you ★★★★");
  });
});

describe("中文（繁／简／粤）", () => {
  it("一般粗口打码，字间空格／标点不影响", () => {
    expect(masked("屌你")).toBe("★★");
    expect(masked("屌 你 老 母")).toBe("★★ 老 母");
    expect(masked("你真係仆街")).toBe("你真係★★");
    expect(masked("仆 街")).toBe("★★");
    expect(masked("他妈的")).toBe("★★★");
    expect(masked("傻逼")).toBe("★★");
  });
  it("严重词拒发", () => {
    expect(f("你去死").action).toBe("block");
    expect(f("死全家").action).toBe("block");
    expect(f("約炮嗎").action).toBe("block");
    expect(f("强奸").action).toBe("block");
    expect(f("去 死").action).toBe("block");
  });
  it("不误伤日常", () => {
    for (const t of ["你妈妈好吗", "他妈妈来了", "今晚去邊度飲", "你老母好嗎", "再嚟一局", "祝你好運"]) {
      expect(f(t).action, t).toBe("allow");
    }
  });
});

describe("可选项", () => {
  it("联系方式拦截（默认不拦，开了才拦）", () => {
    expect(f("加我微信 abc").action).toBe("allow");
    expect(f("加我微信 abc", { blockContacts: true })).toEqual({ action: "block", reason: "contact" });
    expect(f("call 9123 4567", { blockContacts: true }).action).toBe("block");
    expect(f("add my ig: foo", { blockContacts: true }).action).toBe("block");
    expect(f("see https://x.test", { blockContacts: true }).action).toBe("block");
    expect(f("3 個 5", { blockContacts: true }).action).toBe("allow");
  });
  it("env 追加词：严重词拒、打码词打码；中文追加", () => {
    expect(f("you muppet", { extraBlock: ["muppet"] }).action).toBe("block");
    expect(masked("you muppet")).toBeNull();
    const v = f("you muppet", { extraMask: ["muppet"] });
    expect(v.action === "mask" && v.text).toBe("you ★★★★★★");
    expect(f("你個衰人", { extraBlock: ["衰人"] }).action).toBe("block");
  });
  it("总开关：wordFilter=false 时只做联系方式", () => {
    expect(f("fuck", { wordFilter: false }).action).toBe("allow");
    expect(f("fuck https://x.test", { wordFilter: false, blockContacts: true }).action).toBe("block");
    expect(chatFilterEnabled(undefined)).toBe(true);
    expect(chatFilterEnabled("on")).toBe(true);
    expect(chatFilterEnabled("off")).toBe(false);
    expect(parseWordEnv(" a, b ,,c ")).toEqual(["a", "b", "c"]);
  });
});

describe("纯本地", () => {
  it("模块不依赖任何外部调用", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/games/chatFilter.ts", "utf8");
    for (const banned of ["fetch(", "import(", "openai", "minimax", "moderation", "require("]) {
      expect(src.includes(banned), banned).toBe(false);
    }
  });
});
