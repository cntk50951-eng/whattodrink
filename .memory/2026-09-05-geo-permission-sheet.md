# 2026-09-05: 手機定位權限指引卡（平台差異）

## 情境

用戶 iPhone Chrome 上 Vercel 站：定位無彈框、直接失敗；桌面正常。

## 問題

手機系統瀏覽器記住拒絕／系統總開關關閉時，geolocation 靜默失敗；
舊指引只有 Safari 路徑，iOS Chrome 用戶照做也找不到入口。

## 原因

1. Permissions API 不問，舊代碼直接 request，denied 無聲無息。
2. iOS 按 App 分定位權限：Chrome 是「設定→Chrome→位置」，
   跟 Safari 不同路徑；籠統寫 Safari 幫不到 Chrome 用戶。
3. 內置瀏覽器（微信／IG）禁定位，只能換瀏覽器，無代碼解。

## 修正

1. `lib/device.ts`：純函數 `detectPlatform`／`detectBrowser`
  （CriOS／MicroMessenger 等標記，單測用真實 UA 覆蓋 5 種）。
2. 指引卡按平台＋瀏覽器拼步驟；Android 加
   `intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end`
   一鍵直達（Chrome 可解，其他瀏覽器無視，手動步驟兜底）。
3. iOS 無網頁可達的設定 deep-link（平台鐵律）——只給手動步驟，
   不要承諾一鍵直達。
4. 卡片可關（dismiss→小 pill，點 pill 重試＋重開卡）。
