# AI 翻唱發佈 End-to-End Workflow（手機一條龍 vs 電腦專業版）

## Best recording setup on phone (mic under HKD 1000, room, app)?

### Takeaway
iPhone/Android 內建咪已可起步；升級首選是直插手機的電容咪（Shure MV88 系列 / RØDE VideoMic Me-L/USB-C，約 HKD 500–1000），配合衫房/被竇等吸音環境 + BandLab（免費 DAW）+ Moises（去人聲做伴奏），學習成本最低。

### Cited Findings
- BandLab Studio 是免費雲端 DAW，手機 App 可直接錄 voice/audio 軌、加 virtual instrument/Looper，並有 Mix Panel 調音量/pan/mute/solo — [BandLab 官方教學](https://blog.bandlab.com/studio-faq)；手機錄音教學建議伴奏軌先降約 -10dB 再錄人聲 — [ColeMizeStudios 教學](https://colemizestudios.com/how-to-record-vocals-in-bandlab-on-mobile-and-desktop)
- Shure MV88+ 是手機直插 stereo 電容咪，比 RØDE VideoMic Me 系列功能多（DSP、pickup mode 切換），音質明顯勝過內建咪、房間回音較少；RØDE VideoMic Me-L 約 USD 79 屬平價選擇 — [SoundGale 評測](https://soundgale.com/shure-mv88-review)；[YouTube 比較評測](https://www.youtube.com/watch?v=mcy_t92CLqg)
- Shure MV88（USB-C 版）主打 TikTok/Reels/Shorts voiceover，mono cardioid 模式對嘴講話最穩，不需額外器材 — [Stream Designz 評測](https://www.streamdesignz.com/blogs/live-streaming/shure-mv88-usb-c-mic-review-best-phone-mic-for-streaming-recording)
- Reddit 錄音社群共識：任何 USB condenser 咪手機都可供電推動；iPhone 內建咪在「死房」（如衣帽間）其實可用；藍牙耳機 overdub 會有 latency，要用有線監聽 — [r/musicproduction 討論](https://www.reddit.com/r/musicproduction/comments/1ltb251/what_are_some_good_quality_mics_for_recording)
- Moises 被 Apple 選為 iPad App of the Year，50M+ 用戶，可一鍵分離 vocal/drum/bass/guitar/piano，做卡拉 OK 伴奏帶；免費版含 vocal/drums/bass 分離 + chord/pitch/speed 工具 — [Moises 官網](https://moises.ai)；[Google Play 頁面](https://play.google.com/store/apps/details?id=ai.moises&hl=en_US)
- 2025 年 10 月更新：Premium/Pro 才有 background-vocal 分離升級版、Hi-Fi guitar 分離模型、可自訂樂器組合分離 — [Moises 官方 blog](https://moises.ai/blog/latest/improvements-latest-releases)
- Engadget 2026 手機咪指南：預算 lav 首選 PowerDeWise，shotgun 選 Deity V-Mic D4 — [Engadget](https://www.engadget.com/computing/accessories/best-mobile-microphones-for-recording-with-a-phone-154536629.html)

### Inferences
- HKD 1000 內最穩組合：Shure MV88+ Video Kit（約 HKD 1300–1600 水貨/二手可壓到 ~1000）或 RØDE VideoMic Me-C/USB-C（約 HKD 500–700）+ 有線耳機；再平可用 wireless lav（DJI Mic / BOYA mini，HKD 400–800），但 lav 音色偏薄，唱歌不如小振膜電容咪。
- 房間 > 咪：先處理環境（關窗、窗簾、衣櫃前錄、棉被搭帳篷），免費且效果最明顯。
- App 分工：Moises（做伴奏/轉 key/練歌）→ BandLab（錄音+混音+mastering 一條龍免費）→ CapCut（拍片剪片+字幕）。

### Gaps
- 沒有找到香港本地行貨 2026 年即時售價（豐澤/百老匯/Broadway），以上為 USD 定價推算；report 寫作時應註明「約數」。
- Cantonese/Canto-pop 在 Moises chord/lyric transcription 的準確度無可靠來源。

## Step-by-step workflow（錄音 > 修音 > 和聲 > 混音 > 拍片 > AI 剪接 > 發佈）?

### Takeaway
手機一條龍全程免費可行：Moises 做伴奏 → BandLab 錄主音+和聲+內建 effects/mastering → 手機拍直式片 → CapCut 自動字幕+模板 → 發佈。電腦專業版則是把混音/mastering 搬到 Cakewalk/Reaper 級 DAW + 付費 Moises Hi-Fi stems。

### Cited Findings
- BandLab 內建 Voice Cleaner、audio presets、Automation、MIDI edit，手機 App 即可混音；Mastering 頁提供 Universal/Fire/Clarity/Tape 四個免費 preset，無限次數、browser-based — [BandLab Studio FAQ](https://blog.bandlab.com/studio-faq)；[BandLab Mastering 官網](https://www.bandlab.com/mastering?lang=en)；[SoundGirls 評測](https://soundgirls.org/bandlab-mastering-a-review)
- Moises 免費版每月 5 首分離；Premium（web 年付約 USD 2.99–3.99/mo）無限分離+全部 stem 種類；Pro（約 USD 7.99–9.99/mo）加 Hi-Fi 模型、guitar/piano 分離、AI mastering、Voice Studio — [StemSplit 的 Moises 評測](https://stemsplit.io/blog/moises-ai-review)；[Chartlex 2026 定價整理](https://www.chartlex.com/blog/marketing/moises-ai-review-2026)
- CapCut 2025 年改制後 auto captions、4K export、去水印需 Pro（約 USD 10–20/mo 或地區定價 USD 6–9.99/mo）；免費版仍有剪接、transition、template、基礎 AI 工具 — [Descript 2026 整理](https://www.descript.com/blog/article/capcut-captions-arent-free-anymore-heres-a-better-option)；[Captions.ai 比較文](https://captions.ai/blog/captions-vs-capcut)；[Reddit r/CapCut 討論](https://www.reddit.com/r/CapCut/comments/1eachxp/capcut_auto_captions_not_free_anymore)
- YouTube 內建免費 auto-caption 仍可用，CapCut 付費字幕的替代方案是 Descript/YouTube Studio 後製字幕 — [Descript](https://www.descript.com/blog/article/capcut-captions-arent-free-anymore-heres-a-better-option)

### Inferences
- 建議兩條 workflow：
  - **手機一條龍（免費，學習成本 ~1 晚）**：1) Moises 免費版分離伴奏（或轉 key/慢速練歌）→ 2) BandLab 開 project，import 伴奏、降 -10dB，加 voice 軌錄主音（有線耳機監聽）→ 3) 複製軌錄和聲，套 Voice Cleaner/preset，加少許 reverb/delay → 4) Mix Panel 平衡音量，送 BandLab Mastering 選 Clarity/Universal → 5) 手機另拍對嘴/彈唱直式片（MV88/內建咪收參考聲）→ 6) CapCut 對齊音檔+免費字幕（或 YouTube Studio 後加上）→ 7) 發佈三平台。
  - **電腦專業版（HKD 100–200/mo 級）**：同上但 Moises Premium/Pro 取 Hi-Fi stems + BandLab/Cakewalk by BandLab（免費桌面 DAW）精修 EQ/compression/tuning（如 MAutoPitch 免費）+ CapCut Pro 或 Premiere 字幕模板 + DistroKid 上架 Spotify/Apple Music。
- 和聲最慳位做法：BandLab 內錄 2 軌（高三度+低三度）pan 左右，或 Moises Voice Studio（Pro）AI 和聲；新手先做單軌 double（同旋律錄兩次，一軌稍細聲）已加厚。
- 修音期望管理：BandLab 內建 preset 足夠 demo 級；要真 pitch-correction 需桌面（Melodyne/Reaper ReaTune），屬專業版才考慮。

### Gaps
- 無可靠來源證實 BandLab 手機版有無內建 pitch correction；應視為「無/極弱」，如 report 提及需註明不確定。
- CapCut 免費字幕額度各地區/版本不一（有人仍免費），report 應寫「2025 年後新版多需 Pro」，並給 YouTube Studio 免費字幕作後備。

## Cover song copyright handling (YouTube Content ID, IG, TikTok 2026)?

### Takeaway
翻唱配片法理上要 sync license，但實務上 YouTube/IG/TikTok 靠平台與版權方的 blanket 協議容許上架：YouTube 走 Content ID claim（版權方拿廣告費，你拿觀眾），IG/TikTok 走站內音樂庫授權；自己錄的翻唱一般只會 claim 不會 strike，但音源檔用原版、改歌詞、未發表歌是高危線。

### Cited Findings
- Content ID 是自動比對系統而非法律裁決；翻唱上傳後幾分鐘到幾小時內被掃到，版權方三選一：拿廣告收益 / 追蹤數據 / 地區或全面 block；絕大多數選拿收益 — [StemSplit 2026 完整指南](https://stemsplit.io/blog/cover-songs-youtube-permission)
- Content ID claim 自動、不影響 channel standing（幾百個都無事）；copyright strike 是人手 DMCA 下架，三振出局，90 天過期；標準翻唱極少收 strike；收到 composition claim 正確做法是「什麼都不做」，亂 dispute 反而可能升級成 strike — [StemSplit 2026 指南](https://stemsplit.io/blog/cover-songs-youtube-permission)
- 嚴格法律上翻唱配片需 sync license + mechanical license；sync 非強制授權，版權方可拒絕或開價 USD 500–10,000+，個人 creator 實務上極少直接申請；想自己賺翻唱收益要經 Soundrop/DistroKid/WeAreTheHits 等代辦 — [StemSplit 2026 指南](https://stemsplit.io/blog/cover-songs-youtube-permission)；[Ditto Music](https://dittomusic.com/en/blog/how-to-release-a-cover-song-legally-and-earn-royalties)；[Vondran Legal](https://www.vondranlegal.com/how-to-legally-post-cover-songs-on-youtube-tiktok-and-instagram)
- 高危行為：混入原版錄音（master rights，唱片公司比出版社嚴得多）、大改歌詞（變衍生作品，mechanical 不保）、翻唱未發表歌（強制 mechanical 只保已發行歌）— [StemSplit 2026 指南](https://stemsplit.io/blog/cover-songs-youtube-permission)
- IG：站內音樂庫有 Meta 與廠牌協議，個人帳號可用；第三方軟件後製加歌、商用帳號只限 Meta Sound Collection；系統比對到無授權音檔會 mute/刪/降觸及/地區 block，且可事後追溯 mute — [FoxiMusic 2026 IG 指南](https://www.foximusic.com/blog/instagram-reels-music-copyright-legal-guide)；[The IP Press 2026-08 分析](https://www.theippress.com/2026/08/04/why-your-viral-reel-got-muted-the-hidden-copyright-system-of-instagram-everyday-ip)
- TikTok：只能用站內 licensed 音樂庫的歌，否則上傳即代表你聲稱擁有全部權利；非音樂庫音檔可被權利人舉報下架 — [TikTok Music Terms](https://www.tiktok.com/legal/page/global/music-terms-eea/en)；實務上搜官方 sound 用其音檔，否則會被 mute — [Reddit r/Music 討論](https://www.reddit.com/r/Music/comments/1bn1dmd/please_let_me_know_how_i_can_cover_songs_on)
- 真實翻唱（自己錄晒所有音）的安全做法：description 寫歌名+原唱+全部作曲作詞人；audio claim（誤判用原版）可 dispute，composition claim 不要 dispute — [StemSplit 2026 指南](https://stemsplit.io/blog/cover-songs-youtube-permission)
- 無「10 秒/30 秒豁免」:再短的無授權使用都不安全 — [FoxiMusic 2026 IG 指南](https://www.foximusic.com/blog/instagram-reels-music-copyright-legal-guide)

### Inferences
- 對 HK 業餘歌手最實際策略：YouTube 照上（接受版權方拿收益，賺觀眾）；IG/TikTok 優先用「原聲上傳自己翻唱」而非套用他人音檔，被 mute 可申訴自己是表演者；想要 Spotify/Apple Music 上架才經 DistroKid 買 cover license。
- Cantonese 歌多屬香港/台灣出版社，同樣受 Content ID/blanket 協議覆蓋；但小廠或獨立音樂人未必有協議，block/下架風險較高，宜先以不公開/私人連結試水。
- 未找到香港 CASH 針對個人翻唱上傳 YouTube 的直接指引（CASH 管公開表演/廣播，平台上載主要由平台協議覆蓋）；report 不應聲稱「CASH 會追你」。

### Gaps
- 找不到 CASH/HK 法例下個人翻唱上傳的本地指引，只找到美國法（17 U.S.C. §115）論述；HK 適用性不確定。
- 未確認 2026 年 TikTok/IG 對「自己唱的翻唱原聲」是否同樣有分潤/claim 機制；只知不會即時 strike。

## Cost total for each workflow tier (免費 / HKD 100-200月費 / 專業)?

### Takeaway
免費版全程 HKD 0 可出片；HKD 100–200/mo 檔主力花在 Moises Premium + CapCut Pro；專業版一次性投入咪+耳機約 HKD 1500–2500，月費約 HKD 200–350（含 DistroKid 年費攤分）。

### Cited Findings
- BandLab（含 DAW + mastering + 發行前工具）核心功能免費、mastering 無限免費 — [BandLab Mastering 官網](https://www.bandlab.com/mastering?lang=en)；[Musosoup 免費 mastering 整理](https://musosoup.com/blog/free-song-mastering)
- Moises：免費 5 首/月；Premium web 年付約 USD 2.99–3.99/mo（iOS 內購較貴，月付 USD 5.99）；Pro web 年付約 USD 7.99–9.99/mo（iOS 月付可達 USD 29.99）— [StemSplit 評測](https://stemsplit.io/blog/moises-ai-review)；[Chartlex 2026 定價](https://www.chartlex.com/blog/marketing/moises-ai-review-2026)；[SensorTower App Store 內購價](https://app.sensortower.com/overview/1515796612?country=US)
- CapCut Pro 約 USD 6–9.99/mo（地區/平台而定），auto captions、4K、去水印需 Pro — [Reddit r/CapCut](https://www.reddit.com/r/CapCut/comments/1eachxp/capcut_auto_captions_not_free_anymore)；[Descript 2026](https://www.descript.com/blog/article/capcut-captions-arent-free-anymore-heres-a-better-option)
- DistroKid 上架：Musician 版 USD 24.99/yr 起，cover license 每首 USD 12/年另計 — [DistroKid 官網定價](https://distrokid.com/product/distrokid/plans-and-pricing-2)；[DistroKid cover licensing 頁](https://distrokid.com/product/cover-song-licensing)；[DistroKid 支援頁](https://support.distrokid.com/hc/en-us/articles/360013648953-Uploading-Cover-Songs-to-DistroKid)
- 咪硬件：RØDE VideoMic Me-L 約 USD 79；Shure MV88+ kit 約 USD 219（評測價）；Shure MV88 USB-C 版定位入門 — [YouTube 評測](https://www.youtube.com/watch?v=mcy_t92CLqg)；[SoundGale](https://soundgale.com/shure-mv88-review)；[Stream Designz](https://www.streamdesignz.com/blogs/live-streaming/shure-mv88-usb-c-mic-review-best-phone-mic-for-streaming-recording)

### Inferences
- 三檔總帳（按 USD→HKD ~7.8 估算）：
  - **免費檔 HKD 0**：內建咪 + BandLab + Moises 免費（5 首/月）+ CapCut 免費/YouTube 字幕。足夠出第一條片。
  - **輕量月費 HKD ~80–160/mo**：Moises Premium 年付（~HKD 280/yr ≈ HKD 23/mo）+ CapCut Pro（~HKD 50–80/mo）+（可選）RØDE Me-C 一次性 ~HKD 600。月付計約 HKD 100–150。
  - **專業檔（一次性 ~HKD 1500–2500 + 月費 ~HKD 200–350）**：Shure MV88+（~HKD 1200–1700）或入門 condenser + interface、有線監聽耳機（~HKD 300–500）+ Moises Pro 年付（~HKD 750/yr）+ CapCut Pro + DistroKid（USD 24.99/yr + 每首 cover USD 12/yr）。
- CP 值最高升級順序：房間處理（0 元）→ 有線耳機（~200）→ 手機咪（~600）→ Moises Premium（~23/mo）→ CapCut Pro（~60/mo）→ DistroKid（出串流才買）。
- 注意 iOS 內購比官網貴，應經 Moises/DistroKid 官網年付。

### Gaps
- HKD 實售價（深水埗/通利/官網 HK store）無即時來源，report 內金額應標「約、2026 年中 USD 定價推算」。
- 未查 Cakewalk/Reaper 等桌面 DAW 付費（如有）細項，但兩者皆有免費可用版本，對免費檔結論無影響。
