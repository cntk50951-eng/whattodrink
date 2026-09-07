# 城市图标资源（city-icons）

左上城市卡的按需图形。用户要求：基于真实地标照片起稿、墨线涂鸦风、
web／iOS／Android 三端复用同一份资源。

## 资源位置

`public/city-icons/<code>.svg` —— Next.js 直接 serving，iOS／Android
从同一份文件转换，无需重画。

| code | 城市 | 地标依据 |
| ---- | ---- | -------- |
| hk | 香港 | 中銀大廈（退台剪影＋白鋼 X 撐＋雙天線＋裙樓＋維港浪；v1 画成 plain 梯形被纠正） |
| bj | 北京 | 天壇祈年殿（葫芦金顶坐檐＋深蓝三檐＋红 tier 相连＋红墙三门＋石栏杆基；v1 三檐悬空被纠正） |
| sh | 上海 | 東方明珠（大下球粉带＋三足外撇＋三柱单 pod＋小上球；v1 球小无柱、粉带有牙齿感被纠正） |
| gz | 廣州 | 廣州塔（极瘦銀針＋斜格＋腰环＋顶针；v1 画胖偏紫被纠正） |
| sz | 深圳 | 春筍（近圆柱微曲＋通天竖肋＋底部倒 V 撑；v1 菱形格被纠正） |

> 起稿方法（硬性，用户要求）：先 Wikimedia Commons 拉实拍对照再画，
> 每枚自渲染预检（cairosvg 到 `/tmp/cityprev/`，脚本留 /tmp 可重跑）。
> agent-browser 在本机 sandbox 跑不起来（daemon＋装浏览器双失败），
> 改用 Commons API 搜图＋curl 直下＋read_file 看图。

## 绘制规范（加新城市必须遵守）

1. `viewBox="0 0 64 64"`，方形，40px 小尺寸可读（粗剪影＋最少细节）。
2. 墨线固定 `#3a3129`（**禁 CSS 变量**，原生端解析不了）；面填固定品牌 hex。
3. **禁滤镜**（`feTurbulence` wobble 转不成 VectorDrawable）、**禁 `<text>`**
   （字库三端不一致）、其余只用 path／circle／ellipse／rect。
4. 手绘感靠微不对称 Q 曲线＋错峰细节，不靠滤镜。
5. `<title>` 写城市＋地标（无障碍）。
6. 地标起稿对照真实照片，造型是风格化剪影、非商标 artwork。

## 三端转换

- **Web**：`components/map/CityIcon.tsx` 按码 `<img>` 按需加载，
  失败回退 Building2。
- **iOS**：Xcode Asset Catalog → New Image Set → 勾 Single Vector，
  导入 SVG 即自动生成 @1x/@2x/@3x PDF。
- **Android**：Android Studio 右键 drawable → New → Vector Asset →
  Local file 导入同一份 SVG（只用规范内元素，转换零警告）。

## 加一个城市的清单

1. 按上规画 `public/city-icons/<code>.svg`。
2. `lib/city.ts`：`CITY_CODES` 加码＋`AREA_MATCH` 加区名（简／繁／英）。
3. 三语 `messages/*.json` 加 `cityName_<code>`（JSON 脚本＋diff 验门）。
4. `lib/city.test.ts` 加命中＋回退单测。
5. 本文件表格加一行。
