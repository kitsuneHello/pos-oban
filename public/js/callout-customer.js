const MAX_PER_SIDE = 12;

function columnHTML(title, icon, numbers, cls) {
  const slice = numbers.slice(0, MAX_PER_SIDE);
  const rest = numbers.length - slice.length;
  return `
    <div class="callout-column ${cls}">
      <h2><i class="fa-solid ${icon}"></i> ${title}
        <span class="count">${numbers.length}件</span>
      </h2>
      ${numbers.length === 0
        ? '<div class="callout-empty">現在該当する注文はありません</div>'
        : `
        <div class="nums">${slice.map((n) => `<div class="num-card"><div class="n">${n}</div></div>`).join('')}</div>
        ${rest > 0 ? `<div class="callout-page">ほか ${rest}件</div>` : ''}
        `}
    </div>
  `;
}

function render(state) {
  const org = document.getElementById('customer-org');
  if (org) org.textContent = state.orgName || '呼出し案内';
  const cols = document.getElementById('customer-columns');
  cols.innerHTML = `
    ${columnHTML('お渡し可能', 'fa-bell-concierge', state.ready || [], 'ready')}
    ${columnHTML('調理中', 'fa-fire', state.cooking || [], 'cooking')}
  `;
}

function setConn(online) {
  const dot = document.getElementById('conn-dot');
  const text = document.getElementById('conn-text');
  dot.classList.toggle('online', online);
  dot.classList.toggle('offline', !online);
  text.textContent = online ? '接続中' : '再接続中…';
}

function updateTime() {
  const el = document.getElementById('customer-updated');
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  el.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

let hasConnected = false;

const es = new EventSource('/board/stream');
es.onopen = () => {
  setConn(true);
  hasConnected = true;
};
es.onmessage = (ev) => {
  try {
    render(JSON.parse(ev.data));
    updateTime();
  } catch { /* ignore */ }
};
es.onerror = () => {
  if (hasConnected) setConn(false);
  const cols = document.getElementById('customer-columns');
  if (cols && cols.children.length === 0) {
    cols.innerHTML = '<div class="callout-empty">サーバーに接続できません。しばらくしてから更新してください</div>';
  }
};
