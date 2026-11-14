// The orders page: register this browser for push on the "orders" interest.
const { instanceId, endpoint } = await fetch('/api/config').then((r) => r.json());
const push = new HibiraPush.Client({ instanceId, endpoint });

const button = document.querySelector('#alerts');
const status = document.querySelector('#alerts-status');

async function showState() {
  const state = await push.getRegistrationState();
  const on = state === HibiraPush.RegistrationState.PERMISSION_GRANTED_REGISTERED_WITH_BEAMS;
  button.hidden = on;
  status.hidden = !on;
}

// Browsers only show the permission prompt after a click.
button.addEventListener('click', async () => {
  await push.start();
  await push.addDeviceInterest('orders');
  await showState();
});

showState();

// While the page is open, the list refreshes on its own.
const list = document.querySelector('#orders');
const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
async function refresh() {
  const orders = await fetch('/api/orders').then((r) => r.json());
  document.querySelector('#count').textContent = orders.length;
  list.innerHTML = orders.length
    ? orders.map((o) => `<li id="order-${o.id}"><b>#${o.id}</b><span>${o.qty} × ${o.item}</span><span>${o.total}</span><time>${fmt.format(o.at)}</time></li>`).join('')
    : '<li class="empty">No orders yet</li>';
}
refresh();
setInterval(refresh, 3000);
