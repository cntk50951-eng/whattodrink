/** 驗證碼輸入歸一：驗證器常顯示 "123 456"（含空格／全角數字）；去掉非數字、取前 6 位。 */
export function normalizeTotp(raw: string): string {
  const half = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  return half.replace(/\D/g, "").slice(0, 6);
}
