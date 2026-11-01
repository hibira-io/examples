import { connect } from './echo';
import { applySnapshot, initialState, onCaseUpdated, onDelta, onReconnected } from './support-state';

const $ = (id) => document.getElementById(id);

export function startSupport(page) {
    const t = page.strings;
    let state = initialState(page.snapshot);
    let fetching = null;
    let pollTimer = null;
    let wasConnected = false;

    const csrf = document.querySelector('meta[name="csrf-token"]').content;

    async function fetchSnapshot() {
        // One request at a time; a newer event during it fetches once more.
        if (fetching) {
            fetching.again = true;
            return fetching.promise;
        }
        fetching = { again: false };
        fetching.promise = (async () => {
            try {
                const response = await fetch(page.stateUrl, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                if (response.ok) {
                    state = applySnapshot(state, await response.json());
                    render();
                }
            } catch {
                // Offline: the connection status says so; we fetch again on reconnect.
            } finally {
                const again = fetching.again;
                fetching = null;
                if (again) fetchSnapshot();
            }
        })();
        return fetching.promise;
    }

    // --- Hibira ---------------------------------------------------------
    const echo = connect(page.hibira);
    if (echo) {
        window.Echo = echo;
        const connection = echo.connector.pusher.connection;
        connection.bind('state_change', ({ current }) => {
            setConnection(current);
            if (current === 'connected') {
                stopPolling();
                if (wasConnected) {
                    const result = onReconnected(state);
                    state = result.state;
                    render();
                    fetchSnapshot();
                }
                wasConnected = true;
            } else if (current === 'unavailable' || current === 'failed') {
                startPolling();
            }
        });

        echo.private(page.channel)
            .listen('.case.updated', (event) => {
                const result = onCaseUpdated(state, event);
                if (result.fetch) fetchSnapshot();
            })
            .listen('.agent.delta', (event) => {
                const result = onDelta(state, event);
                state = result.state;
                render();
                if (result.fetch) fetchSnapshot();
            })
            .error(() => setConnection('unavailable'));
    } else {
        setConnection('unavailable');
        startPolling();
    }

    // Only while there is no realtime connection: read the stored state now and then.
    function startPolling() {
        if (!pollTimer) pollTimer = setInterval(fetchSnapshot, 15000);
    }
    function stopPolling() {
        clearInterval(pollTimer);
        pollTimer = null;
    }

    // --- Sending ----------------------------------------------------------
    $('composer').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = $('body').value.trim();
        if (!body || !state.snapshot.accepts_input) return;
        $('send').disabled = true;
        try {
            const response = await fetch(page.messageUrl, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
                body: JSON.stringify({ body }),
            });
            const data = await response.json().catch(() => null);
            if (data && data.version !== undefined) {
                state = applySnapshot(state, data);
            }
            if (response.ok) {
                $('body').value = '';
            } else {
                flash(data?.error ?? data?.message ?? t.errors.unknown);
            }
        } catch {
            flash(t.errors.network);
        } finally {
            render();
        }
    });
    $('body').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            $('composer').requestSubmit();
        }
    });

    // --- Rendering ------------------------------------------------------
    let flashText = null;
    function flash(text) {
        flashText = text;
        setTimeout(() => {
            flashText = null;
            render();
        }, 6000);
    }

    function setConnection(current) {
        const map = {
            connecting: [t.connection.connecting, 'bg-slate-200 text-slate-700'],
            initialized: [t.connection.connecting, 'bg-slate-200 text-slate-700'],
            connected: [t.connection.connected, 'bg-emerald-100 text-emerald-800'],
            unavailable: [echo ? t.connection.reconnecting : t.connection.unavailable, 'bg-amber-100 text-amber-900'],
            failed: [t.connection.unavailable, 'bg-red-100 text-red-800'],
            disconnected: [t.connection.offline, 'bg-amber-100 text-amber-900'],
        };
        const [label, classes] = map[current] ?? map.connecting;
        const el = $('connection');
        el.textContent = label;
        el.className = `rounded-full px-3 py-1 text-xs ${classes}`;
        el.dataset.state = current;
    }

    function render() {
        const s = state.snapshot;
        document.body.dataset.caseStatus = s.status;
        document.body.dataset.caseVersion = s.version;

        $('order-number').textContent = s.order.number;
        $('order-description').textContent = s.order.description;
        $('order-paid').textContent = s.order.paid;
        $('order-refunded').textContent = s.order.refunded;
        $('order-refundable').textContent = s.order.refundable;

        const ops = $('operations');
        ops.replaceChildren();
        if (s.operations.length === 0) {
            ops.append(li(t.page.no_refunds, 'text-slate-500'));
        }
        for (const op of s.operations) {
            const item = li('', 'rounded-md border border-slate-200 p-2');
            item.dataset.operationStatus = op.status;
            item.append(span(t.operation_status[op.status] ?? op.status, 'font-medium'));
            item.append(span(t.page.requested.replace(':amount', op.requested), 'block text-slate-600'));
            if (op.final) item.append(span(t.page.final.replace(':amount', op.final), 'block text-slate-600'));
            if (op.decided_by) item.append(span(t.page.decided_by.replace(':name', op.decided_by), 'block text-slate-500'));
            if (op.note) item.append(span(op.note, 'block text-slate-500'));
            ops.append(item);
        }

        const banner = $('case-status');
        const tone = {
            awaiting_approval: 'bg-amber-50 text-amber-900',
            resuming: 'bg-sky-50 text-sky-900',
            thinking: 'bg-sky-50 text-sky-900',
            completed: 'bg-emerald-50 text-emerald-900',
            rejected: 'bg-red-50 text-red-900',
            failed: 'bg-red-50 text-red-900',
        }[s.status] ?? 'bg-white text-slate-700';
        banner.className = `border-b border-slate-200 px-4 py-3 text-sm ${tone}`;
        banner.replaceChildren(span(t.status[s.status] ?? s.status, 'font-semibold'));
        const detail = s.error ? t.errors[s.error] : t.status_detail[s.status];
        if (detail) banner.append(span(detail, 'block'));
        if (flashText) banner.append(span(flashText, 'block font-medium'));

        const list = $('messages');
        list.replaceChildren();
        if (s.messages.length === 0 && !state.stream) {
            list.append(li(t.page.empty, 'text-center text-sm text-slate-500'));
        }
        for (const m of s.messages) {
            list.append(bubble(m.role, m.body));
        }
        if (state.stream) {
            const item = bubble('agent', state.stream.text);
            item.dataset.streaming = 'true';
            item.append(span(state.stream.gap ? t.page.resync : t.page.streaming, 'mt-1 block text-xs text-slate-500'));
            list.append(item);
        } else if (['thinking', 'resuming'].includes(s.status)) {
            const item = bubble('agent', '');
            item.append(span(t.page.streaming, 'block text-xs text-slate-500'));
            list.append(item);
        }
        list.scrollTop = list.scrollHeight;

        $('body').disabled = !s.accepts_input;
        $('send').disabled = !s.accepts_input;
    }

    function bubble(role, text) {
        const mine = role === 'customer';
        const item = li('', `max-w-[85%] rounded-lg px-3 py-2 ${mine ? 'ml-auto bg-indigo-600 text-white' : 'bg-slate-100'}`);
        item.dataset.role = role;
        item.append(span(t.page[role === 'customer' ? 'you' : role] ?? role, `block text-xs ${mine ? 'text-indigo-100' : 'text-slate-500'}`));
        const body = span(text, 'whitespace-pre-wrap');
        body.dataset.body = '';
        item.append(body);
        return item;
    }
    function li(text, classes) {
        const el = document.createElement('li');
        el.className = classes;
        if (text) el.textContent = text;
        return el;
    }
    function span(text, classes) {
        const el = document.createElement('span');
        el.className = classes;
        el.textContent = text;
        return el;
    }

    render();
    // Whatever happened before the page connected is in the snapshot; fetch once connected too.
    fetchSnapshot();
}
