/**
 * swmmJsonBridge.js
 * ----------------
 * Safe replacement for the strcpy/strcat-based JSON serializer in swmm5.c.
 *
 * The old approach in swmm5.c used a fixed C char array (JX[]) and appended
 * to it with strcat() with no bounds checking.  For any model larger than the
 * buffer, or any name containing characters that need JSON escaping (quotes,
 * backslashes, control characters), the result was either a buffer overflow or
 * malformed JSON.
 *
 * This module works differently:
 *   1. The Emscripten module exposes individual getter functions per element
 *      type (swmm_getNode, swmm_getLink, swmm_getSubcatch …).
 *   2. We call those getters from JS and build the model object here.
 *   3. String values from C are passed through safeStr() to guarantee valid
 *      JSON regardless of what characters SWMM names contain.
 *
 * Usage:
 *   import { buildModelFromWasm } from './swmmJsonBridge.js';
 *   const model = await buildModelFromWasm(Module);
 */

/**
 * Escape a raw C string for safe inclusion in JSON.
 * Handles: quotes, backslashes, control chars, null bytes.
 * @param {string} s
 * @returns {string}
 */
export function safeStr(s) {
  if (s == null) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\0/g, '')
    .replace(/[\x01-\x1f\x7f]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`);
}

/**
 * Build a full model JS object by calling individual WASM getter functions.
 * This never concatenates raw C strings into a JSON buffer.
 *
 * @param {object} Module   — Emscripten module (js.js)
 * @returns {SwmmModel}
 */
export function buildModelFromWasm(Module) {
  const model = {
    nodes:        [],
    links:        [],
    subcatchments:[],
    raingages:    [],
    pollutants:   [],
  };

  // Guard: if the compiled module doesn't expose the new getter API yet,
  // fall back to parsing the legacy JX JSON string (see legacyParse below).
  if (typeof Module._swmm_getNodeCount !== 'function') {
    return legacyParse(Module);
  }

  const nodeCount    = Module._swmm_getNodeCount();
  const linkCount    = Module._swmm_getLinkCount();
  const subCount     = Module._swmm_getSubcatchCount();
  const rngCount     = Module._swmm_getRaingageCount();

  for (let i = 0; i < nodeCount; i++) {
    model.nodes.push({
      index:     i,
      name:      safeStr(Module.UTF8ToString(Module._swmm_getNodeName(i))),
      type:      Module._swmm_getNodeType(i),
      elevation: Module._swmm_getNodeInvert(i),
      maxDepth:  Module._swmm_getNodeMaxDepth(i),
    });
  }

  for (let i = 0; i < linkCount; i++) {
    model.links.push({
      index:    i,
      name:     safeStr(Module.UTF8ToString(Module._swmm_getLinkName(i))),
      type:     Module._swmm_getLinkType(i),
      fromNode: Module._swmm_getLinkNode1(i),
      toNode:   Module._swmm_getLinkNode2(i),
      length:   Module._swmm_getLinkLength(i),
    });
  }

  for (let i = 0; i < subCount; i++) {
    model.subcatchments.push({
      index:  i,
      name:   safeStr(Module.UTF8ToString(Module._swmm_getSubcatchName(i))),
      area:   Module._swmm_getSubcatchArea(i),
      outlet: Module._swmm_getSubcatchOutlet(i),
    });
  }

  for (let i = 0; i < rngCount; i++) {
    model.raingages.push({
      index: i,
      name:  safeStr(Module.UTF8ToString(Module._swmm_getRaingageName(i))),
    });
  }

  return model;
}

/**
 * Legacy fallback: parse the JX[] JSON string the old swmm5.c produced.
 * Wraps the parse in try/catch and returns null on failure rather than
 * throwing.
 * @param {object} Module
 * @returns {SwmmModel|null}
 */
function legacyParse(Module) {
  try {
    const ptr   = Module._swmm_getJX();
    const raw   = Module.UTF8ToString(ptr);
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[swmmJsonBridge] Legacy JX parse failed:', e.message);
    return null;
  }
}
