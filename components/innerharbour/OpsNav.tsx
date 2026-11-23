import Link from "next/link";

export type OpsSection = "review" | "user-reports" | "game-reports" | "notices";

const TABS: { key: OpsSection; href: string; label: string }[] = [
  { key: "review", href: "/innerharbour/review", label: "投訴審核" },
  { key: "user-reports", href: "/innerharbour/user-reports", label: "用戶舉報" },
  { key: "game-reports", href: "/innerharbour/game-reports", label: "遊戲舉報" },
  { key: "notices", href: "/innerharbour/notices", label: "系統消息與更新" },
];

/**
 * 統一後台頂欄（僅在 requireAdminPage 驗權通過後渲染；非管理員 404 不洩露路徑）。
 */
export function OpsNav({ active, role }: { active: OpsSection; role?: "viewer" | "moderator" }) {
  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 24px",
        borderBottom: "1px solid #e5e7eb",
        background: "#fafafa",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.2px", color: "#111" }}>
          🍺 Hi Drink 管理後台
        </span>
        <nav style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {TABS.map((t) => {
            const on = t.key === active;
            return (
              <Link
                key={t.key}
                href={t.href}
                style={{
                  textDecoration: "none",
                  fontSize: 13.5,
                  fontWeight: on ? 700 : 500,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: on ? "#111" : "#fff",
                  color: on ? "#fff" : "#374151",
                  border: on ? "1px solid #111" : "1px solid #d1d5db",
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {role && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 999,
            background: role === "moderator" ? "#fef3c7" : "#f3f4f6",
            color: role === "moderator" ? "#92400e" : "#4b5563",
          }}
        >
          {role === "moderator" ? "管理員（可讀寫）" : "唯讀檢視者"}
        </span>
      )}
    </header>
  );
}
