import { describe, expect, it } from "vitest";
import { normalizeHashtag, parseHashtags, readHashtags } from "./hashtags";

describe("hashtags", () => {
  it("normalize：去 # 與空白、限長、限字符", () => {
    expect(normalizeHashtag("#微醺")).toBe("微醺");
    expect(normalizeHashtag("＃ 和 阿明 ")).toBe("和阿明");
    expect(normalizeHashtag("IPA_love")).toBe("IPA_love");
    expect(normalizeHashtag("一二三四五六七八九十一二")).toBe("一二三四五六七八九十一二");
    expect(normalizeHashtag("一二三四五六七八九十一二三")).toBeNull();
    expect(normalizeHashtag("##")).toBeNull();
    expect(normalizeHashtag("a<b>")).toBeNull();
    expect(normalizeHashtag("😀")).toBeNull();
    expect(normalizeHashtag(3)).toBeNull();
  });
  it("parse：缺席 null、非數組／超量／非法 error、去重不分大小寫", () => {
    expect(parseHashtags(undefined)).toBeNull();
    expect(parseHashtags("x")).toHaveProperty("error");
    expect(parseHashtags(["a", "b", "c", "d", "e", "f"])).toHaveProperty("error");
    expect(parseHashtags(["#ok", "a b!"])).toHaveProperty("error");
    expect(parseHashtags(["#Chill", "chill", "微醺"])).toEqual({ hashtags: ["Chill", "微醺"] });
    expect(parseHashtags([])).toEqual({ hashtags: [] });
  });
  it("read：壞值回 []", () => {
    expect(readHashtags(null)).toEqual([]);
    expect(readHashtags(["a", 1, "b"])).toEqual(["a", "b"]);
  });
});
