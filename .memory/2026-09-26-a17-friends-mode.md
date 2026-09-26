# 2026-09-26 UR A.17 好友模式實作

## 情境

A.15 拍板後實作好友模式讀路徑：`GET /friends/check`＋pins／wall `scope=friends`＋綠點關係過濾＋底部「只看好友」鈕。一次一個端點（api-workflow），A.19 復用同一判定函數。

## 問題

- `parsePinsParams`／`parseWallParams` 加 `scope` 鍵後，兩處舊 `toEqual` exact-match 測試即撐破（預期內，補鍵＋加 scope 測）。
- 寫 `lib/api/wall.ts` scope 時第一刀誤刪 `WallSort` 定義行（oldString 選錯錨點），即刻補回。

## 原因

- 加參必掃 exact-match 舊測（A.12 kind／A.13 range 同教訓，這次主動先查）。
- 同文件多 edit  serial 執行仍需每刀複核錨點唯一性。

## 修正

- 三閘：220→232綠（friends 10＋pins/wall scope 各 1）、lint 0 error、build 32頁。
- 綠點：mapper 不動，route 層 post-process `isOnline=false`（坐标／内容照出）；關係查詢只在「有 friends 作者＋viewer 已登入」時觸發，匿名／純公開零額外查詢。
- 空好友即空牆：`friendIds` 空時直接回 `[]`，不下 PostgREST 空集 `.in([])`（語義不定）。
- RLS：0009 只開讀（friendships 自讀＋checkins friends 行讀），寫續拒；用戶需在 Dashboard 執行 0009＋插驗證行（模板見 A.15 D3）。

## 關聯

- 涉及：`lib/friends.ts`、`0009`、`app/api/v1/friends/check`、pins／wall route＋scope、`DrinkMap` 只看好友鈕、`docs/api-openapi.yaml`、`home-map.md` 第十節、`photo-mood.md` 牆 scope 行
- 缺口：cheers／invites 真端點隨 A.4-11/12（mock 層僅 stealth 守衛）；加好友流程另議
