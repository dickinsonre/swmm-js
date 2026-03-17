/**
 * script.js  –  swmm-js main application module
 * ------------------------------------------------
 * Responsibilities:
 *   - File open / save (local .inp)
 *   - Test model loader (OWA examples from /data/test/)
 *   - State-driven UI updates via swmmState
 *   - Network canvas rendering via D3
 *   - Tabulator results table
 *   - Bootstrap 5 modal / toast helpers
 *
 * What changed from the original:
 *   - Removed all jQuery (replaced with vanilla DOM / fetch)
 *   - Removed hidden <span> state (now in swmmState.js)
 *   - Bootstrap data-bs-* attributes (was data-toggle / data-dismiss)
 *   - No babel-standalone; plain ES modules throughout
 *   - moment.js → date-fns (imported per-function, zero overhead)
 *   - Test models wired to the new "Test Models" nav menu
 */

import { parseInp, serializeInp }   from './src/swmmParser.js';
import { state, setState, subscribe, resetState } from './src/swmmState.js';
import { buildModelFromWasm }        from './src/swmmJsonBridge.js';
import { format as fmtDate }         from 'date-fns';   // replaces moment

// ─── Bootstrap modal / toast handles (created once) ─────────────────────────
const errorToastEl = document.getElementById('error-toast');
const errorToast   = errorToastEl ? new bootstrap.Toast(errorToastEl) : null;

function showError(msg) {
  const body = document.getElementById('error-toast-body');
  if (body) body.textContent = msg;
  errorToast?.show();
  console.error('[swmm-js]', msg);
}

// ─── Status bar helpers ───────────────────────────────────────────────────────
function setStatus(msg, progress = null) {
  const txt = document.getElementById('status-text');
  const bar = document.getElementById('progress-bar');
  const ctr = document.getElementById('progress-container');
  if (txt) txt.textContent = msg;
  if (progress !== null && bar && ctr) {
    ctr.style.display = '';
    bar.style.width   = `${progress}%`;
    if (progress >= 100) setTimeout(() => { ctr.style.display = 'none'; }, 800);
  }
}

// ─── File open ───────────────────────────────────────────────────────────────
document.getElementById('nav-file-input')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    loadInpText(text, file.name);
  } catch (err) {
    showError(`Could not read file: ${err.message}`);
  }
  // reset the input so the same file can be re-opened
  e.target.value = '';
});

// ─── Test model loader ────────────────────────────────────────────────────────
document.querySelectorAll('.test-model-item').forEach(el => {
  el.addEventListener('click', async (e) => {
    e.preventDefault();
    const path = el.dataset.model;
    setStatus(`Loading ${path}…`);
    try {
      const res  = await fetch(`/data/${path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      loadInpText(text, path.split('/').pop());
    } catch (err) {
      showError(`Could not load ${path}: ${err.message}`);
      setStatus('Ready');
    }
  });
});

// ─── Demo loader ─────────────────────────────────────────────────────────────
document.getElementById('nav-demo-item')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const res  = await fetch('/data/test/Example1.inp').catch(() => null);
  if (!res?.ok) { showError('Demo model not found'); return; }
  const text = await res.text();
  loadInpText(text, 'Example1.inp (demo)');
});

// ─── New model ────────────────────────────────────────────────────────────────
document.getElementById('nav-new-item')?.addEventListener('click', (e) => {
  e.preventDefault();
  resetState();
  clearCanvas();
  setStatus('New model created');
  updateModelStats(null);
});

// ─── Save as .inp ─────────────────────────────────────────────────────────────
document.getElementById('nav-saveas-item')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (!state.model) { showError('No model loaded'); return; }
  const text = state.inpFile ?? serializeInp(state.model);
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: 'model.inp',
  });
  a.click();
  URL.revokeObjectURL(url);
});

// ─── Units toggle ─────────────────────────────────────────────────────────────
document.getElementById('units-toggle')?.addEventListener('change', (e) => {
  const units = e.target.checked ? 'SI' : 'US';
  setState({ units });
  document.getElementById('units-label').textContent = units;
  if (state.model) renderNetwork(state.model);
});

// ─── Core: load INP text → parse → render ────────────────────────────────────
function loadInpText(text, filename = 'model.inp') {
  try {
    setStatus(`Parsing ${filename}…`, 20);
    const model = parseInp(text);
    setState({ inpFile: text, model, status: 'loaded', activeExample: filename });
    setStatus(`Loaded ${filename}`, 100);
    updateModelStats(model);
    renderNetwork(model);
    populateSidebar(model);
  } catch (err) {
    showError(`Parse error in ${filename}: ${err.message}`);
    setStatus('Parse failed');
  }
}

// ─── Model statistics badge ───────────────────────────────────────────────────
function updateModelStats(model) {
  const el = document.getElementById('model-stats');
  if (!el) return;
  if (!model) { el.textContent = ''; return; }
  const n  = model.junctions.length + model.outfalls.length + model.storage.length;
  const l  = model.conduits.length  + model.pumps.length + model.orifices.length +
             model.weirs.length     + model.outlets.length;
  const s  = model.subcatchments.length;
  el.textContent = `Nodes: ${n}  Links: ${l}  Subcat: ${s}`;
}

// ─── Project summary modal ────────────────────────────────────────────────────
document.getElementById('proj-summary')?.addEventListener('click', () => {
  if (!state.model) return;
  const m   = state.model;
  const rows = [
    ['Raingages',      m.raingages.length],
    ['Subcatchments',  m.subcatchments.length],
    ['Aquifers',       (m._raw?.AQUIFERS ?? []).length],
    ['Junctions',      m.junctions.length],
    ['Outfalls',       m.outfalls.length],
    ['Dividers',       m.dividers.length],
    ['Storage nodes',  m.storage.length],
    ['Conduits',       m.conduits.length],
    ['Pumps',          m.pumps.length],
    ['Orifices',       m.orifices.length],
    ['Weirs',          m.weirs.length],
    ['Outlets',        m.outlets.length],
    ['Flow units',     m.options.FLOW_UNITS ?? '–'],
    ['Routing model',  m.options.FLOW_ROUTING ?? '–'],
    ['Infiltration',   m.options.INFILTRATION ?? '–'],
  ];
  const tbody = rows.map(([k,v]) =>
    `<tr><td>${k}</td><td class="fw-bold">${v}</td></tr>`).join('');
  const tbl = document.getElementById('proj-sum-table');
  if (tbl) tbl.innerHTML = `<tbody>${tbody}</tbody>`;
});

// ─── D3 Network Canvas ────────────────────────────────────────────────────────
let _d3Canvas = null;
let _d3Svg    = null;

function clearCanvas() {
  const canvas = document.getElementById('map-panel');
  if (canvas) canvas.innerHTML = '<canvas id="network-canvas" style="width:100%; border:1px solid #dee2e6; border-radius:4px;"></canvas>';
  _d3Svg = null;
}

function renderNetwork(model) {
  const panel = document.getElementById('map-panel');
  if (!panel) return;

  // Clear previous SVG (we use SVG via D3, not the <canvas> tag)
  panel.innerHTML = '';
  const W = panel.clientWidth  || 800;
  const H = Math.max(400, panel.clientHeight || 500);

  // Collect node positions from COORDINATES
  const coords = model.coordinates ?? {};
  const xs = Object.values(coords).map(c => c.x).filter(Number.isFinite);
  const ys = Object.values(coords).map(c => c.y).filter(Number.isFinite);

  if (!xs.length) {
    panel.innerHTML = '<div class="text-muted p-4 text-center">No coordinate data — map not available</div>';
    return;
  }

  const xScale = d3.scaleLinear().domain([Math.min(...xs), Math.max(...xs)]).range([40, W - 40]);
  const yScale = d3.scaleLinear().domain([Math.min(...ys), Math.max(...ys)]).range([H - 40, 40]);

  const svg = d3.select(panel).append('svg')
    .attr('width',  W)
    .attr('height', H)
    .style('background', '#f8f9fa')
    .style('border', '1px solid #dee2e6')
    .style('border-radius', '4px');

  // Zoom & pan
  const g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.2, 12]).on('zoom', ({ transform }) => g.attr('transform', transform)));

  // Draw polygon outlines for subcatchments
  const polys = model.polygons ?? {};
  g.selectAll('.subcat-poly')
    .data(Object.entries(polys))
    .join('polygon')
    .attr('class', 'subcat-poly')
    .attr('points', ([, pts]) => pts.map(p => `${xScale(p.x)},${yScale(p.y)}`).join(' '))
    .attr('fill', 'rgba(144,190,109,0.25)')
    .attr('stroke', '#52b788')
    .attr('stroke-width', 0.8);

  // Draw conduit vertices (polylines)
  const allNodes = {
    ...Object.fromEntries(model.junctions.map(n => [n.name, n])),
    ...Object.fromEntries(model.outfalls.map(n => [n.name, n])),
    ...Object.fromEntries(model.storage.map(n => [n.name, n])),
  };

  const allLinks = [
    ...model.conduits.map(l => ({ ...l, _type: 'conduit' })),
    ...model.pumps.map(l => ({ ...l, _type: 'pump' })),
    ...model.weirs.map(l => ({ ...l, _type: 'weir' })),
    ...model.orifices.map(l => ({ ...l, _type: 'orifice' })),
  ];

  const linkColor = { conduit: '#457b9d', pump: '#e63946', weir: '#f4a261', orifice: '#a8dadc' };

  allLinks.forEach(link => {
    const from = coords[link.fromNode];
    const to   = coords[link.toNode];
    if (!from || !to) return;

    // Gather interior vertices
    const verts = (model.vertices ?? {})[link.name] ?? [];
    const points = [from, ...verts, to].map(p => [xScale(p.x), yScale(p.y)]);
    const lineGen = d3.line().x(d => d[0]).y(d => d[1]);

    g.append('path')
      .attr('d', lineGen(points))
      .attr('fill', 'none')
      .attr('stroke', linkColor[link._type] ?? '#999')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.8)
      .append('title').text(`${link._type.toUpperCase()}: ${link.name}`);
  });

  // Draw nodes
  const nodeSymbol = {
    junction: d3.symbol().type(d3.symbolCircle).size(40)(),
    outfall:  d3.symbol().type(d3.symbolTriangle).size(60)(),
    storage:  d3.symbol().type(d3.symbolSquare).size(80)(),
  };
  const nodeColor  = { junction: '#1d3557', outfall: '#e63946', storage: '#457b9d' };

  const nodeList = [
    ...model.junctions.map(n => ({ ...n, _ntype: 'junction' })),
    ...model.outfalls.map(n => ({ ...n, _ntype: 'outfall' })),
    ...model.storage.map(n => ({ ...n, _ntype: 'storage' })),
  ];

  g.selectAll('.node-sym')
    .data(nodeList.filter(n => coords[n.name]))
    .join('path')
    .attr('class', 'node-sym')
    .attr('d', d => nodeSymbol[d._ntype])
    .attr('transform', d => `translate(${xScale(coords[d.name].x)},${yScale(coords[d.name].y)})`)
    .attr('fill', d => nodeColor[d._ntype])
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      setState({ selection: { type: d._ntype, id: d.name } });
      showObjectProperties(d, model);
    })
    .append('title').text(d => `${d._ntype.toUpperCase()}: ${d.name}\nElev: ${d.elevation ?? d.elev ?? '–'}`);

  _d3Svg = svg;
}

// ─── Object properties panel ──────────────────────────────────────────────────
function showObjectProperties(obj, model) {
  // Future: open a modal or side panel with full properties table.
  // For now, log to console — wired up in a subsequent PR.
  console.table(obj);
}

// ─── Sidebar section click ────────────────────────────────────────────────────
document.getElementById('object-tree')?.querySelectorAll('[data-section]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    if (!state.model) return;
    openSectionTable(el.dataset.section, state.model);
  });
});

function openSectionTable(section, model) {
  const sectionMap = {
    JUNCTIONS:     model.junctions,
    OUTFALLS:      model.outfalls,
    STORAGE:       model.storage,
    CONDUITS:      model.conduits,
    PUMPS:         model.pumps,
    WEIRS:         model.weirs,
    ORIFICES:      model.orifices,
    OUTLETS:       model.outlets,
    SUBCATCHMENTS: model.subcatchments,
    RAINGAGES:     model.raingages,
    POLLUTANTS:    model.pollutants,
    TIMESERIES:    Object.entries(model.timeseries ?? {}).map(([k,v]) => ({ name: k, points: v.length })),
  };
  const data = sectionMap[section];
  if (!data?.length) return;

  const panel = document.getElementById('results-panel');
  const table = document.getElementById('results-table');
  if (!panel || !table) return;
  panel.hidden = false;

  const cols = Object.keys(data[0]).filter(k => !k.startsWith('_')).map(k => ({
    title: k, field: k, sorter: 'string',
    formatter: v => String(v.getValue() ?? ''),
  }));

  if (table._tabulator) table._tabulator.destroy();
  table._tabulator = new Tabulator(table, {
    data,
    columns: cols,
    layout: 'fitColumns',
    height: '260px',
  });

  document.querySelector('#results-tabs [href="#tab-table"]')?.click();
}

function populateSidebar(model) {
  // Update element counts in sidebar labels
  const counts = {
    RAINGAGES:     model.raingages.length,
    SUBCATCHMENTS: model.subcatchments.length,
    JUNCTIONS:     model.junctions.length,
    OUTFALLS:      model.outfalls.length,
    STORAGE:       model.storage.length,
    CONDUITS:      model.conduits.length,
    PUMPS:         model.pumps.length,
    ORIFICES:      model.orifices.length,
    WEIRS:         model.weirs.length,
  };
  Object.entries(counts).forEach(([sec, cnt]) => {
    document.querySelector(`[data-section="${sec}"]`).textContent =
      `${sec.charAt(0) + sec.slice(1).toLowerCase()} (${cnt})`;
  });
}

// ─── Subscribe to state changes → keep UI in sync ────────────────────────────
subscribe((next, prev) => {
  if (next.status !== prev.status) setStatus(next.status);
});
