export function formatYen(n) {
  return '¥' + Number(n || 0).toLocaleString('ja-JP');
}

export function formatNumber(n) {
  return Number(n || 0).toLocaleString('ja-JP');
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

export function statusLabel(status) {
  return {
    WAITING: '調理待ち',
    PREPARING: '調理中',
    READY: 'お渡し可能',
    COMPLETED: '完了',
    CANCELLED: 'キャンセル',
  }[status] || status;
}

export function elapsedLabel(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  return `${h}時間${m % 60}分前`;
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(msg)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

export async function downloadCsv() {
  const { getUsername, getPassword } = await import('./api.js');
  const res = await fetch('/api/export/csv', { headers: { 'x-username': getUsername(), 'x-password': getPassword() } });
  if (!res.ok) throw new Error('CSVの取得に失敗しました');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pos_orders_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sortOrdersByCreated(orders) {
  return orders.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
}
