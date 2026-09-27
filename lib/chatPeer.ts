/**
 * UR D.7 零 id 聊天路由：peer 身份走 sessionStorage（tab 關即焚，刷新不丟），
 * URL 永遠是乾淨的 `/v2/chat/room`。直接進／會話過期無 peer 即回列表。
 * 純函數＋try/catch（SSR／隱私模式寫失敗不拋，調用方回退列表）。
 */

const ACTIVE_PEER_KEY = "wtd:chat:peer";

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** 進房前調（地圖釘／列表行點擊處）；空串不寫。 */
export function setActivePeer(userId: string): void {
  if (userId === "") return;
  try {
    storage()?.setItem(ACTIVE_PEER_KEY, userId);
  } catch {
    // 配額／隱私模式寫失敗——room 回退列表，不拋
  }
}

/** 房間頁讀（null 即無身份，回列表）。 */
export function readActivePeer(): string | null {
  try {
    const v = storage()?.getItem(ACTIVE_PEER_KEY);
    return v === undefined || v === null || v === "" ? null : v;
  } catch {
    return null;
  }
}

/** 登出／切人時清（登出鏈已有 clearUserLocalCaches 整批清，此為顯式口）。 */
export function clearActivePeer(): void {
  try {
    storage()?.removeItem(ACTIVE_PEER_KEY);
  } catch {
    // 讀不到即無，不拋
  }
}
