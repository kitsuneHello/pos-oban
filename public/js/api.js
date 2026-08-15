const USERNAME_KEY = 'pos_username';
const PASSWORD_KEY = 'pos_password';

export function getUsername() {
  return sessionStorage.getItem(USERNAME_KEY) || '';
}

export function setUsername(name) {
  sessionStorage.setItem(USERNAME_KEY, name);
}

export function getPassword() {
  return sessionStorage.getItem(PASSWORD_KEY) || '';
}

export function setPassword(pw) {
  sessionStorage.setItem(PASSWORD_KEY, pw);
}

export function clearAuth() {
  sessionStorage.removeItem(USERNAME_KEY);
  sessionStorage.removeItem(PASSWORD_KEY);
}

export function isLoggedIn() {
  return !!(getUsername() && getPassword());
}

export async function api(path, options = {}) {
  const opts = {
    method: options.method || 'GET',
    headers: { 'x-username': getUsername(), 'x-password': getPassword(), ...(options.headers || {}) },
  };
  if (options.body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(options.body);
  }
  const res = await fetch(path, opts);
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('pos:unauthorized'));
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'リクエストに失敗しました');
  return data;
}

export function wsConnect(onState) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  let ws = null;
  let closed = false;
  let attempts = 0;
  let timer = null;

  function connect() {
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', username: getUsername(), password: getPassword() }));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'state') {
          window.dispatchEvent(new CustomEvent('pos:sync', { detail: true }));
          onState(msg.data);
        }
      } catch { /* ignore */ }
    };
    ws.onclose = (ev) => {
      window.dispatchEvent(new CustomEvent('pos:sync', { detail: false }));
      if (closed) return;
      if (ev.code === 4001) {
        window.dispatchEvent(new CustomEvent('pos:unauthorized'));
        return;
      }
      attempts += 1;
      clearTimeout(timer);
      timer = setTimeout(connect, Math.min(1000 * 2 ** attempts, 15000));
    };
    ws.onerror = () => ws.close();
  }

  connect();

  return {
    close() {
      closed = true;
      clearTimeout(timer);
      if (ws) ws.close();
    },
  };
}
