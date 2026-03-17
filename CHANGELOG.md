# Changelog

All notable changes to `swmm-js` are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] — 2026-03

### Added

#### Test models
- `data/test/Example1.inp` — OWA/EPA SWMM Example 1: kinematic wave runoff,  
  Horton infiltration, 3 subcatchments, 4-pipe network.
- `data/test/Example2.inp` — OWA/EPA SWMM Example 2: dynamic wave routing,  
  storage unit, orifice outlet, overflow weir.
- `data/test/Example3.inp` — OWA/EPA SWMM Example 3: combined sewer,  
  dry-weather flow patterns, RDII unit hydrographs, CSO weir.
- `data/test/Example4.inp` — OWA/EPA SWMM Example 4: water quality (TSS),  
  buildup/washoff, land uses, Green-Ampt infiltration, bioretention LID.
- `data/test/Example5.inp` — OWA/EPA SWMM Example 5: pump station,  
  wet-well cycling, force main (H-W), rule-based pump control.
- `data/test/Example6.inp` — OWA/EPA SWMM Example 6: snowmelt, groundwater,  
  aquifer recharge, continuous long-term simulation.
- `data/test/Example7.inp` — OWA/EPA SWMM Example 7: dual drainage,  
  gutter/street major system, inlet capture orifices, surface ponding.

#### Source modules (new files in `src/`)
- `src/swmmParser.js` — full section-aware `.inp` parser (30+ sections).  
  Returns a structured JS model object. Includes `serializeInp()` for round-trips.
- `src/swmmState.js` — lightweight reactive state store  
  (`setState`, `subscribe`, `resetState`). Replaces hidden `<span>` DOM state.
- `src/swmmJsonBridge.js` — safe WASM↔JS bridge with `safeStr()` escaper.  
  Replaces the `strcpy`/`strcat` JSON builder in `swmm5.c`.

#### Tests
- `tests/parser.test.js` — 20 tests: section parsing, edge cases, round-trip.
- `tests/state.test.js`  — 7 tests: setState, subscribe, resetState, read-only guard.
- `tests/owa_models.test.js` — 45 tests across all 7 OWA example models:
  element counts, topology integrity, cross-model consistency.

#### Build & tooling
- `package.json` — upgraded to Bootstrap 5.3, D3 v7, Tabulator v6, date-fns v3.  
  Removed: moment.js, jQuery, babel-standalone (browser), Bootstrap 4.  
  Added: Vite (dev server + bundler), Jest + jest-environment-jsdom.
- `vite.config.js` — Vite build config; multi-entry (index, demo_001, demo_002).
- `jest.config.js` — Jest config for ESM project.

### Changed

#### `index.html`
- **Bootstrap 4 → 5**: all `data-toggle` / `data-dismiss` replaced with  
  `data-bs-toggle` / `data-bs-dismiss`.
- **Fixed duplicate IDs**: all three nav dropdowns previously shared  
  `id="navbarDropdownMenuLink"` — now each has a unique ID  
  (`nav-file-menu`, `nav-edit-menu`, `nav-view-menu`, …).
- Added **Test Models** nav menu with direct links to all 7 OWA examples.
- Added **Units toggle** (US / SI) in navbar.
- Added Bootstrap 5 toast for error messages.
- Removed `babel-standalone` script tag (~800 KB); no in-browser JSX transpilation.
- Scripts migrated to `type="module"` ESM imports.

#### `script.js`
- Full rewrite as ES module.
- jQuery removed; all DOM operations use vanilla `document.querySelector` / `fetch`.
- State now read/written via `swmmState.js` instead of `innerHTML` on hidden spans.
- `moment.js` date formatting replaced with `date-fns/format`.
- Test model fetch wired to the new nav menu (`data-model` attribute).
- D3 v7 network canvas: renders nodes (junction/outfall/storage), conduits, and  
  subcatchment polygons with zoom/pan.
- Tabulator v6 section table opens on sidebar click.

#### `.gitignore`
- Added `node_modules/` — **critical**: removes ~50–100 MB of committed vendor code.
- Added `dist/`, `js.js`, `js.wasm`, `js.data` (Emscripten build artifacts).

### Security / reliability

- `src/swmmJsonBridge.js` `safeStr()` escapes all C string values before  
  they touch JSON — eliminates the buffer-overflow risk from the fixed-size `JX[]`  
  char array in `swmm5.c`.

### Deprecated

- Direct `node_modules/` script tags in HTML (`/node_modules/jquery/…` etc.).  
  Use the Vite dev server (`npm run dev`) or the production build (`npm run build`).

---

## [0.0.2-alpha] — 2021 (original upstream release)

Initial alpha release by Issac Gardner (ikegdivs/swmm-js).
