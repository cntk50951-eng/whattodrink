# 2026-09-27 DEF-009：頭像菜單 GroupLabel 游離崩潰（代修同伴 C.16）

## 情境

- 用戶貼 Turbopack runtime 棧：點左上頭像即炸（`MenuGroupContext is missing`）。
- 同伴 C.16 WIP 同文件施工中；崩潰 P0，用戶點名要修。

## 問題

- `DropdownMenuLabel`（→ base-ui `GroupLabel`）放在 `DropdownMenuContent` 直屬，游離任何 `Group` 之外——base-ui runtime 硬拋錯。

## 原因

- 調用方拼錯容器（registry 件本身是對的）；`code-review` skill 第 35 條明寫 Label 必須包在 `DropdownMenuGroup` 內——寫時沒守。
- 深層：base-ui 件只在**交互時**才暴露容器錯（build／tsc 全綠），靜態閘攔不住。

## 修正

- Label 外包一層 `DropdownMenuGroup`（已 import，V2Home 單處，3 行）；tsc 淨；待用戶硬刷新親驗。
- DEF-20260927-009 落條（表格＋詳情，原生 grep 回驗）＋C.16 改動記錄**追加**一行（不同人條目只追加不改，沿並行流程）。
- 教訓：凡拼.dropdown-menu（Label／Separator／Item）先對 skill §35 群組規範；base-ui 容器錯只能靠真點驗——寫完即用戶親驗，不隔夜。

## 關聯

- DEF-20260927-009（Fixing，待親驗轉 Fixed）；UR C.16（同伴，代修歸屬已記）
