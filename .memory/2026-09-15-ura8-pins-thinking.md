# 2026-09-15 UR A.8 地图 Pins 公开 API

## Step1 记忆回顾报备
已读：.memory/MEMORY.md（11条）+ 最近24h全量：2026-09-14-ura7-prod-env-bug.md + 2026-09-10-ura7-auth-decision.md + 2026-09-10-ura5-next-batch.md + 2026-09-13-urc1-toolbar-flex.md + 最近3-5条补齐。本轮生效约束：
- 浏览器 client 必须用 public env（NEXT_PUBLIC_*），不可 require secret（prod 500教训）
- try/catch 必须 console.error，不能 silent 吞错
- flex 容器子项别用 absolute
- 诊断先问清具体名字再定分支

## Step1 需求重述
Goal：GET /api/v1/map/pins?bbox 公开接口，BBOX过滤 + 服务端街区级模糊（3位小数约100m），替掉 lib/checkins.ts MOCK，非公开行不外泄。
Non-Goal：不做写入/精确坐标/鉴权/PostGIS。
AC：匿名BBOX查询 200且坐标均为3位小数精度；private不出；BBOX缺参/格式错/越界/反向 400；DB错 500+诊断行；空结果返回 []。

## Step2 思考摘要
候选路径 ≥2：
- A. SQL范围查询（lat/lng gte/lte + limit 100）+ JS 截断至3位小数（选它：得到简单无PostGIS、复用0005 RLS、易单测；付出：BBOX为矩形非圆形，HK街区够用）
- B. PostGIS ST_MakeEnvelope + ST_SnapToGrid（得到：地理精度高、可圆形查询；付出：需启用扩展、迁移、Supabase JS不支持直接ST查询、复杂度高）
- C. 全量拉取后 JS过滤（得到：实现最简；付出：不scale、浪费带宽、违背limit）

否决：B-殺雞用牛刀，V1量小且 0005 已够；C-性能差，墙/地图量稍大即跪。

疑虑清单：bbox格式定 west,south,east,north 逗号分隔（沿HK_BOUNDS，问：是否需支持跨日界线？答：HK本地不需要，故不问）；模糊精度3位小数已定（街区级，问：是否需随机偏移？答：截断可驗且確定，不随机）；limit 100/上限200 已定（沿wall 20/50 扩大一点，前端地图一屏100够，不问）。
