---
name: github-api
description: "GitHub operations via REST API + curl for whattodrink. Use when creating PRs, pushing code, checking repo status, or any GitHub operation. Never use gh CLI (not installed)."
---

# GitHub API — whattodrink

All GitHub operations use REST API + `curl`. **Never use `gh` CLI** (not installed in this environment).

## Authentication

```bash
# Extract token from .env — NEVER hardcode
GITHUB_TOKEN=$(grep '^GITHUB_KEY=' .env | cut -d= -f2-)
```

## Push with inline token (preferred)

```bash
git push https://x-access-token:${GITHUB_TOKEN}@github.com/cntk50951-eng/whattodrink.git main
```

**Never** use `git remote set-url` to write token into git config.

## Common operations

### Create a PR

```bash
curl -s -X POST \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/cntk50951-eng/whattodrink/pulls \
  -d '{"title":"feat: ...","body":"...","head":"feat/xxx","base":"main"}'
```

### List open PRs

```bash
curl -s \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  https://api.github.com/repos/cntk50951-eng/whattodrink/pulls?state=open
```

### Check CI status

```bash
curl -s \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  https://api.github.com/repos/cntk50951-eng/whattodrink/commits/main/status
```

### Create an issue

```bash
curl -s -X POST \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/cntk50951-eng/whattodrink/issues \
  -d '{"title":"...","body":"..."}'
```

## Safety

- Token from `.env` only, never committed
- Token in inline URL for push, not in git config
- Never log token in commit messages or output
- If token expires, tell user to rotate in GitHub Settings → Developer Settings → Personal access tokens
