# 2026-09-04: Stitch MCP 接入 Muse Code

## 情境

UR1.4 需要對照 Stitch 原稿優化 POC，但本 repo 無 `.stitch/` 目錄、我也沒有 Stitch MCP 工具。用戶直接提供 Stitch API key，要求為 Muse Code 配置 MCP。

## 問題

1. Muse Code 的 MCP 從哪配？官方文件（`dev.meta.ai/docs/muse-code/extending.md` → MCP servers）確認：`~/.config/muse/settings.json` 的 `mcp_servers` 塊；`transport` 為 `stdio`（command/args/env）或 `streamable_http`（url/headers）；另有 `enabled` 與 `mode`（預設 `required`，失敗會 abort 整個 run）。
2. Stitch MCP 的 endpoint 與鑑權格式為何？多方獨立來源一致：`https://stitch.googleapis.com/mcp`，header `X-Goog-Api-Key: <key>`。
3. 我的 sandbox 寫不到 `~/.config/muse/`（writes 僅限 workspace、/tmp），也讀不到（`muse skills list` 曾因此報 Operation not permitted）。所以合併操作必須用戶在自己的終端執行。

## 原因

- Muse Code MCP 是 global-only（無 project-scoped 位置），與 `.agents/skills/` 的專案級共享機制不同。
- `mode` 若留預設 `required`，Stitch 掛掉會連帶 abort 所有 session；應設 `optional`。

## 修正

1. key 存入專案 `.env`（`STITCH_API_KEY`，gitignored）；`.env.example` 只加名字不加值。
2. 用戶在自己終端跑合併命令（key 經 `grep '^STITCH_API_KEY=' .env` 取出，全程不手打明文）：

```bash
cd /Users/yuki/Desktop/whattodrink
STITCH_API_KEY=$(grep '^STITCH_API_KEY=' .env | cut -d= -f2-)
[ -n "$STITCH_API_KEY" ] || { echo "STITCH_API_KEY empty, abort"; exit 1; }
STITCH_API_KEY="$STITCH_API_KEY" python3 - <<'EOF'
import json, os
p = os.path.expanduser('~/.config/muse/settings.json')
try:
    with open(p) as f: cfg = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    cfg = {}
cfg.setdefault('mcp_servers', {})['stitch'] = {
    "transport": "streamable_http",
    "url": "https://stitch.googleapis.com/mcp",
    "headers": {
        "Accept": "application/json",
        "X-Goog-Api-Key": os.environ['STITCH_API_KEY'],
    },
    "enabled": True,
    "mode": "optional",
}
os.makedirs(os.path.dirname(p), exist_ok=True)
with open(p, 'w') as f: json.dump(cfg, f, indent=2)
print("stitch MCP configured")
EOF
```

3. 新開一個 session（MCP 在 session 啟動時載入），驗證方式：讓 agent 調 `list_projects`，能列出 Stitch 專案即 key 有效。
4. 之後若換 key：只改 `.env`，重跑上面命令即可（冪等，會覆寫 stitch 段）。
