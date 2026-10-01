/**
 * UR C.22 揭曉隨機 index——純函數（開 overlay 時抽一次存 state，render 內不抽，防閃爍）。
 * 空池回 -1（調用方不開 overlay）；`rand` 可注入，單測定死。
 */
export function pickRandomIndex(
  count: number,
  rand: () => number = Math.random,
): number {
  if (count <= 0) return -1;
  return Math.min(Math.floor(rand() * count), count - 1);
}
