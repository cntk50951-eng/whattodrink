import type { Metadata } from "next";

import { createServiceClient } from "@/lib/supabase/server";
import {
  appStoreUrl, partyBillText, partyDeepLink, partyPageState, partyPurposeText, partyShareDescription, partyWhenText,
} from "@/lib/share/partyPage";
import { OpenApp } from "./open-app";

/**
 * 酒局分享落地頁（匿名可看；WhatsApp／IG／掃碼的入口）。
 * 只用公開酒局匿名本就可見的字段；不含自填介紹、精確坐標。
 * 已安裝 App：自動／點按鈕用 whattodrink://party/<id> 直達該酒局；未安裝：顯示酒局資料＋下載連結。
 */
export const dynamic = "force-dynamic";

type PartyView = {
  id: string; place: string; start_at: string; expires_at: string; seats_total: number; joined: number;
  bill_intent: string; purposes: unknown; status: unknown; cover_url: string | null; host: string;
  /** 載入時算好（頁面渲染保持純函數） */
  state: "cancelled" | "ended" | "open";
};

async function loadParty(id: string): Promise<PartyView | null> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return null;
  const svc = await createServiceClient();
  const { data } = await svc
    .from("parties")
    .select("id,host_user_id,place,start_at,expires_at,seats_total,bill_intent,purposes,status,cover_url,cover_source")
    .eq("id", id)
    .maybeSingle();
  if (data === null || data === undefined) return null;
  const r = data as Record<string, unknown>;
  const [{ count }, { data: host }] = await Promise.all([
    svc.from("joins").select("party_id", { count: "exact", head: true }).eq("party_id", id),
    svc.from("users").select("nickname").eq("id", r.host_user_id as string).maybeSingle(),
  ]);
  const cover = typeof r.cover_url === "string" && r.cover_source !== "default" && /^https:\/\//.test(r.cover_url) ? r.cover_url : null;
  return {
    id: r.id as string, place: String(r.place ?? ""), start_at: String(r.start_at ?? ""), expires_at: String(r.expires_at ?? ""),
    seats_total: Number(r.seats_total ?? 0), joined: count ?? 0, bill_intent: String(r.bill_intent ?? ""), purposes: r.purposes,
    status: r.status, state: partyPageState({ status: r.status, expires_at: String(r.expires_at ?? "") }, Date.now()), cover_url: cover, host: typeof (host as { nickname?: unknown } | null)?.nickname === "string" ? (host as { nickname: string }).nickname : "酒友",
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await loadParty(id);
  if (p === null) return { title: "酒局不存在 — 今晚飲咩", robots: { index: false } };
  const desc = partyShareDescription(p);
  return {
    title: `${p.place} · ${partyWhenText(p.start_at)} — 今晚飲咩`,
    description: desc,
    robots: { index: false, follow: false },
    openGraph: { title: `${p.host} 邀你碰杯 · ${p.place}`, description: desc, type: "website", ...(p.cover_url !== null ? { images: [p.cover_url] } : {}) },
    twitter: { card: p.cover_url !== null ? "summary_large_image" : "summary", title: `${p.host} 邀你碰杯 · ${p.place}`, description: desc },
  };
}

export default async function PartySharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await loadParty(id);
  const store = appStoreUrl(process.env.APP_STORE_URL);
  const state = p === null ? null : p.state;
  return (
    <main className="wrap">
      <style>{CSS}</style>
      <div className="brand">今晚飲咩</div>
      {p === null ? (
        <section className="card"><h1>搵唔到呢個酒局</h1><p className="muted">連結可能已失效，或者酒局已被刪除。</p></section>
      ) : (
        <section className="card">
          {p.cover_url !== null ? <div className="cover" style={{ backgroundImage: `url(${p.cover_url})` }} /> : <div className="cover plain" />}
          <div className="body">
            {state !== "open" && <span className="pill">{state === "cancelled" ? "發起人已撤銷" : "已結束"}</span>}
            <div className="when">{partyWhenText(p.start_at)}</div>
            <h1>{p.place}</h1>
            <div className="meta">{p.host} 發起 · {p.joined}/{p.seats_total} 人{partyBillText(p.bill_intent) !== "" ? ` · ${partyBillText(p.bill_intent)}` : ""}</div>
            <div className="tags">{partyPurposeText(p.purposes).map((t) => <span key={t}>{t}</span>)}</div>
            {state === "open" ? <OpenApp deepLink={partyDeepLink(p.id)} storeUrl={store} /> : <p className="muted">呢個局已經完結，睇睇其他公開酒局啦。</p>}
            <p className="foot">加入酒局要登入 App；公開酒局只限認證真實酒吧。未滿十八歲切勿飲酒。</p>
          </div>
        </section>
      )}
    </main>
  );
}

const CSS = `
:root{color-scheme:dark}
body{margin:0;background:#0D0E12;color:#F4ECDD;font-family:-apple-system,BlinkMacSystemFont,"PingFang HK","Noto Sans TC",sans-serif}
.wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 16px 40px}
.brand{font-weight:800;letter-spacing:.08em;font-size:13px;color:#FFC46B;margin:8px 0 18px}
.card{width:100%;max-width:420px;border-radius:24px;overflow:hidden;background:#15171D;border:1px solid rgba(255,222,170,.12)}
.cover{height:200px;background-size:cover;background-position:center}
.cover.plain{height:120px;background:radial-gradient(circle at 25% 20%,rgba(255,180,58,.55),transparent 60%),linear-gradient(180deg,#2a1d0c,#15171D)}
.body{padding:20px}
.when{font-size:30px;font-weight:800;letter-spacing:-.03em}
h1{margin:8px 0 0;font-size:22px;letter-spacing:-.02em}
.meta{margin-top:6px;color:#BFB5A3;font-size:14px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.tags span{padding:4px 10px;border-radius:12px;background:rgba(255,255,255,.07);font-size:12px;font-weight:700;color:#BFB5A3}
.pill{display:inline-block;margin-bottom:10px;padding:3px 10px;border-radius:10px;background:rgba(248,113,113,.15);color:#F87171;font-size:12px;font-weight:700}
.actions{margin-top:20px;display:grid;gap:10px}
.btn{display:flex;align-items:center;justify-content:center;height:52px;border-radius:26px;font-weight:800;font-size:16px;text-decoration:none}
.btn.primary{background:linear-gradient(135deg,#FFB43A,#FF7A4F 55%,#FF5C7A);color:#2A1700}
.btn.primary.soft{box-shadow:0 8px 24px rgba(255,122,79,.35)}
.btn.ghost{border:1px solid rgba(255,222,170,.25);color:#F4ECDD}
.muted,.note{color:#9A917F;font-size:13px;line-height:1.6}
.foot{margin:18px 0 0;color:#9A917F;font-size:11.5px;line-height:1.6;text-align:center}
`;
