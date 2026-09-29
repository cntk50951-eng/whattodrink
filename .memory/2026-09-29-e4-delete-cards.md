# 2026-09-29 — DEF-003/004/005 三连修（E.4）

## 情境

- 用户三报：①删后刷新复活 ②同账号手机看不到网页记录 ③照片卡预览错位。Step 7b 当轮落条（003/004/005）。

## 确诊

- 003 实锤：`handleDeleteWant` 只清本地＋根本无 DELETE 端点（RLS owner delete 现成，免迁移）。
- 004 码证正确（登录即全量 `mine` 覆盖）：首嫌手机没登录／次嫌网页离线本地货／三嫌双登录方式实为两人。未动码，留判证法。
- 005 定罪：双图三明治（酒 hero＋实拍）＋3/4 全幅图＋开卡滚动位不确定。

## 修正

- `DELETE /:id`（本人＋404 不泄）＋`parseCheckinIdParam`＋单测＋openapi；客户端先库后本。
- 双卡 IG 化＋照片 `max-h-[46svh]`＋换卡 key-remount 回顶。
- 验证：单测＋3／tsc 0／lint 净；待用户亲验（删→刷新／长图卡／004 两步判证回填）。
- 教训：edit 锚定中文注释行又失败一次（ASCII 锚即过）——注释只读不锚，肌肉记忆。

## 关联

- DEF-003／005 Fixing→待亲验；DEF-004 Open 待回填；UR E.4 [WIP]；未提交。

## round-2（DEF-006／007，2026-09-29）

- DEF-006 定罪：E.4 的 key-remount 在开着换卡时换掉 base-ui 正在跟踪的 Popup→开关机错乱残留吞点击；开卡回调与图层链读过无辜。修法去 key＋id＋effect 回顶。
- DEF-007：双卡 overlay（渐变＋白字压图），无图／无文案原样。
- 教训×2：①TDZ 类型错会连带误报 `react-hooks/purity`（修完自消，不要加 disable）；②edit 中文注释锚连败，ASCII 锚或 python 行号手术；python 改前先打印行号对表（本次索引差一白跑一轮）。

## round-3（DEF-007 返工，2026-09-29）

- overlay 白字在花照片上难读 → 改回分开，但用主流帖子语序：纯图→操作行→caption（用户名加粗＋正文同行）→地点；他人卡操作行从底部上移、酒名并入 caption 第二行。

## round-4（DEF-007，2026-09-29）

- 用户要文案压图但作者视角不加名字：overlay 回来，caption 只留正文（两卡 header 都有作者行）；渐变加深＋drop-shadow 保可读性。

## round-6（DEF-007，2026-09-29）

- 用户定死：文案与照片彻底独立（overlay 全删）；caption 独立行、纯正文、无名字；他人卡已有操作行在图下，caption 紧贴其下。
