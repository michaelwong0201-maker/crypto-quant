const API = "/api";
const LS = "cq_token";
const LS_REMEMBER_USER = "cq_remember_username";

let token = localStorage.getItem(LS);
let me = null;
let route = "dashboard";

/* ---------- Helpers ---------- */
function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function setToken(t) { token = t; t ? localStorage.setItem(LS, t) : localStorage.removeItem(LS); }
function fmtNum(n, d = 2) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtTs(ts) { return fmtTime(new Date(ts * 1000).toISOString()); }
function sideBadge(s) { return s === "BUY" ? '<span class="badge badge--green">BUY</span>' : '<span class="badge badge--red">SELL</span>'; }
function statusBadge(s) {
  if (s === "submitted") return '<span class="badge badge--green">成功</span>';
  if (s === "failed") return '<span class="badge badge--red">失败</span>';
  if (s === "running" || s === "completed") return `<span class="badge badge--green">${s}</span>`;
  return `<span class="badge badge--muted">${s}</span>`;
}
function pctClass(v) { return v >= 0 ? "text-green" : "text-red"; }
function pctStr(v) { return (v >= 0 ? "+" : "") + fmtNum(v) + "%"; }

/* ---------- Error handling ---------- */
const ERROR_MAP = {
  "Invalid credentials": "账号或密码错误，请重试",
  "Not authenticated": "登录已过期，请重新登录",
  "Invalid token": "登录已过期，请重新登录",
  "User not found": "用户不存在或已停用",
  "Current password incorrect": "当前密码错误",
  "You must change your password before using this feature": "请先修改密码后再使用此功能",
  "Insufficient permissions": "权限不足",
};
function friendlyMsg(raw, s) {
  if (ERROR_MAP[raw]) return ERROR_MAP[raw];
  if (s === 422) return "请检查输入参数";
  return raw || "请求异常，请刷新页面后重试";
}
class ApiError extends Error { constructor(m, s, d) { super(m); this.status = s; this.detail = d; } }

async function apiFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body && !(opts.body instanceof FormData) && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let r;
  try { r = await fetch(API + path, { ...opts, headers }); } catch { throw new ApiError("网络异常，请检查连接后重试", 0, null); }
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (r.status === 401) { setToken(null); me = null; const d = data?.detail; throw new ApiError(friendlyMsg(d, 401), 401, d); }
  if (!r.ok) {
    const d = data?.detail;
    let raw = typeof d === "string" ? d : Array.isArray(d) ? d.map(x => x.msg || JSON.stringify(x)).join("; ") : d ? JSON.stringify(d) : r.statusText;
    throw new ApiError(friendlyMsg(raw, r.status), r.status, d);
  }
  return data;
}

let _toastTimer = null;
function showToast(msg) {
  let t = document.getElementById("global-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "global-toast";
    t.className = "global-toast";
    document.body.appendChild(t);
  }
  if (_toastTimer) clearTimeout(_toastTimer);
  t.textContent = msg;
  t.classList.add("global-toast--show");
  _toastTimer = setTimeout(() => { t.classList.remove("global-toast--show"); _toastTimer = null; }, 3000);
}
function showAuthError(_el, msg) { showToast(msg); }

/* ---------- Routing ---------- */
function parseHash() { route = (location.hash || "#/dashboard").replace(/^#\//, "").split("/")[0] || "dashboard"; }
addEventListener("hashchange", () => { parseHash(); render(); });

async function loadMe() {
  if (!token) { me = null; return; }
  try { me = await apiFetch("/auth/me"); } catch { me = null; }
}

/* ---------- Menu ---------- */
const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  assets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-3"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>',
  trading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  charts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  strategies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
  risk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};
const LABELS = { dashboard: "概览", assets: "资产收益", trading: "实盘交易", charts: "数据图表", strategies: "策略引擎", risk: "风控配置", system: "系统监控", users: "账号管理" };
function navLink(h, l) { return `<a class="${route === h ? 'active' : ''}" href="#/${h}">${ICONS[h] || ''}<span>${l}</span></a>`; }

/* ==================== LOGIN ==================== */
const AUTH_BG_IMG_HTML = '<img class="auth-page__bg-img" src="./login-bg.png" srcset="./login-bg.png 1024w, ./login-bg@2x.png 2048w, ./login-bg@4k.png 3840w" sizes="100vw" alt="" decoding="async" fetchpriority="high" />';

function initLoginVideoBg(container) {
  const video = document.createElement("video");
  video.className = "auth-page__bg-video";
  video.src = "./login-bg.mp4";
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("playsinline", "");
  video.oncanplaythrough = () => {
    video.play().then(() => {
      video.classList.add("auth-page__bg-video--ready");
    }).catch(() => {});
  };
  container.appendChild(video);
}

async function renderLogin(root) {
  root.innerHTML = "";
  const w = el(`<div class="auth-page">
    ${AUTH_BG_IMG_HTML}
    <div class="auth-page__brand"><img src="./planet-logo-white.png" width="36" height="36" alt=""/><span>黑洞量化</span></div>
    <div class="auth-login-box">
      <form id="lf">
        <div style="display:flex;flex-direction:column;gap:16px">
          <input class="auth-input" id="auth-user" name="username" type="text" autocomplete="username" placeholder="请输入账户"/>
          <input class="auth-input" id="auth-pass" name="password" type="password" autocomplete="current-password" placeholder="请输入密码"/>
          <button class="auth-submit" id="lb" type="submit">登录</button>
        </div>
      </form>
    </div>
  </div>`);
  root.appendChild(w);
  initLoginVideoBg(w);
  const form = w.querySelector("#lf"), btn = w.querySelector("#lb");
  const uIn = w.querySelector("#auth-user");
  const saved = localStorage.getItem(LS_REMEMBER_USER);
  if (saved) { uIn.value = saved; }
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form), u = (fd.get("username")||"").trim(), p = fd.get("password")||"";
    if (!u) { showToast("请输入账户"); return; } if (!p) { showToast("请输入密码"); return; }
    btn.disabled = true; btn.textContent = "登录中…";
    try {
      const d = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ username: u, password: p }) });
      localStorage.setItem(LS_REMEMBER_USER, u);
      setToken(d.access_token); await loadMe();
      location.hash = d.must_change_password ? "#/change-password" : "#/dashboard"; render();
    } catch (err) { showToast(err.message); } finally { btn.disabled = false; btn.textContent = "登录"; }
  };
}

async function renderChangePassword(root) {
  root.innerHTML = "";
  const w = el(`<div class="auth-page auth-page--center">
    ${AUTH_BG_IMG_HTML}
    <div class="auth-page__brand"><img src="./planet-logo-white.png" width="36" height="36" alt=""/><span>黑洞量化</span></div>
    <div class="auth-center-box">
      <h2 class="auth-center-box__title">设置新密码</h2>
      <p class="auth-center-box__sub">首次登录须修改密码</p>
      <form id="cf">
        <div style="display:flex;flex-direction:column;gap:16px">
          <input class="auth-input" name="cur" type="password" autocomplete="current-password" placeholder="请输入当前密码"/>
          <input class="auth-input" name="n1" type="password" autocomplete="new-password" placeholder="新密码（至少 6 位）"/>
          <input class="auth-input" name="n2" type="password" autocomplete="new-password" placeholder="再次输入新密码"/>
          <button class="auth-submit" id="cb" type="submit">确认修改</button>
        </div>
      </form>
    </div>
  </div>`);
  root.appendChild(w);
  initLoginVideoBg(w);
  const form = w.querySelector("#cf"), btn = w.querySelector("#cb");
  form.onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(form);
    const c = fd.get("cur")||"", n1 = fd.get("n1")||"", n2 = fd.get("n2")||"";
    if (!c) { showToast("请输入当前密码"); return; }
    if (!n1 || n1.length < 6) { showToast("新密码至少需要 6 位"); return; }
    if (n1 !== n2) { showToast("两次输入的新密码不一致"); return; }
    btn.disabled = true; btn.textContent = "保存中…";
    try {
      await apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: c, new_password: n1 }) });
      await loadMe(); location.hash = "#/dashboard"; render();
    } catch (err) { showToast(err.message); } finally { btn.disabled = false; btn.textContent = "确认修改"; }
  };
}

/* ==================== MAIN LAYOUT ==================== */
async function renderMain(root) {
  const crumb = LABELS[route] || route;
  root.innerHTML = `<div class="layout">
    <header class="header"><div class="header__left"><h1>Crypto Quant</h1><div class="header__sep"></div><span class="header__crumb">${crumb}</span></div>
      <div class="header__right"><span class="user-name" id="who"></span><button id="lo">退出</button></div></header>
    <div class="body"><aside class="sider">${Object.entries(LABELS).map(([k,v]) => navLink(k,v)).join("")}</aside>
      <div class="main"><div class="content"><div id="pane"></div></div></div></div></div>`;
  root.querySelector("#who").textContent = me.username;
  root.querySelector("#lo").onclick = () => { setToken(null); me = null; location.hash = "#/login"; render(); };
  const pane = root.querySelector("#pane");
  pane.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
  try {
    const views = { dashboard: viewDashboard, assets: viewAssets, trading: viewTrading, charts: viewCharts, strategies: viewStrategies, risk: viewRisk, system: viewSystem, users: viewUsers };
    const fn = views[route];
    if (fn) await fn(pane); else pane.innerHTML = '<div class="card"><p class="muted">未知页面</p></div>';
  } catch (e) { pane.innerHTML = `<div class="card"><p class="error">${e.message}</p></div>`; }
}

/* ==================== 1. DASHBOARD ==================== */
async function viewDashboard(pane) {
  const d = await apiFetch("/dashboard/overview");
  const m = d.market || {};
  const s = d.trade_stats || {};
  const btc = m.btc_price !== "N/A" ? "$" + fmtNum(m.btc_price) : "N/A";
  const eth = m.eth_price !== "N/A" ? "$" + fmtNum(m.eth_price) : "N/A";

  pane.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card__label">BTC 价格</div><div class="stat-card__value">${btc}</div><div class="stat-card__sub">Binance Testnet</div></div>
      <div class="stat-card"><div class="stat-card__label">ETH 价格</div><div class="stat-card__value">${eth}</div><div class="stat-card__sub">Binance Testnet</div></div>
      <div class="stat-card"><div class="stat-card__label">总订单</div><div class="stat-card__value">${d.order_count}</div><div class="stat-card__sub">成功率 ${s.success_rate || 0}%</div></div>
      <div class="stat-card"><div class="stat-card__label">策略实例</div><div class="stat-card__value">${d.strategy_instance_count}</div><div class="stat-card__sub">${d.running_strategies} 运行中</div></div>
    </div>
    <div class="grid-2">
      <div class="card"><h2>最近订单</h2>
        <table><thead><tr><th>品种</th><th>方向</th><th>数量</th><th>状态</th><th>时间</th></tr></thead><tbody>
          ${d.recent_orders.length ? d.recent_orders.map(o => `<tr><td>${o.symbol}</td><td>${sideBadge(o.side)}</td><td>${o.quantity}</td><td>${statusBadge(o.status)}</td><td>${fmtTime(o.created_at)}</td></tr>`).join("") : '<tr><td colspan="5" class="empty-state">暂无订单</td></tr>'}
        </tbody></table>
      </div>
      <div class="card"><h2>交易统计</h2>
        <div class="stats-grid" style="margin-top:8px">
          <div class="stat-card"><div class="stat-card__label">买入</div><div class="stat-card__value text-green">${s.buy_orders || 0}</div></div>
          <div class="stat-card"><div class="stat-card__label">卖出</div><div class="stat-card__value text-red">${s.sell_orders || 0}</div></div>
          <div class="stat-card"><div class="stat-card__label">成功</div><div class="stat-card__value">${s.submitted || 0}</div></div>
          <div class="stat-card"><div class="stat-card__label">失败</div><div class="stat-card__value text-red">${s.failed || 0}</div></div>
        </div>
      </div>
    </div>
    ${d.recent_alerts.length ? `<div class="card"><h2>最近告警</h2><table><thead><tr><th>级别</th><th>标题</th><th>消息</th><th>时间</th></tr></thead><tbody>${d.recent_alerts.map(a => `<tr><td><span class="badge badge--${a.level === 'WARNING' ? 'yellow' : a.level === 'ERROR' ? 'red' : 'blue'}">${a.level}</span></td><td>${a.title}</td><td>${a.message}</td><td>${fmtTime(a.created_at)}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
}

/* ==================== 2. ASSETS ==================== */
async function viewAssets(pane) {
  pane.innerHTML = '<div class="loading"><div class="spinner"></div>加载资产数据...</div>';
  let summary, stats;
  try {
    [summary, stats] = await Promise.all([apiFetch("/assets/summary"), apiFetch("/assets/trade-stats")]);
  } catch (e) {
    pane.innerHTML = `<div class="card"><p class="error">${e.message}</p><p class="muted mt-12">请检查 .env 中 BINANCE_API_KEY 和 BINANCE_API_SECRET 配置</p></div>`;
    return;
  }
  const spot = summary.spot_balances || [];
  const fut = summary.futures_balances || [];
  const alloc = summary.allocations || [];

  pane.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card__label">总资产估值</div><div class="stat-card__value">$${fmtNum(summary.total_equity_estimate)}</div></div>
      <div class="stat-card"><div class="stat-card__label">现货资产</div><div class="stat-card__value">$${fmtNum(summary.spot_total_estimate)}</div></div>
      <div class="stat-card"><div class="stat-card__label">合约资产</div><div class="stat-card__value">$${fmtNum(summary.futures_total_estimate)}</div></div>
      <div class="stat-card ${summary.futures_unrealized_pnl >= 0 ? 'stat-card--green' : 'stat-card--red'}"><div class="stat-card__label">未实现盈亏</div><div class="stat-card__value">$${fmtNum(summary.futures_unrealized_pnl)}</div></div>
    </div>
    <div class="grid-2">
      <div class="card"><h2>现货持仓</h2>
        <table><thead><tr><th>资产</th><th>可用</th><th>冻结</th><th>合计</th></tr></thead><tbody>
          ${spot.length ? spot.map(b => { const t = (parseFloat(b.free||0) + parseFloat(b.locked||0)).toFixed(6); return `<tr><td><strong>${b.asset}</strong></td><td>${fmtNum(b.free, 6)}</td><td>${fmtNum(b.locked, 6)}</td><td>${t}</td></tr>`; }).join("") : '<tr><td colspan="4" class="empty-state">无持仓</td></tr>'}
        </tbody></table>
      </div>
      <div class="card"><h2>合约持仓</h2>
        <table><thead><tr><th>资产</th><th>余额</th><th>可用</th><th>未实现盈亏</th></tr></thead><tbody>
          ${fut.length ? fut.map(b => `<tr><td><strong>${b.asset}</strong></td><td>${fmtNum(b.balance, 6)}</td><td>${fmtNum(b.availableBalance, 6)}</td><td class="${parseFloat(b.crossUnPnl||0) >= 0 ? 'text-green' : 'text-red'}">${fmtNum(b.crossUnPnl, 6)}</td></tr>`).join("") : '<tr><td colspan="4" class="empty-state">无持仓</td></tr>'}
        </tbody></table>
      </div>
    </div>
    ${alloc.length ? `<div class="card"><h2>资产分布</h2><div class="stats-grid">${alloc.map(a => `<div class="stat-card"><div class="stat-card__label">${a.asset} (${a.type})</div><div class="stat-card__value">${fmtNum(a.amount, 4)}</div></div>`).join("")}</div></div>` : ""}
    <div class="card flex-between"><h2 style="margin:0">快照记录</h2><button class="sm primary" id="snap-btn">拍摄快照</button></div>`;
  pane.querySelector("#snap-btn").onclick = async () => {
    try { await apiFetch("/assets/snapshot", { method: "POST" }); alert("快照已保存"); } catch (e) { alert(e.message); }
  };
}

/* ==================== 3. TRADING ==================== */
async function viewTrading(pane) {
  pane.innerHTML = '<div class="loading"><div class="spinner"></div>加载交易数据...</div>';
  const [orders, positions] = await Promise.all([
    apiFetch("/trading/orders?limit=50"),
    apiFetch("/trading/positions").catch(() => ({ spot: [], futures: [] })),
  ]);

  pane.innerHTML = `
    <div class="card"><h2>下单</h2>
      <form id="tf" class="row">
        <div><label>交易对</label><input name="symbol" value="BTCUSDT" style="width:120px"/></div>
        <div><label>方向</label><select name="side"><option value="BUY">买入 (BUY)</option><option value="SELL">卖出 (SELL)</option></select></div>
        <div><label>数量</label><input name="quantity" placeholder="0.001" style="width:120px"/></div>
        <div><label>市场</label><select name="market_type"><option value="spot">现货</option><option value="futures_usdt">U本位合约</option></select></div>
        <button class="primary" type="submit" id="trade-btn">提交订单</button>
      </form>
      <div class="error" id="te" style="display:none"></div>
    </div>
    <div class="grid-2">
      <div class="card"><h2>现货持仓</h2>
        <table><thead><tr><th>资产</th><th>可用</th><th>冻结</th><th>合计</th></tr></thead><tbody>
          ${positions.spot.length ? positions.spot.map(p => `<tr><td><strong>${p.asset}</strong></td><td>${p.free}</td><td>${p.locked}</td><td>${p.total}</td></tr>`).join("") : '<tr><td colspan="4" class="empty-state">无持仓</td></tr>'}
        </tbody></table>
      </div>
      <div class="card"><h2>合约持仓</h2>
        <table><thead><tr><th>资产</th><th>余额</th><th>可用</th><th>未实现盈亏</th></tr></thead><tbody>
          ${positions.futures.length ? positions.futures.map(p => `<tr><td><strong>${p.asset}</strong></td><td>${p.balance}</td><td>${p.available}</td><td class="${parseFloat(p.unrealized_pnl) >= 0 ? 'text-green' : 'text-red'}">${p.unrealized_pnl}</td></tr>`).join("") : '<tr><td colspan="4" class="empty-state">无持仓</td></tr>'}
        </tbody></table>
      </div>
    </div>
    <div class="card"><h2>订单历史</h2>
      <table><thead><tr><th>ID</th><th>品种</th><th>方向</th><th>数量</th><th>市场</th><th>状态</th><th>交易所ID</th><th>时间</th></tr></thead><tbody>
        ${orders.length ? orders.map(o => `<tr><td>${o.id}</td><td>${o.symbol}</td><td>${sideBadge(o.side)}</td><td>${o.quantity}</td><td>${o.market_type === 'spot' ? '现货' : '合约'}</td><td>${statusBadge(o.status)}</td><td class="muted">${o.exchange_order_id || '-'}</td><td>${fmtTime(o.created_at)}</td></tr>`).join("") : '<tr><td colspan="8" class="empty-state">暂无订单</td></tr>'}
      </tbody></table>
    </div>`;

  const te = pane.querySelector("#te");
  pane.querySelector("#tf").onsubmit = async e => {
    e.preventDefault(); te.style.display = "none";
    const fd = new FormData(e.target), btn = pane.querySelector("#trade-btn");
    const qty = (fd.get("quantity")||"").trim();
    if (!qty) { te.textContent = "请输入数量"; te.style.display = "block"; return; }
    btn.disabled = true; btn.textContent = "提交中…";
    try {
      await apiFetch("/trading/orders", { method: "POST", body: JSON.stringify({ symbol: fd.get("symbol"), side: fd.get("side"), quantity: qty, market_type: fd.get("market_type") }) });
      await viewTrading(pane);
    } catch (err) { te.textContent = err.message; te.style.display = "block"; } finally { btn.disabled = false; btn.textContent = "提交订单"; }
  };
}

/* ==================== 4. CHARTS ==================== */
async function viewCharts(pane) {
  pane.innerHTML = `
    <div class="card">
      <div class="flex-between mb-16"><h2 style="margin:0">K线图表</h2>
        <form id="kf" class="flex gap-8" style="align-items:flex-end">
          <div><label>交易对</label><input name="symbol" value="BTCUSDT" style="width:110px"/></div>
          <div><label>周期</label><select name="interval">${["1m","5m","15m","30m","1h","4h","1d"].map(x => `<option ${x==='1h'?'selected':''}>${x}</option>`).join("")}</select></div>
          <div><label>市场</label><select name="market"><option value="spot">现货</option><option value="futures_usdt">合约</option></select></div>
          <div><label>条数</label><input name="limit" value="200" style="width:70px"/></div>
          <button class="primary sm" type="submit">查询</button>
        </form>
      </div>
      <div id="chart-container" class="chart-wrap"></div>
      <div id="chart-info" class="muted mt-12"></div>
    </div>
    <div class="card"><h2>数据同步</h2>
      <form id="sync-form" class="flex gap-8" style="align-items:flex-end">
        <div><label>交易对</label><input name="symbol" value="BTCUSDT" style="width:110px"/></div>
        <div><label>周期</label><select name="interval">${["1m","5m","15m","1h","4h","1d"].map(x => `<option ${x==='1h'?'selected':''}>${x}</option>`).join("")}</select></div>
        <div><label>市场</label><select name="market"><option value="spot">现货</option><option value="futures_usdt">合约</option></select></div>
        <button class="primary sm" type="submit">同步到数据库</button>
      </form>
      <div id="sync-result" class="muted mt-12"></div>
    </div>`;

  let chartInstance = null;

  async function loadChart(params) {
    const q = new URLSearchParams(params);
    const data = await apiFetch("/market/klines?" + q.toString());
    const container = pane.querySelector("#chart-container");
    container.innerHTML = "";

    if (typeof LightweightCharts !== "undefined" && data.data?.length > 0) {
      chartInstance = LightweightCharts.createChart(container, {
        width: container.clientWidth, height: 400,
        layout: { background: { type: "solid", color: "#111113" }, textColor: "#71717a", fontSize: 11 },
        grid: { vertLines: { color: "#1c1d20" }, horzLines: { color: "#1c1d20" } },
        crosshair: { mode: 0 },
        timeScale: { borderColor: "#232428", timeVisible: true },
        rightPriceScale: { borderColor: "#232428" },
      });
      const cs = chartInstance.addCandlestickSeries({
        upColor: "#22c55e", downColor: "#ef4444", borderDownColor: "#ef4444", borderUpColor: "#22c55e",
        wickDownColor: "#ef4444", wickUpColor: "#22c55e",
      });
      cs.setData(data.data.map(r => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close })));

      const vs = chartInstance.addHistogramSeries({
        priceFormat: { type: "volume" }, priceScaleId: "vol",
      });
      chartInstance.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      vs.setData(data.data.map(r => ({ time: r.time, value: r.volume, color: r.close >= r.open ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)" })));

      chartInstance.timeScale().fitContent();
      new ResizeObserver(() => { if (chartInstance) chartInstance.applyOptions({ width: container.clientWidth }); }).observe(container);
    } else {
      container.innerHTML = `<div class="empty-state">无法加载图表 (${data.data?.length || 0} 条数据)</div>`;
    }
    pane.querySelector("#chart-info").textContent = `${data.symbol} / ${data.interval} / ${data.market} — ${data.data?.length || 0} 条`;
  }

  pane.querySelector("#kf").onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    await loadChart({ symbol: fd.get("symbol"), interval: fd.get("interval"), market: fd.get("market"), limit: fd.get("limit") });
  };

  pane.querySelector("#sync-form").onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    try {
      const r = await apiFetch(`/market/klines/sync?symbol=${fd.get("symbol")}&interval=${fd.get("interval")}&market=${fd.get("market")}`, { method: "POST" });
      pane.querySelector("#sync-result").textContent = `已同步 ${r.synced} 条新数据`;
    } catch (err) { pane.querySelector("#sync-result").textContent = err.message; }
  };

  await loadChart({ symbol: "BTCUSDT", interval: "1h", market: "spot", limit: 200 });
}

/* ==================== 5. STRATEGIES ==================== */
async function viewStrategies(pane) {
  pane.innerHTML = '<div class="loading"><div class="spinner"></div>加载策略数据...</div>';
  const [catalog, instances, btHistory] = await Promise.all([
    apiFetch("/strategies/catalog"),
    apiFetch("/strategies"),
    apiFetch("/strategies/backtest/history?limit=10"),
  ]);

  let selectedKey = catalog[0]?.key || "simple_ma";

  function getFormFields(key) {
    const cat = catalog.find(c => c.key === key);
    const cfg = cat?.default_config || {};
    if (key === "simple_ma") return `
      <div><label>快线周期</label><input name="fast" type="number" value="${cfg.fast||7}" style="width:70px"/></div>
      <div><label>慢线周期</label><input name="slow" type="number" value="${cfg.slow||25}" style="width:70px"/></div>`;
    if (key === "rsi") return `
      <div><label>RSI周期</label><input name="period" type="number" value="${cfg.period||14}" style="width:70px"/></div>
      <div><label>超买线</label><input name="overbought" type="number" value="${cfg.overbought||70}" style="width:70px"/></div>
      <div><label>超卖线</label><input name="oversold" type="number" value="${cfg.oversold||30}" style="width:70px"/></div>`;
    if (key === "bollinger") return `
      <div><label>布林周期</label><input name="period" type="number" value="${cfg.period||20}" style="width:70px"/></div>
      <div><label>标准差倍数</label><input name="num_std" type="number" step="0.1" value="${cfg.num_std||2.0}" style="width:70px"/></div>`;
    return "";
  }

  pane.innerHTML = `
    <div class="card"><h2>创建策略实例</h2>
      <form id="sf">
        <div class="row">
          <div><label>策略类型</label><select name="strategy_key" id="sk">${catalog.map(c => `<option value="${c.key}">${c.name}</option>`).join("")}</select></div>
          <div><label>名称</label><input name="name" value="BTC 策略" style="width:140px"/></div>
          <div><label>交易对</label><input name="symbol" value="BTCUSDT" style="width:110px"/></div>
          <div><label>市场</label><select name="market_type"><option value="spot">现货</option><option value="futures_usdt">合约</option></select></div>
          <div><label>周期</label><input name="interval" value="1m" style="width:60px"/></div>
          <div><label>数量</label><input name="quantity" value="0.001" style="width:80px"/></div>
          <div><label>轮询(秒)</label><input name="poll_seconds" type="number" value="60" style="width:70px"/></div>
        </div>
        <div class="row" id="extra-fields">${getFormFields(selectedKey)}</div>
        <button class="primary" type="submit">创建策略</button>
      </form>
    </div>
    <div class="card"><h2>策略实例 (${instances.length})</h2>
      <table><thead><tr><th>ID</th><th>名称</th><th>类型</th><th>交易对</th><th>状态</th><th>操作</th></tr></thead><tbody id="stb">
        ${instances.length ? instances.map(r => `<tr>
          <td>${r.id}</td><td>${r.name}</td>
          <td><span class="badge badge--blue">${r.strategy_key}</span></td>
          <td>${r.config?.symbol || '-'}</td>
          <td>${r.running ? '<span class="badge badge--green">运行中</span>' : '<span class="badge badge--muted">已停止</span>'}</td>
          <td>
            ${r.running ? `<button class="sm danger" data-x="${r.id}">停止</button>` : `<button class="sm primary" data-s="${r.id}">启动</button>`}
            <button class="sm" data-log="${r.id}">日志</button>
            <button class="sm danger" data-del="${r.id}">删除</button>
          </td></tr>`).join("") : '<tr><td colspan="6" class="empty-state">暂无策略实例</td></tr>'}
      </tbody></table>
    </div>
    <div id="log-panel"></div>
    <div class="card"><h2>回测</h2>
      <form id="btf" class="row">
        <div><label>策略</label><select name="strategy_key">${catalog.map(c => `<option value="${c.key}">${c.name}</option>`).join("")}</select></div>
        <div><label>交易对</label><input name="symbol" value="BTCUSDT" style="width:110px"/></div>
        <div><label>周期</label><select name="interval">${["1m","5m","15m","1h","4h","1d"].map(x => `<option ${x==='1h'?'selected':''}>${x}</option>`).join("")}</select></div>
        <div><label>数据量</label><input name="limit" type="number" value="500" style="width:80px"/></div>
        <div><label>初始资金</label><input name="capital" type="number" value="10000" style="width:100px"/></div>
        <button class="primary" type="submit" id="bt-btn">运行回测</button>
      </form>
      <div id="bt-result"></div>
    </div>
    ${btHistory.length ? `<div class="card"><h2>回测历史</h2>
      <table><thead><tr><th>ID</th><th>策略</th><th>品种</th><th>周期</th><th>收益率</th><th>最大回撤</th><th>胜率</th><th>交易次数</th><th>时间</th></tr></thead><tbody>
        ${btHistory.map(r => `<tr><td>${r.id}</td><td><span class="badge badge--blue">${r.strategy_key}</span></td><td>${r.symbol}</td><td>${r.interval}</td>
          <td class="${pctClass(r.total_return_pct)}">${pctStr(r.total_return_pct)}</td>
          <td class="text-red">${fmtNum(r.max_drawdown_pct)}%</td>
          <td>${fmtNum(r.win_rate, 1)}%</td><td>${r.total_trades}</td><td>${fmtTime(r.created_at)}</td></tr>`).join("")}
      </tbody></table></div>` : ""}`;

  // Strategy type change
  pane.querySelector("#sk").onchange = e => {
    selectedKey = e.target.value;
    pane.querySelector("#extra-fields").innerHTML = getFormFields(selectedKey);
  };

  // Create
  pane.querySelector("#sf").onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    const key = fd.get("strategy_key");
    const config = { symbol: fd.get("symbol"), market_type: fd.get("market_type"), interval: fd.get("interval"), quantity: fd.get("quantity"), poll_seconds: Number(fd.get("poll_seconds")) };
    if (key === "simple_ma") { config.fast = Number(fd.get("fast")); config.slow = Number(fd.get("slow")); }
    if (key === "rsi") { config.period = Number(fd.get("period")); config.overbought = Number(fd.get("overbought")); config.oversold = Number(fd.get("oversold")); }
    if (key === "bollinger") { config.period = Number(fd.get("period")); config.num_std = Number(fd.get("num_std")); }
    try { await apiFetch("/strategies", { method: "POST", body: JSON.stringify({ name: fd.get("name"), strategy_key: key, config }) }); await viewStrategies(pane); } catch (err) { alert(err.message); }
  };

  // Instance actions
  pane.querySelector("#stb").onclick = async ev => {
    const t = ev.target;
    try {
      if (t.dataset.s) { await apiFetch(`/strategies/${t.dataset.s}/start`, { method: "POST" }); await viewStrategies(pane); }
      if (t.dataset.x) { await apiFetch(`/strategies/${t.dataset.x}/stop`, { method: "POST" }); await viewStrategies(pane); }
      if (t.dataset.del) { if (confirm("确认删除此策略？")) { await apiFetch(`/strategies/${t.dataset.del}`, { method: "DELETE" }); await viewStrategies(pane); } }
      if (t.dataset.log) {
        const logs = await apiFetch(`/strategies/${t.dataset.log}/logs?limit=20`);
        pane.querySelector("#log-panel").innerHTML = `<div class="card"><h2>策略日志 #${t.dataset.log}</h2>
          <table><thead><tr><th>级别</th><th>消息</th><th>时间</th></tr></thead><tbody>
            ${logs.length ? logs.map(l => `<tr><td><span class="badge badge--${l.level === 'ERROR' ? 'red' : l.level === 'WARNING' ? 'yellow' : 'blue'}">${l.level}</span></td><td>${l.message}</td><td>${fmtTime(l.created_at)}</td></tr>`).join("") : '<tr><td colspan="3" class="empty-state">暂无日志</td></tr>'}
          </tbody></table></div>`;
      }
    } catch (e) { alert(e.message); }
  };

  // Backtest
  pane.querySelector("#btf").onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    const btn = pane.querySelector("#bt-btn"); btn.disabled = true; btn.textContent = "运行中…";
    const res = pane.querySelector("#bt-result");
    try {
      const r = await apiFetch("/strategies/backtest", { method: "POST", body: JSON.stringify({
        strategy_key: fd.get("strategy_key"), symbol: fd.get("symbol"), interval: fd.get("interval"),
        limit: Number(fd.get("limit")), initial_capital: Number(fd.get("capital")), config: {},
      }) });
      res.innerHTML = `
        <div class="stats-grid mt-16">
          <div class="stat-card"><div class="stat-card__label">初始资金</div><div class="stat-card__value">$${fmtNum(r.initial_capital)}</div></div>
          <div class="stat-card"><div class="stat-card__label">最终资金</div><div class="stat-card__value">$${fmtNum(r.final_capital)}</div></div>
          <div class="stat-card ${r.total_return_pct >= 0 ? 'stat-card--green' : 'stat-card--red'}"><div class="stat-card__label">收益率</div><div class="stat-card__value">${pctStr(r.total_return_pct)}</div></div>
          <div class="stat-card stat-card--red"><div class="stat-card__label">最大回撤</div><div class="stat-card__value">${fmtNum(r.max_drawdown_pct)}%</div></div>
          <div class="stat-card"><div class="stat-card__label">胜率</div><div class="stat-card__value">${fmtNum(r.win_rate, 1)}%</div></div>
          <div class="stat-card"><div class="stat-card__label">交易次数</div><div class="stat-card__value">${r.total_trades}</div></div>
        </div>
        <div class="chart-wrap chart-wrap--sm mt-16" id="bt-chart"></div>
        ${r.trades?.length ? `<div class="mt-16"><h3>交易明细 (最近 ${r.trades.length} 笔)</h3>
          <table><thead><tr><th>时间</th><th>方向</th><th>价格</th><th>数量</th><th>盈亏</th></tr></thead><tbody>
            ${r.trades.map(t => `<tr><td>${fmtTs(t.time)}</td><td>${sideBadge(t.side)}</td><td>$${fmtNum(t.price)}</td><td>${fmtNum(t.qty, 6)}</td><td class="${(t.pnl||0) >= 0 ? 'text-green' : 'text-red'}">${t.pnl != null ? '$' + fmtNum(t.pnl) : '-'}</td></tr>`).join("")}
          </tbody></table></div>` : ""}`;

      // Equity curve chart
      if (r.equity_curve?.length > 1 && typeof LightweightCharts !== "undefined") {
        const cc = pane.querySelector("#bt-chart");
        const chart = LightweightCharts.createChart(cc, {
          width: cc.clientWidth, height: 250,
          layout: { background: { type: "solid", color: "#111113" }, textColor: "#71717a", fontSize: 11 },
          grid: { vertLines: { color: "#1c1d20" }, horzLines: { color: "#1c1d20" } },
          timeScale: { borderColor: "#232428", timeVisible: true }, rightPriceScale: { borderColor: "#232428" },
        });
        const ls = chart.addLineSeries({ color: "#3b82f6", lineWidth: 2 });
        ls.setData(r.equity_curve.map(p => ({ time: p.time, value: p.equity })));
        chart.timeScale().fitContent();
        new ResizeObserver(() => chart.applyOptions({ width: cc.clientWidth })).observe(cc);
      }
    } catch (err) { res.innerHTML = `<p class="error mt-12">${err.message}</p>`; } finally { btn.disabled = false; btn.textContent = "运行回测"; }
  };
}

/* ==================== 6. RISK ==================== */
async function viewRisk(pane) {
  pane.innerHTML = '<div class="loading"><div class="spinner"></div>加载风控配置...</div>';
  const [rs, rules, events] = await Promise.all([
    apiFetch("/risk/settings"),
    apiFetch("/risk/alerts/rules").catch(() => []),
    apiFetch("/risk/alerts/events?limit=30").catch(() => []),
  ]);
  const can = me.role === "admin" || me.role === "operator";

  pane.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card__label">交易开关</div><div class="stat-card__value">${rs.trading_enabled ? '<span class="dot dot--green"></span>已启用' : '<span class="dot dot--red"></span>已禁用'}</div></div>
      <div class="stat-card"><div class="stat-card__label">单笔最大名义值</div><div class="stat-card__value">$${fmtNum(rs.max_order_notional_usd)}</div></div>
    </div>
    ${can ? `<div class="card"><h2>风控设置</h2>
      <form id="rf" class="row">
        <div><label><input type="checkbox" name="trading_enabled" ${rs.trading_enabled ? "checked" : ""}/> 允许交易</label></div>
        <div><label>单笔最大名义(USD)</label><input name="max" type="number" step="0.01" value="${Number(rs.max_order_notional_usd)}" style="width:140px"/></div>
        <button class="primary sm" type="submit">保存</button>
      </form></div>` : '<div class="card"><p class="muted">当前角色无法修改风控配置</p></div>'}
    <div class="card"><h2>告警规则</h2>
      ${can ? `<form id="arf" class="row mb-12">
        <div><label>名称</label><input name="name" placeholder="规则名称" style="width:140px"/></div>
        <div><label>类型</label><select name="rule_type"><option value="price_alert">价格告警</option><option value="drawdown">回撤告警</option><option value="position_limit">仓位限额</option></select></div>
        <button class="primary sm" type="submit">添加规则</button>
      </form>` : ""}
      <table><thead><tr><th>ID</th><th>名称</th><th>类型</th><th>状态</th><th>创建时间</th>${can ? '<th>操作</th>' : ''}</tr></thead><tbody>
        ${rules.length ? rules.map(r => `<tr><td>${r.id}</td><td>${r.name}</td><td><span class="badge badge--blue">${r.rule_type}</span></td><td>${r.enabled ? '<span class="badge badge--green">启用</span>' : '<span class="badge badge--muted">禁用</span>'}</td><td>${fmtTime(r.created_at)}</td>${can ? `<td><button class="sm danger" data-dr="${r.id}">删除</button></td>` : ''}</tr>`).join("") : `<tr><td colspan="${can ? 6 : 5}" class="empty-state">暂无告警规则</td></tr>`}
      </tbody></table>
    </div>
    <div class="card"><h2>告警事件</h2>
      <table><thead><tr><th>级别</th><th>标题</th><th>消息</th><th>状态</th><th>时间</th><th>操作</th></tr></thead><tbody>
        ${events.length ? events.map(e => `<tr><td><span class="badge badge--${e.level === 'ERROR' ? 'red' : e.level === 'WARNING' ? 'yellow' : 'blue'}">${e.level}</span></td><td>${e.title}</td><td>${e.message}</td><td>${e.acknowledged ? '<span class="badge badge--muted">已读</span>' : '<span class="badge badge--yellow">未读</span>'}</td><td>${fmtTime(e.created_at)}</td><td>${!e.acknowledged ? `<button class="sm" data-ack="${e.id}">标记已读</button>` : ''}</td></tr>`).join("") : '<tr><td colspan="6" class="empty-state">暂无告警事件</td></tr>'}
      </tbody></table>
    </div>`;

  if (can) {
    pane.querySelector("#rf")?.addEventListener("submit", async e => {
      e.preventDefault(); const f = e.target;
      await apiFetch("/risk/settings", { method: "PUT", body: JSON.stringify({ trading_enabled: f.querySelector('[name="trading_enabled"]').checked, max_order_notional_usd: Number(f.querySelector('[name="max"]').value) }) });
      await viewRisk(pane);
    });
    pane.querySelector("#arf")?.addEventListener("submit", async e => {
      e.preventDefault(); const fd = new FormData(e.target);
      await apiFetch("/risk/alerts/rules", { method: "POST", body: JSON.stringify({ name: fd.get("name"), rule_type: fd.get("rule_type"), config: {} }) });
      await viewRisk(pane);
    });
  }
  pane.addEventListener("click", async ev => {
    if (ev.target.dataset.dr) { if (confirm("确认删除？")) { await apiFetch(`/risk/alerts/rules/${ev.target.dataset.dr}`, { method: "DELETE" }); await viewRisk(pane); } }
    if (ev.target.dataset.ack) { await apiFetch(`/risk/alerts/events/${ev.target.dataset.ack}/ack`, { method: "POST" }); await viewRisk(pane); }
  });
}

/* ==================== 7. SYSTEM ==================== */
async function viewSystem(pane) {
  pane.innerHTML = '<div class="loading"><div class="spinner"></div>检查系统状态...</div>';
  const [status, logs] = await Promise.all([
    apiFetch("/system/status"),
    apiFetch("/system/audit-logs?limit=30").catch(() => []),
  ]);

  const db = status.database || {};
  const rd = status.redis || {};
  const ex = status.exchange || {};
  const st = status.strategies || {};

  pane.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card__label">版本</div><div class="stat-card__value">${status.version || '-'}</div><div class="stat-card__sub">${status.app_env || ''}</div></div>
      <div class="stat-card"><div class="stat-card__label">Python</div><div class="stat-card__value">${status.python_version || '-'}</div><div class="stat-card__sub">${status.platform || ''}</div></div>
      <div class="stat-card"><div class="stat-card__label">策略引擎</div><div class="stat-card__value">${st.running || 0} / ${st.total_instances || 0}</div><div class="stat-card__sub">运行 / 总数</div></div>
      <div class="stat-card"><div class="stat-card__label">订单总数</div><div class="stat-card__value">${status.orders?.total || 0}</div></div>
    </div>
    <div class="grid-3">
      <div class="card">
        <h2><span class="dot dot--${db.connected ? 'green' : 'red'}"></span>PostgreSQL</h2>
        <p>${db.connected ? `连接正常 · ${db.latency_ms}ms` : '连接失败'}</p>
      </div>
      <div class="card">
        <h2><span class="dot dot--${rd.connected ? 'green' : 'red'}"></span>Redis</h2>
        <p>${rd.connected ? `连接正常 · ${rd.latency_ms}ms` : '连接失败'}</p>
      </div>
      <div class="card">
        <h2><span class="dot dot--${ex.configured ? (ex.spot_public ? 'green' : 'yellow') : 'red'}"></span>Binance</h2>
        <p>${ex.configured ? (ex.spot_public ? '已连接' : '密钥已配置但连通异常') : '未配置 API 密钥'}</p>
      </div>
    </div>
    <div class="card"><h2>服务器时间</h2><p>${status.server_time || '-'}</p></div>
    <div class="card"><h2>审计日志</h2>
      <table><thead><tr><th>ID</th><th>用户ID</th><th>操作</th><th>详情</th><th>时间</th></tr></thead><tbody>
        ${logs.length ? logs.map(l => `<tr><td>${l.id}</td><td>${l.user_id || '-'}</td><td><span class="badge badge--blue">${l.action}</span></td><td class="muted">${l.detail ? JSON.stringify(l.detail) : '-'}</td><td>${fmtTime(l.created_at)}</td></tr>`).join("") : '<tr><td colspan="5" class="empty-state">暂无审计日志</td></tr>'}
      </tbody></table>
    </div>`;
}

/* ==================== 8. USERS ==================== */
async function viewUsers(pane) {
  if (me.role !== "admin") { pane.innerHTML = '<div class="card"><p class="muted">仅管理员可访问账号管理</p></div>'; return; }
  pane.innerHTML = '<div class="loading"><div class="spinner"></div>加载用户数据...</div>';
  const [users, logs] = await Promise.all([
    apiFetch("/users"),
    apiFetch("/users/audit-logs?limit=20").catch(() => []),
  ]);

  pane.innerHTML = `
    <div class="card"><h2>创建用户</h2>
      <form id="uf" class="row">
        <div><label>用户名</label><input name="username" placeholder="输入用户名" style="width:160px"/></div>
        <div><label>角色</label><select name="role"><option value="viewer">Viewer</option><option value="operator">Operator</option><option value="admin">Admin</option></select></div>
        <button class="primary" type="submit">创建</button>
      </form>
      <div id="up" class="mt-12" style="display:none"></div>
    </div>
    <div class="card"><h2>用户列表 (${users.length})</h2>
      <table><thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>状态</th><th>须改密</th><th>创建时间</th><th>操作</th></tr></thead><tbody>
        ${users.map(u => `<tr>
          <td>${u.id}</td><td><strong>${u.username}</strong></td>
          <td><span class="badge badge--${u.role === 'admin' ? 'blue' : u.role === 'operator' ? 'green' : 'muted'}">${u.role}</span></td>
          <td>${u.is_active ? '<span class="badge badge--green">活跃</span>' : '<span class="badge badge--red">停用</span>'}</td>
          <td>${u.must_change_password ? '<span class="badge badge--yellow">是</span>' : '-'}</td>
          <td>${fmtTime(u.created_at)}</td>
          <td>
            ${u.is_active ? `<button class="sm danger" data-deact="${u.id}">停用</button>` : `<button class="sm primary" data-act="${u.id}">激活</button>`}
            <button class="sm" data-reset="${u.id}">重置密码</button>
          </td></tr>`).join("")}
      </tbody></table>
    </div>
    <div class="card"><h2>操作日志</h2>
      <table><thead><tr><th>操作</th><th>用户ID</th><th>详情</th><th>时间</th></tr></thead><tbody>
        ${logs.length ? logs.map(l => `<tr><td><span class="badge badge--blue">${l.action}</span></td><td>${l.user_id || '-'}</td><td class="muted">${l.detail ? JSON.stringify(l.detail) : '-'}</td><td>${fmtTime(l.created_at)}</td></tr>`).join("") : '<tr><td colspan="4" class="empty-state">暂无日志</td></tr>'}
      </tbody></table>
    </div>`;

  pane.querySelector("#uf").onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    const un = (fd.get("username")||"").trim();
    if (!un) { alert("请输入用户名"); return; }
    try {
      const res = await apiFetch("/users", { method: "POST", body: JSON.stringify({ username: un, role: fd.get("role") }) });
      const up = pane.querySelector("#up");
      up.style.display = "block";
      up.innerHTML = `<div class="stat-card stat-card--green"><div class="stat-card__label">用户创建成功 · 初始密码（仅显示一次）</div><div class="stat-card__value" style="font-size:16px;font-family:monospace">${res.initial_password}</div></div>`;
      setTimeout(() => viewUsers(pane), 2000);
    } catch (err) { alert(err.message); }
  };

  pane.addEventListener("click", async ev => {
    const t = ev.target;
    try {
      if (t.dataset.deact) {
        if (confirm("确认停用此用户？")) { await apiFetch(`/users/${t.dataset.deact}/deactivate`, { method: "PATCH" }); await viewUsers(pane); }
      }
      if (t.dataset.act) { await apiFetch(`/users/${t.dataset.act}/activate`, { method: "PATCH" }); await viewUsers(pane); }
      if (t.dataset.reset) {
        if (confirm("确认重置密码？")) {
          const r = await apiFetch(`/users/${t.dataset.reset}/reset-password`, { method: "POST" });
          alert("新密码: " + r.new_password);
        }
      }
    } catch (e) { alert(e.message); }
  });
}

/* ==================== RENDER ==================== */
async function render() {
  parseHash();
  const root = document.getElementById("root");
  if (!token) { await renderLogin(root); return; }
  await loadMe();
  if (!me) { await renderLogin(root); return; }
  if (me.must_change_password && route !== "change-password") { location.hash = "#/change-password"; route = "change-password"; }
  if (route === "change-password") { await renderChangePassword(root); return; }
  if (route === "login") { location.hash = "#/dashboard"; route = "dashboard"; }
  await renderMain(root);
}

render();
