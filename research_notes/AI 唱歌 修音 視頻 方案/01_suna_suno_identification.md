# Suna AI vs Suno AI 識別（為錄製唱歌修音發佈需求）

## What is Suno AI (suno.com) in 2026, and can it 修音 real recorded singing or only generate songs from text?

### Takeaway
Suno（suno.com）是文字/音頻生成完整歌曲的 AI 音樂平台，不是傳統修音工具（無 Auto-Tune/Melodyne 式逐音修正）；最新 v6（2026-09）/v5.5 世代可上傳人聲、用 Cover 重唱、Voices 克隆自己聲音、Studio 做 pitch 微調，但「錄好自己唱歌→精修音準」的核心需求仍需外部工具。

### Cited Findings
- Suno v6 於 2026-09-09 發佈，分三個模型：v6（旗艦，Pro/Premier）、v6-wild（探索性）、v6-mini（免費可用），支援文字/音頻/圖像/視頻輸入轉音樂、單節編輯、mashup、stem 取樣 ([Source](https://about.suno.com/blog/introducing-v6))。
- v5.5（2026-03-26）推出 Voices（錄製/上傳自己聲音並驗證後唱任何歌，僅本人可用，Pro/Premier 限定）、Custom Models、My Taste ([Source](https://suno.com/blog/v5-5))。
- Cover 功能：用現有歌曲（含語音備忘錄等錄音）的實際音頻作參照，保留原旋律重錄成新風格/新聲音，可給純伴奏加詞 ([Source](https://suno.com/products/covers))；上傳自己唱歌/哼唱片段再 Cover 是官方建議用法 ([Source](https://suno.com/release-notes/covers-reimagine-the-music-you-love))。
- Voices 建檔流程：錄製或上傳 15 秒–4 分鐘人聲（乾聲 a cappella 效果最好）、朗讀驗證句比對身份、私人專用；上傳含伴奏檔案會自動做 stem 分離取人聲 ([Source](https://help.suno.com/en/articles/11362369-voices))；Voices 取代 Personas 入口，僅 18 歲以上、部分地區不可用 ([Source](https://help.suno.com/en/articles/11362433-voices-faq))。
- Suno Studio 2.0（2026-08，Premier 限定）是瀏覽器生成式 DAW，含 MIDI、audio effects、合成器；2026-10-29 更新加入 clip 級 fine pitch adjustment（semitones + cents，如 2.38 = 2 半音 38 音分），官方稱「tightening the tuning of recorded audio」可用 ([Source](https://suno.com/release-notes/more-studio-updates-oct26))。
- 傳統修音概念（把走音逐音拉準、保留原人聲）Sunо 無原生一鍵功能：社區做法是用風格 prompt 寫 "autotuned vocals / pitch-corrected" 來讓生成帶電音效果，或用 [Auto-tune] meta tag，屬於生成時指定音色而非後期修真人錄音 ([Source](https://hookgenius.app/learn/suno-vocal-effects))；[Source](https://sunoarchitect.com/en/guide/suno-meta-tags/auto-tune)。
- Suno 定價（2026-09 查價）：Free $0（每日 50 credits≈10 首歌，無商用權、無 stem 分離）；Pro $10/月（年付 $8/月，2,500 credits≈500 首，商用權限於每月 20 首下載）；Premier $30/月（年付 $24/月，10,000 credits≈2,000 首，獨享 Studio，每月 60 首下載商用）([Source](https://www.usagepricing.com/blueprint/suno))；官方定價頁確認三檔結構 ([Source](https://suno.com/pricing))；Free 僅 7 首終身試下載、Pro 20/月、Premier 60/月，下載才有商用權 ([Source](https://help.suno.com/en/articles/13614785))。
- Suno 支援粵語：Custom 模式自填歌詞 + 風格標籤 "Cantonese vocals, Cantopop / Hong Kong pop"，用繁體/粵語書面字，短句、標段落；粵語咬字需多版迭代，同音字/標註處理多音字 ([Source](https://suno.hk/blog/suno-cantonese-song-creation))；中文字符優於拼音，V5.5 中文（含粵語、四川話）支援被評成熟 ([Source](https://suno-ai.cc/en/tutorials/how-to-create-chinese-songs-with-suno))；HookGenius 同樣指引：繁體粵語字 + "Cantonese vocals, Cantopop" ([Source](https://hookgenius.app/learn/suno-chinese-prompts))。
- Suno 本身不做視頻：Pro 方案曾提及 video generation（Trusted Reviews 2026-01 稱 Pro 含 video generation）([Source](https://www.trustedreviews.com/explainer/what-is-suno-4513127))，但核心輸出是音頻；歌詞/封面視頻需另用剪映/CapCut 等工具（見研究員 03/04 範圍）。

### Inferences
- 用戶說的「suna ai」極大概率是聽錯的「Suno AI」（發音相近 suno/suna），因為需求（唱歌、修音、發佈）正好落在 Suno 的歌唱生成場景。
- 若用戶真想要「錄下自己唱歌→修走音→保留自己聲音→加和聲→發視頻」，Suno 只能覆蓋其中「生成伴奏/重唱/和聲感」部分，真正的音準修正仍需 Melodyne / Auto-Tune / 剪映調音等（見研究員 02 範圍），Suno Studio 的 cents 級 pitch 只能做整段移調式微調，非逐音修。
- Suno Cantonese 可用但非完美，需 Custom 歌詞 + 多 take 策略；香港用戶可直接用，無需 VPN（Voices 地區限制除外，屬少數例外）。

### Gaps
- 未找到 Suno 官方 2026 年底最新月費港幣定價（僅 USD/EUR 報價）；香港用戶實際結帳幣種不明。
- Suno 是否計劃推出真正逐音符 pitch 編輯器（類似 Melodyne）尚無官方路線圖資訊。
- Suno 免費版在香港的 Voices 可用性（官方稱部分地區不可用但未列名單）未能確認。

## Is there a product actually called Suna AI? What is it?

### Takeaway
叫 "Suna" 的有兩個互不相關的 AI 產品，但都與唱歌/修音無關：(1) Kortix AI 的開源通用 AI Agent（原 suna.so，現 github.com/kortix-ai/suna）；(2) suna.la 的 AI 電話客服（支援粵語接電話）。兩者都不是唱歌工具。

### Cited Findings
- Suna（Kortix AI）是開源通用 AI Agent：「fully open source AI assistant」，功能為瀏覽器自動化、文件管理、網頁爬蟲、代碼執行等，通過自然語言完成研究/數據分析等任務，Apache-2.0 授權 ([Source](https://github.com/AgentSuna/Suna))；日本 WEEL 介紹確認 2025-04-23 由 Kortix AI 發佈，架構 FastAPI + Next.js + Agent Docker + Supabase ([Source](https://weel.co.jp/media/innovator/about-suna/))；TechPilot 評測 8.6/10，定位 "AI Employee" ([Source](https://techpilot.ai/tools/suna-ai-open-source-ai-agent))。
- 另一個 Suna（suna.la）是 AI 電話客服 agent：24/7 接電話，支援英/普/粵/日/泰五語（Microsoft Azure 神經語音），Free $0（30 分鐘/月）→ Starter $7 → Growth $19 → Pro $89 ([Source](https://suna.la/))；About 頁確認定位為中小企漏接電話解決方案 ([Source](https://suna.la/about))。
- 兩者官網/Repo 均無任何音樂、唱歌、修音功能描述。

### Inferences
- 用戶聽到的 "suna ai" 若指向唱歌，幾乎可排除這兩個 Suna（功能完全對不上）；最可能是 Suno 誤聽。
- 若用戶是在 AI-agent 語境聽到 Suna，則指 Kortix 開源項目，與本唱歌需求無關，可直接排除。

### Gaps
- Kortix Suna 原官網 suna.so 現跳轉狀態未能即時驗證（多個 fork 存在：AgentSuna/suna、bartonmalow/suna），但不影響結論（皆為通用 agent）。

## Could the user mean Sonu, Sona, or another similarly-named vocal AI?

### Takeaway
有兩個名字相近的唱歌 AI 值得列為混淆候選：Sona AI（手機 App，AI 音樂生成 + 訓練自己聲音翻唱）和 Supertone 的 Sona Speech（韓國 HYBE 系可唱歌的超逼真語音模型）；另 "Sonu" 無知名唱歌 AI 對應。

### Cited Findings
- Sona: AI Music & Cover Maker（SUNRAY MOBILE LTD，App Store/Google Play）：文字生成歌曲 + "AI Cover: Sing with Your Own Voice"（用自己聲音數據訓練後翻唱任何生成歌曲，不用進錄音室）；訓練聲音需上傳至少 5 分鐘音頻；全功能需 premium（Voice Training 另收費、訂閱制）([Source](https://apps.apple.com/qa/app/sona-ai-music-cover-maker/id6503645134))；([Source](https://mwm.ai/apps/sona-ai-music-cover-maker/6503645134))。
- Supertone（HYBE 系 AI 音頻公司）Sona Speech 1/2：支援 23 語言、hyper-realistic 可演可唱的聲音，用於 Pinkfong REDREX 粉絲二創（2026-03-26 公告）([Source](https://www.prnewswire.com/news-releases/the-pinkfong-company-introduces-ai-voice-powered-fan-creation-for-new-ip-redrex-302724429.html))；Supertone Play 為其 AI 聲音創作平台。
- 未找到名為 "Sonu AI" 的知名唱歌/修音產品（僅印度歌手 Sonu Nigam 等無關結果，可視為無此產品）。

### Inferences
- "Sona AI" 手機 App 的功能描述（訓練自己聲音翻唱）與用戶需求（自己唱歌發佈）表面最貼合，若用戶是在 App Store 語境聽到，可能是它；但其品質/商用條款遠不如 Suno 成熟，且評價有訓練失敗投訴（MWM 引述用戶評論）。
- Supertone Sona 屬開發者/企業級語音模型，一般消費者不會直接用到，可排除為用戶所指。
- 排序：Suno（最可能）> Sona App（次可能）> Suna agent/電話客服（可排除）> Sonu（無此產品）。

### Gaps
- Sona App 的實際粵語/中文演唱品質無可靠評測來源；其訂閱價格各地幣種混亂（QAR/土耳其里拉/捷克克朗並存），香港實際售價未確認。
- 未能確認 Sona App 訓練聲音的版權驗證機制（相對 Suno 的 spoken-phrase 驗證是否寬鬆未知）。

## Verdict: is Suno suitable for the user's need (real-voice 修音 + 和聲 + 視頻)?

### Takeaway
Suno 適合作為「生成伴奏 + AI 重唱/demo + 和聲感」的環節，但不能替代真人錄音的修音；用戶「錄好自己唱歌→修音→發佈」全流程需 Suno + 修音工具 + 剪輯工具三件套，Suno 單獨不夠。

### Cited Findings
- Suno Cover/Add Vocals/Voices 都是「重新生成」而非「保留原錄音修音」：Cover 以原音頻為參照重錄新版本 ([Source](https://suno.com/products/covers))；Add Vocals 為器樂疊加 AI 生成人聲 ([Source](https://help.suno.com/en/articles/6882817-add-vocals))；Voices 生成的是克隆音色的全新演唱，非原錄音修正 ([Source](https://suno.com/voices))。
- Verge 實測 v5 指出 Suno 人聲「完美到不像真人」，且無法做出走音/粗糙感（"trying to make Suno sound bad — out of tune, raw — was futile"），側面證實 Suno 不做忠實的原聲修飾而是美化重唱 ([Source](https://www.theverge.com/ai-artificial-intelligence/786349/suno-ai-music-generator-v5-review))。
- 和聲：Suno 以 [Harmony] 等標籤生成式加和聲（非後期疊軌控制），HookGenius 列出 Harmony/layered vocals 為 prompt 層效果 ([Source](https://hookgenius.app/learn/suno-vocal-effects))；精確和聲編排需 DAW/Stem 後期（研究員 02/03 範圍）。
- 視頻：Suno 輸出音頻為主，發佈到短視頻/YouTube 需另配剪映等工具（免費版下載僅 7 首終身試用，商用需付費下載）([Source](https://help.suno.com/en/articles/13614785))。

### Inferences
- 給報告撰寫者的建議 verdict：告訴用戶「你聽到的應該是 Suno（suno.com），它能幫你把哼唱變完整歌曲、克隆你聲音唱任何風格、生成和聲感；但你自己錄的原聲走音要修，必須另用修音 App/軟件；最後配視頻用剪映。Suna（agent/電話客服）與唱歌無關不用考慮；Sona App 是山寨感較重的手機版替代，不推薦主力用。」
- 最低成本試水路徑：Suno Free（每日 10 首）試生成 + Cover 玩法，確認喜歡再升 Pro（$10/月）解鎖 Voices/Cover/Stem。

### Gaps
- 用戶原始錄音質量未知（手機直錄 vs 麥克風），影響「Suno Cover 重唱」vs「傳統修音」哪條路更好的判斷，需報告中保留分支建議。
