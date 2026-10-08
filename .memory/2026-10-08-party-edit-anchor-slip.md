# 2026-10-08 — edit 錨串吞行：oldString 含 `export` 行、newString 漏了

## 情境

- 續做 UR E.23（同事中斷接手）：在 `lib/api/party.ts` 加 `countGenders` helper，前一筆 edit 想只改注釋，
  `oldString` 含 `export function seatFor(` 行，`newString` 漏了該行。

## 問題

- edit 成功但語義是刪除：`export function seatFor(` 整行消失，文件留下無頭函數體（殘參數＋回傳型別懸空），tsc 必紅。

## 原因

- edit 的 `oldString`／`newString` 差集即刪除：凡 `oldString` 有而 `newString` 無的行都是刪除，
  起草時只比對「想改的行」，沒逐行比對邊界行（首尾行最易吞）。

## 修正

- 當輪即讀回驗出（93–111 行），補回 `export function seatFor(` 並再讀驗與原文一致；tsc 零錯／party.test 9 綠。
- 判例：凡 `oldString` 跨函數簽名／塊邊界，寫完先讀回驗邊界行；多行 edit 起草後先數行數（new ≥ old，除非本意刪除）。
