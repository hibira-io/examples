// The customer page's state, without the DOM, so it can be tested alone
// (tests/js/support-state.test.mjs).
//
// The backend's case snapshot is the truth. Hibira events only say that a
// newer version exists ("case.updated") or carry the agent's text while it
// streams ("agent.delta", numbered per run). So:
// - events older than the snapshot, or seen twice, change nothing;
// - a gap in the streamed text (a lost, late or never-replayed event) marks
//   the text incomplete and asks for the snapshot, which holds the stored
//   answer once the turn ends;
// - after a reconnect the page always fetches the snapshot again.

const RUNNING = ['thinking', 'resuming'];

export function initialState(snapshot) {
    return { snapshot, stream: null, resyncing: false };
}

/** A snapshot from the backend. Older ones (a slow response) are ignored. */
export function applySnapshot(state, snapshot) {
    if (snapshot.version < state.snapshot.version) {
        return state;
    }

    const running = RUNNING.includes(snapshot.status);
    const stream = running && state.stream?.run === snapshot.run_id ? state.stream : null;

    return { snapshot, stream, resyncing: running && stream?.gap === true };
}

/** "case.updated": fetch when it is newer than what we show. */
export function onCaseUpdated(state, event) {
    return { state, fetch: Number(event.v) > state.snapshot.version };
}

/** "agent.delta": append in order; on a gap, mark it and fetch. */
export function onDelta(state, event) {
    const seq = Number(event.seq);

    // A run we don't know yet: our snapshot is behind.
    if (event.run !== state.snapshot.run_id) {
        return { state, fetch: true };
    }

    const current = state.stream?.run === event.run ? state.stream : { run: event.run, seq: 0, text: '', gap: false };

    // Seen already, or the text is known to be incomplete: wait for the stored answer.
    if (seq <= current.seq || current.gap) {
        return { state, fetch: false };
    }

    // Never stitch text across a gap: keep what is known good, flag the rest.
    if (seq !== current.seq + 1) {
        const stream = { ...current, seq, gap: true };

        return { state: { ...state, stream, resyncing: true }, fetch: true };
    }

    const stream = { ...current, seq, text: current.text + event.text };

    return { state: { ...state, stream }, fetch: false };
}

/** After a reconnect, anything may have been missed. */
export function onReconnected(state) {
    const stream = state.stream ? { ...state.stream, gap: true } : null;

    return { state: { ...state, stream, resyncing: stream !== null }, fetch: true };
}
