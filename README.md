# Crypto Quant

加密货币量化交易系统 **V0.0.4**（`VERSION` 与 `/health` 同源）：Python 全栈（FastAPI），币安**现货 / U 本位合约测试网**，策略意图与交易适配器隔离；PostgreSQL（Timescale 镜像）+ Redis；后台八大模块 + RBAC；K 线入库、策略扩展、回测与告警等（迁移 `002`）。

产研方案（终稿）：[docs/产研方案.md](docs/产研方案.md)。

## 环境要求

- **Python 3.9+**（推荐 3.11）
- **Docker Desktop**（用于 Postgres + Redis）
- 可选：**Node.js 20+**（仅在使用 `frontend/` React 源码构建时）

## 一键本地启动

```bash
cd /path/to/crypto-quant
cp .env.example .env
# 编辑 .env：填入币安测试网 BINANCE_API_KEY / BINANCE_API_SECRET

./scripts/start-local.sh
```

脚本会：`docker compose up -d` → Alembic 迁移 →（若存在 npm）构建前端 → 启动 Uvicorn。

## 访问地址（验收）

| 用途 | URL |
|------|-----|
| **后台界面（默认内置单页）** | **http://localhost:8000/app/** |
| API 文档 | http://localhost:8000/docs |
| 健康检查 | http://localhost:8000/health |

默认超级管理员（仅本地调试）：用户名 **`admin`**，密码 **`123456`**（见方案文档）。

## 手动启动（与脚本等价）

```bash
docker compose up -d
export SYNC_DATABASE_URL=postgresql://crypto:crypto@localhost:5432/crypto_quant
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

内置后台静态资源位于 `backend/app/static/frontend/`（Vanilla JS + TradingView Lightweight Charts CDN，**无需 Node 即可访问**）。

若使用 `frontend/` 的 React 工程构建，默认输出到 `backend/app/static/react-spa/`，需在 `app/main.py` 中自行改挂载路径（避免覆盖内置 UI）。

## 目录说明

- `backend/`：FastAPI 应用（`data` / `strategy` / `trading` 模块划分）
- `backend/app/static/frontend/`：默认后台 UI
- `frontend/`：可选 React + Ant Design 源码
- `docker-compose.yml`：PostgreSQL（TimescaleDB 镜像）、Redis
- `.env.example`：环境变量模板（**勿提交真实密钥**）

## Git 与发版约定

- 根目录维护 **`VERSION`** 文本文件，与**当前已口头验收**的发布版本号一致（现为 `0.0.4`）。**未验收前不得改为下一正式号**（如 `0.0.5`）。

### 开发检查点标签（每轮新开发，`-dev`）

- 每完成一批新功能或一轮迭代，由负责人在本机打一个**开发快照标签**，格式：**`v<目标正式版>-dev.N`**，例如朝 **V0.0.5** 推进时：`v0.0.5-dev.1`、`v0.0.5-dev.2`…（`N` 递增；**不要**提前改 `VERSION`）。
- 示例（仅打标签，不改 `VERSION`）：

```bash
git add -A && git commit -m "feat: …"   # 若有改动
git tag -a v0.0.5-dev.1 -m "开发检查点：…（待验收 V0.0.5）"
git push origin v0.0.5-dev.1            # 按需
```

### 正式版标签（仅验收后）

- 仅当负责人明确说 **「VX.Y.Z 验收通过」** 时：
  1. 将 **`VERSION`** 改为对应号（如 `0.0.5`）；
  2. 提交并打 **`v0.0.5`**。

一键脚本（会提交当前改动并打标签，适用于**正式验收**场景）：

```bash
chmod +x scripts/git-tag-release.sh
./scripts/git-tag-release.sh v0.0.4 "V0.0.4 验收通过"
# V0.0.5 验收通过后：先编辑 VERSION 为 0.0.5，再：
# ./scripts/git-tag-release.sh v0.0.5 "V0.0.5 验收通过"
```

首次若尚未 `git init`，脚本会初始化并把默认分支设为 `main`。远程仓库按需添加：`git remote add origin <URL>` 后 `git push -u origin main` 与 `git push origin v0.0.x`。

与 AI 协作节奏约定：**每轮开发结束 → 打开发标签 `v0.0.x-dev.N`（x 为下一正式版号）；你说某正式版验收通过 → 再改 `VERSION` 并打 `v0.0.x`。**

## 版本状态

**V0.0.4**（**当前登记版本**，见 `VERSION`）：八大模块功能化——概览（行情/统计/告警摘要）、资产（交易所余额与快照）、实盘（下单与持仓）、图表（K 线 + Lightweight Charts + 入库同步）、策略（双均线 / RSI / 布林带、启停、日志、回测与历史）、风控（全局限额 + 告警规则/事件）、系统（DB/Redis/交易所探测与审计日志）、账号（激活/停用/重置密码）。数据库迁移 `002`：`klines`、`portfolio_snapshots`、`strategy_logs`、`alert_*`、`backtest_runs` 等。

**V0.0.3**：历史——登录 / 首次改密 Figma 风格、暗色主题后台壳层。

**V0.0.2**：历史——站点 favicon；版本号与 `VERSION` 对齐。

**V0.0.1**：历史基线——本地闭环、测试网适配、后台模块与 RBAC。
