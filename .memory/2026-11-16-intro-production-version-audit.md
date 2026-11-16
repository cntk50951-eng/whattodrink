# Production 與本地 intro 不同：先查提交與部署來源

## 情境
用戶短暫將 production SITE_LIVE 設 true 後查看，回報首屏沒有 hi drink、Ivy 後沒有直接接大話骰、底部仍有連結；已自行關回 flag，要求核對版本。

## 問題
容易將本地完成誤解成 production 已更新，或把三個差異歸因於快取、旗標、播放錯誤而重改程式。後續 M.5／M.6／M.7 的修改和品牌素材仍在工作區，沒有 commit／push。

## 原因
GitHub REST 讀取 main 得 `2b5ce6a82aab15b0d7ad0a7d20a5c7a8007018cd`；Production deployment 7798745132 同 SHA，Vercel success 狀態最新時間 `2026-11-16T12:25:20Z`。遠端 story.tsx 無 BrandOpening，仍有 publish、ivy→cocktail→dice；IntroPlayer.tsx 仍寫 WhatToDrink 並有 backup／artwork 兩個 footer Link，沒有手動 browseControls。這與用戶看到的現象一致。

## 修正
- 本輪採唯讀版本稽核，套用 github-api skill；不改 UI、不部署、不動 SITE_LIVE 或 .env。對照本地 BrandOpening、ivy→dice→cocktail 及只有說明文字的 footer，確認所需程式已在本地。
- 正式 alias `/intro` 跟隨跳轉後為 HTTP 200 `/coming-soon`，確認目前已封站。旗標控制進站，不會發布未提交的工作區；後續要同步 production 須先提交／推送這批已可審閱的 intro 修改，維持封站設定。
- Python 3.14 urllib 的本機 CA 鏈驗證失敗，改用系統 curl 正常憑證驗證（沒有停用 TLS）；token 從 .env 以指定 key 抽出、僅放 curl stdin config，不列印、不存入 Git config，回傳只摘版本／狀態／程式關鍵行。
- GitHub main、狀態、Production deployment 與兩份遠端原碼均已核對；不重跑與本輪無程式變更無關的 build／lint／tests。同步 CHANGELOG 與 UR M.7 的發佈狀態說明；展示資料／API／持久化零新增，docs/data 無需更新。本輪無暫存檔，未提交／推送。
