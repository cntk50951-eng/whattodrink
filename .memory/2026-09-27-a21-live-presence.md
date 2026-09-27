# 2026-09-27 A.21 我的位置＋在線態＋好友實時追踪

## 情境

用戶六件事：首屏落我、左上在線／隱身燈、自釘呼吸變色、好友實時呼吸燈跟隨、隱身全黑、離線／隱身好友不可見。深度思考＋問答定案（v2／30s＋50m／打招呼 Sheet＋通道另開）。

## 修正

- DB `0011_users_live_position`（`live_lat／live_lng`；鮮度沿 `last_seen_at` 不加列；**待用戶 Dashboard 執行，未跑則雙端點 500**）。
- `lib/presence.ts`（心跳解析＋在線行解析＋回包解析，20 單測）＋`POST /api/v1/presence`（stealth 403 雙保險）＋`GET /api/v1/friends/live`（互好友＋非隱身＋鮮活 server 三刀）。
- `useHeartbeat`（30s＋50m＋hidden 暫停）＋`useLiveFriends`（同周期＋失能讀時派生空＋Realtime 切換口註記）。
- 自釘綠／灰呼吸＋左上狀態燈（匿名藏／未知 fail-closed 灰）＋首屏飛我一次＋`useGeolocation({watch:true})`（自釘跟人走）。
- 好友常駐滑行層（複用＋setLatLng＋CSS 1.2s 過渡；reduced-motion 關）＋`V2ChatSheet`（say-hi／文字／語音全 toast，零寫入）＋`v2.chat*`×3 parity＋openapi 雙端點＋LiveFriend。
- lint 0 error；三閘綠（worktree 隔離驗）。

## 教訓

- 并行同文件施工的拆車正解：`git worktree` 另起乾淨樹＋只放我的 hunks（`rtk git diff` 是摘要格式，做 patch 必須原生 `git diff`；连错 6 次才醒）。
- `react-hooks` 误报两则：setState 讀時派生替代 effect 清空；Leaflet ref 用註記壓制（沿 BeerIcon 口徑）。
- 動態 `import()` 的 Leaflet 分支（`onReady` 等）是隊友 C.11 的，不在本次 base——合入後若 main 有交集以 GitHub mergeable 為準。

## 關聯

- 關聯 UR A.21 [WIP]（驗收合入待：遷移執行＋雙人聯驗＋提交指令）；通道 UR 另開（EPIC B 落地後）；隊友 C.10／C.11／batch 零碰
