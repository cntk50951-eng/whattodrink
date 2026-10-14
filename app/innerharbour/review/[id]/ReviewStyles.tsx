/** 審核面板樣式（只作用在 .rv 容器；後台內部頁，不影響前台）。 */
export default function ReviewStyles() {
  return (
    <style>{`
      .rv { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f1f5f9; --card:#fff;
            --filer:#2563eb; --target:#d97706; --good:#15803d; --bad:#b91c1c; --admin:#7c3aed; --sys:#64748b;
            background:var(--bg); color:var(--ink); min-height:100vh; padding:20px 24px 48px; font-family:system-ui,-apple-system,"PingFang TC",sans-serif; }
      .rv * { box-sizing:border-box; }
      .rv-wrap { max-width:1180px; margin:0 auto; }
      .rv-nav { font-size:13px; margin-bottom:10px; display:flex; gap:12px; }
      .rv-head { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:16px; }
      .rv-head h1 { margin:0; font-size:22px; }
      .rv-sub { color:var(--muted); font-size:12px; }
      .rv-chip { display:inline-block; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:700; background:#e2e8f0; color:#334155; white-space:nowrap; }
      .rv-chip.filer { background:#dbeafe; color:#1d4ed8; } .rv-chip.target { background:#fef3c7; color:#b45309; }
      .rv-chip.good { background:#dcfce7; color:var(--good); } .rv-chip.bad { background:#fee2e2; color:var(--bad); }
      .rv-chip.admin { background:#ede9fe; color:var(--admin); } .rv-chip.warn { background:#fef3c7; color:#92400e; }
      .rv-banner { border-radius:10px; padding:10px 14px; margin-bottom:12px; font-weight:600; font-size:14px; }
      .rv-banner.err { background:#fee2e2; border:1px solid #fca5a5; color:#991b1b; }
      .rv-banner.ok { background:#dcfce7; border:1px solid #86efac; color:#14532d; }
      .rv-banner.warn { background:#fef9c3; border:1px solid #fde047; color:#713f12; font-weight:500; }
      .rv-grid { display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:16px; align-items:start; }
      @media (max-width: 960px) { .rv-grid { grid-template-columns:1fr; } .rv-aside { position:static !important; } }
      .rv-card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; margin-bottom:16px; box-shadow:0 1px 2px rgba(15,23,42,.04); }
      .rv-card h2 { margin:0 0 12px; font-size:15px; display:flex; align-items:center; gap:8px; }
      .rv-card h2 small { color:var(--muted); font-weight:400; font-size:12px; }
      .rv-aside { position:sticky; top:12px; }
      .rv-people { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
      @media (max-width: 700px) { .rv-people { grid-template-columns:1fr; } }
      .rv-person { background:var(--card); border:1px solid var(--line); border-top:4px solid var(--line); border-radius:12px; padding:14px; }
      .rv-person.filer { border-top-color:var(--filer); } .rv-person.target { border-top-color:var(--target); }
      .rv-person-top { display:flex; gap:10px; align-items:center; margin-bottom:10px; }
      .rv-avatar { width:44px; height:44px; border-radius:50%; object-fit:cover; background:#e2e8f0; flex:none; }
      .rv-person-top b { font-size:16px; } .rv-person-top .rv-sub { display:block; }
      .rv-kv { display:grid; grid-template-columns:84px 1fr; gap:6px 10px; font-size:13px; margin:0; }
      .rv-kv dt { color:var(--muted); } .rv-kv dd { margin:0; word-break:break-word; }
      .rv-score { display:inline-flex; align-items:baseline; gap:4px; }
      .rv-score b { font-size:20px; }
      .rv-quote { background:#f8fafc; border-left:4px solid var(--line); border-radius:6px; padding:10px 12px; margin:0 0 10px; white-space:pre-wrap; word-break:break-word; font-size:14px; }
      .rv-quote.filer { border-left-color:var(--filer); } .rv-quote.target { border-left-color:var(--target); } .rv-quote.admin { border-left-color:var(--admin); }
      .rv-quote .rv-sub { display:block; margin-bottom:4px; font-weight:700; }
      .rv-evid { display:flex; gap:8px; flex-wrap:wrap; }
      .rv-tl { list-style:none; margin:0; padding:0 0 0 4px; }
      .rv-tl li { position:relative; padding:0 0 14px 28px; }
      .rv-tl li::before { content:""; position:absolute; left:6px; top:14px; bottom:-2px; width:2px; background:var(--line); }
      .rv-tl li:last-child::before { display:none; }
      .rv-dot { position:absolute; left:0; top:5px; width:14px; height:14px; border-radius:50%; background:#fff; border:3px solid var(--sys); }
      .rv-tl li.major .rv-dot { width:18px; height:18px; left:-2px; top:3px; }
      .rv-tl li.filer .rv-dot { border-color:var(--filer); } .rv-tl li.target .rv-dot { border-color:var(--target); }
      .rv-tl li.admin .rv-dot { border-color:var(--admin); } .rv-tl li.good .rv-dot { border-color:var(--good); } .rv-tl li.bad .rv-dot { border-color:var(--bad); }
      .rv-tl-time { font-size:12px; color:var(--muted); font-variant-numeric:tabular-nums; }
      .rv-tl-title { font-size:14px; font-weight:600; display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
      .rv-tl li:not(.major) .rv-tl-title { font-weight:500; color:#334155; }
      .rv-tl-body { font-size:13px; background:#f8fafc; border-radius:6px; padding:6px 10px; margin-top:4px; white-space:pre-wrap; word-break:break-word; }
      .rv-todo { display:flex; gap:14px; align-items:center; border-radius:12px; padding:14px 16px; margin-bottom:16px; border:2px solid var(--line); background:#fff; }
      .rv-todo.act { border-color:#f59e0b; background:#fffbeb; } .rv-todo.urgent { border-color:#dc2626; background:#fef2f2; }
      .rv-todo.done { background:#f8fafc; }
      .rv-todo b { font-size:16px; display:block; } .rv-todo p { margin:2px 0 0; font-size:13px; color:#475569; }
      .rv-todo .rv-todo-body { flex:1; min-width:0; }
      .rv-bell { position:relative; width:14px; height:14px; border-radius:50%; background:#f59e0b; flex:none; }
      .rv-todo.urgent .rv-bell { background:#dc2626; }
      .rv-bell::after { content:""; position:absolute; inset:-6px; border-radius:50%; border:2px solid currentColor; color:#f59e0b; animation:rvPulse 1.4s ease-out infinite; }
      .rv-todo.urgent .rv-bell::after { color:#dc2626; }
      @keyframes rvPulse { 0% { transform:scale(.6); opacity:.9; } 100% { transform:scale(1.8); opacity:0; } }
      @media (prefers-reduced-motion: reduce) { .rv-bell::after { animation:none; opacity:.5; } }
      .rv-cta { background:#dc2626 !important; border-color:#dc2626 !important; font-weight:700; white-space:nowrap; padding:10px 18px !important; }
      .rv-todo:not(.urgent) .rv-cta { background:#d97706 !important; border-color:#d97706 !important; }
      details.rv-card > summary { cursor:pointer; font-weight:700; font-size:15px; list-style:none; display:flex; justify-content:space-between; align-items:center; }
      details.rv-card > summary::-webkit-details-marker { display:none; }
      details.rv-card > summary::after { content:"展開 ▾"; font-size:12px; color:var(--muted); font-weight:400; }
      details.rv-card[open] > summary::after { content:"收起 ▴"; }
      details.rv-card[open] > summary { margin-bottom:12px; }
      .rv-tl li.todo .rv-dot { border-color:#f59e0b; background:#f59e0b; animation:rvBlink 1.2s ease-in-out infinite; }
      @keyframes rvBlink { 50% { box-shadow:0 0 0 6px rgba(245,158,11,.25); } }
      @media (prefers-reduced-motion: reduce) { .rv-tl li.todo .rv-dot { animation:none; } }
      .rv-tl li.todo .rv-tl-body { background:#fffbeb; border:1px dashed #f59e0b; }
      .rv-order { margin-left:auto; font-size:12px; font-weight:400; }
      .rv-chat { display:flex; flex-direction:column; gap:8px; max-height:420px; overflow:auto; }
      .rv-bubble { max-width:80%; border-radius:12px; padding:8px 12px; font-size:14px; word-break:break-word; }
      .rv-bubble p { margin:2px 0 0; white-space:pre-wrap; }
      .rv-bubble.filer { align-self:flex-start; background:#dbeafe; } .rv-bubble.target { align-self:flex-end; background:#fef3c7; }
      .rv-gauge { position:relative; height:10px; border-radius:6px; background:#e2e8f0; margin-top:6px; }
      .rv-gauge i { position:absolute; top:0; bottom:0; } .rv-gauge i.lo { left:0; width:15%; background:#bbf7d0; border-radius:6px 0 0 6px; }
      .rv-gauge i.hi { right:0; width:15%; background:#fecaca; border-radius:0 6px 6px 0; }
      .rv-gauge b { position:absolute; top:-3px; width:4px; height:16px; background:#0f172a; border-radius:2px; transform:translateX(-2px); }
      .rv-radio { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
      .rv-radio label { border:2px solid var(--line); border-radius:10px; padding:10px 6px; text-align:center; cursor:pointer; font-weight:700; font-size:14px; background:#fff; }
      .rv-radio input { position:absolute; opacity:0; pointer-events:none; width:0; height:0; padding:0; }
      .rv-radio label:has(input:checked) { border-color:var(--ink); background:var(--ink); color:#fff; }
      .rv-radio label small { display:block; font-weight:400; font-size:11px; opacity:.8; margin-top:2px; }
      .rv-field { margin-bottom:12px; font-size:13px; } .rv-field > span { display:block; font-weight:600; margin-bottom:4px; }
      .rv-field select, .rv-field textarea { width:100%; }
      .rv-submit { width:100%; padding:12px !important; font-weight:700; }
      .rv-hint { font-size:12px; color:var(--muted); margin:0 0 10px; }
      .rv-list { margin:0; padding-left:18px; font-size:13px; } .rv-list li { margin-bottom:4px; }
      .rv-eff { display:flex; justify-content:space-between; gap:8px; font-size:13px; padding:6px 0; border-bottom:1px dashed var(--line); }
      .rv-eff:last-child { border-bottom:0; }
      .rv-neg { color:var(--bad); font-weight:700; } .rv-pos { color:var(--good); font-weight:700; } .rv-rev { color:var(--muted); text-decoration:line-through; }
    `}</style>
  );
}
