import { api } from '../api.js';
import { formatYen, formatNumber, escapeHtml, showToast, statusLabel, formatDateTime, downloadCsv } from '../util.js';

function calcMetrics(orders) {
  const active = orders.filter((o) => o.status !== 'CANCELLED');
  let sales = 0;
  let productUnits = 0;
  let toppingUnits = 0;
  const productAgg = new Map();
  const toppingAgg = new Map();

  for (const o of active) {
    sales += o.total_amount;
    for (const item of o.items) {
      productUnits += item.quantity;
      const key = item.product_id;
      const cur = productAgg.get(key) || { name: item.product_name, revenue: 0, count: 0 };
      cur.revenue += item.total_price;
      cur.count += item.quantity;
      productAgg.set(key, cur);
      for (const t of item.toppings) {
        const units = t.quantity * item.quantity;
        toppingUnits += units;
        const tk = t.topping_id;
        const tc = toppingAgg.get(tk) || { name: t.topping_name, qty: 0 };
        tc.qty += units;
        toppingAgg.set(tk, tc);
      }
    }
  }

  const productRank = [...productAgg.values()].sort((a, b) => b.revenue - a.revenue);
  const toppingRank = [...toppingAgg.values()].sort((a, b) => b.qty - a.qty);
  return { sales, orderCount: active.length, productUnits, toppingUnits, productRank, toppingRank };
}

function rankItemHTML(rank, item, max, shareOf, fmt) {
  const pct = max > 0 ? Math.round((item.revenue || item.qty) / max * 100) : 0;
  const share = shareOf > 0 ? (item.share / shareOf * 100).toFixed(1) : '0.0';
  return `
    <div class="rank-item">
      <span class="rank-no ${rank === 1 ? 'top' : ''}">${rank}</span>
      <span class="name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
      <div class="rank-bar"><div style="width:${Math.max(4, pct)}%"></div></div>
      <span class="cnt">${fmt(item)} ・ ${share}%</span>
    </div>
  `;
}

export const DashboardView = {
  render(main, state) {
    const orders = state.orders.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
    const m = calcMetrics(orders);
    const recent = orders.slice(0, 50);

    const maxProductRevenue = m.productRank.length ? m.productRank[0].revenue : 0;
    const maxToppingQty = m.toppingRank.length ? m.toppingRank[0].qty : 0;
    const toppingShareOf = m.toppingUnits;

    main.innerHTML = `
      <div class="view-scroll">
      <div class="view-title"><i class="fa-solid fa-chart-column"></i> 売上ダッシュボード
        <span class="sub">売上と注文のリアルタイム分析</span>
        <button class="btn btn-primary" data-action="export-csv" style="margin-left:auto" type="button">
          <i class="fa-solid fa-file-csv"></i> CSVエクスポート
        </button>
      </div>

      <div class="summary-grid">
        <div class="card summary-card">
          <div class="label">総売上金額 <span class="icon" style="background:#16a34a"><i class="fa-solid fa-yen-sign"></i></span></div>
          <div class="value">${formatYen(m.sales)}</div>
        </div>
        <div class="card summary-card">
          <div class="label">総注文件数 <span class="icon" style="background:#2563eb"><i class="fa-solid fa-receipt"></i></span></div>
          <div class="value">${formatNumber(m.orderCount)}件</div>
        </div>
        <div class="card summary-card">
          <div class="label">メイン商品販売数 <span class="icon" style="background:#ff6b35"><i class="fa-solid fa-ice-cream"></i></span></div>
          <div class="value">${formatNumber(m.productUnits)}個</div>
        </div>
        <div class="card summary-card">
          <div class="label">トッピング販売数 <span class="icon" style="background:#d97706"><i class="fa-solid fa-candy-cane"></i></span></div>
          <div class="value">${formatNumber(m.toppingUnits)}個</div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="card">
          <h3 class="view-title" style="margin-bottom:8px"><i class="fa-solid fa-trophy"></i> メイン商品売上ランキング</h3>
          <div class="rank-list">
            ${m.productRank.length === 0 ? '<div class="kds-empty">データがありません</div>' : m.productRank.map((item, i) => {
              const totalItemSales = m.productRank.reduce((s, x) => s + x.revenue, 0);
              item.share = item.revenue;
              return rankItemHTML(i + 1, item, maxProductRevenue, totalItemSales, (x) => `${formatNumber(x.count)}件 / ${formatYen(x.revenue)}`);
            }).join('')}
          </div>
        </div>
        <div class="card">
          <h3 class="view-title" style="margin-bottom:8px"><i class="fa-solid fa-candy-cane"></i> トッピング注文数ランキング</h3>
          <div class="rank-list">
            ${m.toppingRank.length === 0 ? '<div class="kds-empty">データがありません</div>' : m.toppingRank.map((item, i) => {
              item.share = item.qty;
              return rankItemHTML(i + 1, item, maxToppingQty, toppingShareOf, (x) => `${formatNumber(x.qty)}個`);
            }).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="view-title" style="margin-bottom:8px"><i class="fa-solid fa-clock-rotate-left"></i> 注文履歴（直近50件）</h3>
        <div class="history-rows">
          ${recent.length === 0 ? '<div class="kds-empty">まだ注文がありません</div>' : recent.map((o) => `
            <div class="history-row">
              <div class="history-head">
                <span class="num">#${o.order_number} <span class="status-tag ${o.status}">${statusLabel(o.status)}</span></span>
                <span class="time">${formatDateTime(o.created_at)} ・ 合計 ${formatYen(o.total_amount)}</span>
                ${o.status !== 'CANCELLED' && o.status !== 'COMPLETED'
                  ? `<button class="btn btn-danger btn-sm" data-action="cancel-order" data-id="${o.order_id}" type="button"><i class="fa-solid fa-xmark"></i> 取消</button>`
                  : ''}
              </div>
              <div class="history-items">
                ${o.items.map((item) => `
                  <div>
                    ${escapeHtml(item.product_name)} ${item.quantity > 1 ? `× ${item.quantity}` : ''}（${formatYen(item.total_price)}）
                    ${item.toppings.length ? `<div class="toppings">└ ${item.toppings.map((t) => `+ ${escapeHtml(t.topping_name)} × ${t.quantity}`).join('、')}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      </div>
    `;

    const exportBtn = main.querySelector('[data-action="export-csv"]');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          await downloadCsv();
          showToast('CSVをダウンロードしました', 'success');
        } catch (e) {
          if (e.message !== 'unauthorized') showToast(e.message, 'error');
        }
      });
    }

    main.querySelectorAll('[data-action="cancel-order"]').forEach((el) => {
      el.addEventListener('click', async () => {
        const order = state.orders.find((o) => o.order_id === el.dataset.id);
        if (!order) return;
        if (!window.confirm(`注文 #${order.order_number} を取り消しますか？\n在庫は自動で返却されます。`)) return;
        try {
          await api(`/api/orders/${order.order_id}/cancel`, { method: 'POST' });
          showToast(`注文 #${order.order_number} を取り消し、在庫を返却しました`, 'success');
        } catch (e) {
          if (e.message !== 'unauthorized') showToast(e.message, 'error');
        }
      });
    });
  },
};
