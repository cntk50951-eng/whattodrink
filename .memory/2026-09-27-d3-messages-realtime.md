# 2026-09-27 D.3 發送＋記錄＋Realtime（room 頁換真源）

## 情境

- 用戶：D.2 未驗但直接開 D.3（"等可以了我再去验证"——D.2＋D.3 合併聯驗）。
- 同伴 D.7 room 重構並行：`[friendId]` 刪、`goChat` 轉 room、ChatThread 加 textarea 等。

## 問題

1. `ChatThread` tsc `shown` 先用後聲明（受控源 edit 順序錯，即修：聲明挪 state 區）。
2. lint `set-state-in-effect`（開房重置三態）——沿同伴同文件豁免口徑加理由壓制。
3. D.2 漏排 `GET messages`（列表和發送之間少歷史端點，D.3 補，UR 已回寫）。
4. openapi `delete` 整段被 edit 吞（oldString 取到段尾，整段消失，即恢復＋補 messages 端點）。

## 原因

- 受控源 edit 三段式（type→props→render）漏了聲明提升；edit 錨點取半截第五次中招（以後凡跨段改動，先讀全函數再下刀）。

## 修正

- 雙端點（keyset 回正序＋冪等 23505 競態收斂＋雙檔限流＋隱身雙驗）＋`ChatRoomLive`（建會→歷史→訂閱→樂觀發送→讀水位順呼）＋`external` 受控源（同伴文件只做加法，缺省 mock 行為不動）＋room 換源 2 hunk。
- 三閘：build 綠（5 會話路由在表）／lint 0 error／340 綠；tsc 唯一殘留是刪頁 validator artifact（構建產物）。
- 待用戶動作：① Dashboard 開 Publication（SQL 下見）② 雙號聯驗。
- 已知缺口：發送失敗撤位無重試鍵（D.4 polishing）；未開 Publication 只有歷史無即時。

## 關聯

- UR D.3 [WIP]（待聯驗＋合入）；D.2 聯驗併入本次（curl 未單獨跑，AC 押後一起驗）
