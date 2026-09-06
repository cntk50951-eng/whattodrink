# 2026-09-05 — UR1.8 验收返工：时间无年＋坐标无意义

## 情境
- UR1.8 首版按“POC 从简”定了经纬度直显＋无年短时间，用户验收时打回：
  1）时间没年份，中英文要各自 full 格式；2）纯坐标“没有任何意义”，
  联机必须显示文字地名。

## 问题
- “POC 从简”被我当成“显示从简”，但用户要的是“方案从简”
  （localStorage、不上后端），显示该给的（地名、年份）一个不能少。
  两个都是看到实物才暴露的判断错位。

## 原因
- 时间格式凭感觉拼（各 locale 默认 shape），没按用户语言定 contract；
- 地点把“存什么”和“显示什么”混为一谈：存坐标是对的，显示坐标是错的。

## 修正
- 时间：`formatToParts` 取 HK 时区数字 parts 再按语言组装
  （中文 `XXXX年XX月XX日 HH:MM`／英文 `YYYY-MM-DD HH:MM`），
  不赌各 locale 默认 shape；单测断言 exact 字符串。
- 地点：免费 Nominatim 逆地理（免 key，`accept-language` 跟 UI，
  路＋区两段，memoize＋存回 storage 离线复用），失败回落坐标；
  卡片地名为主、坐标灰字为辅。
- effect 内同步 setState 再撞 lint：地名解析的状态写入全放 async
  continuation，展示层用 `placeName ?? keyed-fetched` 纯推导，
  不在 effect body 里 reset。
