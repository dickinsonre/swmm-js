# swmm-js — File & Folder Descriptions

> **swmm-js** is a web-centric system for sharing, managing, and creating EPA-SWMM (Stormwater Management Model) files.  
> Forked from [ikegdivs/swmm-js](https://github.com/ikegdivs/swmm-js) | Website: [www.swmm-js.org](https://www.swmm-js.org)

---

## Table of Contents

- [Root-Level Files](#root-level-files)
- [Directories](#directories)
  - [data/](#data)
  - [emscripten/src/](#emscriptensrc)
  - [js/](#js)
  - [src/](#src)
  - [node_modules/](#node_modules)
- [Build Artifacts](#build-artifacts)
- [Configuration & Metadata](#configuration--metadata)

---

## Root-Level Files

### HTML Entry Points

| File | Description |
|------|-------------|
| `index.html` | Main application entry point. Loads the swmm-js web interface, references `style.css`, `product.css`, `script.js`, and the Emscripten WASM module (`js.js`). This is the page served when navigating to the application root. |
| `demo_001.html` | First browser-based demo page. Demonstrates basic SWMM model loading and display functionality using `demo_001.js`. Intended as a minimal working example for new users. |
| `demo_002.html` | Second demo page extending the capabilities shown in `demo_001.html`. Uses `demo_002.js` to illustrate additional features such as simulation output handling or alternative input configurations. |

### JavaScript Files

| File | Description |
|------|-------------|
| `script.js` | Primary application JavaScript for `index.html`. Handles UI interactions, SWMM `.inp` file parsing, communication with the Emscripten WASM module, and rendering of network elements and simulation results. |
| `library.js` | Shared utility library providing helper functions used by both the main application and the demo pages. May include SWMM data-structure helpers, unit converters, or file I/O routines. |
| `demo_001.js` | JavaScript logic for `demo_001.html`. Loads a sample SWMM model, initialises the WASM engine, and renders output to the page. |
| `demo_002.js` | JavaScript logic for `demo_002.html`. Extends `demo_001.js` with additional demonstration scenarios. |
| `js.js` | **Emscripten-generated JavaScript glue code.** Auto-produced by compiling `swmm5.c` with Emscripten. Bootstraps the WebAssembly module, manages memory allocation, and exposes the EPA SWMM5 C API to JavaScript. Do not edit manually. |

### Stylesheets

| File | Description |
|------|-------------|
| `style.css` | Base stylesheet for the swmm-js web interface. Defines layout, typography, colour palette, and responsive behaviour for `index.html`. |
| `product.css` | Supplementary stylesheet for product-specific UI components — panels, toolbars, map canvas, results tables, etc. Separating product styling from base styles keeps theming concerns modular. |

### C Source & Definition

| File | Description |
|------|-------------|
| `swmm5.c` | Consolidated EPA SWMM 5 C source code. This single-file amalgamation of the official SWMM 5 engine is the target compiled by Emscripten to produce `js.js` and `js.wasm`. It implements the full hydrology, hydraulics, water quality, and LID routines of EPA SWMM 5. |
| `swmm5.def` | Windows module-definition file listing the SWMM5 DLL exported functions. Used during native Windows builds; documents which API entry points (`swmm_run`, `swmm_open`, `swmm_step`, `swmm_close`, etc.) are publicly accessible. |

### Data Files

| File | Description |
|------|-------------|
| `xsect.dat` | Cross-section geometry lookup table used by SWMM's hydraulic engine. Contains tabulated depth–area–top-width curves for irregular and user-defined conduit sections. Referenced at runtime by `swmm5.c`. |
| `js.data` | **Emscripten virtual filesystem data package.** Bundles files (such as `xsect.dat` and sample `.inp` models) into a single binary blob that is mounted as a virtual filesystem inside the WASM sandbox. Auto-generated alongside `js.js`; do not edit manually. |
| `js.wasm` | **Compiled WebAssembly binary** of the EPA SWMM 5 engine. The browser downloads and instantiates this file at runtime to execute SWMM simulations at near-native speed entirely client-side, with no server required. |

### Documentation & Legal

| File | Description |
|------|-------------|
| `README.md` | Project overview: what swmm-js is, its current alpha status, link to the swmm-js.org website, and contact information for contributions. |
| `SECURITY.md` | Security policy specifying supported versions and the process for responsibly disclosing vulnerabilities. |
| `license.txt` | Software licence governing the use and distribution of swmm-js source code. |

### Configuration

| File | Description |
|------|-------------|
| `.gitignore` | Specifies files and directories that Git should not track — typically build outputs, temporary files, and environment-specific artefacts. |
| `package.json` | Node.js project manifest. Declares the project name, version, scripts (e.g., build, test), and npm dependencies used for development tooling and the Emscripten build pipeline. |
| `package-lock.json` | Auto-generated lockfile that pins exact dependency versions for reproducible `npm install` runs. Do not edit manually. |

---

## Directories

### `data/`

Contains sample EPA SWMM `.inp` input files and associated datasets used for testing and demonstration.  
- Example model files covering simple catchment, pipe network, and LID configurations.  
- Referenced by the demo pages (`demo_001.html`, `demo_002.html`) and the Emscripten virtual filesystem packager that creates `js.data`.

---

### `emscripten/src/`

Houses the Emscripten build configuration and any C wrapper/glue code needed to expose the SWMM5 API to JavaScript.

| Expected Contents | Description |
|-------------------|-------------|
| Build scripts / `Makefile` | Commands to invoke `emcc` (Emscripten compiler) on `swmm5.c`, producing `js.js`, `js.wasm`, and `js.data`. |
| C wrapper files | Thin C shims that map JavaScript-friendly function signatures onto internal SWMM5 API calls, enabling calls from `script.js` and `library.js`. |

> **Note:** The `emscripten/` path skips through empty directories to reach `emscripten/src/` — the intermediate folder exists only as a namespace.

---

### `js/`

JavaScript modules and helper scripts that are either imported by the main application or tested independently.

| Expected Contents | Description |
|-------------------|-------------|
| SWMM `.inp` parser | Parses the section-based SWMM input file format into JavaScript objects (subcatchments, junctions, conduits, raingauges, etc.). |
| Results reader | Reads SWMM binary output (`.rpt`/`.out`) or captures Emscripten-simulated output and converts it to structured JS arrays for charting. |
| Network renderer | Canvas or SVG drawing code for rendering the pipe/channel network, subcatchments, and flow animation. |
| Unit conversion utilities | Functions for toggling between US customary and SI (metric) units throughout the UI. |

---

### `src/`

Higher-level application source code that is bundled or transpiled before deployment.

| Expected Contents | Description |
|-------------------|-------------|
| UI components | Modular view components for the map panel, results panel, properties inspector, and toolbar. |
| State management | Application state (loaded model, active simulation, selected elements) shared across components. |
| API/interface layer | Abstraction layer between the UI and the `js.js` Emscripten module, handling async WASM calls and result buffering. |

---

### `node_modules/`

Auto-populated by `npm install` from `package.json`. Contains all third-party development dependencies (build tools, testing frameworks, bundlers). This directory is listed in `.gitignore` and **should not be committed to version control**.

---

## Build Artifacts

The following files are **generated** by the Emscripten compilation pipeline and should not be edited by hand:

| File | Generated by |
|------|-------------|
| `js.js` | `emcc swmm5.c ...` — JavaScript glue/loader |
| `js.wasm` | `emcc swmm5.c ...` — WebAssembly binary |
| `js.data` | Emscripten `--preload-file` packager — virtual filesystem |

To rebuild, use the scripts in `emscripten/src/` with the Emscripten SDK (`emsdk`) installed.

---

## Configuration & Metadata

| File | Purpose |
|------|---------|
| `.gitignore` | Excludes `node_modules/`, build outputs, OS artefacts |
| `package.json` | npm project metadata and build scripts |
| `package-lock.json` | Locked dependency tree for reproducible installs |
| `SECURITY.md` | Vulnerability disclosure policy |
| `license.txt` | Project licence terms |

---

## Language Composition

| Language | Share | Role |
|----------|-------|------|
| JavaScript | 55 % | Application logic, SWMM parser, UI, Emscripten glue |
| C | 38 % | EPA SWMM 5 simulation engine (`swmm5.c`) |
| HTML | 6.5 % | Page structure for `index.html` and demo pages |
| CSS | 0.2 % | Styling (`style.css`, `product.css`) |

---

## Quick-Start Architecture

```
Browser
  ├── index.html            ← entry point
  ├── style.css / product.css  ← styling
  ├── script.js             ← UI & orchestration
  ├── library.js            ← shared utilities
  │
  ├── js.js  ──────────────────┐  Emscripten
  ├── js.wasm ─────────────────┤  compiled from
  ├── js.data ─────────────────┘  swmm5.c
  │
  ├── data/                 ← sample SWMM .inp models
  ├── js/                   ← parser, renderer, utilities
  └── src/                  ← UI components & state
```

The browser downloads `js.wasm` and uses `js.js` to instantiate it. `script.js` calls into the WASM module to run SWMM simulations entirely client-side; results are displayed in the HTML interface without any server-side computation.

---

*This document was generated for [dickinsonre/swmm-js](https://github.com/dickinsonre/swmm-js) — March 2026.*  
*Maintained by Robert E. Dickinson, Autodesk Water Technologist & SWMM TAC Chair, CIMM.org*
