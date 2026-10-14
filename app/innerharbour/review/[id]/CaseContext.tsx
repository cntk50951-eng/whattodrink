import { reviewEventKindLabel } from "@/lib/complaints";
import { genderLabel, type ComplaintTally, type PersonCard, type ReviewContext } from "@/lib/reviewContext";

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

function fmt(iso: string | null): string {
  if (iso === null || iso === "") return "—";
  return iso.slice(0, 16).replace("T", " ");
}

function tallyText(t: ComplaintTally): string {
  if (t.total === 0) return "無";
  return `${t.total} 件（成立 ${t.upheld}／駁回 ${t.dismissed}／惡意 ${t.malicious}${t.pending > 0 ? `／未決 ${t.pending}` : ""}）`;
}

const TIER_LABEL: Record<string, string> = {
  newbie: "新手",
  trusted: "靠譜",
  normal: "一般",
  watch: "需注意",
  restricted: "受限",
};

const ROLE_LABEL: Record<PersonCard["role"], string> = {
  host: "發起人",
  member: "參加者",
  left: "曾報名，已退出",
  none: "不在該局名單（資料異常）",
};

function Person({ title, p }: { title: string; p: PersonCard }) {
  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, flex: "1 1 320px", minWidth: 280 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {p.avatarUrl !== null && (
          // 後台內部頁，外鏈頭像；no-referrer 不泄漏後台地址
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatarUrl} alt="" width={48} height={48} referrerPolicy="no-referrer" style={{ borderRadius: 24, objectFit: "cover" }} />
        )}
        <div>
          <strong>{p.nickname}</strong>
          <div style={{ fontSize: 12, color: "#666" }} title={p.id}>
            ID {p.id.slice(0, 8)}…
          </div>
        </div>
      </div>
      <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
        <li>
          性別／年齡：{genderLabel(p.gender)}／{p.age !== null ? `${p.age} 歲` : "未填"}
        </li>
        <li>註冊時間：{fmt(p.registeredAt)}</li>
        <li>在該局身份：{ROLE_LABEL[p.role]}</li>
        <li>
          到場：{p.arrivedAt !== null ? `已打卡 ${fmt(p.arrivedAt)}` : "無打卡記錄"}；房主標記：
          {p.hostMarked === true ? "到了" : p.hostMarked === false ? "未到" : "無"}
        </li>
        <li>
          局內事件：
          {p.events.length === 0
            ? "無"
            : p.events.map((e) => `${reviewEventKindLabel(e.kind)} ${fmt(e.at)}`).join("；")}
        </li>
        <li>
          誠信：
          {p.trust === null
            ? "—"
            : `${TIER_LABEL[p.trust.tier] ?? p.trust.tier}，分數 ${p.trust.score}，已完成 ${p.trust.completed} 局`}
        </li>
        <li>作為投訴人（別案）：{tallyText(p.asFiler)}</li>
        <li>作為被投訴人（別案）：{tallyText(p.asTarget)}</li>
        {p.suspendedUntil !== null && <li style={{ color: "crimson" }}>投訴權限暫停至 {fmt(p.suspendedUntil)}</li>}
      </ul>
    </div>
  );
}

/** 案件背景：涉案雙方的身份與在局記錄、酒局資料、雙方之間的其他投訴（僅內部可見；查看已寫審計）。 */
export default function CaseContext({ ctx }: { ctx: ReviewContext }) {
  const party = ctx.party;
  return (
    <>
      <section>
        <h2>涉案雙方（僅內部可見，不對外）</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Person title="投訴人" p={ctx.filer} />
          <Person title="被投訴人" p={ctx.target} />
        </div>
      </section>
      <section>
        <h2>酒局資料</h2>
        {party === null ? (
          <p>（找不到酒局記錄）</p>
        ) : (
          <ul>
            <li>酒吧：{party.place}</li>
            <li>
              時間：{fmt(party.startAt)} → {fmt(party.expiresAt)}（狀態 {party.status ?? "—"}）
            </li>
            <li>
              發起人：{party.hostNickname ?? "—"}；席位 {party.seatsTotal ?? "—"}，成局門檻 {party.minMembers ?? "—"}
            </li>
            <li>
              名單（{party.roster.length}）：
              {party.roster.map((m) => `${m.nickname}${m.isHost ? "（發起人）" : ""}`).join("、") || "—"}
            </li>
          </ul>
        )}
      </section>
      <section>
        <h2>雙方之間的其他投訴</h2>
        {ctx.pair.length === 0 ? (
          <p>（沒有）</p>
        ) : (
          <ul>
            {ctx.pair.map((h) => (
              <li key={h.id}>
                {fmt(h.at)} · {h.category} · {STATUS_LABEL[h.status] ?? h.status} ·{" "}
                {h.direction === "same" ? "同向（同一人投訴同一人）" : "反向（對方也投訴過）"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
