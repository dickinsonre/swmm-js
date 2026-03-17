/**
 * owa_models.test.js
 * ------------------
 * Loads each OWA test model (.inp) file and validates:
 *  - Parse completes without throwing
 *  - Key section element counts match expected values
 *  - Required OPTIONS keys are present
 *  - All conduit endpoints reference declared nodes
 *  - No duplicate names within any one element type
 *
 * Add more assertions as you expand parser coverage.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseInp } from '../src/swmmParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '../data/test');

function load(filename) {
  const text = readFileSync(join(DATA_DIR, filename), 'utf8');
  return parseInp(text);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Collect all declared node names (junctions + outfalls + storage + dividers) */
function allNodeNames(m) {
  return new Set([
    ...m.junctions.map(n => n.name),
    ...m.outfalls.map(n => n.name),
    ...m.storage.map(n => n.name),
    ...m.dividers.map(n => n.name),
  ]);
}

/** Check no duplicate names in an array of objects with a .name property */
function hasDuplicateNames(arr) {
  const seen = new Set();
  for (const item of arr) {
    if (seen.has(item.name)) return true;
    seen.add(item.name);
  }
  return false;
}

// ─── Example 1 ───────────────────────────────────────────────────────────────

describe('OWA Example 1 – Simple Runoff & KW Routing', () => {
  let m;
  beforeAll(() => { m = load('Example1.inp'); });

  test('parses without throwing', () => { expect(m).toBeTruthy(); });
  test('flow units = CFS',        () => { expect(m.options.FLOW_UNITS).toBe('CFS'); });
  test('routing model = KINWAVE', () => { expect(m.options.FLOW_ROUTING ?? m.options.ROUTING_MODEL).toMatch(/KIN/i); });
  test('has 1 raingage',          () => { expect(m.raingages).toHaveLength(1); });
  test('has 3 subcatchments',     () => { expect(m.subcatchments).toHaveLength(3); });
  test('has 4 junctions',         () => { expect(m.junctions).toHaveLength(4); });
  test('has 1 outfall',           () => { expect(m.outfalls).toHaveLength(1); });
  test('has 4 conduits',          () => { expect(m.conduits).toHaveLength(4); });
  test('no duplicate junction names', () => { expect(hasDuplicateNames(m.junctions)).toBe(false); });
  test('all conduit endpoints reference declared nodes', () => {
    const nodes = allNodeNames(m);
    for (const c of m.conduits) {
      expect(nodes.has(c.fromNode)).toBe(true);
      expect(nodes.has(c.toNode)).toBe(true);
    }
  });
  test('conduit C1 is 400 ft long', () => {
    const c1 = m.conduits.find(c => c.name === 'C1');
    expect(c1).toBeDefined();
    expect(parseFloat(c1.length)).toBe(400);
  });
  test('timeseries TS1 has entries', () => {
    expect(m.timeseries.TS1).toBeDefined();
    expect(m.timeseries.TS1.length).toBeGreaterThan(0);
  });
  test('coordinates defined for all junctions', () => {
    for (const j of m.junctions) {
      expect(m.coordinates[j.name]).toBeDefined();
    }
  });
});

// ─── Example 2 ───────────────────────────────────────────────────────────────

describe('OWA Example 2 – Dynamic Wave + Storage + Orifice', () => {
  let m;
  beforeAll(() => { m = load('Example2.inp'); });

  test('parses without throwing', () => { expect(m).toBeTruthy(); });
  test('flow routing = DYNWAVE',  () => { expect(m.options.FLOW_ROUTING).toMatch(/DYN/i); });
  test('has at least 1 storage node', () => { expect(m.storage.length).toBeGreaterThanOrEqual(1); });
  test('has at least 1 orifice',      () => { expect(m.orifices.length).toBeGreaterThanOrEqual(1); });
  test('has at least 1 weir',         () => { expect(m.weirs.length).toBeGreaterThanOrEqual(1); });
  test('orifice Or1 connects from storage', () => {
    const or1 = m.orifices.find(o => o.name === 'Or1');
    expect(or1).toBeDefined();
    const storageNames = new Set(m.storage.map(s => s.name));
    expect(storageNames.has(or1.fromNode)).toBe(true);
  });
});

// ─── Example 3 ───────────────────────────────────────────────────────────────

describe('OWA Example 3 – CSO with RDII', () => {
  let m;
  beforeAll(() => { m = load('Example3.inp'); });

  test('parses without throwing', () => { expect(m).toBeTruthy(); });
  test('has DWF entries',         () => { expect(m.dwf.length).toBeGreaterThan(0); });
  test('has RDII entries',        () => { expect(m.rdii.length).toBeGreaterThan(0); });
  test('has at least 1 hydrograph', () => {
    expect(Object.keys(m.hydrographs).length).toBeGreaterThanOrEqual(1);
  });
  test('has a weir (CSO structure)', () => {
    expect(m.weirs.length).toBeGreaterThanOrEqual(1);
  });
  test('dry-weather flow node names are valid nodes', () => {
    const nodes = allNodeNames(m);
    for (const d of m.dwf) {
      expect(nodes.has(d.node)).toBe(true);
    }
  });
  test('RDII nodes are valid nodes', () => {
    const nodes = allNodeNames(m);
    for (const r of m.rdii) {
      expect(nodes.has(r.node)).toBe(true);
    }
  });
});

// ─── Example 4 ───────────────────────────────────────────────────────────────

describe('OWA Example 4 – Water Quality + LID', () => {
  let m;
  beforeAll(() => { m = load('Example4.inp'); });

  test('parses without throwing', () => { expect(m).toBeTruthy(); });
  test('infiltration model = GREEN_AMPT', () => {
    expect(m.options.INFILTRATION).toMatch(/GREEN/i);
  });
  test('has at least 1 pollutant (TSS)', () => {
    expect(m.pollutants.length).toBeGreaterThanOrEqual(1);
    expect(m.pollutants[0].name).toBe('TSS');
  });
  test('timeseries has rainfall data', () => {
    expect(m.timeseries.TS_RAIN).toBeDefined();
    const maxVal = Math.max(...m.timeseries.TS_RAIN.map(p => p.value));
    expect(maxVal).toBeGreaterThan(0);
  });
  test('polygon vertices present for each subcatchment', () => {
    for (const s of m.subcatchments) {
      expect(m.polygons[s.name]).toBeDefined();
    }
  });
});

// ─── Example 5 ───────────────────────────────────────────────────────────────

describe('OWA Example 5 – Pump Station & Force Main', () => {
  let m;
  beforeAll(() => { m = load('Example5.inp'); });

  test('parses without throwing', () => { expect(m).toBeTruthy(); });
  test('force main equation = H-W', () => {
    expect(m.options.FORCE_MAIN_EQUATION).toMatch(/H-W|H\/W|HW/i);
  });
  test('has at least 1 pump',    () => { expect(m.pumps.length).toBeGreaterThanOrEqual(1); });
  test('has at least 1 storage', () => { expect(m.storage.length).toBeGreaterThanOrEqual(1); });
  test('pump curve defined in curves', () => {
    const pump = m.pumps[0];
    expect(pump).toBeDefined();
    expect(m.curves[pump.curve] ?? m.curves['PC1']).toBeDefined();
  });
  test('wet well (WetWell) is a storage node', () => {
    const ww = m.storage.find(s => s.name === 'WetWell');
    expect(ww).toBeDefined();
  });
  test('control rules text is non-empty', () => {
    expect(m.controls.length).toBeGreaterThan(10);
  });
});

// ─── Example 6 ───────────────────────────────────────────────────────────────

describe('OWA Example 6 – Snowmelt & Groundwater', () => {
  let m;
  beforeAll(() => { m = load('Example6.inp'); });

  test('parses without throwing', () => { expect(m).toBeTruthy(); });
  test('infiltration = GREEN_AMPT', () => {
    expect(m.options.INFILTRATION).toMatch(/GREEN/i);
  });
  test('has temperature timeseries', () => {
    expect(m.timeseries.TS_TEMP).toBeDefined();
    expect(m.timeseries.TS_TEMP.length).toBeGreaterThan(0);
  });
  test('has precipitation timeseries', () => {
    expect(m.timeseries.TS_PRECIP).toBeDefined();
  });
  test('has 3 conduits', () => { expect(m.conduits).toHaveLength(3); });
  test('report_start_date present', () => {
    expect(m.options.REPORT_START_DATE).toBeDefined();
  });
});

// ─── Example 7 ───────────────────────────────────────────────────────────────

describe('OWA Example 7 – Dual Drainage', () => {
  let m;
  beforeAll(() => { m = load('Example7.inp'); });

  test('parses without throwing', () => { expect(m).toBeTruthy(); });
  test('allow ponding = YES', () => {
    expect(m.options.ALLOW_PONDING).toMatch(/YES/i);
  });
  test('has multiple subcatchments', () => {
    expect(m.subcatchments.length).toBeGreaterThanOrEqual(4);
  });
  test('has orifices (inlet capture)', () => {
    expect(m.orifices.length).toBeGreaterThanOrEqual(2);
  });
  test('gutter conduits have trapezoidal sections', () => {
    const trapXsects = m.xsections.filter(x => x.shape === 'TRAPEZOIDAL');
    expect(trapXsects.length).toBeGreaterThanOrEqual(1);
  });
  test('subcatchment names unique', () => {
    expect(hasDuplicateNames(m.subcatchments)).toBe(false);
  });
  test('all polygon sets have ≥3 vertices', () => {
    for (const s of m.subcatchments) {
      if (m.polygons[s.name]) {
        expect(m.polygons[s.name].length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

// ─── Cross-example consistency checks ────────────────────────────────────────

describe('Cross-model: all examples use CFS flow units', () => {
  const files = [
    'Example1.inp','Example2.inp','Example3.inp',
    'Example4.inp','Example5.inp','Example6.inp','Example7.inp'
  ];
  files.forEach(file => {
    test(`${file} uses CFS`, () => {
      const m = load(file);
      expect(m.options.FLOW_UNITS).toBe('CFS');
    });
  });
});

describe('Cross-model: all examples have non-empty coordinates', () => {
  const files = [
    'Example1.inp','Example2.inp','Example3.inp',
    'Example4.inp','Example5.inp','Example6.inp','Example7.inp'
  ];
  files.forEach(file => {
    test(`${file} has coordinates`, () => {
      const m = load(file);
      expect(Object.keys(m.coordinates).length).toBeGreaterThan(0);
    });
  });
});
