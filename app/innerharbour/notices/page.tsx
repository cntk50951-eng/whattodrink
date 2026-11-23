import Link from "next/link";

import { OpsNav } from "@/components/innerharbour/OpsNav";
import { requireAdminPage } from "@/lib/opsPage";
import {
  deleteSystemNoticeAction,
  saveSystemNoticeAction,
  toggleSystemNoticeAction,
} from "./actions";

/* eslint-disable react-hooks/purity -- Server Component 整頁門禁＋讀庫須比對當前時間判定生效狀態。 */

export const metadata = { robots: { index: false, follow: false } };

type NoticeRow = {
  id: string;
  kind: string;
  severity: string;
  platforms: string[] | null;
  max_version: string | null;
  version_label: string | null;
  title_zh_hant: string;
  title_zh_hans: string | null;
  title_en: string | null;
  body_zh_hant: string | null;
  body_zh_hans: string | null;
  body_en: string | null;
  bullets:
    | {
        icon?: string;
        title_zh_hant?: string;
        title_zh_hans?: string;
        title_en?: string;
        desc_zh_hant?: string;
        desc_zh_hans?: string;
        desc_en?: string;
      }[]
    | null;
  cta_label_zh_hant: string | null;
  cta_label_zh_hans: string | null;
  cta_label_en: string | null;
  cta_url: string | null;
  published: boolean;
  starts_at: string;
  ends_at: string | null;
  updated_at: string;
};

const KIND_LABELS: Record<string, string> = {
  update: "版本更新",
  maintenance: "系統維護",
  announcement: "系統公告",
};

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  // 轉香港時間 UTC+8 方便運營填寫
  const hk = new Date(ms + 8 * 3600_000);
  return hk.toISOString().slice(0, 16);
}

function formatStatus(r: NoticeRow, nowMs: number): { label: string; bg: string; fg: string } {
  if (!r.published) return { label: "草稿", bg: "#fef3c7", fg: "#92400e" };
  const s = Date.parse(r.starts_at);
  const e = r.ends_at ? Date.parse(r.ends_at) : null;
  if (Number.isFinite(s) && s > nowMs) return { label: "排程中", bg: "#dbeafe", fg: "#1e40af" };
  if (e !== null && Number.isFinite(e) && e <= nowMs) return { label: "已結束", bg: "#f3f4f6", fg: "#4b5563" };
  return { label: "生效中", bg: "#d1fae5", fg: "#065f46" };
}

export default async function SystemNoticesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role, svc } = await requireAdminPage({}, "/innerharbour/notices");
  const sp = await searchParams;
  const errMsg = typeof sp.err === "string" ? sp.err : null;
  const okMsg = typeof sp.ok === "string" ? sp.ok : null;
  const editId = typeof sp.edit === "string" ? sp.edit : null;

  const { data: rows, error } = await svc
    .from("system_notices")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const missingTable = error?.code === "42P01";
  const list = (missingTable ? [] : ((rows ?? []) as unknown[])) as NoticeRow[];
  const editing = editId ? list.find((r) => r.id === editId) ?? null : null;
  const nowMs = Date.now();
  const canWrite = role === "moderator";

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <OpsNav active="notices" role={role} />
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>系統消息與版本更新</h1>
            <p style={{ fontSize: 13.5, color: "#4b5563", marginTop: 4 }}>
              發佈後 iOS／Android 將於下次啟動以頂部靈動膠囊顯示；每條通知具唯一 ID，用戶關閉或點擊主按鈕後本機永不重彈（強制升級除外）。
            </p>
          </div>
          {editing && (
            <Link href="/innerharbour/notices" style={{ fontSize: 13.5, fontWeight: 600 }}>
              ← 返回新增公告
            </Link>
          )}
        </div>

        {missingTable && (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "1px solid #f59e0b", background: "#fffbeb", color: "#92400e", fontSize: 13.5 }}>
            尚未建立 <code>system_notices</code> 資料表，請先在 Supabase SQL Editor 執行 <code>supabase/migrations/0080_system_notices.sql</code>。
          </div>
        )}
        {errMsg && (
          <div role="alert" style={{ marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid #ef4444", background: "#fef2f2", color: "#991b1b", fontSize: 13.5 }}>
            {errMsg}
          </div>
        )}
        {okMsg && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid #10b981", background: "#ecfdf5", color: "#065f46", fontSize: 13.5 }}>
            {okMsg}
          </div>
        )}

        {canWrite && !missingTable && (
          <section
            style={{
              marginTop: 20,
              padding: 20,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "#fafafa",
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px" }}>
              {editing ? `編輯公告（ID: ${editing.id.slice(0, 8)}…）` : "發佈新系統消息 / 版本更新"}
            </h2>
            <form action={saveSystemNoticeAction} style={{ display: "grid", gap: 14 }}>
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>類型</strong>
                  <select name="kind" defaultValue={editing?.kind ?? "update"}>
                    <option value="update">版本更新（update）</option>
                    <option value="maintenance">系統維護（maintenance）</option>
                    <option value="announcement">系統公告（announcement）</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>顯示級別</strong>
                  <select name="severity" defaultValue={editing?.severity ?? "normal"}>
                    <option value="normal">普通（頂部靈動膠囊，可關閉）</option>
                    <option value="force">強制升級（鎖定卡片，不可關閉）</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>目標版本門檻（選填，例 1.5.0）</strong>
                  <input
                    name="max_version"
                    placeholder="僅版本低於此號才顯示"
                    defaultValue={editing?.max_version ?? ""}
                  />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>版本／時段小標籤（選填）</strong>
                  <input
                    name="version_label"
                    placeholder="例：v1.5.0 或 週三 03:00–03:30"
                    defaultValue={editing?.version_label ?? ""}
                  />
                </label>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", fontSize: 13.5 }}>
                <strong>目標平台：</strong>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    name="platform_ios"
                    defaultChecked={editing ? (editing.platforms ?? []).includes("ios") : true}
                  />
                  iOS
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    name="platform_android"
                    defaultChecked={editing ? (editing.platforms ?? []).includes("android") : true}
                  />
                  Android
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 12 }}>
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={editing ? editing.published : true}
                  />
                  <strong>立即發佈（不勾則存為草稿）</strong>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>繁體標題 *</strong>
                  <input name="title_zh_hant" required placeholder="Hi Drink v1.5 已準備好" defaultValue={editing?.title_zh_hant ?? ""} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>簡體標題（留空自動沿用繁體）</strong>
                  <input name="title_zh_hans" placeholder="Hi Drink v1.5 已准备好" defaultValue={editing?.title_zh_hans ?? ""} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>英文標題（留空自動沿用繁體）</strong>
                  <input name="title_en" placeholder="Hi Drink v1.5 is ready" defaultValue={editing?.title_en ?? ""} />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>繁體正文</strong>
                  <textarea name="body_zh_hant" rows={2} placeholder="簡短說明本次更新或公告內容…" defaultValue={editing?.body_zh_hant ?? ""} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>簡體正文</strong>
                  <textarea name="body_zh_hans" rows={2} defaultValue={editing?.body_zh_hans ?? ""} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>英文正文</strong>
                  <textarea name="body_en" rows={2} defaultValue={editing?.body_en ?? ""} />
                </label>
              </div>

              <details open={Boolean(editing && (editing.bullets?.length ?? 0) > 0)} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fff" }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13.5 }}>
                  展開卡片亮點要點（選填，最多 3 條）
                </summary>
                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {[1, 2, 3].map((idx) => {
                    const b = editing?.bullets?.[idx - 1];
                    return (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "68px repeat(3, 1fr)", gap: 8, alignItems: "start", paddingTop: idx > 1 ? 8 : 0, borderTop: idx > 1 ? "1px dashed #e5e7eb" : undefined }}>
                        <input name={`b${idx}_icon`} placeholder="✨" defaultValue={b?.icon ?? (idx === 1 ? "✨" : idx === 2 ? "🗺" : "⚡")} aria-label={`亮點 ${idx} 圖示`} />
                        <div style={{ display: "grid", gap: 4 }}>
                          <input name={`b${idx}_title_zh_hant`} placeholder={`要點 ${idx} 繁體標題`} defaultValue={b?.title_zh_hant ?? ""} />
                          <input name={`b${idx}_desc_zh_hant`} placeholder={`要點 ${idx} 繁體說明`} defaultValue={b?.desc_zh_hant ?? ""} />
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          <input name={`b${idx}_title_zh_hans`} placeholder={`要點 ${idx} 簡體標題`} defaultValue={b?.title_zh_hans ?? ""} />
                          <input name={`b${idx}_desc_zh_hans`} placeholder={`要點 ${idx} 簡體說明`} defaultValue={b?.desc_zh_hans ?? ""} />
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          <input name={`b${idx}_title_en`} placeholder={`Bullet ${idx} EN title`} defaultValue={b?.title_en ?? ""} />
                          <input name={`b${idx}_desc_en`} placeholder={`Bullet ${idx} EN desc`} defaultValue={b?.desc_en ?? ""} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>主按鈕繁體文案（選填）</strong>
                  <input name="cta_label_zh_hant" placeholder="例：立即前往更新" defaultValue={editing?.cta_label_zh_hant ?? ""} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>主按鈕簡體文案</strong>
                  <input name="cta_label_zh_hans" placeholder="立即前往更新" defaultValue={editing?.cta_label_zh_hans ?? ""} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>主按鈕英文文案</strong>
                  <input name="cta_label_en" placeholder="Update Now" defaultValue={editing?.cta_label_en ?? ""} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>跳轉連結（https:// / itms-apps:// / market://）</strong>
                  <input name="cta_url" placeholder="https://apps.apple.com/..." defaultValue={editing?.cta_url ?? ""} />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>生效時間（香港時間，留空即刻生效）</strong>
                  <input name="starts_at" type="datetime-local" defaultValue={editing ? toLocalInputValue(editing.starts_at) : ""} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <strong>自動下線時間（香港時間，選填，留空長期有效）</strong>
                  <input name="ends_at" type="datetime-local" defaultValue={editing ? toLocalInputValue(editing.ends_at) : ""} />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit">{editing ? "儲存變更" : "建立系統消息"}</button>
                {editing && (
                  <Link
                    href="/innerharbour/notices"
                    style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #d1d5db", textDecoration: "none", color: "#374151", background: "#fff" }}
                  >
                    取消編輯
                  </Link>
                )}
              </div>
            </form>
          </section>
        )}

        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>全部系統消息（{list.length}）</h2>
          {list.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 14 }}>目前尚未建立任何系統消息。</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table cellPadding={10} style={{ width: "100%", fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th>狀態</th>
                    <th>類型 / 級別</th>
                    <th>標題與內容</th>
                    <th>對象 / 版本門檻</th>
                    <th>生效時間</th>
                    {canWrite && <th>操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => {
                    const st = formatStatus(r, nowMs);
                    return (
                      <tr key={r.id}>
                        <td>
                          <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: st.bg, color: st.fg }}>
                            {st.label}
                          </span>
                        </td>
                        <td>
                          <div>{KIND_LABELS[r.kind] ?? r.kind}</div>
                          {r.severity === "force" && (
                            <span style={{ display: "inline-block", marginTop: 4, padding: "2px 7px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#fee2e2", color: "#b91c1c" }}>
                              強制升級
                            </span>
                          )}
                        </td>
                        <td style={{ maxWidth: 340 }}>
                          <div style={{ fontWeight: 700 }}>
                            {r.title_zh_hant}
                            {r.version_label ? <span style={{ marginLeft: 6, fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{r.version_label}</span> : null}
                          </div>
                          {r.body_zh_hant ? (
                            <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 2 }}>{r.body_zh_hant.slice(0, 80)}</div>
                          ) : null}
                        </td>
                        <td>
                          <div>{(r.platforms ?? []).join(" / ") || "-"}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            {r.max_version ? `版本 < ${r.max_version}` : "所有版本"}
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: "#4b5563", whiteSpace: "nowrap" }}>
                          <div>起：{r.starts_at.slice(0, 16).replace("T", " ")}</div>
                          {r.ends_at ? <div>止：{r.ends_at.slice(0, 16).replace("T", " ")}</div> : null}
                        </td>
                        {canWrite && (
                          <td style={{ whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <form action={toggleSystemNoticeAction}>
                                <input type="hidden" name="id" value={r.id} />
                                <input type="hidden" name="next_published" value={r.published ? "false" : "true"} />
                                <button
                                  type="submit"
                                  style={{
                                    padding: "5px 10px",
                                    fontSize: 12,
                                    background: r.published ? "#fff" : "#111",
                                    color: r.published ? "#111" : "#fff",
                                  }}
                                >
                                  {r.published ? "下架" : "發佈"}
                                </button>
                              </form>
                              <Link
                                href={`/innerharbour/notices?edit=${r.id}`}
                                style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, textDecoration: "none", color: "#111", background: "#fff" }}
                              >
                                編輯
                              </Link>
                              <form action={deleteSystemNoticeAction}>
                                <input type="hidden" name="id" value={r.id} />
                                <button
                                  type="submit"
                                  style={{ padding: "5px 10px", fontSize: 12, background: "#fff", color: "#b91c1c", borderColor: "#fca5a5" }}
                                >
                                  刪除
                                </button>
                              </form>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
