# 2026-09-26 shadcn-ui-design skill 评审与落地（v2 专用）

## 情境

用户起草 `shadcn-ui-design` skill 让我评审，我实证核查（components.json base-nova、Tailwind v4 @theme、Geist/Caveat 字体管线、ui 已有 7 组件）后按评审重写并落三处（md5 一致）。

## 评审出的 10 个洞（已全补）

- Blocker：V1/V2 隔离缺席（全局 CSS 换肤直改 v1）、验收叫 agent 截图（违反用户亲验死命令）、零 i18n（缺 key 炸树）。
- 必补：base-ui 非 Radix、reduced-motion、hydration（useSyncExternalStore）、MCP 可能不存在（fallback＋禁臆造 API＋Node 22 前缀）。
- 小修：v4 口径、字体沿现有管线、safe-area＋aria、落地三目录同步、harness 分工引用。

## 注意

- `.claude/` 在 `.gitignore` 第 45 行，Claude 侧 skill 只活本地、上不了 GitHub（建仓前即如此，未动；要改 .gitignore 需用户拍板）。
- skill 未提交，随下一单一起交。

## 关联

- 文件：`.opencode／.agents／.claude/skills/shadcn-ui-design/SKILL.md`（三份 md5 一致）
