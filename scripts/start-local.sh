#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Starting Postgres + Redis (Docker)"
docker compose up -d

echo "==> Waiting for Postgres"
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U crypto -d crypto_quant >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

export SYNC_DATABASE_URL="${SYNC_DATABASE_URL:-postgresql://crypto:crypto@localhost:5432/crypto_quant}"

cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt

echo "==> Alembic migrate"
alembic upgrade head

if command -v npm >/dev/null 2>&1; then
  echo "==> Optional: build React SPA to backend/app/static/react-spa"
  cd "$ROOT/frontend"
  [[ -d node_modules ]] || npm install
  npm run build || true
else
  echo "==> npm not found: using built-in UI at backend/app/static/frontend"
fi

echo "==> Uvicorn on http://0.0.0.0:8000"
echo "    UI: http://localhost:8000/app/"
echo "    API docs: http://localhost:8000/docs"
cd "$ROOT/backend"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
