const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const store = require('./store');

const PORT = process.env.PORT || 3000;

store.load();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (req.originalUrl === '/api/auth') return next();
  const username = req.headers['x-username'];
  const password = req.headers['x-password'];
  if (!store.verifyLogin(username, password)) {
    return res.status(401).json({ ok: false, error: '認証が必要です。再入場してください。' });
  }
  next();
}

app.use('/api', requireAuth);

function publicState() {
  const { products, toppings, orders, orgName } = store.getState();
  return { products, toppings, orders, orgName };
}

function broadcast(snapshot) {
  const payload = JSON.stringify({ type: 'state', data: snapshot });
  for (const client of wss.clients) {
    if (client.authenticated && client.readyState === 1) client.send(payload);
  }
}

function emit() {
  broadcast(publicState());
}

function handleResult(res, result) {
  if (!result.ok) return res.status(400).json(result);
  emit();
  return res.json(result);
}

app.post('/api/auth', (req, res) => {
  const { username, password } = req.body || {};
  if (store.verifyLogin(username, password)) {
    return res.json({ ok: true, username: String(username).trim() });
  }
  return res.status(401).json({ ok: false, error: 'ユーザー名またはパスワードが正しくありません。' });
});

app.get('/api/state', (req, res) => {
  res.json(publicState());
});

app.post('/api/orders', (req, res) => {
  const { items, depositAmount } = req.body || {};
  handleResult(res, store.createOrder({ items, depositAmount }));
});

app.post('/api/orders/:id/status', (req, res) => {
  const { status } = req.body || {};
  handleResult(res, store.setOrderStatus(req.params.id, status));
});

app.post('/api/orders/:id/undo', (req, res) => {
  handleResult(res, store.undoOrderStatus(req.params.id));
});

app.post('/api/orders/:id/cancel', (req, res) => {
  handleResult(res, store.cancelOrder(req.params.id));
});

app.post('/api/products/:id/stock', (req, res) => {
  const { stock } = req.body || {};
  handleResult(res, store.setProductStock(req.params.id, stock));
});

app.post('/api/products/:id/unlimited', (req, res) => {
  const { is_unlimited } = req.body || {};
  handleResult(res, store.setProductUnlimited(req.params.id, is_unlimited));
});

app.post('/api/products/:id/soldout', (req, res) => {
  const { is_sold_out } = req.body || {};
  handleResult(res, store.setProductSoldOut(req.params.id, is_sold_out));
});

app.post('/api/products', (req, res) => {
  const { name, price, stock, is_unlimited, image } = req.body || {};
  handleResult(res, store.addProduct({ name, price, stock, is_unlimited, image }));
});

app.post('/api/products/:id/edit', (req, res) => {
  const { name, price, image } = req.body || {};
  handleResult(res, store.updateProduct(req.params.id, { name, price, image }));
});

app.post('/api/products/:id/delete', (req, res) => {
  handleResult(res, store.deleteProduct(req.params.id));
});

app.post('/api/reset', (req, res) => {
  handleResult(res, store.resetData());
});

app.post('/api/orgname', (req, res) => {
  const { name } = req.body || {};
  handleResult(res, store.setOrgName(name));
});

app.post('/api/users', (req, res) => {
  const { username } = req.body || {};
  handleResult(res, store.addUser(username));
});

app.post('/api/toppings', (req, res) => {
  const { name, price, stock, is_unlimited } = req.body || {};
  handleResult(res, store.addTopping({ name, price, stock, is_unlimited }));
});

app.post('/api/toppings/:id/stock', (req, res) => {
  const { stock } = req.body || {};
  handleResult(res, store.setToppingStock(req.params.id, stock));
});

app.post('/api/toppings/:id/unlimited', (req, res) => {
  const { is_unlimited } = req.body || {};
  handleResult(res, store.setToppingUnlimited(req.params.id, is_unlimited));
});

app.post('/api/toppings/:id/soldout', (req, res) => {
  const { is_sold_out } = req.body || {};
  handleResult(res, store.setToppingSoldOut(req.params.id, is_sold_out));
});

app.get('/api/export/csv', (req, res) => {
  const orders = store.getOrdersForExport();
  const lines = [];
  lines.push([
    '注文番号', '注文ID', '日時', 'ステータス', '合計金額',
    '商品ID', '商品名', '数量', '本体単価', '明細金額',
    'トッピングID', 'トッピング名', 'トッピング単価', 'トッピング数',
  ].join(','));
  for (const o of orders) {
    for (const item of o.items) {
      const tops = item.toppings && item.toppings.length ? item.toppings : [{ topping_id: '', topping_name: '', price: '', quantity: '' }];
      for (const t of tops) {
        lines.push([
          o.order_number, o.order_id, o.created_at, o.status, o.total_amount,
          item.product_id, csvEscape(item.product_name), item.quantity, item.unit_price, item.total_price,
          t.topping_id, csvEscape(t.topping_name), t.price, t.quantity,
        ].join(','));
      }
    }
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="pos_orders.csv"');
  res.send('\uFEFF' + lines.join('\r\n'));
});

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.authenticated = false;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'auth') {
        if (store.verifyLogin(msg.username, msg.password)) {
          ws.authenticated = true;
          ws.send(JSON.stringify({ type: 'state', data: publicState() }));
        } else {
          ws.close(4001, 'unauthorized');
        }
      }
    } catch { /* ignore */ }
  });
});

const keepAliveInterval = setInterval(() => {
  for (const client of wss.clients) {
    if (client.readyState !== 1) continue;
    if (!client.isAlive) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
}, 30000);

wss.on('close', () => clearInterval(keepAliveInterval));

server.listen(PORT, () => {
  console.log(`POSレジアプリ起動: http://localhost:${PORT}`);
});
