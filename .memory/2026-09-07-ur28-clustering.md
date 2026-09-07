# 2026-09-07 UR2.8 睇全港聚合（开工记忆门禁＋两踩雷）

## 情境
- UR2.8：睇全港下 pins 挤成一团。开工按 Step 1 门禁读完 24h 内全部 27 篇
  memory，首轮回复即报备（读了哪几篇＋哪 5 条本轮生效）。
- 方向经 AskUserQuestion 定为聚合优先（A 收紧 framing 治标、B 动态尺寸
  放大会更挤、D 引入 markercluster 杀鸡用牛刀且样式冲突）。

## 问题
1. JSON 脚本 `json.dump(f, d)` 参数写反，且文件已 `"w"` 打开——
   `messages/en.json` 被截断归零（zh 两个还没轮到，逃过）。
2. `exhaustive-deps` 的 disable 贴错两次：先贴在调用行前（规则上报的是
   effect 行），再贴进块注释里（块注释内不生效），最后发现上报位置是
   `}, []);` 行——disable 必须紧贴该行，说明文字放它前面。

## 原因
1. heredoc 一次成型没自查参数序；`"w"` 截断＋异常＝数据丢失，git 外
   无后悔药。
2. 凭印象认定“上报在 effect 开头”，没看行号（540:6 写得明白是数组行）。

## 修正
1. `git checkout -- messages/en.json` 恢复（7913 字节对上），重做后
   `git diff messages/` 逐文件验只有加 key 两行。
   铁律：凡脚本批量写文件，先 `git status` 确认可恢复，再跑；跑完 diff 验。
2. 正确贴法：
   ```
   };
   // 说明……
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);
   ```
   （理由：init-once，函数只读 refs／模块常量／挂载时 locale t。）
3. 本轮实现备忘：`lib/clusters.ts` 像素贪心聚合＋4 单测；他人 pin 层
   zoomend 重建（`othersLayerRef`＋teardown 清空）；`.pinCluster` 静态无常动；
   簇点击 zoom＋2（reduced-motion 用 setView）；门：59 tests／tsc 净／lint 0 error。
