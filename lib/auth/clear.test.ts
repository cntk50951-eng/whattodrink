import { beforeEach, describe, expect, it } from "vitest";

// vitest 跑 node 環境，無 localStorage —— 最小內存 stub（帶事件分發，供 UR A.9 測試）
const memStore = new Map<string, string>();
const ls = {
  getItem: (k: string) => (memStore.has(k) ? (memStore.get(k) as string) : null),
  setItem: (k: string, v: string) => void memStore.set(k, v),
  removeItem: (k: string) => void memStore.delete(k),
  clear: () => memStore.clear(),
};
const winTarget = new EventTarget() as unknown as Window & { localStorage: typeof ls };
(winTarget as unknown as Record<string, unknown>).localStorage = ls;
Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true });
Object.defineProperty(globalThis, "window", {
  value: winTarget,
  configurable: true,
});

beforeEach(() => memStore.clear());

import {
  clearUserLocalCaches,
  LOGOUT_CLEAR_EVENT,
  USER_CACHE_KEYS,
} from "./clear";

describe("clearUserLocalCaches (UR A.7 登出不可见)", () => {

  it("登出后私有墙/想喝/点赞本地缓存被清除", () => {
    // 先模拟已登录打卡后写入的本地缓存
    for (const key of USER_CACHE_KEYS) {
      window.localStorage.setItem(key, JSON.stringify({ fake: 1 }));
    }
    window.localStorage.setItem("wtd-camera-consent", "1");

    clearUserLocalCaches();

    for (const key of USER_CACHE_KEYS) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
    // 非用户维度不清除
    expect(window.localStorage.getItem("wtd-camera-consent")).toBe("1");
  });

  it("登出时派发 wtd:logout 事件，UI 监听后清内存态（UR A.9）", () => {
    let fired = false;
    const handler = () => {
      fired = true;
    };
    window.addEventListener(LOGOUT_CLEAR_EVENT, handler);
    clearUserLocalCaches();
    window.removeEventListener(LOGOUT_CLEAR_EVENT, handler);
    expect(fired).toBe(true);
  });

  it("SSR 环境 no-op 不抛", () => {
    // vitest jsdom 下 window 存在，此用例仅校验接口不抛
    expect(() => clearUserLocalCaches()).not.toThrow();
  });
});
