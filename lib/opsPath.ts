/** 後台路徑（與 `OPS_BASE` 同源）：proxy 對它跳過 intl 改寫。 */
export function isOpsPath(pathname: string): boolean {
  return pathname === "/innerharbour" || pathname.startsWith("/innerharbour/");
}
