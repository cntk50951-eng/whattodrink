/**
 * UR A.1 架構 §9 演進：`/api/transcribe` → `/api/v1/transcribe` 版本化。
 * 本文件為薄代理，邏輯與 `app/api/transcribe/route.ts` 同源，僅換前綴；
 * 舊路徑保留（見 `docs/api-openapi.yaml` deprecated 標記），302 半年後再下線。
 * 兩路徑同時接受 `audioBase64`，回 `{text, accent}` 或 `{code,message}`（沿用舊信封，非 `error` 包絡）。
 */
export { POST } from "@/app/api/transcribe/route";
export const runtime = "nodejs";
