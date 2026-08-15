import { api } from '../api.js';
import { formatYen, formatNumber, escapeHtml, showToast } from '../util.js';

function stockChip(record) {
  if (record.is_unlimited) return '<span class="stock-chip unlimited">無制限</span>';
  const cls = record.stock <= 0 ? 'empty' : record.stock <= 5 ? 'low' : '';
  return `<span class="stock-chip ${cls}">${formatNumber(record.stock)}</span>`;
}

function soldOutCell(record, type) {
  const checked = record.is_sold_out ? 'checked' : '';
  return `
    <div style="display:flex;align-items:center;gap:8px">
      <label class="switch">
        <input type="checkbox" data-action="toggle-soldout" data-type="${type}" data-id="${record.id}" ${checked}>
        <span class="slider"></span>
      </label>
      ${record.is_sold_out ? '<span class="soldout-tag">SOLD OUT</span>' : ''}
    </div>
  `;
}

function stockEditor(record, type) {
  return `
    <div class="stock-edit">
      <input type="number" class="stock-input" data-action="stock-input" data-type="${type}" data-id="${record.id}"
             min="0" step="1" value="${record.is_unlimited ? '' : record.stock}"
             placeholder="${record.is_unlimited ? '無制限' : '0'}" ${record.is_unlimited ? 'disabled' : ''}>
      <button class="btn btn-ghost btn-sm" data-action="set-stock" data-type="${type}" data-id="${record.id}" type="button">設定</button>
      <button class="btn btn-ghost btn-sm unlimited-toggle${record.is_unlimited ? ' on' : ''}" data-action="toggle-unlimited"
              data-type="${type}" data-id="${record.id}" type="button">無制限</button>
    </div>
  `;
}

const MAX_IMG_DIM = 480;

function readCompressedImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) {
      reject(new Error('画像ファイル（JPG/PNG など）を選択してください。'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('画像サイズが大きすぎます（10MBまで）。'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMG_DIM / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function productThumb(image) {
  if (image) return `<span class="product-thumb"><img src="${image}" alt=""></span>`;
  return '<span class="product-thumb no-image"><i class="fa-solid fa-image"></i></span>';
}
export const InventoryView = {
  render(main, state) {
    main.innerHTML = `
      <div class="view-scroll">
      <div class="view-title"><i class="fa-solid fa-boxes-stacked"></i> 在庫 &amp; 商品管理
        <span class="sub">商品とトッピングの在庫・品切れを管理します</span>
      </div>

      <div class="inv-section">
        <h2><i class="fa-solid fa-ice-cream"></i> メイン商品</h2>
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>商品名</th><th>基本価格</th><th>在庫数</th><th>売り切れ</th><th>在庫変更</th><th>編集</th><th>削除</th></tr>
              </thead>
              <tbody>
                ${state.products.map((p) => `
                  <tr>
                    <td><div class="prod-cell">${p.image ? `<span class="product-thumb small"><img src="${p.image}" alt=""></span>` : ''}<strong>${escapeHtml(p.name)}</strong></div></td>
                    <td class="num">${formatYen(p.price)}</td>
                    <td class="num">${stockChip(p)}</td>
                    <td>${soldOutCell(p, 'product')}</td>
                    <td>${stockEditor(p, 'product')}</td>
                    <td><button class="btn btn-ghost btn-sm" data-action="edit-product" data-id="${p.id}" type="button" title="編集"><i class="fa-solid fa-pen"></i></button></td>
                    <td><button class="btn btn-danger btn-sm" data-action="delete-product" data-id="${p.id}" type="button" title="削除"><i class="fa-solid fa-trash"></i></button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <form id="add-product-form" class="add-form">
            <div>
              <label>商品名</label>
              <input type="text" id="pd-name" placeholder="例: メロンソフトアイス" required>
            </div>
            <div>
              <label>基本価格（円）</label>
              <input type="number" id="pd-price" min="0" step="1" placeholder="0" required>
            </div>
            <div>
              <div class="stock-field">
                <label>初期在庫数</label>
                <input type="number" id="pd-stock" min="0" step="1" placeholder="0" required>
              </div>
              <label class="mini-check"><input type="checkbox" id="pd-unlimited"> 無制限</label>
            </div>
            <div class="add-form-image-row">
              <div class="file-field">
                <label>商品画像（任意）</label>
                <input type="file" id="pd-image" accept="image/*">
              </div>
              <button type="submit" class="btn btn-primary"><i class="fa-solid fa-plus"></i> 商品追加</button>
            </div>
          </form>
        </div>
      </div>

      <div class="inv-section">
        <h2><i class="fa-solid fa-candy-cane"></i> トッピング（全共通）</h2>
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>トッピング名</th><th>追加価格/個</th><th>在庫数</th><th>売り切れ</th><th>在庫変更</th></tr>
              </thead>
              <tbody>
                ${state.toppings.map((t) => `
                  <tr>
                    <td><strong>${escapeHtml(t.name)}</strong></td>
                    <td class="num">${formatYen(t.price)}</td>
                    <td class="num">${stockChip(t)}</td>
                    <td>${soldOutCell(t, 'topping')}</td>
                    <td>${stockEditor(t, 'topping')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <form id="add-topping-form" class="add-form">
            <div>
              <label>トッピング名</label>
              <input type="text" id="tp-name" placeholder="例: シナモン" required>
            </div>
            <div>
              <label>追加価格（円）</label>
              <input type="number" id="tp-price" min="0" step="1" placeholder="0" required>
            </div>
            <div>
              <div class="stock-field">
                <label>初期在庫数</label>
                <input type="number" id="tp-stock" min="0" step="1" placeholder="0" required>
              </div>
              <label class="mini-check"><input type="checkbox" id="tp-unlimited"> 無制限</label>
            </div>
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-plus"></i> トッピング追加</button>
          </form>
        </div>
      </div>

      <div class="inv-section">
        <h2><i class="fa-solid fa-shop"></i> 店舗設定</h2>
        <div class="card">
          <form id="org-name-form" class="add-form settings-form">
            <div>
              <label>団体名（ヘッダーに表示）</label>
              <input type="text" id="org-name-input" value="${escapeHtml(state.orgName || '')}" maxlength="40" required>
            </div>
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> 保存</button>
          </form>
          <div class="reset-row">
            <p><i class="fa-solid fa-triangle-exclamation"></i> 注文・売上・商品・トッピングをすべて削除して、まっさらな状態にします。元に戻すことはできません。</p>
            <button class="btn btn-danger" data-action="reset-data" type="button">
              <i class="fa-solid fa-rotate-left"></i> 全データを初期化
            </button>
          </div>
        </div>
      </div>
      </div>
    `;

    main.querySelectorAll('input[data-action="toggle-soldout"]').forEach((el) => {
      el.addEventListener('change', () => {
        const { id, type } = el.dataset;
        api(`/api/${type}s/${id}/soldout`, { method: 'POST', body: { is_sold_out: el.checked } })
          .catch((e) => { if (e.message !== 'unauthorized') showToast(e.message, 'error'); });
      });
    });

    main.querySelectorAll('button[data-action="set-stock"]').forEach((el) => {
      el.addEventListener('click', () => {
        const { id, type } = el.dataset;
        const input = el.closest('.stock-edit').querySelector('.stock-input');
        const stock = Math.max(0, Math.floor(Number(input.value) || 0));
        api(`/api/${type}s/${id}/stock`, { method: 'POST', body: { stock } })
          .then(() => showToast(`在庫数を ${stock} に設定しました`, 'success'))
          .catch((e) => { if (e.message !== 'unauthorized') showToast(e.message, 'error'); });
      });
    });

    main.querySelectorAll('button[data-action="toggle-unlimited"]').forEach((el) => {
      el.addEventListener('click', () => {
        const { id, type } = el.dataset;
        const turnOn = !el.classList.contains('on');
        api(`/api/${type}s/${id}/unlimited`, { method: 'POST', body: { is_unlimited: turnOn } })
          .then(() => showToast(turnOn ? '無制限に設定しました' : '無制限を解除しました', 'success'))
          .catch((e) => { if (e.message !== 'unauthorized') showToast(e.message, 'error'); });
      });
    });

    const form = main.querySelector('#add-topping-form');
    if (form) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const name = form.querySelector('#tp-name').value.trim();
        const price = Math.max(0, Math.floor(Number(form.querySelector('#tp-price').value) || 0));
        const stock = Math.max(0, Math.floor(Number(form.querySelector('#tp-stock').value) || 0));
        const is_unlimited = form.querySelector('#tp-unlimited').checked;
        api('/api/toppings', { method: 'POST', body: { name, price, stock, is_unlimited } })
          .then((res) => {
            showToast(`トッピング「${res.topping.name}」を追加しました`, 'success');
            form.reset();
          })
          .catch((e) => { if (e.message !== 'unauthorized') showToast(e.message, 'error'); });
      });
    }

    const productForm = main.querySelector('#add-product-form');
    if (productForm) {
      productForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const name = productForm.querySelector('#pd-name').value.trim();
        const price = Math.max(0, Math.floor(Number(productForm.querySelector('#pd-price').value) || 0));
        const stock = Math.max(0, Math.floor(Number(productForm.querySelector('#pd-stock').value) || 0));
        const is_unlimited = productForm.querySelector('#pd-unlimited').checked;
        const fileInput = productForm.querySelector('#pd-image');
        const body = { name, price, stock, is_unlimited };
        const submit = (image) => api('/api/products', { method: 'POST', body: { ...body, image } })
          .then((res) => {
            showToast(`商品「${res.product.name}」を追加しました`, 'success');
            productForm.reset();
          })
          .catch((e) => { if (e.message !== 'unauthorized') showToast(e.message, 'error'); });
        if (fileInput && fileInput.files.length) {
          readCompressedImage(fileInput.files[0])
            .then((image) => submit(image))
            .catch((e) => showToast(e.message, 'error'));
        } else {
          submit(null);
        }
      });
    }

    main.querySelectorAll('.mini-check input[type="checkbox"]').forEach((cb) => {
      const field = cb.closest('div').querySelector('.stock-field');
      if (!field) return;
      const input = field.querySelector('input');
      const apply = () => {
        field.classList.toggle('hidden', cb.checked);
        if (cb.checked) { input.value = ''; input.removeAttribute('required'); }
        else input.required = true;
      };
      apply();
      cb.addEventListener('change', apply);
    });

    main.querySelectorAll('[data-action="edit-product"]').forEach((el) => {
      el.addEventListener('click', () => {
        const product = state.products.find((p) => p.id === el.dataset.id);
        if (product) openEditProductModal(product);
      });
    });

    main.querySelectorAll('[data-action="delete-product"]').forEach((el) => {
      el.addEventListener('click', () => {
        const product = state.products.find((p) => p.id === el.dataset.id);
        if (!product) return;
        if (!window.confirm(`商品「${product.name}」を削除しますか？\n注文履歴は残りますが、在庫の自動返却は対象外になります。`)) return;
        api(`/api/products/${product.id}/delete`, { method: 'POST' })
          .then(() => showToast(`商品「${product.name}」を削除しました`, 'success'))
          .catch((e) => { if (e.message !== 'unauthorized') showToast(e.message, 'error'); });
      });
    });

    const orgForm = main.querySelector('#org-name-form');
    if (orgForm) {
      orgForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const name = orgForm.querySelector('#org-name-input').value.trim();
        api('/api/orgname', { method: 'POST', body: { name } })
          .then(() => showToast('団体名を保存しました', 'success'))
          .catch((e) => { if (e.message !== 'unauthorized') showToast(e.message, 'error'); });
      });
    }

    const resetBtn = main.querySelector('[data-action="reset-data"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (!window.confirm('すべてのデータ（注文・売上・在庫・商品・トッピング・団体名）を初期状態に戻します。\nこの操作は取り消せません。よろしいですか？')) return;
        try {
          await api('/api/reset', { method: 'POST' });
          showToast('すべてのデータを初期状態に戻しました', 'success');
        } catch (e) {
          if (e.message !== 'unauthorized') showToast(e.message, 'error');
        }
      });
    }
  },
};

function openEditProductModal(product) {
  let overlay = document.getElementById('edit-product-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'edit-product-overlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="modal edit-product-modal">
      <div class="topping-modal-head">
        <h2><i class="fa-solid fa-pen"></i> 商品を編集</h2>
        <button class="modal-close" data-action="close" type="button"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="edit-product-form" class="edit-product-form">
        <div>
          <label>商品名</label>
          <input type="text" id="edit-name" value="${escapeHtml(product.name)}" required>
        </div>
        <div>
          <label>基本価格（円）</label>
          <input type="number" id="edit-price" min="0" step="1" value="${product.price}" required>
        </div>
        <div>
          <label>商品画像</label>
          <div class="edit-image-row">
            <img id="edit-image-preview" class="edit-image-preview${product.image ? '' : ' hidden'}"
                 src="${product.image || ''}" alt="">
            <input type="file" id="edit-image" accept="image/*">
            <button type="button" class="btn btn-danger btn-sm${product.image ? '' : ' hidden'}"
                    id="edit-image-clear"><i class="fa-solid fa-trash"></i> 画像を削除</button>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block"><i class="fa-solid fa-floppy-disk"></i> 保存</button>
      </form>
    </div>
  `;

  let editImageValue;
  const preview = overlay.querySelector('#edit-image-preview');
  const clearBtn = overlay.querySelector('#edit-image-clear');
  const fileInput = overlay.querySelector('#edit-image');

  fileInput.addEventListener('change', () => {
    if (!fileInput.files.length) return;
    readCompressedImage(fileInput.files[0])
      .then((image) => {
        editImageValue = image;
        preview.src = image;
        preview.classList.remove('hidden');
        clearBtn.classList.remove('hidden');
      })
      .catch((e) => showToast(e.message, 'error'));
  });

  clearBtn.addEventListener('click', () => {
    editImageValue = '';
    fileInput.value = '';
    preview.classList.add('hidden');
    preview.removeAttribute('src');
    clearBtn.classList.add('hidden');
  });

  overlay.querySelector('[data-action="close"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#edit-product-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = overlay.querySelector('#edit-name').value.trim();
    const price = Math.max(0, Math.floor(Number(overlay.querySelector('#edit-price').value) || 0));
    const image = editImageValue === undefined ? product.image : editImageValue;
    api(`/api/products/${product.id}/edit`, { method: 'POST', body: { name, price, image } })
      .then(() => {
        showToast(`商品「${name}」を更新しました`, 'success');
        overlay.remove();
      })
      .catch((e) => { if (e.message !== 'unauthorized') showToast(e.message, 'error'); });
  });
}
