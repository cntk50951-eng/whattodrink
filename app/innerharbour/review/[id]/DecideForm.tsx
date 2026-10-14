"use client";

import { useFormStatus } from "react-dom";

type Option = { key: string; label: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "處理中…請稍候" : "執行（需新鮮二次驗證；已判定的案件不可重複執行）"}
    </button>
  );
}

/**
 * 判定表單（客戶端殼：只負責「點了要有反應」——提交中禁用按鈕並顯示處理中，避免用戶以為沒反應而重複點；
 * 驗證與執行全在服務端 Server Action，錯誤由頁面頂部 #err 橫幅顯示）。
 */
export default function DecideForm({
  action,
  isAppeal,
  reasons,
}: {
  action: (formData: FormData) => void | Promise<void>;
  isAppeal: boolean;
  reasons: Option[];
}) {
  return (
    <form action={action}>
      {isAppeal && (
        <p>申訴案：與原判相同＝維持原判（不動積分）；不同＝沖銷原扣分後按新判執行，且需第二位審核員。</p>
      )}
      <label>
        決定：
        <select name="decision" defaultValue="uphold">
          <option value="uphold">成立</option>
          <option value="dismiss">駁回</option>
          <option value="malicious">惡意</option>
        </select>
      </label>{" "}
      <label>
        severity（成立·騷擾用）：
        <select name="severity" defaultValue="1">
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </label>{" "}
      <label>
        對外理由（用戶可見）：
        <select name="reason" defaultValue={reasons[0]?.key}>
          {reasons.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <p>
        <label>
          內部備註（<strong>必填</strong>，僅後台可見，不會發給任何用戶）：
          <br />
          <textarea name="note" rows={3} cols={60} required maxLength={500} placeholder="例如：已核對到場記錄與雙方陳述，判定依據…" />
        </label>
      </p>
      <Submit />
    </form>
  );
}
