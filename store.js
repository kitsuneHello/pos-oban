const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.txt');

const STATUS = Object.freeze({
  WAITING: 'WAITING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const DEFAULT_DATA = {
  passcode: '1234',
  orgName: '文化祭 模擬店レジ',
  nextOrderNumber: 1,
  products: [
    { id: 'p1', name: 'バニラソフトアイス', price: 300, stock: 100, is_sold_out: false, is_unlimited: false, image: null },
    { id: 'p2', name: 'チョコソフトアイス', price: 320, stock: 100, is_sold_out: false, is_unlimited: false, image: null },
    { id: 'p3', name: 'いちごソフトアイス', price: 320, stock: 80, is_sold_out: false, is_unlimited: false, image: null },
    { id: 'p4', name: 'かき氷（いちご）', price: 350, stock: 60, is_sold_out: false, is_unlimited: false, image: null },
    { id: 'p5', name: 'たこ焼き（8個入り）', price: 400, stock: 50, is_sold_out: false, is_unlimited: false, image: null },
    { id: 'p6', name: '焼きそば', price: 300, stock: 50, is_sold_out: false, is_unlimited: false, image: null },
  ],
  toppings: [
    { id: 't1', name: 'ホイップクリーム', price: 50, stock: 100, is_sold_out: false, is_unlimited: false },
    { id: 't2', name: 'チョコソース', price: 30, stock: 100, is_sold_out: false, is_unlimited: false },
    { id: 't3', name: 'あんこ', price: 40, stock: 80, is_sold_out: false, is_unlimited: false },
    { id: 't4', name: '抹茶ソース', price: 30, stock: 80, is_sold_out: false, is_unlimited: false },
    { id: 't5', name: 'マヨネーズ', price: 20, stock: 100, is_sold_out: false, is_unlimited: false },
    { id: 't6', name: '青のり', price: 0, stock: 100, is_sold_out: false, is_unlimited: false },
  ],
  orders: [],
};

let data = null;

function normalizeIds() {
  let changed = false;
  const orderSeen = new Set();
  const itemSeen = new Set();
  for (const o of data.orders) {
    if (!o.order_id || orderSeen.has(o.order_id)) {
      o.order_id = nextId('o', data.orders, 'order_id');
      changed = true;
    }
    orderSeen.add(o.order_id);
    for (const it of o.items || []) {
      if (!it.cart_item_id || itemSeen.has(it.cart_item_id)) {
        it.cart_item_id = nextId('ci', data.orders.flatMap((x) => x.items || []), 'cart_item_id');
        changed = true;
      }
      itemSeen.add(it.cart_item_id);
    }
  }
  if (changed) persist();
}

function load() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (typeof data.passcode !== 'string') data.passcode = DEFAULT_DATA.passcode;
      if (typeof data.orgName !== 'string' || !data.orgName.trim()) data.orgName = DEFAULT_DATA.orgName;
      if (typeof data.nextOrderNumber !== 'number') data.nextOrderNumber = 1;
      if (!Array.isArray(data.products)) data.products = DEFAULT_DATA.products;
      if (!Array.isArray(data.toppings)) data.toppings = DEFAULT_DATA.toppings;
      if (!Array.isArray(data.orders)) data.orders = [];
      for (const p of data.products) if (typeof p.is_unlimited !== 'boolean') p.is_unlimited = false;
      for (const t of data.toppings) if (typeof t.is_unlimited !== 'boolean') t.is_unlimited = false;
      for (const p of data.products) if (typeof p.image !== 'string') p.image = null;
      normalizeIds();
    } catch (err) {
      console.error('data.json の読み込みに失敗。初期データで起動します:', err.message);
      data = structuredClone(DEFAULT_DATA);
    }
  } else {
    data = structuredClone(DEFAULT_DATA);
    persist();
  }
  if (process.env.PASSCODE) data.passcode = process.env.PASSCODE;
  return data;
}

function persist() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function resetData() {
  data = structuredClone(DEFAULT_DATA);
  data.products = [];
  data.toppings = [];
  data.orders = [];
  persist();
  return { ok: true };
}

function getState() {
  return data;
}

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const lines = fs.readFileSync(USERS_FILE, 'utf8').split(/\r?\n/);
    return lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  } catch (err) {
    console.error('users.txt の読み込みに失敗:', err.message);
    return [];
  }
}

function verifyLogin(username, password) {
  const name = String(username || '').trim();
  if (!name) return false;
  if (!loadUsers().includes(name)) return false;
  return String(password) === String(data.passcode);
}

function addUser(username) {
  const name = String(username || '').trim();
  if (!name) return { ok: false, error: 'ユーザー名を入力してください。' };
  const users = loadUsers();
  if (users.includes(name)) return { ok: false, error: 'このユーザー名はすでに登録されています。' };
  fs.appendFileSync(USERS_FILE, name + '\n', 'utf8');
  return { ok: true, username: name };
}

function nextId(prefix, list, key = 'id') {
  let n = 1;
  const used = new Set(list.map((x) => x[key]));
  while (used.has(prefix + n)) n++;
  return prefix + n;
}

function calcOrderTotal(items) {
  let total = 0;
  for (const item of items) {
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    const toppingTotal = item.toppings.reduce((s, t) => s + t.price * t.quantity, 0);
    const itemTotal = qty * (item.unit_price + toppingTotal);
    item.total_price = itemTotal;
    total += itemTotal;
  }
  return total;
}

/**
 * 注文確定。在庫の確保（メイン商品・トッピングとも）をトランザクション的に行う。
 * 不足があれば変更を適用せずにエラーを返す。
 */
function createOrder({ items, depositAmount }) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'カートが空です。' };
  }

  const reservation = [];
  const validToppingIds = new Set(data.toppings.map((t) => t.id));

  for (const item of items) {
    const product = data.products.find((p) => p.id === item.product_id);
    if (!product) return { ok: false, error: `商品が見つかりません: ${item.product_id}` };
    if (product.is_sold_out) return { ok: false, error: `${product.name} はSOLD OUTです。` };
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    if (!product.is_unlimited && product.stock < qty) {
      return { ok: false, error: `${product.name} の在庫が不足しています。（残り ${product.stock}個）` };
    }
    if (!product.is_unlimited) reservation.push({ product, qty });

    const toppings = Array.isArray(item.toppings) ? item.toppings : [];
    for (const t of toppings) {
      const tqty = Math.max(1, Math.floor(t.quantity || 1));
      if (!validToppingIds.has(t.topping_id)) {
        return { ok: false, error: `トッピングが見つかりません: ${t.topping_id}` };
      }
      const topping = data.toppings.find((x) => x.id === t.topping_id);
      if (topping.is_sold_out) return { ok: false, error: `${topping.name} はSOLD OUTです。` };
      const consumed = qty * tqty;
      if (!topping.is_unlimited && topping.stock < consumed) {
        return { ok: false, error: `${topping.name} の在庫が不足しています。（残り ${topping.stock}個）` };
      }
      if (!topping.is_unlimited) reservation.push({ product: topping, qty: consumed });
    }
  }

  reservation.forEach(({ product, qty }) => {
    product.stock -= qty;
  });

  const builtItems = items.map((item) => {
    const product = data.products.find((p) => p.id === item.product_id);
    return {
      cart_item_id: nextId('ci', data.orders.flatMap((o) => o.items), 'cart_item_id'),
      product_id: product.id,
      product_name: product.name,
      unit_price: product.price,
      quantity: Math.max(1, Math.floor(item.quantity || 1)),
      total_price: 0,
      toppings: (Array.isArray(item.toppings) ? item.toppings : []).map((t) => {
        const topping = data.toppings.find((x) => x.id === t.topping_id);
        return {
          id: nextId('oit', data.orders.flatMap((o) => o.items).flatMap((i) => i.toppings)),
          topping_id: topping.id,
          topping_name: topping.name,
          price: topping.price,
          quantity: Math.max(1, Math.floor(t.quantity || 1)),
        };
      }),
    };
  });

  const order = {
    order_id: nextId('o', data.orders, 'order_id'),
    order_number: data.nextOrderNumber,
    status: STATUS.WAITING,
    total_amount: 0,
    deposit_amount: Math.max(0, Math.floor(depositAmount || 0)),
    change_amount: 0,
    created_at: new Date().toISOString(),
    prev_status: null,
    items: builtItems,
  };

  order.total_amount = calcOrderTotal(order.items);
  order.change_amount = Math.max(0, order.deposit_amount - order.total_amount);

  data.orders.push(order);
  data.nextOrderNumber += 1;
  persist();
  return { ok: true, order };
}

function restoreStock(order) {
  for (const item of order.items) {
    const itemQty = Math.max(1, Math.floor(item.quantity || 1));
    const product = data.products.find((p) => p.id === item.product_id);
    if (product && !product.is_unlimited) product.stock += itemQty;
    for (const t of item.toppings) {
      const topping = data.toppings.find((x) => x.id === t.topping_id);
      if (topping && !topping.is_unlimited) topping.stock += itemQty * t.quantity;
    }
  }
}

function findOrder(orderId) {
  const order = data.orders.find((o) => o.order_id === orderId);
  return order || null;
}

function setOrderStatus(orderId, status) {
  const order = findOrder(orderId);
  if (!order) return { ok: false, error: '注文が見つかりません。' };
  if (!Object.values(STATUS).includes(status) || status === STATUS.CANCELLED) {
    return { ok: false, error: '不正なステータスです。' };
  }
  if (order.status === STATUS.CANCELLED) return { ok: false, error: 'キャンセル済みの注文です。' };
  order.prev_status = order.status;
  order.status = status;
  persist();
  return { ok: true, order };
}

function undoOrderStatus(orderId) {
  const order = findOrder(orderId);
  if (!order) return { ok: false, error: '注文が見つかりません。' };
  if (order.status === STATUS.CANCELLED) return { ok: false, error: 'キャンセル済みの注文です。' };
  if (!order.prev_status) return { ok: false, error: '1つ前に戻れません。' };
  const prev = order.prev_status;
  order.status = prev;
  order.prev_status = null;
  persist();
  return { ok: true, order };
}

function cancelOrder(orderId) {
  const order = findOrder(orderId);
  if (!order) return { ok: false, error: '注文が見つかりません。' };
  if (order.status === STATUS.CANCELLED) return { ok: false, error: 'すでにキャンセル済みです。' };
  restoreStock(order);
  order.status = STATUS.CANCELLED;
  persist();
  return { ok: true, order };
}

function setProductStock(productId, stock) {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return { ok: false, error: '商品が見つかりません。' };
  product.stock = Math.max(0, Math.floor(Number(stock) || 0));
  product.is_unlimited = false;
  persist();
  return { ok: true, product };
}

function setProductUnlimited(productId, value) {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return { ok: false, error: '商品が見つかりません。' };
  product.is_unlimited = !!value;
  persist();
  return { ok: true, product };
}

function setProductSoldOut(productId, value) {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return { ok: false, error: '商品が見つかりません。' };
  product.is_sold_out = !!value;
  persist();
  return { ok: true, product };
}

function addProduct({ name, price, stock, is_unlimited, image }) {
  if (!name || !String(name).trim()) return { ok: false, error: '商品名を入力してください。' };
  const product = {
    id: nextId('p', data.products),
    name: String(name).trim(),
    price: Math.max(0, Math.floor(price || 0)),
    stock: Math.max(0, Math.floor(stock || 0)),
    is_sold_out: false,
    is_unlimited: !!is_unlimited,
    image: typeof image === 'string' ? image : null,
  };
  data.products.push(product);
  persist();
  return { ok: true, product };
}

function updateProduct(productId, { name, price, image }) {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return { ok: false, error: '商品が見つかりません。' };
  if (!name || !String(name).trim()) return { ok: false, error: '商品名を入力してください。' };
  product.name = String(name).trim();
  product.price = Math.max(0, Math.floor(price || 0));
  if (typeof image === 'string') product.image = image === '' ? null : image;
  persist();
  return { ok: true, product };
}

function deleteProduct(productId) {
  const idx = data.products.findIndex((p) => p.id === productId);
  if (idx === -1) return { ok: false, error: '商品が見つかりません。' };
  const [product] = data.products.splice(idx, 1);
  persist();
  return { ok: true, product };
}

function setOrgName(name) {
  const value = String(name || '').trim();
  if (!value) return { ok: false, error: '団体名を入力してください。' };
  data.orgName = value;
  persist();
  return { ok: true, orgName: value };
}

function addTopping({ name, price, stock, is_unlimited }) {
  if (!name || !String(name).trim()) return { ok: false, error: 'トッピング名を入力してください。' };
  const topping = {
    id: nextId('t', data.toppings),
    name: String(name).trim(),
    price: Math.max(0, Math.floor(price || 0)),
    stock: Math.max(0, Math.floor(stock || 0)),
    is_sold_out: false,
    is_unlimited: !!is_unlimited,
  };
  data.toppings.push(topping);
  persist();
  return { ok: true, topping };
}

function setToppingStock(toppingId, stock) {
  const topping = data.toppings.find((t) => t.id === toppingId);
  if (!topping) return { ok: false, error: 'トッピングが見つかりません。' };
  topping.stock = Math.max(0, Math.floor(Number(stock) || 0));
  topping.is_unlimited = false;
  persist();
  return { ok: true, topping };
}

function setToppingUnlimited(toppingId, value) {
  const topping = data.toppings.find((t) => t.id === toppingId);
  if (!topping) return { ok: false, error: 'トッピングが見つかりません。' };
  topping.is_unlimited = !!value;
  persist();
  return { ok: true, topping };
}

function setToppingSoldOut(toppingId, value) {
  const topping = data.toppings.find((t) => t.id === toppingId);
  if (!topping) return { ok: false, error: 'トッピングが見つかりません。' };
  topping.is_sold_out = !!value;
  persist();
  return { ok: true, topping };
}

function getOrdersForExport() {
  return data.orders
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function getRecentOrders(limit = 50) {
  return data.orders
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

module.exports = {
  STATUS,
  load,
  persist,
  resetData,
  getState,
  verifyLogin,
  addUser,
  createOrder,
  setOrderStatus,
  undoOrderStatus,
  cancelOrder,
  setProductStock,
  setProductUnlimited,
  setProductSoldOut,
  addProduct,
  updateProduct,
  deleteProduct,
  addTopping,
  setToppingStock,
  setToppingUnlimited,
  setToppingSoldOut,
  setOrgName,
  getOrdersForExport,
  getRecentOrders,
};
