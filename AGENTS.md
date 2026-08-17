# AGENTS.md

POS register web app for a school festival food stall. Vanilla JS frontend + Express/WS backend. No build step, no tests, no linter.

## Run

```bash
npm start        # or: npm run dev (identical — both run `node server.js`)
```

Server starts on `http://localhost:3000` (`PORT` env to override).

## Architecture

- `server.js` — Express + WebSocket server, all HTTP routes and WS broadcast logic
- `store.js` — All data/business logic, CRUD, auth, persistence
- `public/` — Static frontend served by Express (no bundler, native ES modules)
  - `public/js/main.js` — SPA bootstrap, tab routing, WebSocket connection
  - `public/js/views/{pos,kds,callout,inventory,dashboard}.js` — 5 tab views
- `data.json` — Runtime database (gitignored, auto-created with defaults on first run)
- `users.txt` — One username per line, `#` comments supported

## Key patterns

- **No build/transpile step.** All JS is plain ES modules or CommonJS. Edit and reload.
- **No tests or linter.** Verification is manual (`npm start`, open browser).
- **`data.json` is gitignored** and created from `DEFAULT_DATA` in `store.js` on first launch. Delete it to reset to defaults.
- **`PASSCODE` env var** overrides the stored passcode at startup but does not persist the change.
- **`users.txt` is re-read on every login attempt** — no restart needed after edits.
- **All `/api/*` routes** (except `/api/auth`) require `x-username` + `x-password` headers.
- **WebSocket clients** must send `{type: "auth", username, password}` after connecting. Server broadcasts full state snapshot (not diffs) on every mutation.
- **Order statuses:** `WAITING` → `PREPARING` → `READY` → `COMPLETED` (plus `CANCELLED`). Single-step undo via `prev_status` field.
- **Stock is transactional:** all items in an order are validated before any stock is deducted. Cancellation restores stock.
- **IDs are prefix-based** (`p1`, `t1`, `o1`, `ci1`, `oit1`); duplicates are resolved at load time in `normalizeIds()`.
- **Atomic writes:** `data.json` is written to a `.tmp` file then renamed (see `persist()` in `store.js`).
- **Frontend auth** is stored in `sessionStorage` and auto-reconnects WebSocket with backoff.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `PASSCODE` | `"1234"` | Override common passcode (not persisted) |
