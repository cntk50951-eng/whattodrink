# 發布 M.5／M.6／M.7，核對同提交的 Production

## 情境
前輪已確診 production 停在 2b5ce6a，本地文案、Ivy→骰子、去底部連結、手動回看與品牌首屏尚未提交。用戶現在明確要求「請提交部署，確保 production 最新」，構成本批次 commit／push／部署授權。

## 問題
不能再把先前「尚未提交」當成禁止發布，也不能只 push 成功就宣稱 production 最新。使用者已查看本機首屏並要求部署；重複索取同一授權會阻塞已授權工作。

## 原因
本地工作區、GitHub main、Vercel Production 是不同階段；SITE_LIVE 是獨立的封站開關。部署驗證要對照同一新 SHA 的 Vercel 成功狀態及 Production deployment，正式 alias 繼續跳 coming-soon 才符合產品未開放的要求。

## 修正
- 使用 harness-workflow／code-review／github-api，複核最新 memory 與程式。遠端 main 在提交前仍是 2b5ce6a，沒有他人新提交；本輪直接發布使用者已要求的 intro 批次。除 scope 內程式、品牌圖、測試和累積記錄外，不帶 reports／research_notes，原 components/intro／public/intro、.env、proxy／全站旗標不動。
- 提交前完整驗證：build 138 頁；npm test -- --maxWorkers=2，121 檔／1,251 tests 全綠；全站 lint 0 errors／12 個既有 warnings。原版備份雜湊測試通過；品牌 manifest 8 個雜湊匹配、三語品牌與 12 幕順序正確、footer 0 連結。
- 新 lib／API 均無新增；資料來源同前輪 docs/data/intro-marketing.md，隨功能修改一併提交。CHANGELOG／backlog／素材 README 記本批次範圍與發佈方式，UR 完成勾選留待用戶視覺驗收，不因推送成功自動打勾。
- 推送憑證從 .env 指定 key 抽出，inline URL 不寫回 git config；GitHub 狀態查詢用 curl 正常 TLS，不用本機 Python 3.14 的缺失 CA 鏈。後續檢查新 SHA 的 main、Vercel success／Production status 與 alias，確保驗證對象為本次程式；不改封站開關來驗頁。
- 本輪沒有新增暫存檔；既有生成母稿／來源／授權／提示詞均為交付資產保留。
- 暫存檢查發現兩份原 OFL 第 21 行自帶行尾空白，為保持來源五檔逐位元一致而原樣保留；排除這兩份第三方授權文本後，全部本輪程式／文檔 diff --check 通過，沒有為排版修飾改寫授權來源。
