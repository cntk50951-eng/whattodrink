# 2026-09-04 UR2.4 v3：画现实产品前必须亲眼看参照图，文字描述不够

- 背景：v2 按文字搜索（颜色/构成描述）重画后用户仍嫌不够细腻，要求按真实样子升级。
- 做法：Wikimedia Commons API 按品名搜 File（namespace=6）→ Special:FilePath 下载 800px
  到 /tmp/beer-ref → read_file 逐张看 → 再落笔；少爺啤 Commons 没有，用官网 Shopify
  products.json 拿到 Classic packshot；看完 `rm -rf /tmp/beer-ref`（用户要清临时文件）。
- 看图纠正的 v2 硬伤（证明文字描述会误导）：
  - 藍妹不是蓝罐，是米白罐＋金细纹＋椭圆蓝章＋古典女神＋底部蓝带白字；
  - Kirin 不是白罐紅字，是高瘦银罐＋金麒麟神兽＋红带白字＋一番搾り；
  - Heineken 红星在瓶颈（配竖字），瓶身是椭圆绿标（HEINEKEN ORIGINAL／红星白章／缎带／PURE MALT LAGER）；
  - Hoegaarden 六角杯是刻面 tumbler，字是白字藏青描边＋小徽章；
  - 少爺 Classic 标志是红功夫裤＋少/爺双圈＋藏青 CLASSIC，不是红印章；
  - 茅台是高红盖＋红标白斜带斜构图（KWEICHOW MOUTAI＋贵州茅台酒）。
- 教训：文字描述只能定配色，构图/比例/label 层级必须亲眼看图；以后画现实产品走
  「搜图→下载→看→画→删」固定流程。read_file 可直接看本地图片，这是有效工具链。
- lint 附带：SVG <text> 里的英文直引号（JAPAN'S）触发 react/no-unescaped-entities，
  用弯引号 ’ 解决。
