# 2026-10-13 — 酒局阶段 A（政策纯函数＋事件先行＋通知表）

## 情境

- iOS 要撤銷规则／退出记录／站内通知（阶段 A）；B／C／紧急通道不做，但表为 B 留扩展。

## 问题

- 撤銷无时间门、无记录、无通知；退出删行无痕；无通知表。

## 原因

- 旧 E.23 只做开局看板，散局语义缺失。

## 修正

- `cancelPolicy`／`leavePolicy`／`minutesBeforeStart` 纯函数＋单测（59／61 分界、负分钟）。
- 撤銷：service 写（事件＋通知表零 policy）；0 人 `cancel_no_joiners` 不通知；重复撤幂等。
- 退出：先记事件再删行（late／after_start 分流；后者不通知）；host 通知遇拉黑跳过。
- 政策欄只对登录者算（匿名缺席）；`notified_count` 照实际插入人数（通知失败只记 log，数仍照 joins 算——已注明口径）。
- 判例：凡"先记后删"顺序，事件 insert 必须在 delete 之前（删后无行可对）。
- 未做：B／C／紧急通道、push、RLS policy（service-only，沿 push_log）。
