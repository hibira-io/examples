// node --test tests/js/  (npm test)
import assert from 'node:assert/strict';
import test from 'node:test';
import { applySnapshot, initialState, onCaseUpdated, onDelta, onReconnected } from '../../resources/js/support-state.js';

const snap = (version, status, extra = {}) => ({ version, status, run_id: 'run-1', messages: [], operations: [], ...extra });

test('a case.updated older or equal to the snapshot does not fetch; a newer one does', () => {
    const state = initialState(snap(5, 'awaiting_approval'));
    assert.equal(onCaseUpdated(state, { v: 4 }).fetch, false);
    assert.equal(onCaseUpdated(state, { v: 5 }).fetch, false);
    assert.equal(onCaseUpdated(state, { v: 6 }).fetch, true);
});

test('a late snapshot never takes the page back', () => {
    let state = initialState(snap(7, 'completed'));
    state = applySnapshot(state, snap(6, 'resuming'));
    assert.equal(state.snapshot.status, 'completed');
    assert.equal(state.snapshot.version, 7);
});

test('deltas in order build the text; duplicates are ignored', () => {
    let state = initialState(snap(3, 'resuming'));
    for (const [seq, text] of [[1, '主管'], [2, '已核准'], [2, '已核准'], [1, '主管']]) {
        state = onDelta(state, { run: 'run-1', seq, text }).state;
    }
    assert.equal(state.stream.text, '主管已核准');
    assert.equal(state.stream.gap, false);
});

test('a missing delta flags the text as incomplete, never stitches it, and asks for the snapshot', () => {
    let state = initialState(snap(3, 'resuming'));
    state = onDelta(state, { run: 'run-1', seq: 1, text: '主管' }).state;
    const result = onDelta(state, { run: 'run-1', seq: 3, text: 'USD 29.00' });
    assert.equal(result.fetch, true);
    assert.equal(result.state.stream.gap, true);
    assert.equal(result.state.resyncing, true);
    assert.equal(result.state.stream.text, '主管', 'text after the gap is not appended');

    // Later deltas don't change the incomplete text either.
    const later = onDelta(result.state, { run: 'run-1', seq: 4, text: '。' });
    assert.equal(later.state.stream.text, '主管');
});

test('history that starts mid-run (complete: false, or over the 100-event limit) is treated as a gap', () => {
    // The first delta we see is seq 37: earlier ones were never delivered or replayed.
    const result = onDelta(initialState(snap(3, 'resuming')), { run: 'run-1', seq: 37, text: '…' });
    assert.equal(result.fetch, true);
    assert.equal(result.state.stream.gap, true);
});

test('the stored answer replaces an incomplete stream once the turn ends', () => {
    let state = initialState(snap(3, 'resuming'));
    state = onDelta(state, { run: 'run-1', seq: 2, text: 'x' }).state;
    state = applySnapshot(state, snap(4, 'completed', { messages: [{ role: 'agent', body: '已退款 USD 29.00' }] }));
    assert.equal(state.stream, null);
    assert.equal(state.resyncing, false);
    assert.equal(state.snapshot.messages[0].body, '已退款 USD 29.00');
});

test('a delta from a run the page does not know yet asks for the snapshot', () => {
    const result = onDelta(initialState(snap(3, 'awaiting_approval')), { run: 'run-2', seq: 1, text: '主管' });
    assert.equal(result.fetch, true);
    assert.equal(result.state.stream, null);
});

test('after a reconnect the page always refetches and distrusts a stream in progress', () => {
    let state = initialState(snap(3, 'resuming'));
    state = onDelta(state, { run: 'run-1', seq: 1, text: '主管' }).state;
    const result = onReconnected(state);
    assert.equal(result.fetch, true);
    assert.equal(result.state.stream.gap, true);

    const idle = onReconnected(initialState(snap(3, 'completed')));
    assert.equal(idle.fetch, true);
    assert.equal(idle.state.stream, null);
});
