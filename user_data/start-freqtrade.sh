#!/bin/sh
set -eu

CONFIG_FILE="/freqtrade/user_data/config.json"

DRY_RUN="$(
python - "$CONFIG_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as config_file:
    config = json.load(config_file)

dry_run = config.get("dry_run")
if dry_run is True:
    print("true")
elif dry_run is False:
    print("false")
else:
    raise SystemExit("config.json must define dry_run as true or false")
PY
)"

if [ "$DRY_RUN" = "true" ]; then
    DB_URL="sqlite:////freqtrade/user_data/tradesv3-dryrun.sqlite"
else
    DB_URL="sqlite:////freqtrade/user_data/tradesv3-live.sqlite"
fi

echo "Starting freqtrade with dry_run=${DRY_RUN}, db_url=${DB_URL}"

exec freqtrade trade \
    --logfile /freqtrade/user_data/logs/freqtrade.log \
    --db-url "$DB_URL" \
    --config "$CONFIG_FILE" \
    --strategy SpotFixedGridStrategy
