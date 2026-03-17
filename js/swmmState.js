/**
 * swmmState.js
 * -----------
 * Central in-memory state store for swmm-js.
 *
 * Replaces the old pattern of storing model data in hidden <span> elements:
 *   <span id="inpFile" hidden></span>
 *   <span id="rptFile" hidden></span>
 *   …etc.
 *
 * Usage:
 *   import { state, setState, subscribe, resetState } from './swmmState.js';
 *
 *   // Read
 *   const model = state.model;
 *
 *   // Write (triggers all listeners registered via subscribe())
 *   setState({ status: 'running' });
 *
 *   // Listen
 *   const unsub = subscribe((newState, prevState) => { … });
 *   unsub(); // stop listening
 */

/** @typedef {Object} SwmmAppState */

/** @type {SwmmAppState} */
const _initial = {
  /** Raw text of the loaded .inp file */
  inpFile: null,

  /** Raw text of the simulation .rpt file */
  rptFile: null,

  /** Parsed model object (nodes, links, subcatchments, …) — see swmmParser.js */
  model: null,

  /** Link (conduit/pump/weir/…) result arrays keyed by element name */
  linkResult: {},

  /** Node result arrays keyed by element name */
  nodeResult: {},

  /** Simulation progress 0–100 */
  progress: 0,

  /** Human-readable status message */
  status: 'idle',

  /** 'US' | 'SI' */
  units: 'US',

  /** Currently selected object { type, id } or null */
  selection: null,

  /** Name of the active demo/example model, if any */
  activeExample: null,
};

let _state = { ..._initial };

/** @type {Array<(next: SwmmAppState, prev: SwmmAppState) => void>} */
const _listeners = [];

/**
 * Read-only current state snapshot.
 * Always reads the latest value of _state via the get trap.
 * Direct property assignment throws — use setState() instead.
 */
export const state = new Proxy(
  {},
  {
    get(_t, prop) {
      return _state[prop];
    },
    set(_t, prop) {
      throw new Error(`state.${String(prop)} is read-only. Use setState() to update.`);
    },
    ownKeys() { return Object.keys(_state); },
    getOwnPropertyDescriptor(_t, prop) {
      return { configurable: true, enumerable: true, writable: false, value: _state[prop] };
    },
    has(_t, prop) { return prop in _state; },
  }
);

/**
 * Merge `patch` into current state and notify all subscribers.
 * @param {Partial<SwmmAppState>} patch
 */
export function setState(patch) {
  const prev = { ..._state };
  _state = { ..._state, ...patch };
  _listeners.forEach((fn) => fn(_state, prev));
}

/**
 * Register a listener that fires whenever setState() is called.
 * Returns an unsubscribe function.
 * @param {(next: SwmmAppState, prev: SwmmAppState) => void} listener
 * @returns {() => void}
 */
export function subscribe(listener) {
  _listeners.push(listener);
  return () => {
    const i = _listeners.indexOf(listener);
    if (i !== -1) _listeners.splice(i, 1);
  };
}

/**
 * Reset the entire state back to initial values (e.g. on "New" menu action).
 */
export function resetState() {
  setState({ ..._initial });
}

/**
 * @typedef {Object} SwmmAppState
 * @property {string|null} inpFile
 * @property {string|null} rptFile
 * @property {object|null} model
 * @property {Object.<string, number[]>} linkResult
 * @property {Object.<string, number[]>} nodeResult
 * @property {number} progress
 * @property {string} status
 * @property {'US'|'SI'} units
 * @property {{type:string, id:string}|null} selection
 * @property {string|null} activeExample
 */
