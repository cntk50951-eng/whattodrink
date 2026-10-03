/**
 * UR D.8 聊天房本地缓存（SWR 秒开；v2-only 消费，共用层只做加法）。
 * - 存视图行 `ChatMessage[]`（id 去重＋时间升序＋超限裁 50，纯函数可单测）。
 * - 键按 peer（1v1，D 范围）；`ownerUid` 不对／版本不对即弃（防跨号串看）。
 * - 附件只存描述（path／mime／bytes／secs），播时签名现场换（短链过期即脏，故不存）。
 * - IDB 不可用（SSR／无痕／配额满）一律 fail-open 走网络，调用方无感。
 */

import type { ChatMessage } from "./chat";

export const CHAT_CACHE_VERSION = 1;
export const CHAT_CACHE_LIMIT = 50;
const CHAT_CACHE_DB = "wtd-chat";
const CHAT_CACHE_STORE = "threads";

export type CachedThread = {
  v: number;
  ownerUid: string;
  convId: string | null;
  savedAt: number;
  messages: ChatMessage[];
};

/** peer 缓存键（1v1；group 留 `conv:` 命名空间，另议）。 */
export function cacheKeyForPeer(peerId: string): string {
  return `peer:${peerId}`;
}

function isChatMessage(raw: unknown): raw is ChatMessage {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    (r.role === "me" || r.role === "friend") &&
    typeof r.at === "number" &&
    Number.isFinite(r.at)
  );
}

/** 缓存记录校验（坏结构／错版本／错 owner 即弃；坏行逐行丢，不炸整串）。 */
export function validateCache(raw: unknown, ownerUid: string): CachedThread | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== CHAT_CACHE_VERSION) return null;
  if (r.ownerUid !== ownerUid) return null;
  if (!Array.isArray(r.messages)) return null;
  const messages = (r.messages as unknown[]).filter(isChatMessage);
  return {
    v: CHAT_CACHE_VERSION,
    ownerUid,
    convId: typeof r.convId === "string" ? (r.convId as string) : null,
    savedAt: typeof r.savedAt === "number" ? (r.savedAt as number) : 0,
    messages,
  };
}

/**
 * 两路合并（base＋extra；同 id 取 extra；时间升序；超限裁末 N 条）。
 * 用途：历史回包＋开房期先到的 Realtime 行（防 settle 覆盖丢行）。
 */
export function mergeMessageLists(
  base: ChatMessage[],
  extra: ChatMessage[],
  limit: number = CHAT_CACHE_LIMIT,
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of base) byId.set(m.id, m);
  for (const m of extra) byId.set(m.id, m);
  const merged = [...byId.values()].sort((a, b) => a.at - b.at);
  return merged.slice(-Math.max(1, limit));
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(CHAT_CACHE_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(CHAT_CACHE_STORE)) {
          req.result.createObjectStore(CHAT_CACHE_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function tx<T>(run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then((db) => {
    if (db === null) return null;
    return new Promise<T | null>((resolve) => {
      try {
        const t = db.transaction(CHAT_CACHE_STORE, "readwrite");
        const store = t.objectStore(CHAT_CACHE_STORE);
        const req = run(store);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
        t.oncomplete = () => db.close();
        t.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

/** 读 peer 缓存（未命中／非法／错主即 null；调用方走骨架）。 */
export async function loadCachedThread(
  peerId: string,
  ownerUid: string | null,
): Promise<CachedThread | null> {
  if (ownerUid === null) return null;
  try {
    const raw = await tx((store) => store.get(cacheKeyForPeer(peerId)));
    return validateCache(raw, ownerUid);
  } catch {
    return null;
  }
}

/** 写 peer 缓存（幂等复写；失败静默，调用方照常走网络）。 */
export async function saveCachedThread(
  peerId: string,
  ownerUid: string | null,
  convId: string | null,
  messages: ChatMessage[],
): Promise<void> {
  if (ownerUid === null || messages.length === 0) return;
  try {
    const record: CachedThread = {
      v: CHAT_CACHE_VERSION,
      ownerUid,
      convId,
      savedAt: Date.now(),
      messages: messages.slice(-CHAT_CACHE_LIMIT),
    };
    await tx((store) => store.put(record, cacheKeyForPeer(peerId)));
  } catch {
    // 配额满／隐私模式：静默降级，下次进房走网络
  }
}
