const PASSCODE_KEY = 'pos_passcode';

export function getPasscode() {
  return sessionStorage.getItem(PASSCODE_KEY) || '';
}

export function setPasscode(code) {
  sessionStorage.setItem(PASSCODE_KEY, code);
}

export function clearPasscode() {
  sessionStorage.removeItem(PASSCODE_KEY);
}

export async function api(path, options = {}) {
  const opts = {
    method: options.method || 'GET',
    headers: { 'x-passcode': getPasscode(), ...(options.headers || {}) },
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
      attempts = 0;
      window.dispatchEvent(new CustomEvent('pos:sync', { detail: true }));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'state') onState(msg.data);
      } catch { /* ignore */ }
    };
    ws.onclose = () => {
      window.dispatchEvent(new CustomEvent('pos:sync', { detail: false }));
      if (closed) return;
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
