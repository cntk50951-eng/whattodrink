"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

type Option = { key: string; label: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="rv-submit" disabled={pending} aria-busy={pending}>
      {pending ? "處理中…請稍候" : "執行判定"}
    </button>
  );
}

/**
 * 判定表單（客戶端殼：只負責「點了要有反應」——提交中禁用按鈕並顯示處理中，避免重複點；
 * 驗證與執行全在服務端 Server Action，錯誤由頁面頂部 #err 橫幅顯示）。
 */
export default function DecideForm({
  action,
  isAppeal,
  reasons,
  draft,
}: {
  action: (formData: FormData) => void | Promise<void>;
  isAppeal: boolean;
  reasons: Option[];
  /** 二次驗證通過後帶回的已填內容；有就自動提交一次 */
  draft?: { decision: string; severity: string; reason: string; note: string } | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fired = useRef(false);
  useEffect(() => {
    if (draft && !fired.current) {
      fired.current = true;
      formRef.current?.requestSubmit();
    }
  }, [draft]);
  const dec = draft?.decision ?? "uphold";
  return (
    <form action={action} ref={formRef}>
      {draft && <p className="rv-hint">驗證通過，正在自動提交你剛才填寫的判定…</p>}
      {isAppeal && (
        <p className="rv-hint">申訴案：與原判相同＝維持原判（不動積分）；不同＝沖銷原扣分（含退還的退出扣分）後按新判執行；正式運營需第二位審核員覆核（測試模式／只有一位審核員時可由原判人處理）。</p>
      )}
      <div className="rv-radio" role="radiogroup" aria-label="判定結果">
        <label>
          <input type="radio" name="decision" value="uphold" defaultChecked={dec === "uphold"} />
          成立
          <small>扣被投訴人</small>
        </label>
        <label>
          <input type="radio" name="decision" value="dismiss" defaultChecked={dec === "dismiss"} />
          駁回
          <small>扣投訴人 2</small>
        </label>
        <label>
          <input type="radio" name="decision" value="malicious" defaultChecked={dec === "malicious"} />
          惡意
          <small>重扣投訴人</small>
        </label>
      </div>
      <label className="rv-field">
        <span>嚴重度（僅「成立 · 騷擾」用）</span>
        <select name="severity" defaultValue={draft?.severity ?? "1"}>
          <option value="1">1 · 輕（−10）</option>
          <option value="2">2 · 中（−18）</option>
          <option value="3">3 · 重（−25）</option>
        </select>
      </label>
      <label className="rv-field">
        <span>對外理由（用戶會看到）</span>
        <select name="reason" defaultValue={draft?.reason ?? reasons[0]?.key}>
          {reasons.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="rv-field">
        <span>
          內部備註 <b style={{ color: "#b91c1c" }}>必填</b>（僅後台可見）
        </span>
        <textarea name="note" rows={4} required maxLength={500} defaultValue={draft?.note ?? ""} placeholder="例如：已核對到場記錄與雙方陳述，判定依據…" />
      </label>
      <Submit />
      <p className="rv-hint" style={{ marginTop: 8 }}>需新鮮二次驗證；已判定的案件不可重複執行。</p>
    </form>
  );
}
