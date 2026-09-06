# 拍照推荐＋心情推荐数据

## 一、拍照推荐（`/camera`，他人 WIP，只记已落地形状）

对应组件：`components/camera/camera-flow.tsx`（state 均为会话级，未持久化）。

| 字段 | 页面位置 | 类型 | 当前来源 | 未来表映射 |
|---|---|---|---|---|
| `photo`（照片 dataURL） | 拍照页预览 | `string \| null` | state（拍摄／上传） | `checkins.photo_url`（传对象存储，库里只存 URL） |
| `source`（camera／upload） | 来源标记 | `PhotoSource` | state | 不进库（或进 `checkins.photo_source`，待定） |
| `note`（文字备注，≤500 字） | 备注输入 | `string`（`MAX_NOTE_CHARS`） | state | `checkins.note` |
| `audio`（{url, seconds}）＋`audioBlob` | 语音备注 | state，≤60 秒（`MAX_VOICE_SECONDS`） | state | `checkins.audio_url`＋`audio_seconds` |
| `trans.text`／`trans.status`（转录文本＋态） | 转录结果 | `TransState` | state，经 `/api/transcribe`＋讯飞（`IflytekAccent`：cantonese／mandarin／english） | `checkins.transcript` |
| `receipt`（{photo, note, transcript, audioSeconds} 回执单） | 提交前汇总 | 对象 | state（前端组装，未提交） | 提交即 `checkins` 一行 |

## 二、心情推荐（`/mood` stub，无数据）

页面只有占位文案＋返回按钮。未来心情流程输入（情绪字／选项）进
`mood_logs(user_id, mood_text, created_at)`，推荐结果沿用 `beers`＋`checkins`。
