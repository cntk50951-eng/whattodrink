import { decisionLabel, type DecisionRecord } from "@/lib/reviewContext";
import { TRUST_KIND_TEXT } from "@/lib/trust/config";
import { fmtHK } from "@/lib/reviewTimeline";

/** 判定記錄（側欄）：結果、處理人、理由、備註、實際積分變化。處理軌跡已併入主時間軸。 */
export default function DecisionRecordView({ rec }: { rec: DecisionRecord }) {
  const tone = rec.decision === "uphold" ? "good" : rec.decision === null ? "" : "bad";
  return (
    <section id="rec" className="rv-card">
      <h2>
        判定記錄 <span className={`rv-chip ${tone}`}>{decisionLabel(rec.decision)}</span>
      </h2>
      <dl className="rv-kv">
        <dt>處理人</dt>
        <dd>{rec.decidedBy}</dd>
        <dt>時間</dt>
        <dd>{fmtHK(rec.decidedAt)}</dd>
        <dt>對外理由</dt>
        <dd>{rec.publicReason ?? "—"}</dd>
        <dt>內部備註</dt>
        <dd>{rec.internalNote ?? "（無）"}</dd>
        {rec.appealStatus !== null && (
          <>
            <dt>申訴</dt>
            <dd>{rec.appealStatus === "pending" ? "處理中" : rec.appealStatus === "upheld" ? "已改判" : "維持原判"}</dd>
          </>
        )}
      </dl>
      <h2 style={{ marginTop: 14 }}>實際積分變化</h2>
      {rec.effects.length === 0 ? (
        <p className="rv-sub">沒有扣分／加分記錄（駁回時被投訴人不變、維持原判不動積分，或尚未執行）。</p>
      ) : (
        rec.effects.map((e, i) => (
          <div key={i} className="rv-eff">
            <span className={e.reversed ? "rv-rev" : undefined}>
              {e.nickname} · {e.reversed ? "沖銷：" : ""}{TRUST_KIND_TEXT[e.kind.replace(":reversed", "")] ?? e.kind.replace(":reversed", "")}
            </span>
            <span className={e.delta < 0 ? "rv-neg" : "rv-pos"}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
          </div>
        ))
      )}
      <p className="rv-sub" style={{ marginTop: 10 }}>查看詳情共 {rec.viewCount} 次（均已寫審計）。</p>
    </section>
  );
}
