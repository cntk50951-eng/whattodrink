# AI 唱歌修音 + 和聲工具研究 (Pitch Correction & Harmony Tools 2026)

## 關鍵問題 1：哪些工具是「修自己把聲」(tune) vs 「換聲」(replace)?

### Takeaway
傳統修音 (Melodyne / Auto-Tune / Waves Tune / RePitch / Nectar) 保留原聲只修正 pitch；AI 工具 (Audimee / Kits / SoundID VoiceAI) 主力是 voice conversion（換成另一把聲），但 Kits AI Pitch Editor 和 SoundID VoiceAI + own-voice workflow 可以做到修自己把聲 + AI 和聲。

### Cited Findings
- Kits AI Pitch Editor 是 browser-based piano-roll pitch correction，用 AI voice modeling re-synthesize 人聲而非傳統 pitch-shift，避免 robotic artifacts，可 tune、可改 melody、可升降八度做 harmonies — [Kits AI](https://www.kits.ai/blog/kits-ai-pitch-editing)
- Kits AI Harmony Generator 可由單一人聲生成最多 4-part studio-quality harmonies，用 75+ royalty-free voices — [Kits AI](https://www.kits.ai/tools/harmony-generator)
- Audimee 核心是 vocal conversion：把 raw vocal recordings 轉成 royalty-free voices、可 train own voices、做 copyright-free covers、另有 harmonies / stem splitter 功能 — [Audimee](https://audimee.com/)
- SoundID VoiceAI 是 DAW 內 (VST3/AU/AAX) 的 voice changer：把自己把聲/humming 轉成 pro vocals & instruments，做 backing vocals、double tracks、demos；Unison Mode 可疊最多 8 層 vocal layers — [Sonarworks](https://www.sonarworks.com/soundid-produce/voiceai)
- SoundID VoiceAI 本身 processes timing and pitch，官方建議不要同時疊加 auto-tune/pitch correction plugins；Gearspace 用戶指出 "Voice AI doesn't fix tuning issues"，即它不是 tuner 而是 fixer/replacer — [Sonarworks Blog](https://www.sonarworks.com/blog/learn/how-to-use-soundid-voice-ai-alongside-traditional-vocal-processing-chains); [Gearspace](https://gearspace.com/threads/sonarworks-releases-soundid-voiceai-update.1454078/)
- 2026 年最佳 vocal tuning plugins 評選包括 Synchro Arts RePitch（含 pitch + timing cleanup），定位是 detailed cleanup 而非 AI 換聲 — [Magnetic Magazine](https://magneticmag.com/2026/02/the-best-vocal-tuning-plugins/)
- iZotope Nectar 4 內建 Pitch correction module（formant-preserving）+ Vocal Harmonizer/Harmony module + 12 個 vocal mixing modules（EQ/compression/de-ess/reverb），屬於 keep-your-voice 類全能 vocal chain — [iZotope](https://www.izotope.com/products/nectar-advanced); [iZotope Docs](https://help.izotope.com/nectar2/content/nectar%202%20help%20documentation/pitch%20correction%20module.htm)
- Nectar 在 YouTube 盲測中被評為比 Auto-Tune / Waves Tune 更 transparent/natural — [YouTube 比較片](https://www.youtube.com/watch?v=1qdkcFxzVhE)
- Reddit 用戶實測 4 款 pitch plugins，Melodyne 表現最佳 — [Reddit](https://www.reddit.com/r/WeAreTheMusicMakers/comments/oiav46/i_compared_4_pitch_correction_plugins_here_are/)
- LALAL.AI 定位是 stem separation（人聲/樂器分離），不是 tuning 或 harmony 工具 — 本次搜索未見其 pitch-correction 功能，歸類為輔助（伴奏製作/去人聲）用途
- Voicify 主要做 AI cover / text-to-song 方向，不適合「修自己錄音」需求 — 本次搜索未見其保留原聲 tuning 功能（見 Gaps）

### Inferences
- 若目標是「把自己唱的修到出得街但仍是自己把聲」：路線 A = 傳統 tuner (Nectar/RePitch/Melodyne)；路線 B = Kits AI（clone own voice 後用 Pitch Editor re-synthesize）。Audimee / SoundID VoiceAI 預設會改變音色，除非 train/clone 自己把聲。
- SoundID VoiceAI 最佳實踐是先 tune 好 input（用 Melodyne/Nectar），再做 voice conversion + harmony stacking，而非指望它執音準。

### Gaps
- Voicify、Mixea、Moises「Vocal Repair」、Waves Tune 具體中文支援及 2026 最新版本表現，缺乏可靠來源，未能確認。
- Audimee 是否有不換聲、純 tuning 模式，官網未明確說明。

## 關鍵問題 2：Mobile-friendly 選項（香港 iOS/Android 用戶）?

### Takeaway
手機上真正做到「錄音即修音」的是 Voloco（免費 auto-tune + harmony）和 Moises（stem separation + pitch changer + 練歌）；Smule / StarMaker 屬 karaoke 社交，不算專業修音。

### Cited Findings
- Voloco 超過 8000 萬下載、4.8 評分，主打手機錄 studio-quality vocals，免費 auto-tune presets + effects + harmony — [Voloco](https://voloco.com/); [App Store](https://apps.apple.com/us/app/voloco-vocal-recording-studio/id1052970183); [Google Play](https://play.google.com/store/apps/details?id=com.jazarimusic.voloco&hl=en_US)
- Moises 是 iOS/Android 音樂人 App，主打 AI vocal remover / stem separation、key detection + real-time pitch changer（轉調配合 vocal range）、chord detection，2026 年已有 60M+ 用戶 — [App Store](https://apps.apple.com/us/app/moises-the-musicians-app/id1515796612); [Google Play](https://play.google.com/store/apps/details?id=ai.moises&hl=en_US); [Music.AI case study](https://music.ai/case-studies/education/moises-uses-music-ai-to-empower-millions/)
- Moises 的 Pitch Changer 主要是整首歌轉調（練歌/karaoke 用），AI-Key detection + pitch change 需 Premium/Pro 訂閱 — [Moises Help](https://help.moises.ai/hc/en-us/articles/6582517238044-How-do-I-use-the-Key-Detection-with-the-Pitch-Changer)
- Kits AI、Audimee、SoundID VoiceAI 均為 browser/desktop/DAW 工具；SoundID VoiceAI 試用版明確只支援 macOS/Windows 電腦 — [Sonarworks](https://www.sonarworks.com/soundid-produce/voiceai)
- iZotope Nectar、Waves Tune、Melodyne 均為 desktop DAW plugins，無 mobile 版本 — [iZotope](https://www.izotope.com/products/nectar-advanced)

### Inferences
- 香港業餘用戶「手機錄 → 即修即出片」最低門檻組合：Voloco（錄 + tune + harmony）→ Moises（分軌/轉調/做 backing track）。兩者皆有免費版，iOS/Android 皆可下載。
- 手機 App 適合 demo/IG Reels/TikTok；要出 YouTube 高品質 cover，仍需 desktop（Kits browser 或 Nectar）做 final polish。

### Gaps
- Smule / StarMaker 在香港的付費價格、匯出音質（能否匯出 dry vocal 再後製），缺乏可靠來源。
- Voloco 免費版 vs 付費版（Voloco Pro）在匯出音質/去水印方面的差異，未能確認。

## 關鍵問題 3：Pricing、中文/粵語歌支援、出片音質？

### Takeaway
唯一明確支援中文唱歌的是 SoundID VoiceAI 的 C-pop expansion pack（含 Meng 中文女聲）；其他工具的 pitch correction 本身與語言無關（音準是音準），但 AI voice conversion 類對中文/粵語九聲的處理效果不明，是最大風險點。

### Cited Findings
- SoundID VoiceAI 推出 C-pop (Chinese) expansion pack，preset demo 包括 "Meng"（Female, Warm, Airy 中文唱歌聲）；另有 K-pop pack；每個 pack €29，perpetual license €99，bundle €169；PAYG tokens $19.99/120 分鐘、$39.99/300 分鐘、$69.99/600 分鐘；7 天免費試用（含 9,000 tokens）— [Sonarworks](https://www.sonarworks.com/soundid-produce/voiceai)
- Audimee FAQ 明確設有 "Can I convert vocals in languages other than English?" 一題，表示支援非英語，但具體中文/粵語效果無公開 demo 證據 — [Audimee](https://audimee.com/)（FAQ 標題見首頁）
- Audimee 採用訂閱制 + conversion time（分鐘制），付費用戶每月 refill；有免費試用 — [Audimee Pricing](https://audimee.com/pricing); [RouteNote](https://create.routenote.com/blog/audimee-the-ultimate-ai-vocal-creation-tool/)
- Kits AI 免費計劃可試用；付費 Starter 約 $10–11.99/月、Creator 約 $19.99–24.99/月、Composer 約 $47.99–59.99/月，按 download minutes 計 — [Kits Pricing](https://www.kits.ai/pricing); [Kits Blog](https://www.kits.ai/blog/kits-ai-subscription); [Reddit](https://www.reddit.com/r/SunoAI/comments/1lupaxg/is_kits_ai_worth_it/)
- Moises Premium 約 $3.99/月（年付約 $35.88/年），Pro 約 $95.88/年（年付）；免費版每月限量 uploads — [StemSplit review](https://stemsplit.io/blog/moises-ai-review); [ChartLex review](https://www.chartlex.com/blog/marketing/moises-ai-review-2026)
- RoEx Automix Pro $24.99/月 unlimited mixes；AI mastering 單次下載約 $6.49 起（per-master pricing）；有免費 mix 試用 — [RoEx Pricing](https://automix.roexaudio.com/pricing); [RoEx Blog](https://www.roexaudio.com/blog/how-much-does-it-cost-to-mix-and-master-a-song-in-2026)
- iZotope Nectar 4 Elements 約 $55/£49，Standard £189，Advanced £289（upgrade £139）— [Equipboard](https://equipboard.com/items/izotope-nectar-4); [MusicTech](https://musictech.com/reviews/plug-ins/izotope-nectar-4-brings-valuable-updates-alongside-some-unexpected-creative-tools/)
- Kits AI 聲稱 output 為 natural studio-grade（re-synthesis 避免 metallic artifacts），適合 phone memo 變 finished take；並設 Vocal Repair tool 先修復再 tuning — [Kits AI](https://www.kits.ai/blog/kits-ai-pitch-editing)
- SoundID VoiceAI 每個 preset 由真實歌手訓練、fairly compensated、royalty-free，可商用發佈 — [Sonarworks](https://www.sonarworks.com/soundid-produce/voiceai)
- RoEx 被 UnitedMasters 採用為 indie artists 的 AI mastering 方案（$4.99/track 合作價），屬發行級 mastering — [Music Business Worldwide](https://www.musicbusinessworldwide.com/unitedmasters-taps-roex-to-offer-ai-powered-mastering-to-indie-artists/)

### Inferences
- 粵語九聲依賴相對音高走向：傳統 pitch-snapping tuner 若修正過度，可能壓平聲調導致「懶音/變字」。建議 tuning 強度用輕量（Nectar/RePitch 的 gentle 模式），AI 換聲類更需實測粵語長句。
- 出片到 YouTube/IG/TikTok 的音質鏈：tuning（Kits/Nectar）→ harmony stack（Kits/SoundID）→ mix/master（RoEx/Nectar）已足夠獨力完成，無需錄音室。

### Gaps
- 無可靠來源證實 Kits AI、Audimee 對粵語/國語歌的實際效果（無中文 demo、無中文用戶評測）。報告撰寫人應標註為「需實測」。
- 各工具匯出格式（WAV 24-bit? MP3 320k?）及 commercial release 授權細節（Kits/Audimee 付費版是否 royalty-free），未能逐一核實。
- LALAL.AI、Mixea、Voicify 的 2026 定價與中文支援，無可靠來源。

## 關鍵問題 4：業餘歌手（唔識 DAW）想做到專業效果，最推薦 1–2 個？

### Takeaway
最推薦：Kits AI（browser，一站式 tuning + harmony + own-voice clone，無需 DAW）配搭 Voloco 或 Moises（手機錄音/練歌）。有 DAW 野心才加 Nectar 4 Elements。

### Cited Findings
- Kits AI Pitch Editor 全程 browser、no plugins/no DAW，upload WAV/MP3/M4A（包括 phone voice memo）→ piano-roll 拖音 → Generate 即得自然人聲；另有 Harmony Generator（一拖即 4-part）和 Vocal Repair，workflow 完全無需 DAW 知識 — [Kits AI](https://www.kits.ai/blog/kits-ai-pitch-editing); [Kits Harmony](https://www.kits.ai/tools/harmony-generator)
- Kits AI 提供 custom voice clone：clone 自己把聲後再做 conversion/harmony，可保留音色認同感 — [Kits AI](https://www.kits.ai/blog/kits-ai-pitch-editing)
- Reddit 討論顯示 Kits 免費版只有 1 個 vocal slot / 有限 download minutes，重度使用需付費（Creator $19.99/月起），但試水免費已可驗證效果 — [Reddit](https://www.reddit.com/r/SunoAI/comments/1lupaxg/is_kits_ai_worth_it/); [Kits Blog](https://www.kits.ai/blog/free-kits-ai)
- Voloco 免費手機錄音 + auto-tune + harmony，80M 下載验证易用性，是零學習成本的起點 — [Voloco](https://voloco.com/)
- Moises 免費版已可做 stem separation（抽伴奏）+ 轉調，配合 Kits 做「自製 cover」流程：Moises 抽伴奏 → 手機/Voloco 錄人聲 → Kits 修音+和聲 → RoEx master — 各環節均有免費入口 — [Moises](https://moises.ai/); [RoEx](https://www.roexaudio.com/)
- iZotope Nectar 被 Reddit audioengineering 版評為適合 beginner 的 vocal mixing swiss-army knife（含 AI assist），Elements 版 $55 是便宜入場券，但仍需 DAW（GarageBand 免費亦可）— [Reddit](https://www.reddit.com/r/audioengineering/comments/1gz8up2/what_are_yall_opinions_of_nectar_4_advanced/)

### Inferences
- 推薦組合（按預算/難度排序）：(1) 零成本試驗：Voloco（錄+修）→ Moises free（伴奏/轉調）→ Kits free（和聲/polish）；(2) 月付一杯咖啡價：Kits Creator + Moises Premium，年成本 < $300 USD，即有 browser studio。
- 若唱中文/粵語歌，SoundID VoiceAI C-pop pack（€29 + €99 perpetual）值得列入試聽名單，但它需要 DAW，不列入首選，只作進階選項。
- 不推薦業餘用戶首選 Audimee：其強項是換聲/cover 創作而非「修好自己把聲」，且 voice replacement 可能引發「唔似自己唱」的認同問題。

### Gaps
- 缺乏 2025–2026 年針對華語/粵語歌的橫向評測（YouTube/Reddit 中文圈），首選組合對粵語歌的實際效果需用戶親自用同一錄音 A/B 測試。
- RoEx Automix 對人聲 cover（非完整 stems）的 mix 效果，缺乏用家證據。
