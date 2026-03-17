/**
 * parser.test.js
 * Tests for swmmParser.js — section parsing and round-trip fidelity.
 */

import { parseInp, serializeInp } from '../src/swmmParser.js';

// ─── Minimal synthetic INP text ───────────────────────────────────────────────

const MINIMAL_INP = `
[TITLE]
Minimal test model

[OPTIONS]
FLOW_UNITS           CFS
ROUTING_MODEL        DYNWAVE
START_DATE           01/01/2020
START_TIME           00:00:00
END_DATE             01/01/2020
END_TIME             06:00:00
REPORT_START_DATE    01/01/2020
REPORT_START_TIME    00:00:00
WET_STEP             00:05:00
DRY_STEP             00:05:00
ROUTING_STEP         0:01:00

[RAINGAGES]
;Name      Format   Interval  SCF  Source  SeriesName
RG1        VOLUME   1:00      1.0  TIMESERIES TS_RAIN

[SUBCATCHMENTS]
;Name  RainGage  Outlet  Area  PctImperv  Width  Slope  CurbLen  SnowPack
S1     RG1       J1      10    50         100    0.5    0

[SUBAREAS]
;Subcat  NImperv  NPerv  SImperv  SPerv  PctZero  RouteTo
S1       0.01     0.10   0.05     0.05   25       OUTLET

[INFILTRATION]
;Subcat  MaxRate  MinRate  Decay  DryTime  MaxInfil
S1       3.0      0.5      4.14   7        0

[JUNCTIONS]
;Name  Elev  MaxDepth  InitDepth  SurDepth  PondedArea
J1     0.0   10.0      0          0         0
J2     -1.0  10.0      0          0         0

[OUTFALLS]
;Name  Elev   Type    StageData  TideGate
Out1   -2.0   FREE

[CONDUITS]
;Name  FromNode  ToNode  Length  Roughness  InOffset  OutOffset  InitFlow  MaxFlow
C1     J1        J2      400     0.013      0         0          0         0
C2     J2        Out1    200     0.013      0         0          0         0

[XSECTIONS]
;Link  Shape    Geom1  Geom2  Geom3  Geom4  Barrels
C1     CIRCULAR 1.5    0      0      0      1
C2     CIRCULAR 1.5    0      0      0      1

[TIMESERIES]
;Name      Date      Time    Value
TS_RAIN               0:00    0.0
TS_RAIN               0:15    0.10
TS_RAIN               0:30    0.25
TS_RAIN               0:45    0.10
TS_RAIN               1:00    0.0

[REPORT]
INPUT      NO
CONTROLS   NO
SUBCATCHMENTS ALL
NODES      ALL
LINKS      ALL

[COORDINATES]
;Node  X       Y
J1     1000    2000
J2     1500    2000
Out1   2000    2000

[VERTICES]
;Link  X       Y
C1     1250    2000

[POLYGONS]
;Subcat  X       Y
S1       900     2100
S1       1100    2100
S1       1100    1900
S1       900     1900
`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('parseInp – section parsing', () => {
  let model;
  beforeAll(() => { model = parseInp(MINIMAL_INP); });

  test('parses title', () => {
    expect(model.title).toMatch('Minimal test model');
  });

  test('parses OPTIONS as key-value map', () => {
    expect(model.options.FLOW_UNITS).toBe('CFS');
    expect(model.options.ROUTING_MODEL).toBe('DYNWAVE');
  });

  test('parses RAINGAGES', () => {
    expect(model.raingages).toHaveLength(1);
    expect(model.raingages[0].name).toBe('RG1');
    expect(model.raingages[0].format).toBe('VOLUME');
  });

  test('parses SUBCATCHMENTS', () => {
    expect(model.subcatchments).toHaveLength(1);
    expect(model.subcatchments[0].name).toBe('S1');
    expect(model.subcatchments[0].area).toBe('10');
    expect(model.subcatchments[0].pctImperv).toBe('50');
  });

  test('parses JUNCTIONS', () => {
    expect(model.junctions).toHaveLength(2);
    expect(model.junctions[0].name).toBe('J1');
    expect(model.junctions[1].name).toBe('J2');
    expect(model.junctions[1].elevation).toBe('-1.0');
  });

  test('parses OUTFALLS', () => {
    expect(model.outfalls).toHaveLength(1);
    expect(model.outfalls[0].name).toBe('Out1');
    expect(model.outfalls[0].type).toBe('FREE');
  });

  test('parses CONDUITS', () => {
    expect(model.conduits).toHaveLength(2);
    expect(model.conduits[0].name).toBe('C1');
    expect(model.conduits[0].fromNode).toBe('J1');
    expect(model.conduits[0].length).toBe('400');
  });

  test('parses XSECTIONS', () => {
    expect(model.xsections).toHaveLength(2);
    expect(model.xsections[0].shape).toBe('CIRCULAR');
    expect(model.xsections[0].geom1).toBe('1.5');
  });

  test('parses TIMESERIES into named arrays', () => {
    expect(model.timeseries.TS_RAIN).toBeDefined();
    expect(model.timeseries.TS_RAIN).toHaveLength(5);
    expect(model.timeseries.TS_RAIN[2].value).toBe(0.25);
  });

  test('parses COORDINATES as name→{x,y} map', () => {
    expect(model.coordinates.J1).toEqual({ x: 1000, y: 2000 });
    expect(model.coordinates.Out1).toEqual({ x: 2000, y: 2000 });
  });

  test('parses VERTICES as name→[{x,y}] map', () => {
    expect(model.vertices.C1).toHaveLength(1);
    expect(model.vertices.C1[0]).toEqual({ x: 1250, y: 2000 });
  });

  test('parses POLYGONS as name→[{x,y}] array', () => {
    expect(model.polygons.S1).toHaveLength(4);
  });

  test('ignores comment lines (;)', () => {
    // Field names from comment row should not appear as data
    const names = model.junctions.map(j => j.name);
    expect(names).not.toContain('Name');
  });
});

describe('parseInp – edge cases', () => {
  test('handles Windows line endings (CRLF)', () => {
    const crlf = MINIMAL_INP.replace(/\n/g, '\r\n');
    const m = parseInp(crlf);
    expect(m.junctions).toHaveLength(2);
  });

  test('handles inline comments on data lines', () => {
    const inp = `[JUNCTIONS]\nJ1  5.0  10.0  0  0  0  ; this is a comment\n`;
    const m = parseInp(inp);
    expect(m.junctions[0].name).toBe('J1');
    expect(m.junctions[0].elevation).toBe('5.0');
  });

  test('handles quoted names with spaces', () => {
    const inp = `[JUNCTIONS]\n"My Node"  5.0  10.0  0  0  0\n`;
    const m = parseInp(inp);
    expect(m.junctions[0].name).toBe('My Node');
  });

  test('returns empty arrays for missing sections', () => {
    const m = parseInp('[TITLE]\nEmpty\n');
    expect(m.conduits).toHaveLength(0);
    expect(m.junctions).toHaveLength(0);
  });

  test('parses empty file without throwing', () => {
    expect(() => parseInp('')).not.toThrow();
  });
});

describe('serializeInp – round-trip', () => {
  test('re-parsed model has same junction count', () => {
    const original = parseInp(MINIMAL_INP);
    const text     = serializeInp(original);
    const reparsed = parseInp(text);
    expect(reparsed.junctions).toHaveLength(original.junctions.length);
  });

  test('re-parsed model has same conduit names', () => {
    const original = parseInp(MINIMAL_INP);
    const text     = serializeInp(original);
    const reparsed = parseInp(text);
    const origNames = original.conduits.map(c => c.name).sort();
    const newNames  = reparsed.conduits.map(c => c.name).sort();
    expect(newNames).toEqual(origNames);
  });

  test('re-parsed model has same OPTIONS keys', () => {
    const original = parseInp(MINIMAL_INP);
    const text     = serializeInp(original);
    const reparsed = parseInp(text);
    expect(reparsed.options.FLOW_UNITS).toBe(original.options.FLOW_UNITS);
    expect(reparsed.options.ROUTING_MODEL).toBe(original.options.ROUTING_MODEL);
  });
});
