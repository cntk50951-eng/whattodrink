import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Intentionally minimal — add config as needed.
  // 安全头（全站统一，不再只给后台路径加——否则 404 响应头会暴露后台路径是否存在；审核报告 M3）。
  // 不含 Cache-Control：含隐私的后台页读 cookie，Next 对动态页默认 no-store；
  // 前台静态资源缓存策略不动。证据链接自带 rel=noreferrer＋referrerPolicy，后台不依赖全局 no-referrer。
  async headers() {
    const common = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    return [{ source: "/:path*", headers: common }];
  },
};

export default withNextIntl(nextConfig);