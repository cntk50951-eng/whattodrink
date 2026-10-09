# 酒闻／主页缩略图管线问题（E.24／E.27 输入，2026-10-09）

> 用户指令：先把问题总结成文档，然后继续可以开发的部分。
> 现状：E.27 profile v1 先回 `photo_thumb`（96px dataURL）顶着；本案另立 UR 解决。

## 现状

- 打卡照片存的是 **base64 dataURL**（`photo_url` 原图 ≤1M，`photo_thumb` 96px ≤32K），直接存库，无 storage 桶管线。
- iOS 要的是 `thumb_url`（约 300px **URL**）：E.24 酒闻 `image_url`（有才存，本就稀疏）、E.27 主页网格（30 条／页，目标包 ≤60KB）。
- v1 顶替：`thumb_url` 回 `photo_thumb`（dataURL）。能看，但**违背"不返回 base64"**，且 30 条 × ~20KB ≈ 600KB，超 60KB 目标一个数量级。

## 要做的管线（另立 UR，估大）

1. 新建私有桶（如 `checkin-images`）＋RLS（读沿打卡可见门；写走 service）。
2. 入库链路产 300px 缩略图并上传（E.1 相机侧现产 96px dataURL，需加 300px 档＋上传＋回写 URL 列）。
3. 历史数据回填（读 dataURL → 压图 → 上传 → 写 URL；量大，分批）。
4. 新列（如 `photo_thumb_url`）＋读端切换（`thumb_url` 优先 URL，无则回 dataURL 兼容老行）。
5. E.22 归档行同理（`photo_thumb` 列有，URL 无）。

## 待产品（转 E.27 §7 相关）

- 300px 是否够（网格＋足迹共用？详情仍用 dataURL 原图？）。
- 回填范围（全量还是近 90 天）。
