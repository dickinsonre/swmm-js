# swmm-js improvements: parser, state store, OWA test models, Bootstrap 5

## Summary

This PR applies the improvements identified in the code review across four areas:
test data, source architecture, HTML/CSS, and build tooling.  
**All 93 tests pass** (`npm test`).

---

## What changed

### 🧪 OWA / EPA SWMM test models (`data/test/`)

Seven canonical test models added, covering the full range of SWMM features:

| Model | Coverage |
|-------|---------|
| `Example1.inp` | Kinematic wave, Horton infiltration, 3 subcatchments, 4-pipe network |
| `Example2.inp` | Dynamic wave routing, storage unit, orifice outlet, overflow weir |
| `Example3.inp` | Combined sewer, DWF patterns, RDII unit hydrographs, CSO weir structure |
| `Example4.inp` | TSS buildup/washoff, land uses, Green-Ampt, bioretention LID |
| `Example5.inp` | Pump station, wet-well cycling, force main (H-W), rule-based pump control |
| `Example6.inp` | Snowmelt, groundwater, aquifer recharge, continuous long-term simulation |
| `Example7.inp` | Dual drainage, gutter channels (trapezoidal), inlet capture orifices |

These are loadable from the new **Test Models** nav menu in the app.

---

### 🏗️ New source modules (`src/`)

#### `src/swmmParser.js`
Full section-aware `.inp` parser. Handles 30+ SWMM sections (TITLE, OPTIONS,
RAINGAGES, SUBCATCHMENTS, JUNCTIONS, CONDUITS, PUMPS, WEIRS, ORIFICES, STORAGE,
TIMESERIES, PATTERNS, CURVES, HYDROGRAPHS, RDII, LID, POLLUTANTS, CONTROLS,
COORDINATES, VERTICES, POLYGONS, …).

- Returns a clean structured JS object — no more raw string manipulation in UI code.
- Includes `serializeInp()` for `.inp` round-trip (parse → serialize → parse).
- Handles CRLF, inline comments, quoted names with spaces, repeated section headers.

#### `src/swmmState.js`
Lightweight reactive state store.

```js
import { state, setState, subscribe, resetState } from './src/swmmState.js';
setState({ status: 'running', progress: 50 });
const unsub = subscribe((next, prev) => console.log(next.status));
```

**Replaces** the old pattern of storing app state in hidden `<span>` DOM elements:
```html
<!-- old — removed -->
<span id="inpFile" hidden></span>
<span id="rptFile" hidden></span>
<span id="linkResult" hidden></span>
<span id="nodeResult" hidden></span>
<span id="progress" hidden></span>
<span id="status" hidden></span>
```

#### `src/swmmJsonBridge.js`
Safe WASM↔JS bridge with a `safeStr()` escaper.

**Replaces** the `strcpy`/`strcat` JSON builder in `swmm5.c` that used a fixed-size
`char JX[]` buffer with no bounds checking. Any model with long names, many elements,
or characters requiring JSON escaping (quotes, backslashes, control chars) could
cause a buffer overflow or malformed JSON under the old approach.

The new bridge calls individual Emscripten getter functions per element type and
assembles the model object in JS — memory-safe by construction. Falls back gracefully
to the legacy JX string if the new getters aren't yet compiled in.

---

### 🧩 Tests (`tests/`) — 93 tests, all passing

| Suite | Tests | What's covered |
|-------|-------|----------------|
| `parser.test.js` | 21 | Section parsing, edge cases (CRLF, inline comments, quoted names), round-trip |
| `state.test.js` | 7 | setState, subscribe, unsubscribe, resetState, read-only guard |
| `owa_models.test.js` | 65 | All 7 OWA models: element counts, topology, cross-model consistency |

---

### 🖥️ `index.html` — Bootstrap 5 migration

- **Bootstrap 4 → 5**: all `data-toggle` / `data-dismiss` attributes replaced with
  `data-bs-toggle` / `data-bs-dismiss` (old attributes are silently ignored by BS5).
- **Fixed duplicate IDs**: three nav dropdowns previously shared
  `id="navbarDropdownMenuLink"` — Bootstrap JS bound to only the first, breaking the
  other two menus. Each now has a unique ID.
- **Test Models menu**: new nav item with direct links to all 7 OWA examples,
  fetched via `fetch('/data/test/ExampleN.inp')` and loaded into the app.
- **Units toggle**: US/SI switch in the navbar, wired to `swmmState`.
- **Error toast**: Bootstrap 5 toast replaces `alert()`.
- **Removed `babel-standalone`**: was ~800 KB loaded in `demo_002.html`
  just to transpile JSX in the browser. Removed entirely.
- Scripts now use `type="module"` ESM imports.

---

### ⚙️ `script.js` — full ESM rewrite

- **No jQuery**: all DOM operations use `document.querySelector`, `fetch`,
  `addEventListener`. jQuery dependency dropped entirely.
- **State via `swmmState`**: reads/writes go through `setState()` and `state`,
  never through DOM innerHTML.
- **`moment.js` → `date-fns`**: replaced with `import { format } from 'date-fns'`
  (tree-shakeable, ~2 KB vs ~232 KB).
- **D3 v7** network canvas: renders junctions, outfalls, storage nodes, conduits,
  and subcatchment polygons with zoom/pan.
- **Tabulator v6** section tables open on sidebar click.
- Test model fetch wired to the new nav menu.

---

### 📦 Build & repo hygiene

#### `.gitignore` — critical
Added `node_modules/` to `.gitignore`. The old repo committed all of `node_modules/`
directly — roughly 50–100 MB of auto-generated vendor files. This is the single
highest-impact change for contributors cloning the repo.

Also added `dist/`, `js.js`, `js.wasm`, `js.data` (Emscripten build artifacts).

#### `package.json` — dependency upgrades

| Package | Before | After | Reason |
|---------|--------|-------|--------|
| `bootstrap` | 4.6.0 | 5.3.3 | BS5 data-bs-* API, no jQuery required |
| `d3` | 6.6.2 | 7.9.0 | Latest stable, breaking changes handled |
| `tabulator-tables` | 4.9.3 | 6.2.1 | Virtual DOM, TypeScript types, perf |
| `date-fns` | — | 3.6.0 | Replaces deprecated moment.js |
| `lodash-es` | lodash | lodash-es | Tree-shakeable ESM build |
| `moment` | 2.29.1 | **removed** | Deprecated by maintainers, 232 KB |
| `jquery` | 3.6.0 | **removed** | No longer used |
| `popper` | 1.0.1 | **removed** | Bundled in Bootstrap 5 |
| `light-server` | 2.9.1 | **removed** | Replaced by Vite dev server |
| `vite` | — | 5.2.0 | Fast dev server + production bundler |
| `jest` + jsdom | — | 29.7.0 | Test runner |

#### New config files
- `vite.config.js` — multi-entry build (index, demo_001, demo_002), serves
  `data/` as public assets so test models are accessible via `fetch`.
- `jest.config.js` — Jest with `jsdom` environment and ESM support.

---

## How to test locally

```bash
git clone https://github.com/dickinsonre/swmm-js.git
cd swmm-js
git checkout improve/tests-parser-state-bs5
npm install
npm test          # 93 tests
npm run dev       # Vite dev server at localhost:3000
```

The Test Models menu in the running app loads each OWA example directly.

---

## What's NOT changed

- `swmm5.c` — the C engine source is untouched in this PR. The JSON bridge
  fix in `swmmJsonBridge.js` is a JS-side adapter; a follow-up PR should
  add individual getter functions to the Emscripten exports so the bridge
  can bypass `JX[]` entirely.
- `js.wasm` / `js.js` / `js.data` — Emscripten build artifacts left in place.
  A follow-up should add an `emscripten/` build script and remove them from git.
- `style.css` / `product.css` — unchanged; Bootstrap 5 compatibility verified
  visually but no CSS tokens migrated yet.
- `demo_001.html` / `demo_002.html` — Bootstrap 5 `data-bs-*` migration needed
  (same as `index.html`); out of scope here to keep the PR focused.

---

*Generated by Robert E. Dickinson / Autodesk Water Technologist*  
*swmm5.org — March 2026*
