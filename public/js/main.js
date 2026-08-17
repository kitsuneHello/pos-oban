import { api, wsConnect, getUsername, setUsername, getPassword, setPassword, clearAuth } from './api.js';
import { showToast } from './util.js';
import { PosView } from './views/pos.js';
import { KdsView } from './views/kds.js';
import { CalloutView } from './views/callout.js';
import { InventoryView } from './views/inventory.js';
import { DashboardView } from './views/dashboard.js';

const views = {
  pos: PosView,
  kds: KdsView,
  callout: CalloutView,
  inventory: InventoryView,
  dashboard: DashboardView,
};

const ClientState = {
  products: [],
  toppings: [],
  orders: [],
};

let activeView = 'pos';
let ws = null;
let timer = null;

function applyState(data) {
  ClientState.products = data.products || [];
  ClientState.toppings = data.toppings || [];
  ClientState.orders = data.orders || [];
  ClientState.orgName = data.orgName || '文化祭 模擬店レジ';
  window.__state = ClientState;
  const brand = document.getElementById('brand-name');
  if (brand) brand.textContent = ClientState.orgName;
}

function updateKdsBadge() {
  const count = ClientState.orders.filter((o) => ['WAITING', 'PREPARING', 'READY'].includes(o.status)).length;
  const badge = document.getElementById('kds-badge');
  badge.classList.toggle('hidden', count === 0);
  badge.textContent = count;
}

function renderActive() {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.closest('#app-main')) return;
  const view = views[activeView];
  const main = document.getElementById('app-main');
  if (!view || !main) return;
  view.render(main, ClientState);
  updateKdsBadge();
}

function setView(viewName) {
  activeView = viewName;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === viewName));
  renderActive();
}

function showAuthModal() {
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('app-header').classList.add('hidden');
  document.getElementById('app-main').classList.add('hidden');
  document.getElementById('auth-username').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-error').classList.add('hidden');
  setTimeout(() => document.getElementById('auth-username').focus(), 50);
}

function enterApp() {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app-header').classList.remove('hidden');
  document.getElementById('app-main').classList.remove('hidden');
  setView('pos');
  if (!timer) {
    timer = setInterval(renderActive, 30000);
  }
}

function logout() {
  clearAuth();
  if (ws) { ws.close(); ws = null; }
  if (timer) { clearInterval(timer); timer = null; }
  showAuthModal();
}

async function boot() {
  window.__state = ClientState;

  document.getElementById('logout-btn').addEventListener('click', logout);

  document.getElementById('tabs-toggle').addEventListener('click', () => {
    document.body.classList.add('hide-header');
    document.getElementById('header-restore').classList.remove('hidden');
  });
  document.getElementById('header-restore').addEventListener('click', () => {
    document.body.classList.remove('hide-header');
    document.getElementById('header-restore').classList.add('hidden');
  });

  document.getElementById('tabs').addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tab');
    if (tab) setView(tab.dataset.view);
  });

  document.getElementById('auth-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const usernameEl = document.getElementById('auth-username');
    const passwordEl = document.getElementById('auth-password');
    const errorEl = document.getElementById('auth-error');
    try {
      await api('/api/auth', { method: 'POST', body: { username: usernameEl.value.trim(), password: passwordEl.value } });
      setUsername(usernameEl.value.trim());
      setPassword(passwordEl.value);
      enterApp();
      connectWs();
    } catch (e) {
      errorEl.textContent = 'ユーザー名またはパスワードが正しくありません。';
      errorEl.classList.remove('hidden');
    }
  });

  window.addEventListener('pos:sync', (ev) => {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    dot.classList.toggle('online', !!ev.detail);
    dot.classList.toggle('offline', !ev.detail);
    text.textContent = ev.detail ? '同期中' : '接続切れ';
  });

  window.addEventListener('pos:unauthorized', () => {
    logout();
    showToast('セッションが無効になりました。再入場してください。', 'error');
  });

  if (getUsername() && getPassword()) {
    try {
      applyState(await api('/api/state'));
      enterApp();
      connectWs();
      return;
    } catch {
      /* fall through to auth modal */
    }
  }
  showAuthModal();
}

function connectWs() {
  if (ws) return;
  ws = wsConnect((data) => {
    applyState(data);
    renderActive();
  });
}

boot();
