import { sortOrdersByCreated } from '../util.js';

const MAX_PER_SIDE = 8;
let readyPage = 0;
let cookingPage = 0;
let readyTimer = null;
let cookingTimer = null;

function bigNumberCard(order) {
  return `
    <div class="num-card">
      <div class="n">${order.order_number}</div>
    </div>
  `;
}

function columnHTML(title, icon, orders, page, cls) {
  const pages = Math.max(1, Math.ceil(orders.length / MAX_PER_SIDE));
  const slice = orders.slice(page * MAX_PER_SIDE, (page + 1) * MAX_PER_SIDE);
  return `
    <div class="callout-column ${cls}${pages > 1 ? ' paging' : ''}">
      <h2><i class="fa-solid ${icon}"></i> ${title}
        <span class="count">${orders.length}件</span>
      </h2>
      ${orders.length === 0
        ? '<div class="callout-empty">現在該当する注文はありません</div>'
        : `
        <div class="nums">${slice.map((o) => bigNumberCard(o)).join('')}</div>
        ${pages > 1 ? `<div class="callout-page">${page + 1} / ${pages}</div>` : ''}
        `}
    </div>
  `;
}

export const CalloutView = {
  render(main, state) {
    const ready = sortOrdersByCreated(state.orders.filter((o) => o.status === 'READY'));
    const cooking = sortOrdersByCreated(state.orders.filter((o) => o.status === 'PREPARING'));
    const totalActive = ready.length + cooking.length;

    const readyPages = Math.max(1, Math.ceil(ready.length / MAX_PER_SIDE));
    const cookingPages = Math.max(1, Math.ceil(cooking.length / MAX_PER_SIDE));
    if (readyPage >= readyPages) readyPage = 0;
    if (cookingPage >= cookingPages) cookingPage = 0;

    if (readyTimer) { clearInterval(readyTimer); readyTimer = null; }
    if (cookingTimer) { clearInterval(cookingTimer); cookingTimer = null; }

    const isActive = () => document.querySelector('.tab.active')?.dataset.view === 'callout';

    if (readyPages > 1) {
      readyTimer = setInterval(() => {
        if (!isActive()) return;
        readyPage = (readyPage + 1) % readyPages;
        CalloutView.render(document.getElementById('app-main'), window.__state || state);
      }, 7000);
    }
    if (cookingPages > 1) {
      cookingTimer = setInterval(() => {
        if (!isActive()) return;
        cookingPage = (cookingPage + 1) % cookingPages;
        CalloutView.render(document.getElementById('app-main'), window.__state || state);
      }, 7000);
    }

    main.innerHTML = `
      <div class="callout">
        ${totalActive === 0
          ? '<div class="callout-empty callout-whole"><i class="fa-solid fa-face-smile"></i><br>現在表示する注文はありません</div>'
          : `
          ${columnHTML('お渡し可能', 'fa-bell-concierge', ready, readyPage, 'ready')}
          ${columnHTML('調理中', 'fa-fire', cooking, cookingPage, 'cooking')}
          `}
      </div>
    `;
  },
};
