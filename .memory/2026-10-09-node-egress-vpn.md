# 2026-10-09 — 本机 Node 出站被 VPN 拦（curl 通、node 不通）

## 情境

- G.4 `/places/around` 本地 500，dev 日志 `fetch failed`；直连高德 API（curl）200 正常。

## 问题

- 同一台机器：curl 到 amap／example／nominatim 全通（200，<2s）；
  `node fetch` 到 google 通，其余全 ETIMEDOUT；node DNS 解析正常（IPv4 对）。
- 本机挂着 VPN（utun4，DNS 100.64.0.2）。

## 原因

- 非代码非 key：是本机出站链路对 Node 进程的选择性拦截（VPN 客户端／EDR 按进程或 SNI 过滤；
  google 204 是 captive-portal 探测白名单，常年放行故具迷惑性）。
- 证据：同目标同 IP，curl 通而 node 不通 → 传输层之上按进程区分。

## 修正

- 本地验证：断 VPN（或在 VPN 客户端放行 node）后重测；生产 Vercel 不走这条链路，不受影响。
- 代码侧零改动（500 包络＋503 无 key 提示已覆盖失败面；重试／降级不为本机特例加）。
- 判例：先 curl 后 node，curl 通 node 不通即查 VPN／EDR，不碰代码。
