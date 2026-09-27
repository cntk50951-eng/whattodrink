import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearActivePeer, readActivePeer, setActivePeer } from "./chatPeer";

// vitest 跑 node 環境，無 sessionStorage —— 最小內存 stub（沿 clear.test.ts 口徑）
const memStore = new Map<string, string>();

beforeEach(() => {
  memStore.clear();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (k: string): string | null => memStore.get(k) ?? null,
      setItem: (k: string, v: string): void => {
        memStore.set(k, v);
      },
      removeItem: (k: string): void => {
        memStore.delete(k);
      },
    },
  });
});

describe("chatPeer (UR D.7)", () => {
  it("空串不寫；讀空回 null", () => {
    setActivePeer("");
    expect(readActivePeer()).toBeNull();
  });
  it("寫讀 round-trip；清後回 null", () => {
    setActivePeer("0f520a5a-2a48-4eb8-8512-69a0a2e448dd");
    expect(readActivePeer()).toBe("0f520a5a-2a48-4eb8-8512-69a0a2e448dd");
    clearActivePeer();
    expect(readActivePeer()).toBeNull();
  });
});
