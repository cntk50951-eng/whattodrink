import { fmtHK, type TimelineItem } from "@/lib/reviewTimeline";

const TAG_CLASS: Record<string, string> = { 投訴人: "filer", 申訴方: "filer", 被投訴人: "target", 審核員: "admin", 判定: "admin" };

/** 案件時間軸：最早在上、最新在下；顏色＝誰做的（藍＝投訴人、橙＝被投訴人、紫＝審核員、灰＝系統）。 */
export default function Timeline({ items, todo }: { items: TimelineItem[]; todo?: { title: string; detail: string } | null }) {
  if (items.length === 0 && !todo) return <p className="rv-sub">（沒有可顯示的記錄）</p>;
  return (
    <ol className="rv-tl">
      {todo && (
        <li className="todo major">
          <span className="rv-dot" aria-hidden />
          <div className="rv-tl-time">現在</div>
          <div className="rv-tl-title"><span className="rv-chip warn">待你處理</span><span>{todo.title}</span></div>
          <div className="rv-tl-body">{todo.detail}</div>
        </li>
      )}
      {items.map((it, i) => (
        <li key={i} className={`${it.tone} ${it.major ? "major" : ""}`}>
          <span className="rv-dot" aria-hidden />
          <div className="rv-tl-time">{fmtHK(it.at)}</div>
          <div className="rv-tl-title">
            {it.tag !== null && <span className={`rv-chip ${TAG_CLASS[it.tag] ?? ""}`}>{it.tag}</span>}
            <span>{it.title}</span>
          </div>
          {it.body !== null && <div className="rv-tl-body">{it.body}</div>}
        </li>
      ))}
    </ol>
  );
}
