#!/usr/bin/env bash
# 校驗 web `content/legal/*.json` 與 iOS／AOS App 內那六份逐字節一致（單一來源在 App 內）。
# 用法：scripts/check-legal-sync.sh        # 只檢查（不一致 exit 1）
#       scripts/check-legal-sync.sh --sync  # 以 iOS 為準覆蓋 web 副本（之後仍要 AOS 也一致）
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
ios="$here/../whattodrink_ios/WhatToDrink/Resources/Legal"
aos="$here/../whattodrink_aos/app/src/main/assets/legal"
web="$here/content/legal"
if [[ "${1:-}" == "--sync" ]]; then cp "$ios"/legal-*.json "$web"/; fi
bad=0
for f in "$ios"/legal-*.json; do
  b="$(basename "$f")"
  for other in "$web/$b" "$aos/$b"; do
    if ! cmp -s "$f" "$other"; then echo "DIFF  $b  ↔  $other"; bad=1; fi
  done
done
[[ $bad -eq 0 ]] && echo "legal JSON: iOS / AOS / web 六份逐字節一致" || exit 1
