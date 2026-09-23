# 2026-09-15 打卡二次登录不可见

## 情境
登出清本地（A.9）后，登录后看不到之前的打卡（`wtd-want-history` 已被 `clearUserLocalCaches` 清空，且 `wantHistory` 仅从 localStorage 恢复，无 DB 回显）。

## 問題
- `want` 打卡仅 `localStorage`（POC 水位），`POST /api/v1/checkins` 未实现，`GET /api/v1/checkins/mine` 缺失，二次登录/换设备即丢。
- `DrinkMap` 初次加载与 `SIGNED_IN` 事件均未从 DB 拉历史。

## 原因
- A.10 之前标为 todo，未落地；登出清本地与未登录浮层（A.9/A.11）先行，导致登录态历史真空。

## 修正
- `lib/api/checkins.ts` 纯函数：`parseCreateCheckinBody`/`parseMineParams`/`toMineRow`/`mineRowToWantRecord`（与 wall 同容错坏行跳过），`lib/api/checkins.test.ts` 10 单测。
- `app/api/v1/checkins/route.ts` POST 🔒：校验 `beer_id/lat/lng/place_name` → 验 `beers` 存在 → `checkins.insert{user_id=auth.uid(), type=want, visibility=private}` → 201；401/400/500 分流。
- `app/api/v1/checkins/mine/route.ts` GET 🔒：`user_id=uid + type=want` 倒序 `limit` → `toMineRow` → `{checkins}`。
- `components/map/DrinkMap`：已登录 `POST /checkins` 落库（失败回退本地），`place_name` 暂 null；mount 分流：已登录 `fetch /mine` 转 `WantRecord`（倒序→升序），匿名走 `loadWantHistory`；`SIGNED_IN` 监听即时回显；`placeName` 解析后已登录不回写 `wtd-*`。
- `docs/api-openapi.yaml` 补两端点 + `Checkin/MineRow/MinePage/bearerAuth/Unauthorized`；`docs/PRODUCT_BACKLOG.md` A.10 置 [WIP] 补记录；`CHANGELOG.md` 补条目。
- RLS 复用 `0001+0006`，`npm run build` 27→29 页；197 绿/tsc 净/lint 0 error。

## 關聯
- 涉及：`lib/api/checkins.ts:1`, `app/api/v1/checkins/route.ts:1`, `app/api/v1/checkins/mine/route.ts:1`, `components/map/DrinkMap.tsx:40,950,1371`
- 測試：`lib/api/checkins.test.ts:1`
