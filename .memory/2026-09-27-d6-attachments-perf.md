# 2026-09-27 D.6 附件＋列表提速（實作完待驗）

## 情境

- 用戶：D.6 開工＋存 binary 方案＋列表慢優化。

## 修正

- 存儲：私有桶×2（用户 Dashboard 建）＋0013 RLS（首段歸屬寫删，讀零口徑全走簽名）＋sign（白名單＋caps）／view（bucket 白名單＋歸屬：自己或互好友，陌生人 404）雙端點；發送附件校验（歸屬雙保險＋caps＋kind 開閘）；`attachments` 回讀（歷史＋冪等＋競態三處 select 補列）。
- 提速：列表 3N+1→單 RPC（0014，SECURITY DEFINER＋auth.uid 硬校验＋匿名 revoke；畢業線簽名不變）；friends 端點本就 2 跳不動；客戶端並行早就是。
- UI：composer 圖鍵＋mic 轉內聯錄音（mock 態藏鍵，VoiceRecorder 現成件直用）＋圖／音氣泡（簽名緩存＋骨架＋秒數）＋snippet 章（`chatSnippetImage/Audio`×3；secs 取末條附件，無則通用章）；`chatAttach/Uploading/VoicePlay/Pause/Secs`×3。
- 三閘：我方 tsc 淨（同伴 V2Home/moderation 施工紅＋validator artifact，不碰）／lint 0 error（gathering 1 error 同伴的）／chat 單測綠；build 待用戶聯驗前跑（同伴樹紅中，現在跑必紅非我方）。
- 待用戶動作：①建兩私有桶 ②跑 0013＋0014 ③雙號聯驗（圖／音／snippet／慢列表體感）。

## 關聯

- UR D.6 [WIP]（待三動作＋聯驗＋合入）；轉寫另議；E2E 加密 V2
