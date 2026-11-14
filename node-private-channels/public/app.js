const params = new URLSearchParams(location.search);
const user = params.get('as') || 'alice';
const kind = params.get('channel') || 'public';
const orderId = params.get('order') || '1042';
const { key, host } = await (await fetch('/config.json')).json();

const pusher = new Pusher(key, {
  cluster: 'hkg', // required by pusher-js, unused once wsHost is set
  wsHost: host,
  forceTLS: true,
  enabledTransports: ['ws', 'wss'],
  channelAuthorization: {
    endpoint: '/pusher/auth',
    headers: { 'X-Demo-User': user },
  },
});

const names = {
  public: `order-${orderId}`,
  private: `private-order-${orderId}`,
  encrypted: `private-encrypted-order-${orderId}`,
};
const channel = pusher.subscribe(names[kind]);

channel.bind('pusher:subscription_succeeded', () => ui.state('ok', `Subscribed to ${channel.name}`));
channel.bind('pusher:subscription_error', (error) => ui.state('denied', `Rejected (${error.status}): not your order`));
channel.bind('status', (order) => ui.order(order));

// What actually travels over the socket, before pusher-js decrypts it.
pusher.connection.bind('message', (message) => {
  if (message.event === 'status') ui.wire(message.data);
});

const ui = window.ui;
ui.init({ user, channelName: names[kind], orderId });
