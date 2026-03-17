/**
 * swmmParser.js
 * ------------
 * Parses an EPA SWMM 5 .inp text file into a structured JavaScript object.
 *
 * Sections handled: TITLE, OPTIONS, RAINGAGES, SUBCATCHMENTS, SUBAREAS,
 * INFILTRATION, JUNCTIONS, OUTFALLS, DIVIDERS, STORAGE, CONDUITS, PUMPS,
 * ORIFICES, WEIRS, OUTLETS, XSECTIONS, TRANSECTS, LOSSES, CONTROLS,
 * POLLUTANTS, LANDUSES, BUILDUP, WASHOFF, COVERAGES, INFLOWS, DWF, RDII,
 * HYDROGRAPHS, TIMESERIES, PATTERNS, CURVES, REPORT, TAGS, MAP, COORDINATES,
 * VERTICES, Polygons, SYMBOLS, BACKDROP, LABELS.
 *
 * Usage:
 *   import { parseInp } from './swmmParser.js';
 *   const model = parseInp(inpText);
 */

/**
 * Parse raw .inp file text into a model object.
 * @param {string} text
 * @returns {SwmmModel}
 */
export function parseInp(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const sections = splitSections(lines);
  return {
    title:         parseTitle(sections.TITLE ?? []),
    options:       parseOptions(sections.OPTIONS ?? []),
    raingages:     parseTable(sections.RAINGAGES ?? [], RAINGAGE_FIELDS),
    subcatchments: parseTable(sections.SUBCATCHMENTS ?? [], SUBCATCH_FIELDS),
    subareas:      parseTable(sections.SUBAREAS ?? [], SUBAREA_FIELDS),
    infiltration:  parseTable(sections.INFILTRATION ?? [], INFIL_FIELDS),
    junctions:     parseTable(sections.JUNCTIONS ?? [], JUNCTION_FIELDS),
    outfalls:      parseTable(sections.OUTFALLS ?? [], OUTFALL_FIELDS),
    dividers:      parseTable(sections.DIVIDERS ?? [], DIVIDER_FIELDS),
    storage:       parseTable(sections.STORAGE ?? [], STORAGE_FIELDS),
    conduits:      parseTable(sections.CONDUITS ?? [], CONDUIT_FIELDS),
    pumps:         parseTable(sections.PUMPS ?? [], PUMP_FIELDS),
    orifices:      parseTable(sections.ORIFICES ?? [], ORIFICE_FIELDS),
    weirs:         parseTable(sections.WEIRS ?? [], WEIR_FIELDS),
    outlets:       parseTable(sections.OUTLETS ?? [], OUTLET_FIELDS),
    xsections:     parseTable(sections.XSECTIONS ?? [], XSECT_FIELDS),
    losses:        parseTable(sections.LOSSES ?? [], LOSS_FIELDS),
    timeseries:    parseTimeSeries(sections.TIMESERIES ?? []),
    patterns:      parsePatterns(sections.PATTERNS ?? []),
    curves:        parseCurves(sections.CURVES ?? []),
    pollutants:    parseTable(sections.POLLUTANTS ?? [], POLLUTANT_FIELDS),
    controls:      parseControls(sections.CONTROLS ?? []),
    inflows:       parseTable(sections.INFLOWS ?? [], INFLOW_FIELDS),
    dwf:           parseTable(sections.DWF ?? [], DWF_FIELDS),
    rdii:          parseTable(sections.RDII ?? [], RDII_FIELDS),
    hydrographs:   parseHydrographs(sections.HYDROGRAPHS ?? []),
    report:        parseOptions(sections.REPORT ?? []),
    coordinates:   parseCoordinates(sections.COORDINATES ?? []),
    vertices:      parseVertices(sections.VERTICES ?? []),
    polygons:      parseVertices(sections.POLYGONS ?? []),
    symbols:       parseCoordinates(sections.SYMBOLS ?? []),
    tags:          parseTags(sections.TAGS ?? []),
    _raw:          sections,
  };
}

// ─── Section splitter ────────────────────────────────────────────────────────

function splitSections(lines) {
  const sections = {};
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;
    const m = line.match(/^\[([A-Z_]+)\]/i);
    if (m) {
      current = m[1].toUpperCase();
      // Allow the same section header to appear multiple times (e.g. two
      // [XSECTIONS] blocks) by appending to an existing array rather than
      // replacing it.
      if (!sections[current]) sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  return sections;
}

// ─── Generic table parser ─────────────────────────────────────────────────────

function parseTable(lines, fields) {
  const rows = [];
  for (const line of lines) {
    const parts = tokenize(line);
    if (!parts.length) continue;
    const obj = {};
    fields.forEach((f, i) => {
      obj[f] = parts[i] !== undefined ? parts[i] : '';
    });
    // store any overflow tokens
    if (parts.length > fields.length) {
      obj._extra = parts.slice(fields.length);
    }
    rows.push(obj);
  }
  return rows;
}

// ─── Special-case parsers ─────────────────────────────────────────────────────

function parseTitle(lines) {
  return lines.join('\n');
}

function parseOptions(lines) {
  const opts = {};
  for (const line of lines) {
    const parts = tokenize(line);
    if (parts.length >= 2) opts[parts[0].toUpperCase()] = parts.slice(1).join(' ');
  }
  return opts;
}

function parseTimeSeries(lines) {
  const series = {};
  for (const line of lines) {
    const parts = tokenize(line);
    if (parts.length < 3) continue;
    const name = parts[0];
    if (!series[name]) series[name] = [];
    // DATE TIME VALUE or just TIME VALUE
    const hasDate = parts.length >= 4 && parts[1].includes('/');
    if (hasDate) {
      series[name].push({ date: parts[1], time: parts[2], value: parseFloat(parts[3]) });
    } else {
      series[name].push({ time: parts[1], value: parseFloat(parts[2]) });
    }
  }
  return series;
}

function parsePatterns(lines) {
  const patterns = {};
  for (const line of lines) {
    const parts = tokenize(line);
    if (parts.length < 2) continue;
    const name = parts[0];
    if (!patterns[name]) patterns[name] = { type: '', multipliers: [] };
    const types = ['MONTHLY','DAILY','HOURLY','WEEKEND'];
    if (types.includes(parts[1].toUpperCase())) {
      patterns[name].type = parts[1].toUpperCase();
      patterns[name].multipliers.push(...parts.slice(2).map(Number));
    } else {
      patterns[name].multipliers.push(...parts.slice(1).map(Number));
    }
  }
  return patterns;
}

function parseCurves(lines) {
  const curves = {};
  for (const line of lines) {
    const parts = tokenize(line);
    if (parts.length < 2) continue;
    const name = parts[0];
    if (!curves[name]) curves[name] = { type: '', points: [] };
    const curveTypes = ['STORAGE','DIVERSION','TIDAL','PUMP1','PUMP2','PUMP3',
                        'PUMP4','RATING','CONTROL','SHAPE'];
    if (curveTypes.includes(parts[1].toUpperCase())) {
      curves[name].type = parts[1].toUpperCase();
      if (parts.length >= 4)
        curves[name].points.push({ x: parseFloat(parts[2]), y: parseFloat(parts[3]) });
    } else if (parts.length >= 3) {
      curves[name].points.push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]) });
    }
  }
  return curves;
}

function parseCoordinates(lines) {
  const coords = {};
  for (const line of lines) {
    const parts = tokenize(line);
    if (parts.length >= 3) coords[parts[0]] = { x: parseFloat(parts[1]), y: parseFloat(parts[2]) };
  }
  return coords;
}

function parseVertices(lines) {
  const verts = {};
  for (const line of lines) {
    const parts = tokenize(line);
    if (parts.length < 3) continue;
    if (!verts[parts[0]]) verts[parts[0]] = [];
    verts[parts[0]].push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]) });
  }
  return verts;
}

function parseTags(lines) {
  const tags = {};
  for (const line of lines) {
    const parts = tokenize(line);
    if (parts.length >= 3) {
      const key = `${parts[0].toUpperCase()}:${parts[1]}`;
      tags[key] = parts[2];
    }
  }
  return tags;
}

function parseControls(lines) {
  return lines.join('\n');
}

function parseHydrographs(lines) {
  const hydros = {};
  let current = null;
  for (const line of lines) {
    const parts = tokenize(line);
    if (!parts.length) continue;
    if (parts.length === 2 && !current) {
      current = parts[0];
      hydros[current] = { raingage: parts[1], monthly: {} };
    } else if (current && parts.length >= 8) {
      hydros[current].monthly[parts[0]] = {
        short: { R: +parts[1], T: +parts[2], K: +parts[3] },
        medium:{ R: +parts[4], T: +parts[5], K: +parts[6] },
        long:  { R: +parts[7], T: +parts[8] !== undefined ? +parts[8] : 0,
                 K: +parts[9] !== undefined ? +parts[9] : 0 },
      };
    }
  }
  return hydros;
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

function tokenize(line) {
  // Strip inline comments
  const noComment = line.replace(/;.*$/, '').trim();
  if (!noComment) return [];
  // Split on whitespace, respecting quoted strings
  const tokens = [];
  let cur = '';
  let inQ = false;
  for (const ch of noComment) {
    if (ch === '"') { inQ = !inQ; }
    else if (!inQ && /\s/.test(ch)) {
      if (cur) { tokens.push(cur); cur = ''; }
    } else { cur += ch; }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

// ─── Field name lists ─────────────────────────────────────────────────────────

const RAINGAGE_FIELDS     = ['name','format','interval','scf','source','tsname','fname','sta','units'];
const SUBCATCH_FIELDS     = ['name','raingage','outlet','area','pctImperv','width','slope','curbLen','snowpack'];
const SUBAREA_FIELDS      = ['subcat','nImperv','nPerv','sImperv','sPerv','pctZero','routeTo','pctRouted'];
const INFIL_FIELDS        = ['subcat','maxRate','minRate','decay','dryTime','maxInfil'];
const JUNCTION_FIELDS     = ['name','elevation','maxDepth','initDepth','surDepth','pondedArea'];
const OUTFALL_FIELDS      = ['name','elevation','type','stageData','tidegate'];
const DIVIDER_FIELDS      = ['name','elevation','divLink','type','cutoff','qmin','ht','cd','maxDepth','initDepth','surDepth','pondedArea'];
const STORAGE_FIELDS      = ['name','elev','maxDepth','initDepth','shape','curveName','a1','a2','a0','pondedArea','fevap','seepRate'];
const CONDUIT_FIELDS      = ['name','fromNode','toNode','length','roughness','inOffset','outOffset','initFlow','maxFlow'];
const PUMP_FIELDS         = ['name','fromNode','toNode','curve','status','suctionDepth','offDepth'];
const ORIFICE_FIELDS      = ['name','fromNode','toNode','type','offset','cd','gated','closeTime'];
const WEIR_FIELDS         = ['name','fromNode','toNode','type','crestHt','cd','gated','endCon','endCoeff'];
const OUTLET_FIELDS       = ['name','fromNode','toNode','offset','gated','curveName','cd','exponent'];
const XSECT_FIELDS        = ['link','shape','geom1','geom2','geom3','geom4','barrels','culvert'];
const LOSS_FIELDS         = ['link','kin','kout','kavg','flap','seepage'];
const POLLUTANT_FIELDS    = ['name','units','crain','cgw','cii','kdecay','snowOnly','coPollut','coFract'];
const INFLOW_FIELDS       = ['node','constituent','tseries','type','ufactor','sfactor','baseline','pattern'];
const DWF_FIELDS          = ['node','constituent','avgValue','pat1','pat2','pat3','pat4'];
const RDII_FIELDS         = ['node','uhGroup','sewerArea'];

/**
 * Serialize a parsed model back to .inp text format.
 * Useful for round-trip testing.
 * @param {SwmmModel} model
 * @returns {string}
 */
export function serializeInp(model) {
  const lines = [];
  const sect = (name, rows, fields) => {
    if (!rows?.length) return;
    lines.push(`[${name}]`);
    lines.push(';' + fields.join('\t'));
    rows.forEach(r => lines.push(fields.map(f => r[f] ?? '').join('\t')));
    lines.push('');
  };

  if (model.title) { lines.push('[TITLE]'); lines.push(model.title); lines.push(''); }
  if (model.options) {
    lines.push('[OPTIONS]');
    Object.entries(model.options).forEach(([k,v]) => lines.push(`${k.padEnd(20)}${v}`));
    lines.push('');
  }
  sect('RAINGAGES',     model.raingages,     RAINGAGE_FIELDS);
  sect('SUBCATCHMENTS', model.subcatchments, SUBCATCH_FIELDS);
  sect('SUBAREAS',      model.subareas,      SUBAREA_FIELDS);
  sect('INFILTRATION',  model.infiltration,  INFIL_FIELDS);
  sect('JUNCTIONS',     model.junctions,     JUNCTION_FIELDS);
  sect('OUTFALLS',      model.outfalls,      OUTFALL_FIELDS);
  sect('STORAGE',       model.storage,       STORAGE_FIELDS);
  sect('CONDUITS',      model.conduits,      CONDUIT_FIELDS);
  sect('PUMPS',         model.pumps,         PUMP_FIELDS);
  sect('ORIFICES',      model.orifices,      ORIFICE_FIELDS);
  sect('WEIRS',         model.weirs,         WEIR_FIELDS);
  sect('OUTLETS',       model.outlets,       OUTLET_FIELDS);
  sect('XSECTIONS',     model.xsections,     XSECT_FIELDS);
  sect('POLLUTANTS',    model.pollutants,    POLLUTANT_FIELDS);
  sect('INFLOWS',       model.inflows,       INFLOW_FIELDS);
  sect('DWF',           model.dwf,           DWF_FIELDS);
  sect('RDII',          model.rdii,          RDII_FIELDS);

  if (model.timeseries) {
    lines.push('[TIMESERIES]');
    Object.entries(model.timeseries).forEach(([name, pts]) => {
      pts.forEach(p => lines.push(`${name}\t${p.date ?? ''}\t${p.time}\t${p.value}`));
    });
    lines.push('');
  }
  if (model.coordinates) {
    lines.push('[COORDINATES]');
    Object.entries(model.coordinates).forEach(([id,c]) => lines.push(`${id}\t${c.x}\t${c.y}`));
    lines.push('');
  }
  if (model.vertices) {
    lines.push('[VERTICES]');
    Object.entries(model.vertices).forEach(([id,pts]) => pts.forEach(p => lines.push(`${id}\t${p.x}\t${p.y}`)));
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * @typedef {Object} SwmmModel
 */
