# 2026-09-29 — DEF-20260929-001 暴力文本静默发布（修復中）

## 情境

- 用戶報：打卡 note 填 `I want to kill them` 照樣发布（附 POST 200 response，note 已進庫為證）。
- 本轮 E.2 本就未提交，生产无影响；在 Investigating 当轮修。

## 问题

1. OpenAI 从当前地域直连回 `unsupported_country_region_territory`（仓内 key 实测）→ `moderateContent` 抛错 → 空 catch 静默下沉，全程零日志。
2. Minimax 平台信号对暴力文本是瞎的：英文与中文（`我要杀了他们，把他们全都打死`）双双 `input_sensitive: false`（200 正常回包实测）→ 静默放行。
3. 用户 response 证明文本已到服务端，“没送到”假设排除。

## 原因

- 可观测为零（空 catch）＋ fail-open 无分级（无 key／全挂同一条路）＋兜底只有一个盲信号。

## 修正

- `ModerationVendorError`（vendor＋status，message 沿旧格式不断言）＋路由大声日志（vendor＋status，不记内容／key）。
- Minimax 模型裁决 OR 化（`BLOCK／PASS` 单词＋`<content>` 围栏；平台信号独立，注水只能更严）＋`max_completion_tokens` 8→16。
- `moderationAction` 纯函数：flagged 拒；有 key 全挂 503 fail-closed（沿 rejected 通道，`V2Home` 零改动）；无 key／无输入沿旧放行。
- 图片：代码本就在链上（双 vendor body 断言补上）；Minimax 图片 plumbing 真 key 200 验证。
- 验证：单测 19 绿（12 沿用＋7 新增）＋`lib/api/checkins` 21 绿；Minimax 真 key live 双绿（暴力 EN→拦／干净→放，跑完即删）；tsc exit 0／eslint 净。
- 教训：地域封锁是 vendor 选型的第一约束（免费但不可达＝不可用）；兜底必须与主审异构且独立验证，盲信平台信号等于没兜底。

## 关联

- DEF-20260929-001（Investigating→待用户原路径复测转 Fixing）；UR E.2 [WIP] 不变；未提交（等复测＋合入指令）。
