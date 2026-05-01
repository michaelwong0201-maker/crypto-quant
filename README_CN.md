# Freqtrade 本地部署说明

本目录是一个本地 Freqtrade Docker 部署，用于个人学习、回测和 Dry-run。

## 访问

- Web UI: http://127.0.0.1:8080
- 默认用户名: `freqtrader`
- 密码位置: `user_data/config.json` 里的 `api_server.password`

当前配置是 Dry-run，不会下真实订单。交易所 API key/secret 为空。

## 常用命令

在本目录执行：

```bash
docker compose up -d
docker compose down
docker compose logs -f freqtrade
docker compose ps
```

## Docker 环境（卸载 Docker Desktop 后）

本项目依赖 **Docker** 跑 `docker compose`。若本机已删除 Docker Desktop，可用 Homebrew 安装 **Colima + Docker CLI**（轻量，无需 Docker Desktop 订阅界面）：

```bash
HOMEBREW_NO_AUTO_UPDATE=1 brew install colima docker docker-compose
```

1. 配置 Compose 插件（本仓库已在本机写过一次 `~/.docker/config.json`，若你重装系统可手动补上）：

   - `cliPluginsExtraDirs`：`/opt/homebrew/lib/docker/cli-plugins`
   - `currentContext`：`colima`

2. 启动虚拟机（**首次**会下载 Lima 磁盘镜像，可能需要几分钟到十几分钟，需联网）：

   ```bash
   colima start
   ```

3. 确认 Docker 可用：

   ```bash
   docker info
   docker compose version
   ```

4. 在本目录启动 Freqtrade：

   ```bash
   cd /path/to/freqtrade-local
   docker compose up -d
   ```

开机后若 `docker` 报错，先执行 `colima start`（可将 `brew services start colima` 设为登录自启）。

**备选**：从 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) 安装官方桌面版；安装后把 `~/.docker/config.json` 里的 `currentContext` 改回 `desktop-linux`（或让 Docker Desktop 自己管理），并视情况删除上面的 `cliPluginsExtraDirs` 中与 Homebrew 重复的配置。

## 重要文件

- `docker-compose.yml`: Docker 启动配置
- `frequi_assets/installed/`: 本地覆盖的 FreqUI 静态资源，已注入简体中文文案脚本
- `frequi_assets/installed/zh-cn-runtime.js`: 简体中文页面文案运行时翻译脚本
- `user_data/config.json`: Freqtrade 配置，包含 Web UI 密码和未来可能的交易所密钥
- `user_data/strategies/sample_strategy.py`: 示例策略
- `user_data/data/`: 历史行情数据
- `user_data/logs/`: 运行日志
- `user_data/tradesv3.sqlite`: 本地交易记录数据库

## 当前安全设置

- `dry_run`: true
- `stake_currency`: USDT
- `stake_amount`: 100
- `max_open_trades`: 3
- 交易模式: 现货 spot
- 固定交易对: BTC/USDT, ETH/USDT, SOL/USDT
- `exchange.enable_ws`: false，本地学习阶段使用 REST，避免 WebSocket 网络噪音

实盘前必须重新检查配置、风控、交易所限制、API 权限和策略回测结果。

## 中文界面

当前 FreqUI 页面通过 Docker volume 覆盖静态资源实现简体中文化：

```yaml
./frequi_assets/installed:/freqtrade/freqtrade/rpc/api_server/ui/installed:ro
```

### 与官方升级共存（推荐生产用法）

官方镜像里的 FreqUI 是**已打包的静态资源**，升级 `freqtradeorg/freqtrade` 镜像时，若不保留覆盖层，界面会回到英文。

本仓库采用两层结构：

| 路径 | 作用 |
|------|------|
| `frequi_assets/overlay/zh-cn-runtime.js` | **中文文案源文件**（提交到 Git；日常只改这里） |
| `frequi_assets/installed/` | **实际挂载到容器的完整 UI**（可由脚本从镜像生成后再注入中文） |

**原则**：`docker-compose.yml` 里**始终保留**上述 volume；升级镜像后若 UI 资源有变，执行一次同步脚本即可。

### 从官方镜像刷新 FreqUI 并重新注入中文

在仓库根目录执行（需要 Docker；会 `docker pull` 指定镜像）：

```bash
./scripts/frequi-ui-refresh-from-image.sh
```

可选环境变量：

- `FREQTRADE_IMAGE`：默认 `freqtradeorg/freqtrade:stable`，与 `docker-compose.yml` 中 `image` 保持一致即可。
- `ZH_CN_RUNTIME_VERSION`：写入 `index.html` 里脚本 URL 的缓存版本号；不设置则用当前时间戳。

脚本会：备份当前 `frequi_assets/installed` → 从镜像复制官方 `installed` → 拷贝 `overlay/zh-cn-runtime.js` → 用 `scripts/inject_frequi_zh_index.py` 修补 `index.html`（`lang`、标题、`noscript`、加载翻译脚本）。

然后重启容器：

```bash
docker compose up -d --force-recreate
```

### 日常维护中文文案

1. 编辑 `frequi_assets/overlay/zh-cn-runtime.js`。
2. 复制到运行目录并刷新缓存版本（任选其一）：
   - 再跑一次 `./scripts/frequi-ui-refresh-from-image.sh`（会顺带对齐官方 UI，适合大版本升级），或
   - 手动：`cp frequi_assets/overlay/zh-cn-runtime.js frequi_assets/installed/`，并适当修改 `frequi_assets/installed/index.html` 里 `zh-cn-runtime.js?v=` 的版本号后重启。

### 浏览器缓存

如果浏览器仍显示英文或旧脚本，先强制刷新；仍不生效时给 URL 加一次缓存参数，例如：

```text
http://127.0.0.1:8080/?v=zh-cn
```
