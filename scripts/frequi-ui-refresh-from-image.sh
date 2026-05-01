#!/usr/bin/env bash
# Sync FreqUI static files from the official Docker image, then apply Chinese overlay.
# Keeps zh-cn-runtime.js and index.html hooks in git under frequi_assets/overlay/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${FREQTRADE_IMAGE:-freqtradeorg/freqtrade:stable}"
ZH_VER="${ZH_CN_RUNTIME_VERSION:-$(date +%Y%m%d-%H%M%S)}"
OVERLAY="${ROOT}/frequi_assets/overlay"
INST="${ROOT}/frequi_assets/installed"

if ! command -v docker >/dev/null 2>&1; then
  echo "需要已安装的 docker 命令。" >&2
  exit 1
fi

if [[ ! -f "${OVERLAY}/zh-cn-runtime.js" ]]; then
  echo "缺少 ${OVERLAY}/zh-cn-runtime.js，请先提交 overlay 文案。" >&2
  exit 1
fi

echo "拉取镜像: ${IMAGE}"
docker pull "${IMAGE}"

TS="$(date +%Y%m%d%H%M%S)"
if [[ -d "${INST}" ]] && [[ -f "${INST}/index.html" ]]; then
  BACKUP="${INST}.backup.${TS}"
  echo "备份当前 UI 到: ${BACKUP}"
  cp -R "${INST}" "${BACKUP}"
fi

mkdir -p "${INST}"
CID="$(docker create "${IMAGE}")"
cleanup() { docker rm -f "${CID}" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "从镜像复制 FreqUI 到: ${INST}"
docker cp "${CID}:/freqtrade/freqtrade/rpc/api_server/ui/installed/." "${INST}/"

cp "${OVERLAY}/zh-cn-runtime.js" "${INST}/zh-cn-runtime.js"
python3 "${ROOT}/scripts/inject_frequi_zh_index.py" "${INST}/index.html" "${ZH_VER}"

echo "完成。请检查 ${INST}，然后重启容器，例如:"
echo "  cd ${ROOT} && docker compose up -d --force-recreate"
