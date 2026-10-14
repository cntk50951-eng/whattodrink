import { reviewEventKindLabel } from "@/lib/complaints";
import { genderLabel, type ComplaintTally, type PersonCard, type ReviewContext } from "@/lib/reviewContext";
import { fmtHK } from "@/lib/reviewTimeline";

const STATUS_LABEL: Record<string, string> = {
  awaiting_response: "等申辯",
  pending: "處理中",
  triaged: "已分診",
  escalated: "待人工",
  upheld: "成立",
  dismissed: "駁回",
  malicious: "惡意",
  withdrawn: "撤回",
};

function tallyText(t: ComplaintTally): string {
  if (t.total === 0) return "無";
  return `${t.total} 件（成立 ${t.upheld}／駁回 ${t.dismissed}／惡意 ${t.malicious}${t.pending > 0 ? `／未決 ${t.pending}` : ""}）`;
}

const TIER_LABEL: Record<string, string> = { newbie: "新手", trusted: "靠譜", normal: "一般", watch: "需注意", restricted: "受限" };
const ROLE_LABEL: Record<PersonCard["role"], string> = {
  host: "發起人",
  member: "參加者",
  left: "曾報名，已退出",
  none: "不在名單（資料異常）",
};

function Person({ kind, title, p }: { kind: "filer" | "target"; title: string; p: PersonCard }) {
  const risky = p.asTarget.upheld + p.asTarget.malicious >= 2 || p.asFiler.dismissed + p.asFiler.malicious >= 2;
  return (
    <div className={`rv-person ${kind}`}>
      <div className="rv-person-top">
        {p.avatarUrl !== null ? (
          // 後台內部頁，外鏈頭像；no-referrer 不泄漏後台地址
          // eslint-disable-next-line @next/next/no-img-element
          <img className="rv-avatar" src={p.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="rv-avatar" />
        )}
        <div>
          <span className={`rv-chip ${kind}`}>{title}</span>
          <b style={{ marginLeft: 6 }}>{p.nickname}</b>
          <span className="rv-sub" title={p.id}>ID {p.id.slice(0, 8)}…</span>
        </div>
      </div>
      <dl className="rv-kv">
        <dt>誠信</dt>
        <dd>
          {p.trust === null ? (
            "—"
          ) : (
            <>
              <span className="rv-score"><b>{p.trust.score}</b>／100</span>{" "}
              <span className="rv-chip">{TIER_LABEL[p.trust.tier] ?? p.trust.tier}</span>{" "}
              <span className="rv-sub">已完成 {p.trust.completed} 局</span>
            </>
          )}
        </dd>
        <dt>在局身份</dt>
        <dd>{ROLE_LABEL[p.role]}</dd>
        <dt>到場</dt>
        <dd>
          {p.arrivedAt !== null ? `已打卡 ${fmtHK(p.arrivedAt)}` : "無打卡"}；房主標記
          {p.hostMarked === true ? "到了" : p.hostMarked === false ? "未到" : "無"}
        </dd>
        <dt>局內事件</dt>
        <dd>{p.events.length === 0 ? "無" : p.events.map((e) => `${reviewEventKindLabel(e.kind)} ${fmtHK(e.at)}`).join("；")}</dd>
        <dt>性別／年齡</dt>
        <dd>
          {genderLabel(p.gender)}／{p.age !== null ? `${p.age} 歲` : "未填"}
        </dd>
        <dt>註冊</dt>
        <dd>{fmtHK(p.registeredAt)}</dd>
        <dt>作投訴人</dt>
        <dd>{tallyText(p.asFiler)}</dd>
        <dt>被投訴</dt>
        <dd>
          {tallyText(p.asTarget)} {risky && <span className="rv-chip bad">需留意</span>}
        </dd>
        {p.suspendedUntil !== null && (
          <>
            <dt>投訴權限</dt>
            <dd><span className="rv-chip bad">暫停至 {fmtHK(p.suspendedUntil)}</span></dd>
          </>
        )}
      </dl>
    </div>
  );
}

/** 涉案雙方並排卡（藍＝投訴人、橙＝被投訴人）。僅內部可見；查看已寫審計。 */
export function PeopleCards({ ctx }: { ctx: ReviewContext }) {
  return (
    <div className="rv-people">
      <Person kind="filer" title="投訴人" p={ctx.filer} />
      <Person kind="target" title="被投訴人" p={ctx.target} />
    </div>
  );
}

/** 酒局資料＋雙方之間的其他投訴。 */
export default function CaseContext({ ctx }: { ctx: ReviewContext }) {
  const party = ctx.party;
  return (
    <>
      <section className="rv-card">
        <h2>酒局資料</h2>
        {party === null ? (
          <p className="rv-sub">（找不到酒局記錄）</p>
        ) : (
          <dl className="rv-kv" style={{ gridTemplateColumns: "72px 1fr" }}>
            <dt>酒吧</dt>
            <dd>{party.place}</dd>
            <dt>時間</dt>
            <dd>
              {fmtHK(party.startAt)} → {fmtHK(party.expiresAt)}（{party.status ?? "—"}）
            </dd>
            <dt>發起人</dt>
            <dd>
              {party.hostNickname ?? "—"}；席位 {party.seatsTotal ?? "—"}，成局門檻 {party.minMembers ?? "—"}
            </dd>
            <dt>名單 {party.roster.length}</dt>
            <dd>{party.roster.map((m) => `${m.nickname}${m.isHost ? "（發起人）" : ""}`).join("、") || "—"}</dd>
          </dl>
        )}
      </section>
      <section className="rv-card">
        <h2>雙方之間的其他投訴</h2>
        {ctx.pair.length === 0 ? (
          <p className="rv-sub">沒有。</p>
        ) : (
          <ul className="rv-list">
            {ctx.pair.map((h) => (
              <li key={h.id}>
                {fmtHK(h.at)} · {h.category} · {STATUS_LABEL[h.status] ?? h.status} ·{" "}
                {h.direction === "same" ? "同向" : "反向（對方也投訴過）"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
