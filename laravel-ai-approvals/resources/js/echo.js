import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Hibira speaks the Pusher Channels protocol: the standard clients work with
// the host set to Hibira. The app key and host come from the page (server
// config), not from the build, so one build works for every environment.
export function connect({ key, host, port, scheme }) {
    if (!key) {
        return null;
    }

    window.Pusher = Pusher;

    return new Echo({
        broadcaster: 'pusher',
        key,
        // pusher-js requires a cluster, but does not use it once wsHost is set.
        cluster: 'hkg',
        wsHost: host || 'ws.hibira.io',
        wsPort: port || 443,
        wssPort: port || 443,
        forceTLS: (scheme || 'https') === 'https',
        enabledTransports: ['ws', 'wss'],
        disableStats: true,
    });
}
