import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Intentionally minimal — add config as needed.
  // 清單 B14：后台路径安全头（防点击劫持＋不缓存隐私页；前台不动）。
  async headers() {
    const admin = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
    ];
    return [
      { source: "/innerharbour/:path*", headers: admin },
      { source: "/api/internal/:path*", headers: admin },
    ];
  },
};

export default withNextIntl(nextConfig);