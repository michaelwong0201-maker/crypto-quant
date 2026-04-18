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
/** 避免 undefined/非数字在页面上显示成 NaN */
function fmtNumSafe(n, d = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return fmtNum(x, d);
}
function fmtTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}
function fmtTs(ts) { return fmtTime(new Date(ts * 1000).toISOString()); }
function sideBadge(s) { return s === "BUY" ? '<span class="badge badge--green">BUY</span>' : '<span class="badge badge--red">SELL</span>'; }
function statusBadge(s) {
  if (s === "submitted") return '<span class="badge badge--green">已提交</span>';
  if (s === "pending") return '<span class="badge badge--yellow">待报</span>';
  if (s === "open") return '<span class="badge badge--blue">挂单</span>';
  if (s === "partial") return '<span class="badge badge--yellow">部分成交</span>';
  if (s === "filled") return '<span class="badge badge--green">已成交</span>';
  if (s === "canceled") return '<span class="badge badge--muted">已撤销</span>';
  if (s === "rejected") return '<span class="badge badge--red">被拒</span>';
  if (s === "failed") return '<span class="badge badge--red">失败</span>';
  if (s === "running" || s === "completed") return `<span class="badge badge--green">${s}</span>`;
  return `<span class="badge badge--muted">${s}</span>`;
}
function streamDot(ok) {
  return ok ? '<span class="dot dot--green" title="正常"></span>' : '<span class="dot dot--red" title="异常"></span>';
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

const PAGE_SIZE = 10;
function buildPagerHTML(total, page) {
  const pages = Math.ceil(total / PAGE_SIZE) || 1;
  if (total <= PAGE_SIZE) return '';
  let btns = `<button class="pager__btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>&lsaquo;</button>`;
  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && i > 3 && i < pages - 2 && Math.abs(i - page) > 1) {
      if (i === 4 || i === pages - 3) btns += '<span style="color:var(--muted);padding:0 2px">…</span>';
      continue;
    }
    btns += `<button class="pager__btn${i === page ? ' pager__btn--active' : ''}" data-page="${i}">${i}</button>`;
  }
  btns += `<button class="pager__btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>&rsaquo;</button>`;
  return `<div class="pager"><span class="pager__info">共 ${total} 条</span><div class="pager__btns">${btns}</div></div>`;
}
function pageSlice(list, page) {
  const start = (page - 1) * PAGE_SIZE;
  return list.slice(start, start + PAGE_SIZE);
}

const MAX_TOASTS = 3;
function _getToastContainer() {
  let c = document.getElementById("toast-container");
  if (!c) { c = document.createElement("div"); c.id = "toast-container"; c.className = "toast-container"; document.body.appendChild(c); }
  return c;
}
const TOAST_ICONS = {
  success: '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
  warn: '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
  error: '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
};
function showToast(msg, type) {
  if (!type) type = "warn";
  const c = _getToastContainer();
  const item = document.createElement("div");
  item.className = "toast-item toast-" + type;
  item.innerHTML = '<span class="toast-icon">' + (TOAST_ICONS[type] || '') + '</span><span class="toast-msg">' + msg + '</span>';
  c.appendChild(item);
  requestAnimationFrame(() => requestAnimationFrame(() => item.classList.add("toast-item--show")));
  const dismiss = () => {
    item.classList.remove("toast-item--show");
    setTimeout(() => { if (item.parentNode) item.parentNode.removeChild(item); }, 260);
  };
  setTimeout(dismiss, 3000);
  while (c.children.length > MAX_TOASTS) {
    const oldest = c.children[0];
    oldest.classList.remove("toast-item--show");
    setTimeout(() => { if (oldest.parentNode) oldest.parentNode.removeChild(oldest); }, 260);
  }
}
function showAuthError(_el, msg) { showToast(msg, "error"); }

/* ---------- Global modals ---------- */
function _closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.remove());
}

function showConfirmModal(msg, onConfirm) {
  _closeAllModals();
  const overlay = el(`<div class="modal-overlay">
    <div class="modal-box">
      <p class="modal-msg">${msg}</p>
      <div class="modal-actions">
        <span class="modal-cancel" id="mc">取消</span>
        <button class="modal-confirm" id="mk">确认</button>
      </div>
    </div>
  </div>`);
  document.body.appendChild(overlay);
  overlay.querySelector("#mc").onclick = () => overlay.remove();
  overlay.querySelector("#mk").onclick = () => { overlay.remove(); onConfirm(); };
  overlay.addEventListener("mousedown", e => { if (e.target === overlay) overlay.remove(); });
}

function showChangePasswordModal() {
  _closeAllModals();
  const overlay = el(`<div class="modal-overlay">
    <div class="modal-box">
      <h3>修改密码</h3>
      <div>
        <div class="modal-field"><label>旧密码</label><input type="text" data-f="cur" class="mask-pwd" autocomplete="off" spellcheck="false" placeholder="请输入旧密码"/></div>
        <div class="modal-field"><label>新密码</label><input type="text" data-f="n1" class="mask-pwd" autocomplete="off" spellcheck="false" placeholder="请输入新密码"/></div>
        <div class="modal-field"><label>确认新密码</label><input type="text" data-f="n2" class="mask-pwd" autocomplete="off" spellcheck="false" placeholder="再次输入新密码"/></div>
        <div class="modal-actions">
          <span class="modal-cancel" id="mc">取消</span>
          <button class="modal-confirm" type="button" id="cpf-save">保存</button>
        </div>
      </div>
    </div>
  </div>`);
  document.body.appendChild(overlay);
  overlay.querySelector("#mc").onclick = () => overlay.remove();
  overlay.addEventListener("mousedown", e => { if (e.target === overlay) overlay.remove(); });
  const _v = f => (overlay.querySelector(`[data-f="${f}"]`)?.value || "").trim();
  overlay.querySelector("#cpf-save").onclick = async () => {
    const cur = _v("cur"), n1 = _v("n1"), n2 = _v("n2");
    if (!cur) { showToast("请输入旧密码"); return; }
    if (!n1) { showToast("请输入新密码"); return; }
    if (n1.length < 6) { showToast("新密码至少需要 6 位"); return; }
    if (n1 !== n2) { showToast("两次输入的新密码不一致"); return; }
    if (n1 === cur) { showToast("新密码不能与旧密码相同"); return; }
    const btn = overlay.querySelector("#cpf-save");
    btn.disabled = true; btn.textContent = "保存中…";
    try {
      await apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: cur, new_password: n1 }) });
      overlay.remove();
      showToast("密码修改成功", "success");
      await loadMe();
    } catch (err) { showToast(err.message, "error"); } finally { btn.disabled = false; btn.textContent = "保存"; }
  };
}

function doLogout() { setToken(null); me = null; location.hash = "#/login"; render(); }

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
  roles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  accounts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>',
};
const CHEVRON_DOWN = '<svg class="sider__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
const MENU_TREE = [
  { key: "dashboard", label: "概览" },
  { key: "assets", label: "资产收益" },
  { key: "trading", label: "实盘交易" },
  { key: "charts", label: "数据图表" },
  { key: "strategies", label: "策略引擎" },
  { key: "risk", label: "风控配置" },
  { key: "system", label: "系统监控" },
  { key: "users", label: "账号管理", children: [
    { key: "roles", label: "角色管理" },
    { key: "accounts", label: "创建账号" },
  ]},
];
const ALL_LABELS = {};
MENU_TREE.forEach(m => { ALL_LABELS[m.key] = m.label; if (m.children) m.children.forEach(c => { ALL_LABELS[c.key] = c.label; }); });
let _usersMenuOpen = false;

function buildSiderHTML(perms) {
  const p = perms || [];
  const hasPerm = k => !me || me.role === "admin" || p.includes(k);
  let html = "";
  for (const item of MENU_TREE) {
    if (item.children) {
      const visChildren = item.children.filter(c => hasPerm(c.key));
      if (visChildren.length === 0) continue;
      const isChildActive = visChildren.some(c => route === c.key);
      const open = _usersMenuOpen || isChildActive;
      html += `<div class="sider__group${open ? ' sider__group--open' : ''}" data-group="${item.key}">`;
      html += `<div class="sider__parent" data-label="${item.label}">${ICONS[item.key] || ''}<span>${item.label}</span>${CHEVRON_DOWN}</div>`;
      html += `<div class="sider__children">`;
      for (const ch of visChildren) {
        html += `<a class="${route === ch.key ? 'active' : ''} sider__child" href="#/${ch.key}" data-label="${ch.label}">${ICONS[ch.key] || ''}<span>${ch.label}</span></a>`;
      }
      html += `</div></div>`;
    } else {
      if (!hasPerm(item.key)) continue;
      html += `<a class="${route === item.key ? 'active' : ''}" href="#/${item.key}" data-label="${item.label}">${ICONS[item.key] || ''}<span>${item.label}</span></a>`;
    }
  }
  return html;
}

let _siderPopup = null;
let _siderPopupTimer = null;
function _hideSiderPopup() {
  _siderPopupTimer = setTimeout(() => { if (_siderPopup) _siderPopup.style.display = "none"; }, 120);
}
function _showSiderPopup(anchor, group) {
  clearTimeout(_siderPopupTimer);
  if (!_siderPopup) {
    _siderPopup = document.createElement("div");
    _siderPopup.className = "sider-popup";
    _siderPopup.addEventListener("mouseenter", () => clearTimeout(_siderPopupTimer));
    _siderPopup.addEventListener("mouseleave", _hideSiderPopup);
    document.body.appendChild(_siderPopup);
  }
  const children = group.querySelectorAll(".sider__children a");
  let html = "";
  children.forEach(a => { html += `<a class="sider-popup__item${a.classList.contains('active') ? ' active' : ''}" href="${a.getAttribute('href')}">${a.querySelector("span")?.textContent || ''}</a>`; });
  _siderPopup.innerHTML = html;
  const r = anchor.getBoundingClientRect();
  _siderPopup.style.left = r.right + 6 + "px";
  _siderPopup.style.top = r.top + "px";
  _siderPopup.style.display = "block";
  _siderPopup.querySelectorAll("a").forEach(a => a.addEventListener("click", () => { _siderPopup.style.display = "none"; }));
}

function bindSiderGroups(root) {
  root.querySelectorAll(".sider__parent").forEach(p => {
    p.addEventListener("click", () => {
      if (siderCollapsed) return;
      const g = p.closest(".sider__group");
      if (g) { g.classList.toggle("sider__group--open"); _usersMenuOpen = g.classList.contains("sider__group--open"); }
    });
    p.addEventListener("mouseenter", () => {
      if (!siderCollapsed) return;
      _hideSiderTip();
      const g = p.closest(".sider__group");
      if (g) _showSiderPopup(p, g);
    });
    p.addEventListener("mouseleave", () => {
      if (siderCollapsed) _hideSiderPopup();
    });
  });
}
const TOGGLE_EXPAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="14 9 17 12 14 15"/></svg>';
const TOGGLE_COLLAPSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="17 9 14 12 17 15"/></svg>';
let siderCollapsed = localStorage.getItem("cq_sider_collapsed") === "1";

let _siderTip = null;
function _showSiderTip(anchor, text) {
  if (!_siderTip) {
    _siderTip = document.createElement("div");
    _siderTip.className = "sider-tooltip";
    document.body.appendChild(_siderTip);
  }
  const r = anchor.getBoundingClientRect();
  _siderTip.textContent = text;
  _siderTip.style.left = r.right + 8 + "px";
  _siderTip.style.top = r.top + r.height / 2 + "px";
  _siderTip.style.transform = "translateY(-50%)";
  _siderTip.style.display = "";
}
function _hideSiderTip() { if (_siderTip) _siderTip.style.display = "none"; }

function bindSiderToggle(root) {
  const btn = root.querySelector("#sider-toggle");
  const sider = root.querySelector(".sider");
  if (!btn || !sider) return;
  if (siderCollapsed) { sider.classList.add("sider--collapsed"); btn.innerHTML = TOGGLE_EXPAND; }
  btn.onclick = () => {
    siderCollapsed = !siderCollapsed;
    sider.classList.toggle("sider--collapsed", siderCollapsed);
    btn.innerHTML = siderCollapsed ? TOGGLE_EXPAND : TOGGLE_COLLAPSE;
    localStorage.setItem("cq_sider_collapsed", siderCollapsed ? "1" : "0");
    _hideSiderTip();
    if (_siderPopup) _siderPopup.style.display = "none";
  };
  sider.querySelectorAll("a[data-label], .sider__parent[data-label]").forEach(a => {
    a.addEventListener("mouseenter", () => { if (siderCollapsed) _showSiderTip(a, a.dataset.label); });
    a.addEventListener("mouseleave", () => { _hideSiderTip(); });
  });
  bindSiderGroups(root);
}

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
      <div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <input class="auth-input" id="auth-user" type="text" autocomplete="off" spellcheck="false" placeholder="请输入账号"/>
          <input class="auth-input mask-pwd" id="auth-pass" type="text" autocomplete="off" spellcheck="false" placeholder="请输入密码"/>
          <button class="auth-submit" id="lb" type="button">登录</button>
        </div>
      </div>
    </div>
  </div>`);
  root.appendChild(w);
  initLoginVideoBg(w);
  const btn = w.querySelector("#lb");
  const uIn = w.querySelector("#auth-user"), pIn = w.querySelector("#auth-pass");
  const saved = localStorage.getItem(LS_REMEMBER_USER);
  if (saved) { uIn.value = saved; }
  const doLogin = async () => {
    const u = uIn.value.trim(), p = pIn.value;
    if (!u) { showToast("请输入账号"); return; } if (!p) { showToast("请输入密码"); return; }
    btn.disabled = true; btn.textContent = "登录中…";
    try {
      const d = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ username: u, password: p }) });
      localStorage.setItem(LS_REMEMBER_USER, u);
      setToken(d.access_token);
      location.hash = "#/dashboard"; render();
    } catch (err) { showToast(err.message, "error"); } finally { btn.disabled = false; btn.textContent = "登录"; }
  };
  btn.onclick = doLogin;
  pIn.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
}

async function renderChangePassword(root) {
  root.innerHTML = "";
  const w = el(`<div class="auth-page auth-page--center">
    ${AUTH_BG_IMG_HTML}
    <div class="auth-page__brand"><img src="./planet-logo-white.png" width="36" height="36" alt=""/><span>黑洞量化</span></div>
    <div class="auth-center-box">
      <h2 class="auth-center-box__title">设置新密码</h2>
      <p class="auth-center-box__sub">首次登录须修改密码</p>
      <div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <input class="auth-input mask-pwd" data-f="cur" type="text" autocomplete="off" spellcheck="false" placeholder="请输入当前密码"/>
          <input class="auth-input mask-pwd" data-f="n1" type="text" autocomplete="off" spellcheck="false" placeholder="新密码（至少 6 位）"/>
          <input class="auth-input mask-pwd" data-f="n2" type="text" autocomplete="off" spellcheck="false" placeholder="再次输入新密码"/>
          <button class="auth-submit" id="cb" type="button">确认修改</button>
        </div>
      </div>
    </div>
  </div>`);
  root.appendChild(w);
  initLoginVideoBg(w);
  const btn = w.querySelector("#cb");
  const _v = f => (w.querySelector(`[data-f="${f}"]`)?.value || "");
  btn.onclick = async () => {
    const c = _v("cur"), n1 = _v("n1"), n2 = _v("n2");
    if (!c) { showToast("请输入当前密码"); return; }
    if (!n1 || n1.length < 6) { showToast("新密码至少需要 6 位"); return; }
    if (n1 !== n2) { showToast("两次输入的新密码不一致"); return; }
    btn.disabled = true; btn.textContent = "保存中…";
    try {
      await apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: c, new_password: n1 }) });
      await loadMe(); location.hash = "#/dashboard"; render();
    } catch (err) { showToast(err.message, "error"); } finally { btn.disabled = false; btn.textContent = "确认修改"; }
  };
}

/* ==================== MAIN LAYOUT ==================== */
const BRAND_HTML = '<img src="./favicon.png" width="22" height="22" alt="" class="header__logo"/>黑洞量化';

function _headerRight(username) {
  return `<div class="header__right"><div class="user-menu"><div class="user-menu__name" id="who">${username || ''}</div><div class="user-menu__drop"><div class="user-menu__drop-inner"><a href="javascript:void(0)" data-action="chg-pwd">修改密码</a><a href="javascript:void(0)" data-action="logout">退出登录</a></div></div></div></div>`;
}
function _bindHeaderRight(root) {
  root.querySelector('.user-menu__drop')?.addEventListener('click', e => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'chg-pwd') showChangePasswordModal();
    if (a.dataset.action === 'logout') showConfirmModal('您是否确认退出登录？', doLogout);
  });
}

function renderMainShell(root, activeRoute) {
  const crumb = ALL_LABELS[activeRoute] || activeRoute;
  root.innerHTML = `<div class="layout">
    <header class="header"><div class="header__left"><h1>${BRAND_HTML}</h1><button class="sider-toggle" id="sider-toggle" title="折叠/展开菜单">${TOGGLE_COLLAPSE}</button><div class="header__sep"></div><span class="header__crumb">${crumb}</span></div>
      ${_headerRight('')}</header>
    <div class="body"><aside class="sider">${buildSiderHTML(null)}</aside>
      <div class="main"><div class="content"><div id="pane"><div class="loading"><div class="spinner"></div>加载中...</div></div></div></div></div></div>`;
  _bindHeaderRight(root);
  bindSiderToggle(root);
}

async function renderMain(root) {
  const crumb = ALL_LABELS[route] || route;
  const perms = me.permissions || [];
  root.innerHTML = `<div class="layout">
    <header class="header"><div class="header__left"><h1>${BRAND_HTML}</h1><button class="sider-toggle" id="sider-toggle" title="折叠/展开菜单">${TOGGLE_COLLAPSE}</button><div class="header__sep"></div><span class="header__crumb">${crumb}</span></div>
      ${_headerRight(me.username)}</header>
    <div class="body"><aside class="sider">${buildSiderHTML(perms)}</aside>
      <div class="main"><div class="content"><div id="pane"></div></div></div></div></div>`;
  _bindHeaderRight(root);
  bindSiderToggle(root);
  const pane = root.querySelector("#pane");
  pane.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
  try {
    if (route === "users") { location.hash = "#/accounts"; route = "accounts"; }
    const views = { dashboard: viewDashboard, assets: viewAssets, trading: viewTrading, charts: viewCharts, strategies: viewStrategies, risk: viewRisk, system: viewSystem, roles: viewRoles, accounts: viewAccounts };
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
    pane.innerHTML = `<div class="card"><p class="error">${e.message}</p><p class="muted mt-12">请检查项目根目录 .env 是否填写 BINANCE_API_KEY / BINANCE_API_SECRET，保存后<strong>重启后端</strong>。若用 Docker 部署，需保证容器能访问币安接口。</p></div>`;
    return;
  }
  const spot = summary.spot_balances || [];
  const alloc = summary.allocations || [];

  pane.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card__label">总资产估值（现货）</div><div class="stat-card__value">$${fmtNumSafe(summary.total_equity_estimate)}</div></div>
      <div class="stat-card"><div class="stat-card__label">现货资产</div><div class="stat-card__value">$${fmtNumSafe(summary.spot_total_estimate)}</div></div>
    </div>
    <div class="card"><h2>现货持仓</h2>
        <table><thead><tr><th>资产</th><th>可用</th><th>冻结</th><th>合计</th></tr></thead><tbody>
          ${spot.length ? spot.map(b => { const t = (parseFloat(b.free||0) + parseFloat(b.locked||0)).toFixed(6); return `<tr><td><strong>${b.asset}</strong></td><td>${fmtNum(b.free, 6)}</td><td>${fmtNum(b.locked, 6)}</td><td>${t}</td></tr>`; }).join("") : '<tr><td colspan="4" class="empty-state">无持仓</td></tr>'}
        </tbody></table>
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
  const [orders, positions, venue, exRaw] = await Promise.all([
    apiFetch("/trading/orders?limit=50"),
    apiFetch("/trading/positions").catch(() => ({ spot: [] })),
    apiFetch("/trading/venue-status").catch(() => null),
    apiFetch("/trading/exchange-open-orders").catch(() => []),
  ]);

  const vn = venue || {};
  const env = vn.spot_trading_env || (vn.binance_testnet ? "testnet" : "live");
  const venueLine = env === "testnet"
    ? "当前对接 <strong>Binance 现货测试网</strong>（testnet.binance.vision），请在测试网充值后验收。"
    : env === "demo"
    ? "当前对接 <strong>Binance 现货模拟交易（Demo）</strong>，密钥须来自 <a href=\"https://demo.binance.com\" target=\"_blank\" rel=\"noopener\">demo.binance.com</a> 的 API 管理。"
    : "当前为 <strong>主网现货</strong> 配置，请确认密钥与风控后再操作。";

  pane.innerHTML = `
    <div class="card" style="border-left:4px solid var(--accent);background:rgba(99,102,241,0.06)">
      <p style="margin:0 0 8px;font-size:14px">${venueLine}</p>
      <div class="row" style="flex-wrap:wrap;gap:12px;align-items:center;font-size:13px">
        <span>${streamDot(vn.market_stream_healthy)} 行情 WebSocket</span>
        <span class="muted">${vn.market_stream_enabled === false ? "（已关闭）" : ""}</span>
        <span>${streamDot(vn.user_stream_healthy)} 成交流 User Stream</span>
        <span class="muted">${vn.user_stream_enabled === false ? "（已关闭）" : "网格补单依赖此项"}</span>
      </div>
    </div>
    <div class="card"><h2>下单（现货）</h2>
      <form id="tf" class="row">
        <div><label>交易对</label><input name="symbol" id="trade-symbol" value="BTCUSDT" style="width:120px"/></div>
        <div><label>方向</label><select name="side"><option value="BUY">买入 (BUY)</option><option value="SELL">卖出 (SELL)</option></select></div>
        <div><label>数量</label><input name="quantity" placeholder="0.001" style="width:120px"/></div>
        <button class="primary" type="submit" id="trade-btn">提交订单</button>
      </form>
      <div class="error" id="te" style="display:none"></div>
    </div>
    <div class="card"><h2>现货持仓</h2>
        <table><thead><tr><th>资产</th><th>可用</th><th>冻结</th><th>合计</th></tr></thead><tbody>
          ${positions.spot && positions.spot.length ? positions.spot.map(p => `<tr><td><strong>${p.asset}</strong></td><td>${p.free}</td><td>${p.locked}</td><td>${p.total}</td></tr>`).join("") : '<tr><td colspan="4" class="empty-state">无持仓</td></tr>'}
        </tbody></table>
    </div>
    <div class="card">
      <div class="flex-between mb-16"><h2 style="margin:0">交易所当前挂单</h2><button type="button" class="sm primary" id="ex-refresh">刷新</button></div>
      <table><thead><tr><th>品种</th><th>方向</th><th>类型</th><th>价格</th><th>数量</th><th>成交</th><th>状态</th><th>客户端订单号</th></tr></thead><tbody id="ex-oo-body">
        ${Array.isArray(exRaw) && exRaw.length ? exRaw.map(o => `<tr><td>${o.symbol}</td><td>${sideBadge(o.side)}</td><td>${o.type || "-"}</td><td>${o.price}</td><td>${o.origQty}</td><td>${o.executedQty != null ? o.executedQty : "-"}</td><td>${o.status || "-"}</td><td class="muted" style="font-size:12px;max-width:220px;word-break:break-all">${o.clientOrderId || "-"}</td></tr>`).join("") : '<tr><td colspan="8" class="empty-state">暂无挂单或未配置 API</td></tr>'}
      </tbody></table>
    </div>
    <div class="card"><h2>本地订单记录</h2>
      <table><thead><tr><th>ID</th><th>品种</th><th>方向</th><th>类型</th><th>数量</th><th>价格</th><th>状态</th><th>交易所ID</th><th>客户端ID</th><th>时间</th></tr></thead><tbody>
        ${orders.length ? orders.map(o => `<tr><td>${o.id}</td><td>${o.symbol}</td><td>${sideBadge(o.side)}</td><td>${o.order_type || "-"}</td><td>${o.quantity}</td><td>${o.price != null ? o.price : "—"}</td><td>${statusBadge(o.status)}</td><td class="muted">${o.exchange_order_id || '-'}</td><td class="muted" style="font-size:12px;max-width:140px;word-break:break-all">${o.client_order_id || '-'}</td><td>${fmtTime(o.created_at)}</td></tr>`).join("") : '<tr><td colspan="10" class="empty-state">暂无订单</td></tr>'}
      </tbody></table>
    </div>`;

  const te = pane.querySelector("#te");
  async function reloadOpenOrders() {
    const sym = (pane.querySelector("#trade-symbol")?.value || "").trim() || null;
    const body = pane.querySelector("#ex-oo-body");
    try {
      const q = sym ? ("?symbol=" + encodeURIComponent(sym)) : "";
      const list = await apiFetch("/trading/exchange-open-orders" + q);
      body.innerHTML = list.length ? list.map(o => `<tr><td>${o.symbol}</td><td>${sideBadge(o.side)}</td><td>${o.type || "-"}</td><td>${o.price}</td><td>${o.origQty}</td><td>${o.executedQty != null ? o.executedQty : "-"}</td><td>${o.status || "-"}</td><td class="muted" style="font-size:12px;max-width:220px;word-break:break-all">${o.clientOrderId || "-"}</td></tr>`).join("") : '<tr><td colspan="8" class="empty-state">暂无挂单</td></tr>';
    } catch {
      body.innerHTML = '<tr><td colspan="8" class="empty-state">无法拉取挂单（权限或网络）</td></tr>';
    }
  }
  pane.querySelector("#ex-refresh").onclick = () => reloadOpenOrders();

  pane.querySelector("#tf").onsubmit = async e => {
    e.preventDefault(); te.style.display = "none";
    const fd = new FormData(e.target), btn = pane.querySelector("#trade-btn");
    const qty = (fd.get("quantity")||"").trim();
    if (!qty) { te.textContent = "请输入数量"; te.style.display = "block"; return; }
    btn.disabled = true; btn.textContent = "提交中…";
    try {
      await apiFetch("/trading/orders", { method: "POST", body: JSON.stringify({ symbol: fd.get("symbol"), side: fd.get("side"), quantity: qty }) });
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
    await loadChart({ symbol: fd.get("symbol"), interval: fd.get("interval"), market: "spot", limit: fd.get("limit") });
  };

  pane.querySelector("#sync-form").onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    try {
      const r = await apiFetch(`/market/klines/sync?symbol=${fd.get("symbol")}&interval=${fd.get("interval")}&market=spot`, { method: "POST" });
      pane.querySelector("#sync-result").textContent = `已同步 ${r.synced} 条新数据`;
    } catch (err) { pane.querySelector("#sync-result").textContent = err.message; }
  };

  await loadChart({ symbol: "BTCUSDT", interval: "1h", market: "spot", limit: 200 });
}

/* ==================== 5. STRATEGIES ==================== */
async function viewStrategies(pane) {
  pane.innerHTML = '<div class="loading"><div class="spinner"></div>加载策略数据...</div>';
  const endpoints = [
    ["GET /strategies/catalog", () => apiFetch("/strategies/catalog")],
    ["GET /strategies", () => apiFetch("/strategies")],
    ["GET /strategies/backtest/history", () => apiFetch("/strategies/backtest/history?limit=10")],
  ];
  const settled = await Promise.allSettled(endpoints.map(([, fn]) => fn()));
  const failed = settled
    .map((r, i) => (r.status === "rejected" ? `${endpoints[i][0]}: ${r.reason?.message || r.reason}` : null))
    .filter(Boolean);
  if (failed.length) {
    pane.innerHTML = `<div class="card"><p class="error">${failed.join("<br/>")}</p>
      <p class="muted mt-12">若提示 500：先确认数据库已 <code>alembic upgrade head</code>；若仍失败，请查看运行 <code>uvicorn</code> 的终端里对应请求栈，或把报错贴给开发。</p></div>`;
    return;
  }
  const catalog = settled[0].value;
  const instances = settled[1].value;
  const btHistory = settled[2].value;

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
    if (key === "grid_spot") return `
      <div><label>下界价</label><input name="lowerPrice" type="number" step="0.01" value="${cfg.lowerPrice||80000}" style="width:100px"/></div>
      <div><label>上界价</label><input name="upperPrice" type="number" step="0.01" value="${cfg.upperPrice||100000}" style="width:100px"/></div>
      <div><label>网格数</label><input name="gridCount" type="number" value="${cfg.gridCount||10}" style="width:70px"/></div>
      <div><label>每格USDT</label><input name="amountPerGrid" type="number" step="0.01" value="${cfg.amountPerGrid||15}" style="width:80px"/></div>
      <div><label>每轮最多挂单</label><input name="max_orders_per_tick" type="number" value="${cfg.max_orders_per_tick??12}" style="width:70px" title="防止一次轮询打满 API"/></div>`;
    return "";
  }

  pane.innerHTML = `
    <div class="card"><h2>创建策略实例</h2>
      <form id="sf">
        <div class="row">
          <div><label>策略类型</label><select name="strategy_key" id="sk">${catalog.map(c => `<option value="${c.key}">${c.name}</option>`).join("")}</select></div>
          <div><label>名称</label><input name="name" value="BTC 策略" style="width:140px"/></div>
          <div><label>交易对</label><input name="symbol" value="BTCUSDT" style="width:110px"/></div>
          <div><label>周期</label><input name="interval" value="1m" style="width:60px"/></div>
          <div><label>数量</label><input name="quantity" value="0.001" style="width:80px"/></div>
          <div><label>轮询(秒)</label><input name="poll_seconds" type="number" value="60" style="width:70px"/></div>
          <div class="muted" style="align-self:flex-end;font-size:12px" id="env-hint">环境见 .env <code>BINANCE_USE_TESTNET</code></div>
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
          <td>${r.running ? '<span class="badge badge--green">运行中</span>' : `<span class="badge badge--muted">${r.run_status || "已停止"}</span>`}</td>
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
    const config = { symbol: fd.get("symbol"), market_type: "spot", interval: fd.get("interval"), quantity: fd.get("quantity"), poll_seconds: Number(fd.get("poll_seconds")) };
    if (key === "simple_ma") { config.fast = Number(fd.get("fast")); config.slow = Number(fd.get("slow")); }
    if (key === "rsi") { config.period = Number(fd.get("period")); config.overbought = Number(fd.get("overbought")); config.oversold = Number(fd.get("oversold")); }
    if (key === "bollinger") { config.period = Number(fd.get("period")); config.num_std = Number(fd.get("num_std")); }
    if (key === "grid_spot") {
      config.lowerPrice = String(fd.get("lowerPrice"));
      config.upperPrice = String(fd.get("upperPrice"));
      config.gridCount = Number(fd.get("gridCount"));
      config.amountPerGrid = String(fd.get("amountPerGrid"));
      config.market_type = "spot";
      const mx = fd.get("max_orders_per_tick");
      if (mx !== null && mx !== "") config.max_orders_per_tick = Number(mx);
    }
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

/* ==================== 8. ROLES ==================== */
const PERM_TREE = [
  { key: "dashboard", label: "概览" },
  { key: "assets", label: "资产收益" },
  { key: "trading", label: "实盘交易" },
  { key: "charts", label: "数据图表" },
  { key: "strategies", label: "策略引擎" },
  { key: "risk", label: "风控配置" },
  { key: "system", label: "系统监控" },
  { key: "users", label: "账号管理", children: [
    { key: "roles", label: "角色管理" },
    { key: "accounts", label: "创建账号" },
  ]},
];

function _buildPermCheckboxes(selected) {
  const s = new Set(selected || []);
  let html = '<div class="perm-tree">';
  for (const item of PERM_TREE) {
    if (item.children) {
      const parentChecked = item.children.some(c => s.has(c.key));
      html += `<div class="perm-group">`;
      html += `<label class="perm-item"><input type="checkbox" data-parent="${item.key}" ${parentChecked ? 'checked' : ''}/> ${item.label}</label>`;
      html += `<div class="perm-children">`;
      for (const ch of item.children) {
        html += `<label class="perm-item perm-item--child"><input type="checkbox" data-perm="${ch.key}" data-of="${item.key}" ${s.has(ch.key) ? 'checked' : ''} ${!parentChecked ? 'disabled' : ''}/> ${ch.label}</label>`;
      }
      html += `</div></div>`;
    } else {
      html += `<label class="perm-item"><input type="checkbox" data-perm="${item.key}" ${s.has(item.key) ? 'checked' : ''}/> ${item.label}</label>`;
    }
  }
  html += '</div>';
  return html;
}

function _bindPermTree(container) {
  container.querySelectorAll("[data-parent]").forEach(cb => {
    cb.addEventListener("change", () => {
      const group = cb.dataset.parent;
      container.querySelectorAll(`[data-of="${group}"]`).forEach(child => {
        child.disabled = !cb.checked;
        if (!cb.checked) child.checked = false;
      });
    });
  });
}

function _collectPerms(container) {
  const perms = [];
  container.querySelectorAll("[data-perm]").forEach(cb => { if (cb.checked) perms.push(cb.dataset.perm); });
  return perms;
}

function showRoleModal(existing, onDone) {
  _closeAllModals();
  const isEdit = !!existing;
  const overlay = el(`<div class="modal-overlay">
    <div class="modal-box" style="min-width:400px">
      <h3>${isEdit ? '编辑角色' : '创建角色'}</h3>
      <div class="modal-field"><label>角色名称</label><input type="text" id="rn" autocomplete="off" value="${isEdit ? existing.name : ''}" placeholder="请输入角色名称"/></div>
      <div class="modal-field"><label>菜单权限</label>${_buildPermCheckboxes(isEdit ? existing.permissions : [])}</div>
      <div class="modal-actions">
        <span class="modal-cancel" id="mc">取消</span>
        <button class="modal-confirm" type="button" id="rs">保存</button>
      </div>
    </div>
  </div>`);
  document.body.appendChild(overlay);
  overlay.querySelector("#mc").onclick = () => overlay.remove();
  overlay.addEventListener("mousedown", e => { if (e.target === overlay) overlay.remove(); });
  _bindPermTree(overlay);
  overlay.querySelector("#rs").onclick = async () => {
    const name = (overlay.querySelector("#rn").value || "").trim();
    if (!name) { showToast("请输入角色名称"); return; }
    const perms = _collectPerms(overlay);
    const btn = overlay.querySelector("#rs");
    btn.disabled = true; btn.textContent = "保存中…";
    try {
      if (isEdit) {
        await apiFetch(`/roles/${existing.id}`, { method: "PUT", body: JSON.stringify({ name, permissions: perms }) });
      } else {
        await apiFetch("/roles", { method: "POST", body: JSON.stringify({ name, permissions: perms }) });
      }
      overlay.remove();
      showToast(isEdit ? "角色已更新" : "角色创建成功", "success");
      onDone();
    } catch (err) { showToast(err.message, "error"); } finally { btn.disabled = false; btn.textContent = "保存"; }
  };
}

async function viewRoles(pane) {
  if (me.role !== "admin") { pane.innerHTML = '<div class="card"><p class="muted">仅管理员可访问角色管理</p></div>'; return; }
  pane.innerHTML = '<div class="loading"><div class="spinner"></div>加载角色数据...</div>';
  const roles = await apiFetch("/roles");
  let rolePage = 1;
  let roleFiltered = roles;

  function renderTable(list, pg) {
    const rows = pageSlice(list, pg);
    return `<table><thead><tr><th style="width:140px">角色名称</th><th>权限数</th><th>启用账号</th><th>创建人</th><th>创建时间</th><th>操作</th></tr></thead><tbody>
      ${rows.map(r => `<tr>
        <td><strong>${r.name}</strong></td>
        <td>${r.is_system ? '全部' : r.permissions.length}</td>
        <td>${r.active_user_count || 0}</td>
        <td>${r.created_by || '-'}</td>
        <td>${fmtTime(r.created_at)}</td>
        <td>${r.is_system ? '' : `<button class="sm btn-text" data-edit="${r.id}">编辑</button> <button class="sm btn-del" data-del="${r.id}">删除</button>`}</td>
      </tr>`).join("")}
    </tbody></table>${buildPagerHTML(list.length, pg)}`;
  }

  function refreshRoleTable() { pane.querySelector("#role-table").innerHTML = renderTable(roleFiltered, rolePage); }

  pane.innerHTML = `
    <div class="card"><div class="flex gap-8" style="align-items:center"><input id="role-search" class="input-search" placeholder="请输入角色名称搜索" style="width:160px"/><button class="btn-white" id="add-role" style="font-weight:600">创建角色</button></div></div>
    <div class="card" id="role-table">${renderTable(roles, 1)}</div>`;

  pane.querySelector("#role-search").addEventListener("input", e => {
    const kw = e.target.value.trim().toLowerCase();
    roleFiltered = kw ? roles.filter(r => r.name.toLowerCase().includes(kw)) : roles;
    rolePage = 1;
    refreshRoleTable();
  });

  pane.querySelector("#add-role").onclick = () => showRoleModal(null, () => viewRoles(pane));
  pane.addEventListener("click", async ev => {
    const t = ev.target;
    if (t.dataset.page) { rolePage = Number(t.dataset.page); refreshRoleTable(); return; }
    if (t.dataset.edit) {
      const r = roles.find(x => x.id === Number(t.dataset.edit));
      if (r) showRoleModal(r, () => viewRoles(pane));
    }
    if (t.dataset.del) {
      showConfirmModal("确认删除该角色？", async () => {
        try { await apiFetch(`/roles/${t.dataset.del}`, { method: "DELETE" }); showToast("角色已删除", "success"); await viewRoles(pane); } catch (e) { showToast(e.message, "error"); }
      });
    }
  });
}

/* ==================== 9. ACCOUNTS ==================== */
function showCreateAccountModal(selectableRoles, onDone) {
  _closeAllModals();
  const first = selectableRoles.length ? selectableRoles[0] : null;
  const roleItems = selectableRoles.map(r =>
    `<div class="cdd-item" data-id="${r.id}">${r.name}</div>`
  ).join("") || '<div class="cdd-item cdd-item--disabled">请先创建角色</div>';

  const overlay = el(`<div class="modal-overlay">
    <div class="modal-box" style="min-width:380px">
      <h3>创建账号</h3>
      <div class="modal-field"><label>账号名称</label><input type="text" id="ca-name" autocomplete="off" placeholder="请输入账号名称"/></div>
      <div class="modal-field"><label>角色</label>
        <div class="cdd" id="ca-role-dd">
          <div class="cdd-trigger"><span class="cdd-text">${first ? first.name : '请选择角色'}</span><svg class="cdd-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>
          <div class="cdd-list">${roleItems}</div>
        </div>
        <input type="hidden" id="ca-role" value="${first ? first.id : ''}"/>
      </div>
      <div class="modal-actions">
        <span class="modal-cancel" id="ca-cancel">取消</span>
        <button class="modal-confirm" type="button" id="ca-save" ${first ? '' : 'disabled'}>确认</button>
      </div>
    </div>
  </div>`);
  document.body.appendChild(overlay);

  const dd = overlay.querySelector("#ca-role-dd");
  const ddText = dd.querySelector(".cdd-text");
  const ddList = dd.querySelector(".cdd-list");
  const ddHidden = overlay.querySelector("#ca-role");
  dd.querySelector(".cdd-trigger").onclick = () => dd.classList.toggle("cdd--open");
  dd.querySelectorAll(".cdd-item[data-id]").forEach(item => {
    item.onclick = () => {
      ddText.textContent = item.textContent;
      ddHidden.value = item.dataset.id;
      dd.querySelectorAll(".cdd-item").forEach(i => i.classList.remove("cdd-item--active"));
      item.classList.add("cdd-item--active");
      dd.classList.remove("cdd--open");
    };
  });
  if (first) dd.querySelector(`.cdd-item[data-id="${first.id}"]`)?.classList.add("cdd-item--active");
  document.addEventListener("mousedown", function _closeDd(e) {
    if (!dd.contains(e.target)) { dd.classList.remove("cdd--open"); }
    if (!document.body.contains(overlay)) document.removeEventListener("mousedown", _closeDd);
  });

  overlay.querySelector("#ca-cancel").onclick = () => overlay.remove();
  overlay.addEventListener("mousedown", e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector("#ca-save").onclick = async () => {
    const un = (overlay.querySelector("#ca-name").value || "").trim();
    const rid = ddHidden.value;
    if (!un) { showToast("请输入账号名称"); return; }
    if (!rid) { showToast("请选择角色"); return; }
    const btn = overlay.querySelector("#ca-save");
    btn.disabled = true; btn.textContent = "创建中…";
    try {
      await apiFetch("/users", { method: "POST", body: JSON.stringify({ username: un, role_id: Number(rid) }) });
      showToast("账号创建成功", "success");
      overlay.remove();
      onDone();
    } catch (err) { showToast(err.message, "error"); } finally { btn.disabled = false; btn.textContent = "确认"; }
  };
}

async function viewAccounts(pane) {
  if (me.role !== "admin") { pane.innerHTML = '<div class="card"><p class="muted">仅管理员可访问账号管理</p></div>'; return; }
  pane.innerHTML = '<div class="loading"><div class="spinner"></div>加载账号数据...</div>';
  const [users, roles] = await Promise.all([
    apiFetch("/users"),
    apiFetch("/roles"),
  ]);
  const selectableRoles = roles.filter(r => !r.is_system);
  let accPage = 1;
  let accFiltered = users;

  function renderUserTable(list, pg) {
    const rows = pageSlice(list, pg);
    return `<table><thead><tr><th style="width:140px">账号名称</th><th>角色</th><th>状态</th><th>创建人</th><th>创建时间</th><th>操作</th></tr></thead><tbody>
      ${rows.map(u => `<tr>
        <td><strong>${u.username}</strong></td>
        <td><span class="badge badge--muted">${u.role_name || u.role}</span></td>
        <td style="color:${u.is_active ? 'var(--green,#22c55e)' : 'var(--red,#ef4444)'}">${u.is_active ? '启用' : '禁用'}</td>
        <td>${u.created_by || '-'}</td>
        <td>${fmtTime(u.created_at)}</td>
        <td>${u.role === 'admin' ? '' : `${u.is_active ? `<button class="sm btn-text" data-deact="${u.id}">禁用</button>` : `<button class="sm btn-text" data-act="${u.id}">启用</button>`} <button class="sm btn-text" data-reset="${u.id}">重置密码</button> <button class="sm btn-del" data-del="${u.id}">删除</button>`}</td>
      </tr>`).join("")}
    </tbody></table>${buildPagerHTML(list.length, pg)}`;
  }

  function refreshAccTable() { pane.querySelector("#acc-table").innerHTML = renderUserTable(accFiltered, accPage); }

  pane.innerHTML = `
    <div class="card"><div class="flex gap-8" style="align-items:center">
      <input id="acc-search" class="input-search" placeholder="请输入账号名称搜索" style="width:160px"/>
      <button class="btn-white" id="cu-open" style="font-weight:600">创建账号</button>
    </div></div>
    <div class="card" id="acc-table">${renderUserTable(users, 1)}</div>`;

  pane.querySelector("#cu-open").onclick = () => showCreateAccountModal(selectableRoles, () => viewAccounts(pane));

  pane.querySelector("#acc-search").addEventListener("input", e => {
    const kw = e.target.value.trim().toLowerCase();
    accFiltered = kw ? users.filter(u => u.username.toLowerCase().includes(kw)) : users;
    accPage = 1;
    refreshAccTable();
  });

  pane.addEventListener("click", async ev => {
    const t = ev.target;
    try {
      if (t.dataset.page) { accPage = Number(t.dataset.page); refreshAccTable(); return; }
      if (t.dataset.deact) {
        showConfirmModal("确认禁用此账号？", async () => {
          try { await apiFetch(`/users/${t.dataset.deact}/deactivate`, { method: "PATCH" }); showToast("已禁用", "success"); await viewAccounts(pane); } catch (e) { showToast(e.message, "error"); }
        });
      }
      if (t.dataset.act) {
        showConfirmModal("确认启用此账号？", async () => {
          try { await apiFetch(`/users/${t.dataset.act}/activate`, { method: "PATCH" }); showToast("已启用", "success"); await viewAccounts(pane); } catch (e) { showToast(e.message, "error"); }
        });
      }
      if (t.dataset.reset) {
        showConfirmModal("确认重置此账号密码？", async () => {
          try {
            const r = await apiFetch(`/users/${t.dataset.reset}/reset-password`, { method: "POST" });
            showToast("密码已重置：" + r.new_password, "success");
          } catch (e) { showToast(e.message, "error"); }
        });
      }
      if (t.dataset.del) {
        showConfirmModal("确认删除此账号？删除后不可恢复。", async () => {
          try { await apiFetch(`/users/${t.dataset.del}`, { method: "DELETE" }); showToast("账号已删除", "success"); await viewAccounts(pane); } catch (e) { showToast(e.message, "error"); }
        });
      }
    } catch (e) { showToast(e.message, "error"); }
  });
}

/* ==================== RENDER ==================== */
async function render() {
  parseHash();
  const root = document.getElementById("root");
  if (!token) { await renderLogin(root); return; }
  if (!me) {
    // Show layout shell immediately with spinner while loading user info
    if (route === "login") { route = "dashboard"; }
    renderMainShell(root, route);
    await loadMe();
    if (!me) { await renderLogin(root); return; }
    const whoEl = root.querySelector("#who");
    if (whoEl) whoEl.textContent = me.username;
  } else {
    if (route === "login") { location.hash = "#/dashboard"; route = "dashboard"; }
  }
  await renderMain(root);
}

render();
