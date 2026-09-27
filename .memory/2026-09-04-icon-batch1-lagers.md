# 2026-09-04 icon 批量管线 batch1：家族去重＋10 个拉格

- 用户要按目录顺序画下面 100 个，先全库家族去重：1144 行正好 0 英文重名
  （UR2.4 去重已做），但产品变体行会撞已画 icon（Tsingtao Classic 等），
  所以用家族规则再排 25 行：英文名去括号＋整词匹配 10 个已画家族。
  坑：首版子串匹配误杀獭祭／久保田／麒麟山（括号内酒厂备注＋kirinzan），
  改整词＋去括号后解决；Moutai Prince／Yingbin 算同家族（白瓶红标同 livery）。
- batch1（01 头 10 个拉格）看图要点：
  Bud 现行是白罐黑字＋红底带（非老红罐）；Carlsberg 瓶身无大标只有颈小标＋浮雕字；
  Snow 棕瓶蓝标白雪花＋勇闯天涯；Yanjing 大绿棒子＋米白标紅字；Harbin 深绿标＋金字 1900；
  Bud Light 蓝罐白字块；Coors Light 银罐红字＋蓝山＋SUPER COLD；
  Miller Lite 藏青罐＋金椭圆；Modelo 是矮胖 stubby 透明瓶＋金箔颈＋白标 navy 字。
- 进度台账 `docs/data/beer-catalog/11-icon-progress.md`：每次报剩余（全队列／本批100）。
  本批后：全队列剩 1109，本批 100 目标剩 90。
- 门：tsc／lint 0 error／vitest 44 全绿；参照图＋队列 JSON 已清 /tmp。
