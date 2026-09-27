# 2026-09-27 D.4 返工：全好友＋一鍵定位（待複驗）

## 情境

- 用戶驗收：列表只見離線 1（只有會話的人）；要全好友末信倒序＋在線行一鍵定位＋地圖點開聊。

## 問題

- D.4 初版只有會話（空會話缺口當時記 UR，未做）；`?friend=` 深鏈不存在。

## 修正

- `GET /friends` 新（accepted 全量，nickname／avatar／mode／last_seen→online 四列；坐標不進列表，定位走地圖 live，深鏈隱私分離）＋`toFriendListItem`（lib/friends 加法，2 測）＋`mergeFriendList`（lib/chat 加法，置頂＋末信倒序＋沉底，1 測）＋列表改全好友＋定位鈕（在線行）＋`?friend=`（mount 讀即清＋live 首批非空消費：飛人＋開卡；離線靜默）＋`chatLocate`×3。
- 地圖點開聊：鏈路現成（pin→FriendCard→room），深鏈落點即卡，零新增。
- 三閘：tsc 淨／lint 0 error／build 綠（friends 路由在表）／350 綠。
- 本輪 edit 吞段四連擊（delete 整段／ChatPeer properties／重鍵 friends／C.15 誤配）：教訓升級——「插入」操作 oldString 只取**一行**錨點，絕不取整段；每次改完即 python yaml＋grep 雙驗（本次全數即修即驗）。
- rtk grep 管道 stdin 當倉庫搜＋`rtk read --tail-lines` 不存在：關鍵驗證改原生 `git grep`／`sed -n`（C.11 誤報教訓重演，工具鏈坑再記）。

## 關聯

- UR D.4 [WIP]（待複驗＋合入）；空會話缺口關閉；D.5b／D.6 另期
