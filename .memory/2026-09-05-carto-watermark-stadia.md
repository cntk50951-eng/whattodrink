# 2026-09-05: CARTO 匿名瓦片加水印，底圖改 Stadia 水彩

## 情境

UR1.1 上線用 CARTO Voyager（當時免 key），用戶驗收時整幅地圖壓著
「API KEY REQUIRED」水印。

## 問題

CARTO 改了政策：`basemaps.cartocdn.com` 匿名請求照常回 200，但磚上打水印；
要乾淨磚得申請免費 key。訓練資料裡的「CARTO 免 key」已過期。

## 原因

選型時只驗了「免 key 可調通」，沒查當下政策（官方已有
carto.com/basemas/apikey 說明頁）。免費磚政策會變，不能當永久前提。

## 修正

1. 主源換 Stadia Stamen Watercolor（手繪感＋品牌最合）：
   `tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=`，
   key 放 `NEXT_PUBLIC_STADIA_KEY`（客戶端公開 key，dashboard 鎖 referrer）。
2. 無 key 時自動降級 Esri Light Gray（免 key），地圖永不空白＋提示文案。
3. 水彩原生只到 z16：tile 層設 `maxNativeZoom: 16`，地圖 maxZoom 維持 18 過縮。
4. attribution 照官方文檔寫全（Stadia＋Stamen＋OpenMapTiles＋OSM／Esri）。
5. 之後選免費磚必查官方當下政策頁＋用 curl 實測一磚，不只看文件說免 key。
