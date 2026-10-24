const $ = (id) => document.getElementById(id);

export function startChat({ room, me, messages, sendUrl }) {
    const list = $('messages');
    const online = new Map();
    const typing = new Map();

    messages.forEach(render);
    scrollDown();

    // Presence channel: here/joining/leaving keep the member list, listen()
    // receives MessageSent (broadcastAs "message.sent", hence the dot), and
    // whispers are client events that go straight from browser to browser.
    const channel = window.Echo.join(`room.${room}`)
        .here((users) => {
            users.forEach((u) => online.set(u.id, u));
            renderOnline();
        })
        .joining((u) => {
            online.set(u.id, u);
            renderOnline();
        })
        .leaving((u) => {
            online.delete(u.id);
            typing.delete(u.id);
            renderOnline();
            renderTyping();
        })
        .listen('.message.sent', (message) => {
            typing.delete(message.user.id);
            renderTyping();
            render(message);
            scrollDown();
        })
        .listenForWhisper('typing', ({ id, name }) => {
            clearTimeout(typing.get(id)?.timer);
            typing.set(id, { name, timer: setTimeout(() => (typing.delete(id), renderTyping()), 3000) });
            renderTyping();
        })
        .error((error) => setStatus(`channel error (${error?.status ?? error?.type ?? 'unknown'})`, 'text-red-600'));

    const connection = window.Echo.connector.pusher.connection;
    connection.bind('state_change', ({ current }) =>
        setStatus(current, current === 'connected' ? 'text-emerald-600' : 'text-amber-600'));

    let lastWhisper = 0;
    $('body').addEventListener('input', () => {
        if (Date.now() - lastWhisper > 1000) {
            lastWhisper = Date.now();
            channel.whisper('typing', me);
        }
    });

    $('composer').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = $('body');
        const body = input.value.trim();
        if (!body) return;
        input.value = '';

        const res = await fetch(sendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                // Lets the server skip this browser with ->toOthers().
                'X-Socket-ID': window.Echo.socketId() ?? '',
            },
            body: JSON.stringify({ body }),
        });
        if (res.ok) {
            render(await res.json());
            scrollDown();
        } else {
            input.value = body;
            setStatus(`send failed (${res.status})`, 'text-red-600');
        }
    });

    function render(message) {
        const mine = message.user.id === me.id;
        const li = document.createElement('li');
        li.className = `flex flex-col ${mine ? 'items-end' : 'items-start'}`;
        const meta = document.createElement('span');
        meta.className = 'text-xs text-slate-500';
        meta.textContent = `${message.user.name} · ${new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const bubble = document.createElement('p');
        bubble.className = `max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 ${
            mine ? 'bg-indigo-600 text-white' : 'bg-white shadow-sm dark:bg-slate-800'}`;
        bubble.textContent = message.body;
        li.append(meta, bubble);
        list.append(li);
    }

    function renderOnline() {
        $('online-count').textContent = online.size;
        $('online').replaceChildren(...[...online.values()].map((u) => {
            const li = document.createElement('li');
            li.textContent = u.id === me.id ? `${u.name} (you)` : u.name;
            return li;
        }));
    }

    function renderTyping() {
        const names = [...typing.values()].map((t) => t.name);
        $('typing').textContent = names.length ? `${names.join(', ')} ${names.length > 1 ? 'are' : 'is'} typing…` : '';
    }

    function scrollDown() {
        list.scrollTop = list.scrollHeight;
    }

    function setStatus(text, color) {
        const el = $('status');
        el.textContent = text;
        el.className = `text-xs ${color}`;
    }
}
