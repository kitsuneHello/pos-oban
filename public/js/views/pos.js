import { api } from '../api.js';
import { formatYen, formatNumber, escapeHtml, showToast } from '../util.js';

let cart = [];
let deposit = 0;
let modalProduct = null;
let modalQty = 1;
let modalCounts = {};
let editingIdx = null;

function subtotal() {
  return cart.reduce((s, l) => {
    const toppingTotal = l.toppings.reduce((x, t) => x + t.price * t.quantity, 0);
    return s + (l.unit_price + toppingTotal) * l.quantity;
  }, 0);
}

function stockClass(n) {
  if (n <= 0) return 'empty';
  if (n <= 5) return 'low';
  return '';
}

export const PosView = {
  render(main, state) {
    main.innerHTML = `
      <div class="view-title"><i class="fa-solid fa-cash-register"></i> レジ会計
        <span class="sub">商品を選択してトッピングを自由にカスタマイズできます</span>
      </div>
      <div class="pos-layout">
        <div class="product-grid">
          ${state.products.map((p) => `
            <button class="product-card${p.is_sold_out || (!p.is_unlimited && p.stock <= 0) ? ' sold-out' : ''}"
                    data-action="open-product" data-id="${p.id}" type="button">
              ${p.is_sold_out || (!p.is_unlimited && p.stock <= 0) ? '<span class="soldout-flag">SOLD OUT</span>' : ''}
              ${p.image
                ? `<span class="product-thumb"><img src="${p.image}" alt="" loading="lazy"></span>`
                : '<span class="product-thumb no-image"><i class="fa-solid fa-image"></i></span>'}
              <span class="product-info">
                <span class="product-name">${escapeHtml(p.name)}</span>
                <span class="product-price">${formatYen(p.price)}</span>
                <span class="product-stock ${p.is_unlimited ? 'unlimited' : stockClass(p.stock)}">
                  ${p.is_unlimited
                    ? '<i class="fa-solid fa-infinity"></i> 無制限'
                    : `<i class="fa-solid fa-box"></i> 残り${formatNumber(p.stock)}個`}
                </span>
              </span>
            </button>
          `).join('')}
        </div>

        <div class="cart-panel card">
          <h3><span><i class="fa-solid fa-cart-shopping"></i> カート</span>
            ${cart.length ? `<span class="stock-chip">${cart.length}点</span>` : ''}
          </h3>
          ${cart.length === 0
            ? '<div class="cart-empty"><i class="fa-solid fa-basket-shopping"></i><br>商品をタップして追加してください</div>'
            : `
            <div class="cart-items">
              ${cart.map((l, idx) => `
                <div class="cart-item">
                  <div class="cart-item-head">
                    <span class="cart-item-name">${escapeHtml(l.name)}</span>
                    <span class="cart-item-actions">
                      <button class="cart-item-remove" data-action="edit-line" data-idx="${idx}" type="button"
                              title="編集"><i class="fa-solid fa-pen"></i></button>
                      <button class="cart-item-remove" data-action="remove-line" data-idx="${idx}" type="button"
                              title="削除"><i class="fa-solid fa-xmark"></i></button>
                    </span>
                  </div>
                  <div class="cart-item-tops">
                    ${l.toppings.length === 0 ? '<div class="cart-top-line">（トッピングなし）</div>' : ''}
                    ${l.toppings.map((t) => `
                      <div class="cart-top-line">
                        <span class="plus"><i class="fa-solid fa-plus"></i> ${escapeHtml(t.name)} × ${t.quantity}</span>
                        <span class="cart-top-price">${formatYen(t.price * t.quantity)}</span>
                      </div>
                    `).join('')}
                  </div>
                  <div class="cart-item-foot">
                    <span class="cart-item-qty">× ${formatNumber(l.quantity)}セット</span>
                  </div>
                  <div class="cart-totals">
                    <div class="row total"><span>小計</span><span>${formatYen((l.unit_price + l.toppings.reduce((x, t) => x + t.price * t.quantity, 0)) * l.quantity)}</span></div>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="cart-totals">
              <div class="row"><span>商品点数</span><span>${cart.length}</span></div>
              <div class="row total"><span>合計</span><span>${formatYen(subtotal())}</span></div>
            </div>
          `}
        </div>

        <div class="payment-panel card">
          <div class="deposit-label"><i class="fa-solid fa-hand-holding-dollar"></i> 預かり金額</div>

          <input type="number" class="deposit-input" id="deposit-input" min="0" step="1"
                 placeholder="預かり金額を入力" value="${deposit || ''}">

          <div class="calc-grid">
            <button class="btn calc-key" data-action="calc-digit" data-val="7" type="button">7</button>
            <button class="btn calc-key" data-action="calc-digit" data-val="8" type="button">8</button>
            <button class="btn calc-key" data-action="calc-digit" data-val="9" type="button">9</button>
            <button class="btn calc-key calc-key-back" data-action="calc-back" type="button"
                    title="1桁削除"><i class="fa-solid fa-delete-left"></i></button>
            <button class="btn calc-key" data-action="calc-digit" data-val="4" type="button">4</button>
            <button class="btn calc-key" data-action="calc-digit" data-val="5" type="button">5</button>
            <button class="btn calc-key" data-action="calc-digit" data-val="6" type="button">6</button>
            <button class="btn calc-key calc-key-clear" data-action="calc-clear" type="button">C</button>
            <button class="btn calc-key" data-action="calc-digit" data-val="1" type="button">1</button>
            <button class="btn calc-key" data-action="calc-digit" data-val="2" type="button">2</button>
            <button class="btn calc-key" data-action="calc-digit" data-val="3" type="button">3</button>
            <button class="btn calc-key" data-action="calc-digit" data-val="00" type="button">00</button>
            <button class="btn calc-key calc-key-wide" data-action="calc-digit" data-val="0" type="button">0</button>
            <button class="btn calc-key calc-key-eq calc-key-wide" data-action="deposit-quick" data-val="exact" type="button"
                    title="合計と同額を入力">＝</button>
          </div>

          <div class="change-row ${deposit >= subtotal() ? 'change' : 'warn'}">
            ${deposit >= subtotal()
              ? `<span><i class="fa-solid fa-hand-holding-heart"></i> お釣り</span><span class="amount">${formatYen(deposit - subtotal())}</span>`
              : `<span><i class="fa-solid fa-triangle-exclamation"></i> 預かり金額が不足しています（あと ${formatYen(subtotal() - deposit)}）</span>`}
          </div>
          <button class="btn btn-success btn-block" id="confirm-order"
                  data-action="confirm" type="button"
                  ${cart.length === 0 || deposit < subtotal() ? 'disabled' : ''}>
            <i class="fa-solid fa-cash-register"></i> 会計確定・注文送信
          </button>
        </div>
      </div>
    `;

    main.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        const action = el.dataset.action;
        const id = el.dataset.id;
        const idx = el.dataset.idx;
        if (action === 'open-product') openProduct(id, state);
        else if (action === 'edit-line') editLine(Number(idx), state);
        else if (action === 'remove-line') { cart.splice(Number(idx), 1); PosView.render(main, state); }
        else if (action === 'deposit-quick') {
          deposit = el.dataset.val === 'exact' ? subtotal() : Number(el.dataset.val);
          PosView.render(main, state);
        } else if (action === 'calc-digit') calcDigit(el.dataset.val);
        else if (action === 'calc-back') calcBack();
        else if (action === 'calc-clear') calcClear();
        else if (action === 'confirm') confirmOrder(state);
      });
    });

    const depositInput = main.querySelector('#deposit-input');
    if (depositInput) {
      depositInput.addEventListener('input', () => {
        deposit = Math.max(0, Math.floor(Number(depositInput.value) || 0));
        refreshPaymentUI(main);
      });
    }

    if (modalProduct) renderModal(state);
  },
};

function refreshPaymentUI(main) {
  const row = main.querySelector('.change-row');
  const btn = main.querySelector('#confirm-order');
  const total = subtotal();
  const enough = deposit >= total;
  if (row) {
    row.className = `change-row ${enough ? 'change' : 'warn'}`;
    row.innerHTML = enough
      ? `<span><i class="fa-solid fa-hand-holding-heart"></i> お釣り</span><span class="amount">${formatYen(deposit - total)}</span>`
      : `<span><i class="fa-solid fa-triangle-exclamation"></i> 預かり金額が不足しています（あと ${formatYen(total - deposit)}）</span>`;
  }
  if (btn) btn.disabled = cart.length === 0 || !enough;
}

function setDeposit(text) {
  const input = document.getElementById('deposit-input');
  if (input) input.value = text;
  deposit = Math.max(0, Math.floor(Number(text) || 0));
  const main = document.getElementById('app-main');
  if (main) refreshPaymentUI(main);
}

function calcDigit(val) {
  const input = document.getElementById('deposit-input');
  const cur = input ? input.value : String(deposit);
  setDeposit(cur === '' || cur === '0' ? val : cur + val);
}

function calcBack() {
  const input = document.getElementById('deposit-input');
  const cur = input ? input.value : String(deposit);
  setDeposit(cur.slice(0, -1));
}

function calcClear() {
  setDeposit('');
}

function openProduct(productId, state) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  if (product.is_sold_out || (!product.is_unlimited && product.stock <= 0)) {
    showToast(`${product.name} は現在売り切れです`, 'error');
    return;
  }
  modalProduct = product;
  modalQty = 1;
  modalCounts = {};
  editingIdx = null;
  renderModal(state);
}

function editLine(idx, state) {
  const line = cart[idx];
  if (!line) return;
  const product = state.products.find((p) => p.id === line.product_id);
  if (!product) {
    showToast('商品が見つかりません。在庫画面で確認してください。', 'error');
    return;
  }
  modalProduct = product;
  modalQty = product.is_unlimited
    ? Math.max(1, line.quantity)
    : Math.min(Math.max(1, line.quantity), Math.max(1, product.stock));
  modalCounts = {};
  for (const t of line.toppings) modalCounts[t.topping_id] = t.quantity;
  editingIdx = idx;
  renderModal(state);
}

function renderModal(state) {
  let overlay = document.getElementById('topping-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'topping-overlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  const product = state.products.find((p) => p.id === modalProduct.id);
  const base = product ? product.price : modalProduct.price;
  const stock = product ? (product.is_unlimited ? Infinity : product.stock) : 0;
  const toppingTotal = state.toppings.reduce((s, t) => s + t.price * (modalCounts[t.id] || 0), 0);

  overlay.innerHTML = `
    <div class="modal topping-modal">
      <div class="topping-modal-head">
        <div class="modal-product-title">
          ${modalProduct.image ? `<span class="modal-product-thumb"><img src="${modalProduct.image}" alt=""></span>` : ''}
          <div>
            <h2>${escapeHtml(modalProduct.name)}</h2>
            <div class="price">本体 ${formatYen(base)}</div>
          </div>
        </div>
        <button class="modal-close" data-action="close-modal" type="button"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="product-qty-row">
        <span class="label"><i class="fa-solid fa-box"></i> 個数（商品＋トッピング 1セット）</span>
        <div class="counter">
          <button class="counter-btn" data-action="prod-dec" type="button"
                  ${modalQty <= 1 ? 'disabled' : ''}><i class="fa-solid fa-minus"></i></button>
          <span class="counter-val">${modalQty}</span>
          <button class="counter-btn inc" data-action="prod-inc" type="button"
                  ${modalQty >= stock ? 'disabled' : ''}><i class="fa-solid fa-plus"></i></button>
        </div>
        <span class="qty-price">1セット ${formatYen(base + toppingTotal)}</span>
      </div>
      <div class="topping-list">
        ${state.toppings.map((t) => {
          const qty = modalCounts[t.id] || 0;
          const unlimited = !!t.is_unlimited;
          const maxPerSet = unlimited ? null : Math.floor(t.stock / Math.max(1, modalQty));
          const disabled = t.is_sold_out || (!unlimited && (t.stock <= 0 || maxPerSet <= 0));
          const maxed = !unlimited && qty >= maxPerSet;
          return `
            <div class="topping-row ${disabled ? 'disabled' : ''}">
              <div class="topping-info">
                <div class="name">${escapeHtml(t.name)}</div>
                <div class="meta">
                  ${t.is_sold_out || (!unlimited && t.stock <= 0)
                    ? '<span class="soldout-tag"><i class="fa-solid fa-ban"></i> SOLD OUT</span>'
                    : `${formatYen(t.price)}/個 ・ 1セットあたり${unlimited ? '無制限' : `最大${formatNumber(maxPerSet)}個`}`}
                </div>
              </div>
              <div class="counter">
                <button class="counter-btn" data-action="dec" data-id="${t.id}" type="button"
                        ${qty === 0 || disabled ? 'disabled' : ''}><i class="fa-solid fa-minus"></i></button>
                <span class="counter-val">${qty}</span>
                <button class="counter-btn inc" data-action="inc" data-id="${t.id}" type="button"
                        ${disabled || maxed ? 'disabled' : ''}><i class="fa-solid fa-plus"></i></button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="topping-modal-foot">
        <div class="total">合計 ${formatYen((base + toppingTotal) * modalQty)}</div>
        <button class="btn btn-primary" data-action="add-to-cart" type="button">
          ${editingIdx === null
            ? '<i class="fa-solid fa-cart-plus"></i> カートに追加'
            : '<i class="fa-solid fa-pen"></i> 更新'}
        </button>
      </div>
    </div>
  `;

  overlay.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      if (action === 'close-modal') closeModal();
      else if (action === 'prod-inc') { modalQty = Math.min(modalQty + 1, stock); renderModal(state); }
      else if (action === 'prod-dec') { modalQty = Math.max(1, modalQty - 1); renderModal(state); }
      else if (action === 'inc') { modalCounts[el.dataset.id] = (modalCounts[el.dataset.id] || 0) + 1; renderModal(state); }
      else if (action === 'dec') {
        modalCounts[el.dataset.id] = Math.max(0, (modalCounts[el.dataset.id] || 0) - 1);
        renderModal(state);
      } else if (action === 'add-to-cart') addToCart();
    });
  });
}

function closeModal() {
  modalProduct = null;
  modalQty = 1;
  modalCounts = {};
  editingIdx = null;
  document.getElementById('topping-overlay')?.remove();
}

function toppingKey(tops) {
  return tops.map((t) => `${t.topping_id}:${t.quantity}`).sort().join(',');
}

function addToCart() {
  const current = window.__state.products.find((p) => p.id === modalProduct.id);
  const qty = current && !current.is_unlimited ? Math.min(modalQty, current.stock) : modalQty;
  const tops = Object.entries(modalCounts)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({ topping_id: id, quantity: q }));
  const line = {
    product_id: modalProduct.id,
    name: modalProduct.name,
    unit_price: modalProduct.price,
    quantity: qty,
    toppings: tops.map(({ topping_id, quantity }) => {
      const t = window.__state.toppings.find((x) => x.id === topping_id);
      return { topping_id, name: t.name, price: t.price, quantity };
    }),
  };
  const editing = editingIdx !== null;
  if (editing) {
    cart.splice(editingIdx, 1);
    editingIdx = null;
  }
  const existing = cart.find((l) => l.product_id === line.product_id && toppingKey(l.toppings) === toppingKey(line.toppings));
  if (existing) {
    existing.quantity += line.quantity;
  } else {
    cart.push(line);
  }
  closeModal();
  showToast(`${line.name} × ${line.quantity} をカート${editing ? 'に反映' : 'に追加'}しました`, 'success');
  const main = document.getElementById('app-main');
  if (main) PosView.render(main, window.__state);
}

async function confirmOrder() {
  const items = cart.map((l) => ({
    product_id: l.product_id,
    quantity: l.quantity,
    toppings: l.toppings.map((t) => ({ topping_id: t.topping_id, quantity: t.quantity })),
  }));
  try {
    const res = await api('/api/orders', { method: 'POST', body: { items, depositAmount: deposit } });
    const order = res.order;
    cart = [];
    deposit = 0;
    showToast(`注文 #${order.order_number} を受付ました。お釣り ${formatYen(order.change_amount)}`, 'success');
    const main = document.getElementById('app-main');
    if (main) PosView.render(main, window.__state);
  } catch (e) {
    if (e.message !== 'unauthorized') showToast(e.message, 'error');
  }
}
