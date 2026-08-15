# AGENTS.md

Single-group POS cash-register web app for a school festival (文化祭模擬店). All UI text and
error messages are in **Japanese**; keep new strings Japanese.

## Run
- `npm start` (== `npm run dev` == `node server.js`). No build, no tests, no lint. Deps: express, ws only.
- Server listens on all interfaces on `PORT` (default 3000) and serves `public/` + WS on the same port — multi-device sync is the point.
- Passcode: `PASSCODE` env var overrides `data.json`'s `passcode` at startup (`store.load()` applies it last). `data.json` is gitignored.

## Architecture
- `store.js` — all business logic and persistence. After every successful mutation it broadcasts the full `{type:'state', data:{products,toppings,orders,orgName}}` snapshot over WS.
- `server.js` — Express routes + WebSocket broadcast. All `/api/*` routes except `/api/auth` require the `x-passcode` header (default passcode `1234`); 401 triggers client logout. Product CRUD (`POST /api/products`, `.../:id/edit`, `.../:id/delete`) and org name (`POST /api/orgname`) live here too; header brand name is driven by `state.orgName`.
- `public/` — vanilla JS ES modules (no framework, no bundler). Views live in `public/js/views/`, each exporting `{render(main, state)}` that sets `main.innerHTML` then wires `[data-action]` handlers. Register new views in `main.js` `views` map + add a tab in `index.html`. Shared helpers in `util.js`, auth/WS client in `api.js`.
- `REQUIREMENTS.md` is the authoritative Japanese spec — read it before changing behavior.

## Gotchas
- **`data.json` is the live database** — read+written synchronously by `store.js` on every mutation; created from `DEFAULT_DATA` on first run. Do not hand-edit while the server runs. If corrupt, `store.js` silently falls back to defaults.
- **Server state is the source of truth.** Views must re-render from `window.__state` (fed by WS), not from API responses. `pos.js` keeps module-level `cart`/`deposit` that intentionally survive re-renders.
- Order statuses: `WAITING → PREPARING → READY → COMPLETED`, plus `CANCELLED`. `undoOrderStatus` only steps back one level (`prev_status`).
- `createOrder` validates ALL items and toppings first, then decrements stock (transactional). `cancelOrder` restores stock for product and toppings. Keep both sides in sync when changing stock logic.
- **Stock model: products/toppings have `is_unlimited`.** Unlimited items skip the stock check, are never decremented (`createOrder`), and are never restored (`cancelOrder`). Stock is set as an **absolute value** via `setProductStock`/`setToppingStock` (`POST /api/{products|toppings}/:id/stock`, body `{stock}`), which also clears `is_unlimited`; unlimited is toggled via `POST /api/{products|toppings}/:id/unlimited` body `{is_unlimited}`. `load()` backfills missing `is_unlimited` (default `false`) for legacy data.
- IDs come from `nextId(prefix, list, key='id')` with prefixes `p/t/o/ci/oit`; new prefixes must not collide. **Orders use the `order_id` field and order items use `cart_item_id`** — pass the correct `key` to `nextId` (e.g. `nextId('o', data.orders, 'order_id')`), otherwise every order gets the same id. `load()` runs `normalizeIds()` to repair legacy duplicate ids.
- `POST /api/reset` wipes everything to a **blank system** (products, toppings, orders all `[]`) — used by the "全データを初期化" button in the inventory settings section. `store.resetData()` starts from `structuredClone(DEFAULT_DATA)` then empties `products`/`toppings`/`orders`; passcode, orgName, nextOrderNumber stay at defaults.
- Products have an optional `image` field holding a **compressed JPEG data URL** (client resizes to ≤480px via canvas before upload; `express.json({ limit: '10mb' })` in `server.js`). `load()` backfills missing `image` (default `null`); edit with `image: ''` clears it. POS cards + topping modal + inventory table show the thumbnail.
- CSV export (`/api/export/csv`) uses BOM + CRLF; keep `csvEscape` for any new columns.
