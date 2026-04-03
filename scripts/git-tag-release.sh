#!/usr/bin/env bash
# 在验收通过后于本机执行，将当前代码提交并打版本标签。
# 用法：./scripts/git-tag-release.sh v0.0.4 "V0.0.4 验收通过"

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TAG="${1:?第一个参数：标签名，如 v0.0.4（须与根目录 VERSION 一致）}"
MSG="${2:-Release $TAG}"

if [[ ! -d .git ]]; then
  git init
  git branch -M main
fi

git add -A
if git diff --staged --quiet; then
  echo "Nothing to commit."
else
  git commit -m "$MSG"
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists. Skip tagging."
else
  git tag -a "$TAG" -m "$MSG"
  echo "Created annotated tag: $TAG"
fi

echo "Done. Push when ready:"
echo "  git remote add origin <你的仓库URL>   # 仅需一次"
echo "  git push -u origin main"
echo "  git push origin $TAG"
