/**
 * state.test.js
 * Tests for the swmmState.js store.
 */

import { state, setState, subscribe, resetState } from '../src/swmmState.js';

describe('swmmState', () => {
  afterEach(() => resetState());

  test('initial status is idle', () => {
    expect(state.status).toBe('idle');
  });

  test('setState updates a field', () => {
    setState({ status: 'running' });
    expect(state.status).toBe('running');
  });

  test('setState merges (does not replace) state', () => {
    setState({ progress: 50 });
    setState({ status: 'done' });
    expect(state.progress).toBe(50);
    expect(state.status).toBe('done');
  });

  test('subscribe fires listener on setState', () => {
    const calls = [];
    const unsub = subscribe((next, prev) => calls.push({ next, prev }));
    setState({ progress: 30 });
    expect(calls).toHaveLength(1);
    expect(calls[0].next.progress).toBe(30);
    expect(calls[0].prev.progress).toBe(0);
    unsub();
  });

  test('unsubscribe stops future calls', () => {
    const calls = [];
    const unsub = subscribe(() => calls.push(1));
    setState({ progress: 10 });
    unsub();
    setState({ progress: 20 });
    expect(calls).toHaveLength(1);
  });

  test('resetState restores initial values', () => {
    setState({ status: 'running', progress: 75 });
    resetState();
    expect(state.status).toBe('idle');
    expect(state.progress).toBe(0);
  });

  test('state is read-only (direct mutation throws)', () => {
    expect(() => { state.status = 'x'; }).toThrow();
  });
});
