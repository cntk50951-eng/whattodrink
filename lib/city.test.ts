import { describe, expect, it } from "vitest";

import { cityIconSrc, resolveCityCode } from "./city";

const CENTRAL = { lat: 22.2819, lng: 114.1577 };
const BEIJING = { lat: 39.9042, lng: 116.4074 };

describe("resolveCityCode", () => {
  it("港 bounds 内即 hk（无区名也行）", () => {
    expect(resolveCityCode(CENTRAL, null)).toBe("hk");
  });
  it("区名命中一线城市（简／繁／英）", () => {
    expect(resolveCityCode(BEIJING, "北京市")).toBe("bj");
    expect(resolveCityCode(null, "Shanghai")).toBe("sh");
    expect(resolveCityCode(null, "廣州市")).toBe("gz");
    expect(resolveCityCode(null, "深圳市")).toBe("sz");
  });
  it("港 bounds 优先于区名", () => {
    expect(resolveCityCode(CENTRAL, "北京市")).toBe("hk");
  });
  it("无命中回 null（调用方回退 Building2，不编造）", () => {
    expect(resolveCityCode(null, null)).toBeNull();
    expect(resolveCityCode({ lat: 35.68, lng: 139.69 }, "東京都")).toBeNull();
  });
  it("资源路径按码拼", () => {
    expect(cityIconSrc("hk")).toBe("/city-icons/hk.svg");
    expect(cityIconSrc("sz")).toBe("/city-icons/sz.svg");
  });
});
