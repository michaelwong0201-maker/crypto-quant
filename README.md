# Freqtrade Local

Dockerized Freqtrade deployment with a spot fixed-grid strategy and separate databases for dry-run and live trading.

## First-time setup

```bash
cp user_data/config.example.json user_data/config.json
# Edit user_data/config.json before starting. Use dry_run=true first.
docker-compose up -d
```

The startup script reads `dry_run` from `user_data/config.json`:

- `true` uses `user_data/tradesv3-dryrun.sqlite`
- `false` uses `user_data/tradesv3-live.sqlite`

Do not commit `user_data/config.json`; it contains local secrets.
