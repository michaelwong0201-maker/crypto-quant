# PRD：加密货币实盘交易 V0.0.7（BTC 现货单向等差网格）

| 字段 | 内容 |
|------|------|
| 文档类型 | Product Requirements Document（PRD） |
| 产品 | Crypto Quant |
| 版本 | V0.0.7 |
| 状态 | Draft → Review → Approved（由负责人定稿） |
| 依据 | `加密货币实盘交易_V0.0.7_调研报告.docx`（2026-04-18） |
| 读者 | 产品负责人、后端/前端研发、Agent（Cursor Composer 2 Fast） |
| 机密 | 内部使用；禁止将 API Key、密钥设计写入版本库明文 |

---

## Skill 复用说明（文档骨架）

> **以后生成同类 PRD 时保留本节前 12 节结构；仅替换「元数据表、范围、需求 ID 明细、数据模型差异」。**

**必填元变量**：`version`、`iteration_goal`、`trading_pair`、`strategy_type`、`exchange_primary`、`exchange_fallback`、`risk_tier`、`api_base_path`（本仓库为 `/api`）、`frontend_modules_touched`。

---

## 1. 背景与问题陈述

### 1.1 背景

系统定位为**可投产的加密货币量化交易平台**。前端已划分 7 个模块（资产收益、实盘交易、数据图表、策略引擎、风控配置、系统监控、账号管理）；后端叙事为 3 大模块 9 子模块（数据 / 策略 / 交易）。**当前可稳定使用的仅为登录与账号管理**；核心交易链路尚未闭环。

### 1.2 要解决的问题

打通 **「行情进入系统 → 策略可解释运行 → 交易所可审计执行 → 前端可观测」** 的最小闭环，标的与市场范围刻意收窄以降低风险与复杂度。

### 1.3 成功标准（验收总纲）

1. **数据**：BTCUSDT 现货行情可持续接入；K 线可按多周期查询并展示；延迟与断连可观测。  
2. **策略**：可创建/启停 **现货单向等差网格** 策略实例；参数持久化；状态机行为符合本文档。  
3. **实盘**：策略触发后经风控校验可向交易所提交订单；订单状态与成交与交易所**可对账收敛**；前端可查看订单与核心持仓信息。  
4. **风控**：本文档 **§8 最小风控集** 全部实现且有自动化测试或脚本用例覆盖要点。

---

## 2. 目标与范围

### 2.1 产品目标（V0.0.7）

| ID | 目标描述 |
|----|-----------|
| G-01 | 实现 BTCUSDT **现货、无杠杆** 的自动化交易闭环 |
| G-02 | 策略形态：**单向等差网格**（Geometric 与多标的为后续迭代） |
| G-03 | **数据、策略、实盘、必要前端** 同步交付，避免「后端孤岛」 |
| G-04 | 架构上满足：**接入层 / 处理层 / 存储 / 策略运行时 / 执行层** 职责边界清晰，便于 V0.0.8+ 扩展 |

### 2.2 In Scope

- 行情：WebSocket + REST 补数；标准化字段；Redis 热数据；PostgreSQL（TimescaleDB 镜像）持久化 K 线。  
- 策略：策略注册、订阅行情、网格计算、状态持久化、与执行模块交互。  
- 执行：REST 下单/撤单；User Stream / execution 类事件驱动状态更新（见 §7）。  
- 前端：K 线多周期、策略配置+预览、实盘订单与基础持仓视图、关键操作确认。  
- 风控：§8 最小集。  
- 环境：**默认对接 Binance Spot Testnet 用于联调**；生产通过配置切换主网（同一套接口抽象，禁止硬编码环境）。

### 2.3 Out of Scope（明确不做）

- 合约、杠杆、借币、提币 API。  
- 多标的组合、跨所套利、高频做市。  
- 冷归档（S3/MinIO）与全量 Tick 永久留存。  
- 订单路由、多账户智能拆分。  
- 等比网格（UI 可预留，逻辑默认关闭）。

### 2.4 假设与依赖

- 交易所 API 可用；负责人提供 **测试网密钥** 与（可选）生产密钥流程。  
- 服务器时钟 NTP 同步（用于签名与 K 线对齐）。  
- 现有 **RBAC** 延续：交易与策略操作仅授权角色可用（沿用当前 `User`/权限模型，细节在实现阶段对齐现有表）。

---

## 3. 术语表

| 术语 | 定义 |
|------|------|
| 单向网格 | 本迭代定义为 **做多网格**：价格下跌触发买入、上涨触发卖出降仓；不对现货开「空」 |
| 等差网格 | 网格价为下界到上界的**等差**序列 |
| 信号时钟 | 以 **K 线收盘** 或 **限价挂单触及** 为触发源；须在策略实例元数据中可配置默认值 |
| clientOrderId | 客户端幂等键；重复提交不得产生重复有效订单 |
| 对账 | 周期性用交易所 REST 查询结果修正本地订单终态 |

---

## 4. 用户与权限（摘要）

| 角色 | 能力 |
|------|------|
| 管理员 | 全量配置、启停策略、查看审计日志 |
| 交易员/操作员 | 策略 CRUD、启停、查看订单与行情（与现有 `operator` 对齐，若需细分在实现任务中单列） |
| 只读 | 仅查看图表与订单（若有） |

**说明**：具体路由守卫与现有 `get_current_user` 对齐；PRD 要求**所有写操作**走鉴权。

---

## 5. 端到端业务流程

### 5.1 主流程（文字）

1. 数据采集服务建立交易所 WS，接收 BTCUSDT 行情事件；标准化后写入 **Redis**（最新行情+近期 K 线窗口）并 **异步/批量** 写入 **DB**（K 线表）。  
2. 前端订阅后端 WS 或轮询 REST 拉取 K 线（**优先 WS**；REST 为降级）。  
3. 用户创建网格策略实例，服务端校验参数并持久化，初始状态 `CREATED`。  
4. 用户「启动」→ 状态 `RUNNING`；引擎计算网格价位，按 **§6.2** 挂初始限价单（或先建底仓，由 `initMode` 决定）。  
5. 成交事件到达 → 更新本地订单状态 → 策略在相邻网格挂反向单 → 循环。  
6. 价格越界 / 风控触发 / 用户暂停 → 状态变更；暂停可配置是否撤单。

### 5.2 状态机（策略实例）

`CREATED` → `RUNNING` → (`PAUSED` ↔ `RUNNING`) → `STOPPED` | `ERROR`

- `ERROR`：须记录 `last_error_code`、`last_error_message`，并**禁止**自动恢复下单直至人工确认或显式「复位」接口（实现阶段定义）。

---

## 6. 功能需求

### 6.1 数据模块

| 需求 ID | 描述 | 验收标准（可测试） |
|---------|------|-------------------|
| FR-D-001 | 接入 **BTCUSDT 现货** 行情 WebSocket（主：**Binance**；架构预留备用源切换点） | 断网后按指数退避重连；重连成功写入事件日志或指标；30s 内可恢复或触发告警钩子 |
| FR-D-002 | REST **补历史 K 线** 与缺口修复 | 给定 `symbol,interval,start,end` 可拉取并 **upsert** DB；重复执行不产生重复主键 |
| FR-D-003 | **标准化字段** 与时间戳 UTC 毫秒 | DB 与 API 输出字段与调研报告 **§2.2.2** 一致（`quote_volume` 等若交易所未返回则存 NULL 并文档说明） |
| FR-D-004 | **Redis 热缓存**：最新 ticker/最近 N 根 K | 读取延迟满足策略单机部署 < 10ms（p95，同机）；键命名与 TTL 策略在 `docs/` 或代码注释中固定 |
| FR-D-005 | **TimescaleDB/PG** 持久化 K 线 | `(symbol, interval, market_type, open_time)` 唯一；支持按时间范围查询；迁移脚本纳入 Alembic |
| FR-D-006 | **数据质量**：异常跳变检测（如 ±5% 阈值可配置） | 触发时写 `alert_events` 或日志表，不在未确认情况下覆盖「明显错误」bar（策略可读上一有效 bar） |
| FR-D-007 | **内部广播**：处理后事件通知策略（Redis Pub/Sub 或等价） | 策略模块可订阅到「新 K 线收盘」事件；单元测试覆盖订阅契约 |

**API（与现有 `/api` 前缀对齐，路径可在实现时微调但须 OpenAPI 一致）**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/market/klines` | 历史/聚合查询（参数：`symbol,interval,limit,startTime,endTime,market`） |
| POST | `/api/market/klines/sync` | 保留/扩展：触发拉取并入库 |
| WS | `/api/ws/market` 或独立 `/ws/market` | 订阅实时 K 线/ ticker（实现选其一并在 README 标注） |

### 6.2 策略引擎（网格）

| 需求 ID | 描述 | 验收标准 |
|---------|------|----------|
| FR-S-001 | 策略类型注册：`GRID_SPOT_BTC_ARITH`（内部 key） | 后端常量与 DB `strategy_key` 可映射 |
| FR-S-002 | 参数模型与校验见 **§6.2.1** | Pydantic 校验 + 业务校验（上界>下界、gridCount 范围、最小名义金额） |
| FR-S-003 | **GridCalculator**：生成网格价数组 | 给定参数输出长度与单调性与公式一致；单测覆盖边界 |
| FR-S-004 | **订单意图**：仅通过 **OrderManager** 发往执行层 | 策略核心不直接 import HTTP 客户端 |
| FR-S-005 | **持久化**：策略实例、网格档位状态、已挂 order 映射 | 进程重启后可恢复 `RUNNING` 实例的网格与在途单（或安全进入 `PAUSED` 并要求人工确认，须在实现说明中选一种并写入 README） |
| FR-S-006 | **启停**：`start` / `pause` / `stop` | `stop` 支持 `cancelOrders: boolean`；所有迁移有审计记录 |

#### 6.2.1 参数 schema（与调研对齐）

| 字段 | 类型 | 规则 |
|------|------|------|
| upperPrice | Decimal | > lowerPrice；建议校验相对现价区间（警告非阻断） |
| lowerPrice | Decimal | < upperPrice |
| gridCount | int | 2–200，推荐默认 20 |
| amountPerGrid | Decimal | ≥ 交易所最小名义（测试网可配置 floor） |
| spacingMode | enum | 仅 `ARITHMETIC` |
| initMode | bool | true=尝试按规则建底仓 |
| stopLoss | Decimal? | 可选；若设须 < lowerPrice 或按产品约定 |
| memo | str | max 200 |

### 6.3 实盘交易（执行）

| 需求 ID | 描述 | 验收标准 |
|---------|------|----------|
| FR-T-001 | Binance Spot **签名 REST**：下单、撤单、查单、余额 | 集成测试在 testnet 跑通最小用例（可用 mock + 1 条真实 testnet 可选） |
| FR-T-002 | **User Data Stream**（listenKey + keepalive）处理 executionReport | 收到成交后本地订单状态 ≤ 2s 内更新（同机网络正常） |
| FR-T-003 | **clientOrderId** 幂等 | 重复提交不产生重复挂单；键格式 `cq_{strategyId}_{gridIndex}_{uuid}` 或等价可追踪格式 |
| FR-T-004 | **订单状态机** 与调研 **§4.2.1** 对齐 | 非法迁移拒绝；终态不可变 |
| FR-T-005 | **对账任务**：定时拉 `openOrders` / `allOrders` 修正漂移 | 可配置间隔；对账结果写日志 |
| FR-T-006 | **密钥**：环境变量或加密字段存储；禁止提交 `.env` | 代码审查 checklist |

**API**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/trading/...` | 在现有 trading 路由上扩展或新建 `orders` 子资源 |
| WS | `/api/ws/orders` | 推送订单增量（可选 Must：若前端来不及可做 Should） |

### 6.4 前端

| 需求 ID | 描述 | 验收标准 |
|---------|------|----------|
| FR-F-001 | **数据图表**：BTCUSDT，多周期 **1m–1d**（与后端约定集合一致） | 切换周期拉取正确 interval；显示最后更新时间 |
| FR-F-002 | **策略配置页**：表单 + **网格预览**（价位线列表或简易图） | 非法输入阻止提交；展示预估总占用（gridCount × amountPerGrid） |
| FR-F-003 | **策略列表/详情**：状态、启停按钮 | 启动二次确认；Testnet/Mainnet **环境标识**醒目 |
| FR-F-004 | **实盘页**：挂单、成交、简版持仓/余额 | 与后端字段一致；失败展示 `detail` |
| FR-F-005 | **紧急平仓**（若本期纳入 Must）：输入 `CONFIRM` | 市价卖出现货 BTC；仅管理员或指定角色 |

**说明**：具体页面路由对接现有 React 或内置 SPA 由实现任务决定；PRD 要求能力存在即可。

---

## 7. 非功能需求

| ID | 类别 | 要求 |
|----|------|------|
| NFR-001 | 安全 | API Key 最小权限；IP 白名单文档化；密钥轮换流程 |
| NFR-002 | 可靠性 | WS 断连期间 **§8** 禁止新下单；恢复后显式策略状态策略 |
| NFR-003 | 可观测 | Prometheus 指标：WS 状态、K 线 lag、下单成功率、拒单原因计数（可与现有系统监控模块对接） |
| NFR-004 | 性能 | 单策略 10 网格下 CPU/内存基线在 README 给出参考 |
| NFR-005 | 审计 | 策略参数变更、启停、紧急平仓全量审计 |

---

## 8. 风控（V0.0.7 最小集 · 必须实现）

| ID | 规则 | 行为 |
|----|------|------|
| R-001 | 单笔下单金额上限（默认 ≤ 账户估算权益 5%，可配置） | 超限拒单并记事件 |
| R-002 | 策略最大持仓：BTC 成本 ≤ 可用 USDT 的 80%（定义计算公式在实现文档中固定） | 超限拒单或暂停策略 |
| R-003 | 价格越出 [lower, upper] | **自动暂停** + 告警 |
| R-004 | 行情 WS 未连接 | 禁止新开仓/新挂单 |
| R-005 | 单策略 60s 内下单 ≤ 10 次 | 超限熔断该策略为 `PAUSED` |

---

## 9. 数据模型（增量摘要）

**新增/变更表（名称供评审，实现以 Alembic 为准）**

- `grid_strategies` 或扩展现有 `strategy_instances.config` JSON schema + `strategy_key`  
- `grid_levels`：`strategy_id, level_index, target_price, side, order_id_local, status`  
- `exchange_orders`：若与 `order_records` 重复则 **扩展** `order_records` 字段：`client_order_id`, `grid_level_id`, `exchange_status`  
- `market_data_health`（可选）：最后 tick 时间、重连次数  
- K 线表：在现有 `klines` 上 **增加列**（`quote_volume`, `trade_count`, `taker_buy_volume`, `is_closed`）或新表 `klines_v2`（二选一，迁移需零停机策略说明）

---

## 10. 测试与验收

### 10.1 测试层级

- **单元**：GridCalculator、状态机迁移、签名工具  
- **集成**：Testnet 下单→成交→回调→反向挂单（可用小额）  
- **前端**：表单校验、WS 降级为轮询  
- **对账**：模拟本地/交易所状态不一致时的收敛

### 10.2 上线前 Checklist

- [ ] 生产密钥未入库  
- [ ] Mainnet 开关与只读演练  
- [ ] 回滚方案：策略全停 + 撤单脚本  
- [ ] 负责人签署 PRD Approved

---

## 11. 里程碑（建议 4 周 · 可对齐调研）

| 周 | 交付 |
|----|------|
| W1 | FR-D-001–007 主干 + 前端 K 线 |
| W2 | FR-S-001–006 + 策略 UI |
| W3 | FR-T-001–005 + 订单 UI |
| W4 | §8 风控 + 全链路联调 + NFR |

---

## 12. 开放问题（须负责人拍板）

1. 进程模型：**单进程 asyncio** 还是 **采集/策略/执行** 分进程（V0.0.7 倾向单进程降低复杂度）。  
2. 策略恢复策略：重启后是 **自动 RUNNING** 还是 **强制 PAUSED**。  
3. 前端基线：优先 **React 工程** 还是 **内置 static SPA** 扩展。  
4. Testnet 与文档示例是否统一为 **Binance Spot Testnet**（与当前 `.env.example` 一致）。

---

## 附录 A：Composer / Agent 实现提示

- 优先阅读：`backend/app/main.py` 路由挂载、`docker-compose.yml`、现有 `order_records`、`klines` 迁移。  
- 新代码与现有 **BinanceTestnetConnector** 关系：**扩展抽象** `ExchangeSpotAdapter`，避免测试网/主网分叉两套业务逻辑。  
- 所有用户可见错误使用 **结构化 `detail`**，便于前端展示。  
- 禁止在 PR 中附带真实 Key。

---

## 附录 B：Skill「PRD 生成」输入模板（粘贴即用）

```yaml
prd_meta:
  version: V0.0.7
  title: BTC 现货单向等差网格闭环
  confidential: true
business:
  goal: 打通 行情-策略-实盘-前端观测
  in_scope: [数据WS+DB, 网格策略, 现货下单, 前端三屏, 风控五项]
  out_scope: [合约, 多标的, 冷存储]
roles: [管理员, 操作员]
integrations:
  exchange_primary: binance_spot
  testnet_default: true
risk: R-001..R-005
milestones_weeks: 4
```

---

*— PRD 结束 —*
