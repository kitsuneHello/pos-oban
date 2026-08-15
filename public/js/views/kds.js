import { api } from '../api.js';
import { formatYen, formatNumber, escapeHtml, showToast, elapsedLabel, sortOrdersByCreated } from '../util.js';

const checkedSets = {};

function totalSets(order) {
  return order.items.reduce((s, it) => s + it.quantity, 0);
}

function orderCardHTML(order) {
  const statusClass = { PREPARING: 'cooking', READY: 'ready' }[order.status] || '';
  const sets = totalSets(order);
  const checked = checkedSets[order.order_id]?.size || 0;
  const allChecked = sets > 0 && checked === sets;

  let si = 0;
  const setRows = order.items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => {
      const idx = si++;
      const on = checkedSets[order.order_id]?.has(idx) || false;
      return `
        <div class="set-row${on ? ' done' : ''}">
          <button type="button" class="set-checkbox" data-action="toggle-set"
                  data-id="${order.order_id}" data-idx="${idx}" aria-pressed="${on}"
                  title="セット${idx + 1}を準備OKにする">
            ${on ? '<i class="fa-solid fa-check"></i>' : ''}
          </button>
          <span class="set-row-name">
            ${escapeHtml(item.product_name)}
            ${item.toppings.map((t) => `<span class="set-row-top">＋${escapeHtml(t.topping_name)}×${formatNumber(t.quantity)}</span>`).join('')}
          </span>
        </div>
      `;
    })
  ).join('');

  return `
    <div class="order-card ${statusClass}">
      <div class="order-card-head">
        <span class="order-num">#${order.order_number}</span>
        <span class="order-elapsed"><i class="fa-regular fa-clock"></i> ${elapsedLabel(order.created_at)}</span>
      </div>
      <div class="order-items">
        ${order.items.map((item) => `
          <div class="order-item-main">
            <span class="order-item-name">${escapeHtml(item.product_name)}</span>
            ${item.toppings.map((t) => `<span class="topping-badge">＋ ${escapeHtml(t.topping_name)}×${formatNumber(t.quantity)}</span>`).join('')}
            <span class="order-item-qty">× ${formatNumber(item.quantity)}セット</span>
          </div>
        `).join('')}
      </div>
      ${order.status === 'WAITING' ? `
        <div class="set-list">
          ${setRows}
          <span class="set-check-count"><strong>${checked}</strong>／${sets}セット</span>
        </div>
      ` : ''}
      <div class="order-card-actions">
        ${order.status === 'WAITING'
          ? `<button class="btn btn-primary" data-action="set-status" data-id="${order.order_id}" data-status="PREPARING" type="button" ${allChecked ? '' : 'disabled'}><i class="fa-solid fa-fire"></i> 調理開始</button>`
          : ''}
        ${order.status === 'PREPARING'
          ? `<button class="btn btn-primary" data-action="set-status" data-id="${order.order_id}" data-status="READY" type="button"><i class="fa-solid fa-bullhorn"></i> 出来上がり（呼出）</button>`
          : ''}
        ${order.status === 'READY'
          ? `<button class="btn btn-success" data-action="set-status" data-id="${order.order_id}" data-status="COMPLETED" type="button"><i class="fa-solid fa-hand-holding-heart"></i> お渡し完了</button>`
          : ''}
        ${['PREPARING', 'READY'].includes(order.status)
          ? `<button class="btn btn-ghost btn-undo" data-action="undo" data-id="${order.order_id}" type="button" title="1つ前に戻す"><i class="fa-solid fa-rotate-left"></i></button>`
          : ''}
      </div>
      <div class="order-total">計 ${formatYen(order.total_amount)}</div>
    </div>
  `;
}

function columnHTML(label, icon, orders, cls) {
  return `
    <div class="kds-col ${cls}">
      <h3><span><i class="fa-solid ${icon}"></i> ${label}</span><span class="count">${orders.length}</span></h3>
      ${orders.length === 0
        ? '<div class="kds-empty">ありません</div>'
        : orders.map(orderCardHTML).join('')}
    </div>
  `;
}

export const KdsView = {
  render(main, state) {
    const waiting = sortOrdersByCreated(state.orders.filter((o) => o.status === 'WAITING'));
    const cooking = sortOrdersByCreated(state.orders.filter((o) => o.status === 'PREPARING'));
    const ready = sortOrdersByCreated(state.orders.filter((o) => o.status === 'READY'));

    const waitingIds = new Set(waiting.map((o) => o.order_id));
    for (const id of Object.keys(checkedSets)) if (!waitingIds.has(id)) delete checkedSets[id];

    main.innerHTML = `
      <div class="view-scroll">
      <div class="view-title"><i class="fa-solid fa-fire-burner"></i> キッチン表示（KDS）
        <span class="sub">調理状況をリアルタイムに確認できます</span>
      </div>
      <div class="kds-columns">
        ${columnHTML('調理待ち', 'fa-clock', waiting, 'awaiting')}
        ${columnHTML('調理中', 'fa-fire', cooking, 'cooking')}
        ${columnHTML('お渡し可能', 'fa-bell', ready, 'ready')}
      </div>
      </div>
    `;

    main.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', async (ev) => {
        const { id, action, status } = el.dataset;
        if (action === 'toggle-set') {
          ev.preventDefault();
          ev.stopPropagation();
          const idx = Number(el.dataset.idx);
          if (!checkedSets[id]) checkedSets[id] = new Set();
          const s = checkedSets[id];
          if (s.has(idx)) s.delete(idx);
          else s.add(idx);
          KdsView.render(main, window.__state);
          return;
        }
        el.disabled = true;
        try {
          if (action === 'set-status') await api(`/api/orders/${id}/status`, { method: 'POST', body: { status } });
          else if (action === 'undo') await api(`/api/orders/${id}/undo`, { method: 'POST' });
        } catch (e) {
          if (e.message !== 'unauthorized') showToast(e.message, 'error');
        }
      });
    });
  },
};
