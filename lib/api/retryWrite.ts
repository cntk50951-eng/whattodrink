/**
 * 狀態已轉態之後的副作用寫入（通知、好友關係）失敗時的有界重試（第七輪 §3.4）。
 * 以前這些寫入只記 log：邀約已撤回／完成／接受，但對方的通知或好友行永遠沒寫成，且沒有任何補救。
 * 不是 outbox（沒有跨請求的持久重放），只擋住最常見的瞬時錯誤（連線抖動、逾時、鎖衝突）；
 * 最終仍失敗時回傳最後一個 error，呼叫端必須用帶 `[needs-repair]` 標記的日誌留下可對賬線索。
 *
 * 不重試必然失敗的錯誤：23xxx（約束）、42xxx（語法／權限／缺表）、PGRST1xx（請求本身不合法）。
 */
export type WriteError = { code?: string; message?: string };
type WriteResult = { error: WriteError | null };

const PERMANENT = /^(23|42|PGRST1)/;

export async function retryWrite(
  run: () => PromiseLike<WriteResult>,
  opts: { attempts?: number; baseDelayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<{ error: WriteError | null; attempts: number }> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const base = opts.baseDelayMs ?? 150;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: WriteError | null = null;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await run();
      if (res.error === null || res.error === undefined) return { error: null, attempts: i };
      last = res.error;
    } catch (e) {
      last = { code: "thrown", message: e instanceof Error ? e.message : "unknown" };
    }
    if (last.code !== undefined && PERMANENT.test(last.code)) return { error: last, attempts: i };
    if (i < attempts) await sleep(base * i);
  }
  return { error: last, attempts };
}
