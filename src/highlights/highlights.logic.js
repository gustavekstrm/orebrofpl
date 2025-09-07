/**
 * Pure logic to compute weekly highlights from aggregates.
 * @module highlights.logic
 */

/**
 * @typedef {Object} WeeklyAggregate
 * @property {number} entryId
 * @property {string} playerName
 * @property {string} teamName
 * @property {number} gwPoints
 * @property {number} totalPoints
 * @property {number|null} overallRank
 * @property {number|null} prevOverallRank
 */

/**
 * @typedef {Object} Highlights
 * @property {WeeklyAggregate|null} veckansSopa
 * @property {WeeklyAggregate|null} veckansKanon
 * @property {{ agg: WeeklyAggregate, delta: number }|null} veckansRaket
 * @property {{ agg: WeeklyAggregate, delta: number }|null} veckansStörtdyk
 * @property {null} flestBänkpoäng
 * @property {null} sämstaKapten
 */

/**
 * Compute highlights from an array of aggregates.
 * Never throws; returns nulls when unavailable.
 *
 * @param {WeeklyAggregate[]} aggregates
 * @returns {Highlights}
 */
export function computeWeeklyHighlights(aggregates) {
  const arr = Array.isArray(aggregates) ? aggregates : [];

  /** @type {WeeklyAggregate|null} */
  let veckansSopa = null;
  /** @type {WeeklyAggregate|null} */
  let veckansKanon = null;
  /** @type {{ agg: WeeklyAggregate, delta: number }|null} */
  let veckansRaket = null;
  /** @type {{ agg: WeeklyAggregate, delta: number }|null} */
  let veckansStörtdyk = null;

  for (const a of arr) {
    // Kanon/Sopa by gwPoints
    if (a && Number.isFinite(a.gwPoints)) {
      if (!veckansKanon || a.gwPoints > veckansKanon.gwPoints) veckansKanon = a;
      if (!veckansSopa || a.gwPoints < veckansSopa.gwPoints) veckansSopa = a;
    }
    // Rank deltas if available
    if (Number.isFinite(a?.overallRank) && Number.isFinite(a?.prevOverallRank)) {
      const delta = Number(a.prevOverallRank) - Number(a.overallRank); // positive is good (improvement)
      if (!veckansRaket || delta > veckansRaket.delta || (delta === veckansRaket.delta && a.gwPoints > (veckansRaket.agg?.gwPoints || 0))) {
        veckansRaket = { agg: a, delta };
      }
      if (!veckansStörtdyk || delta < veckansStörtdyk.delta || (delta === veckansStörtdyk.delta && a.gwPoints < (veckansStörtdyk.agg?.gwPoints || 0))) {
        veckansStörtdyk = { agg: a, delta };
      }
    }
  }

  return {
    veckansSopa: veckansSopa || null,
    veckansKanon: veckansKanon || null,
    veckansRaket: veckansRaket || null,
    veckansStörtdyk: veckansStörtdyk || null,
    flestBänkpoäng: null,
    sämstaKapten: null
  };
}

export default { computeWeeklyHighlights };

/**
 * Pick bottom N by gwPoints with deterministic tie-breakers.
 * Tie-break: lower totalPoints, then higher overallRank, then name A→Z
 * @param {WeeklyAggregate[]} aggregates
 * @param {number} n
 */
export function pickBottomN(aggregates, n = 4) {
  const arr = Array.isArray(aggregates) ? aggregates.slice() : [];
  const sorted = arr.sort((a, b) => {
    const ga = Number(a?.gwPoints ?? a?.latestGwPoints ?? a?.points ?? 0);
    const gb = Number(b?.gwPoints ?? b?.latestGwPoints ?? b?.points ?? 0);
    if (ga !== gb) return ga - gb; // asc (bottom)
    const ta = Number(a?.totalPoints || 0);
    const tb = Number(b?.totalPoints || 0);
    if (ta !== tb) return ta - tb; // lower total first
    const ra = Number(a?.overallRank || 1e12);
    const rb = Number(b?.overallRank || 1e12);
    if (ra !== rb) return rb - ra; // higher rank number (worse) first
    const na = String(a?.playerName || a?.displayName || a?.entry_name || a?.name || '');
    const nb = String(b?.playerName || b?.displayName || b?.entry_name || b?.name || '');
    return na.localeCompare(nb);
  });
  return sorted.slice(0, n).map(r => ({
    playerName: String(r?.playerName || r?.displayName || r?.entry_name || r?.name || ''),
    teamName: String(r?.teamName || r?.team_name || ''),
    gwPoints: Number(r?.gwPoints ?? r?.latestGwPoints ?? r?.points ?? 0)
  }));
}

/**
 * Compute beer merit levels from deviation to average gw points.
 * Returns array with { ...agg, level: string, className: 'green'|'yellow'|'red', delta: number }
 * @param {WeeklyAggregate[]} aggregates
 * @param {{ thresholds?: { legend:number, strong:number, solid:number, weak:number } }} [cfg]
 */
export function computeBeerLevels(aggregates, cfg = {}) {
  const arr = Array.isArray(aggregates) ? aggregates : [];
  if (arr.length === 0) return [];
  const avg = arr.reduce((s, r) => s + Number(r?.gwPoints || 0), 0) / arr.length;
  const t = Object.assign({ legend: 20, strong: 10, solid: 0, weak: -10 }, cfg.thresholds || {});
  return arr.map(r => {
    const delta = Math.round(Number(r?.gwPoints || 0) - avg);
    let level = 'Solid';
    let className = 'yellow';
    if (delta >= t.legend) { level = 'Legend'; className = 'green'; }
    else if (delta >= t.strong) { level = 'Strong'; className = 'green'; }
    else if (delta >= t.solid) { level = 'Solid'; className = 'yellow'; }
    else if (delta >= t.weak) { level = 'Weak'; className = 'red'; }
    else { level = 'Buy-the-round'; className = 'red'; }
    return Object.assign({}, r, { level, className, delta });
  });
}

/**
 * Pick top/bottom N for Wall of Fame/Shame by gwPoints (deterministic ties)
 * @param {WeeklyAggregate[]} aggregates
 * @param {number} n
 */
export function pickWallSets(aggregates, n = 3) {
  const arr = Array.isArray(aggregates) ? aggregates.slice() : [];
  const cmp = (a, b) => {
    const ga = Number(a?.gwPoints || 0);
    const gb = Number(b?.gwPoints || 0);
    if (gb !== ga) return gb - ga; // desc for top
    const ta = Number(a?.totalPoints || 0);
    const tb = Number(b?.totalPoints || 0);
    if (tb !== ta) return tb - ta; // higher total first
    return String(a?.playerName || '').localeCompare(String(b?.playerName || ''));
  };
  const top = arr.slice().sort(cmp).slice(0, n);
  const bottom = arr.slice().sort((a, b) => -cmp(a, b)).slice(0, n);
  return { top, bottom };
}

/**
 * Deterministic seeded pick from list.
 * Uses a simple hash of the provided seed to index into the list.
 * @template T
 * @param {T[]} list
 * @param {string|number} seed
 * @returns {T|null}
 */
export function seededPick(list, seed) {
  const arr = Array.isArray(list) ? list : [];
  if (arr.length === 0) return null;
  const s = String(seed ?? '');
  // djb2 hash
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h |= 0; // 32-bit
  }
  const idx = Math.abs(h) % arr.length;
  return arr[idx] ?? null;
}

/**
 * Rank within GW by gwPoints desc using top-list tie-breakers.
 * Adds gwRank: 1..N
 * @param {WeeklyAggregate[]} rows
 * @returns {(WeeklyAggregate & { gwRank: number })[]}
 */
export function rankWithinGw(rows) {
  const arr = Array.isArray(rows) ? rows.slice() : [];
  const cmp = (a, b) => {
    const ga = Number(a?.gwPoints ?? a?.latestGwPoints ?? a?.points ?? 0);
    const gb = Number(b?.gwPoints ?? b?.latestGwPoints ?? b?.points ?? 0);
    if (gb !== ga) return gb - ga; // desc
    const ta = Number(a?.totalPoints || 0);
    const tb = Number(b?.totalPoints || 0);
    if (tb !== ta) return tb - ta; // higher total first
    return String(a?.playerName || a?.displayName || '').localeCompare(String(b?.playerName || b?.displayName || ''));
  };
  const sorted = arr.sort(cmp);
  return sorted.map((r, i) => Object.assign({}, r, { gwRank: i + 1 }));
}

/**
 * Compute three beer tiers based on GW rank buckets.
 * Buckets: [1,15], [16,25], [26,51].
 * Deterministically pick one per bucket.
 * @param {WeeklyAggregate[]} rows
 * @param {number} gw
 * @returns {{ label: 'Öl'|'Alkoholfri'|'Ingen öl', playerName: string, teamName: string, gwPoints: number, gwRank: number|null, disabled?: boolean }[]}
 */
export function computeBeerTiers(rows, gw) {
  const ranked = rankWithinGw(rows);
  const labels = ['Öl', 'Alkoholfri', 'Ingen öl'];
  const ranges = [ [1, 15], [16, 25], [26, 51] ];

  // Try to incorporate season into seed if available, else fallback
  let seasonLabel = undefined;
  try {
    // Common globals; non-fatal if missing
    if (typeof window !== 'undefined') {
      seasonLabel = window.SEASON || window.CURRENT_SEASON || window.SEASON_LABEL || window.seasonLabel;
    }
  } catch(_) {}
  const seasonSeed = String(seasonLabel || '');
  const seedBase = seasonSeed ? `${seasonSeed}-${gw}` : `${gw}`;

  return ranges.map(([lo, hi], idx) => {
    const bucket = ranked.filter(r => Number(r.gwRank) >= lo && Number(r.gwRank) <= hi);
    if (bucket.length === 0) {
      return { label: /** @type any */(labels[idx]), playerName: '', teamName: '', gwPoints: 0, gwRank: null, disabled: true };
    }
    const seed = seedBase;
    const picked = seededPick(bucket, seed) || bucket[0];
    return {
      label: /** @type any */(labels[idx]),
      playerName: String(picked.playerName || picked.displayName || ''),
      teamName: String(picked.teamName || ''),
      gwPoints: Number(picked.gwPoints ?? picked.latestGwPoints ?? 0),
      gwRank: Number(picked.gwRank || null)
    };
  });
}

// In-memory cache for season row fetches
const __rowsCache = new Map();

/**
 * Tally season-wide tops (Veckans Raket) and bottoms (Veckans Sopa), and compute current king.
 * Only uses provided fetchRows function (proxy-backed).
 * Concurrency limited to 4; small pause between batches of 5.
 * @param {{ currentGw: number, entryIds: number[], fetchRows: (gw:number, entryIds:number[])=>Promise<any[]> }} args
 * @returns {Promise<{ fame: { entryId:number, playerName:string, count:number }|null, shame: { entryId:number, playerName:string, count:number }|null, currentKing: { entryId:number, playerName:string }|null }>}
 */
export async function tallySeasonTopsAndBottoms(args) {
  const currentGw = Number(args?.currentGw || 0);
  const entryIds = Array.isArray(args?.entryIds) ? args.entryIds : [];
  const fetchRows = args?.fetchRows;
  if (!currentGw || !entryIds.length || typeof fetchRows !== 'function') {
    return { fame: null, shame: null, currentKing: null };
  }
  const idKey = entryIds.slice().map(n => Number(n)).sort((a, b) => a - b).join(',');
  const fameCount = new Map(); // entryId -> count
  const shameCount = new Map();
  const idToName = new Map();

  /** @param {any[]} rows */
  function processGw(rows) {
    const arr = Array.isArray(rows) ? rows.slice() : [];
    // Normalize utilities
    const getP = (r) => Number(r?.gwPoints ?? r?.latestGwPoints ?? r?.points ?? 0);
    const getT = (r) => Number(r?.totalPoints ?? r?.total_points ?? 0);
    const getN = (r) => String(r?.playerName || r?.displayName || r?.entry_name || r?.name || '');
    const getId = (r) => Number(r?.entryId || r?.fplId || r?.entry || r?.id || 0);
    // Top tie-breakers (desc by gwPoints, then higher totalPoints, then name A→Z)
    const cmpTop = (a, b) => {
      const ga = getP(a), gb = getP(b);
      if (gb !== ga) return gb - ga;
      const ta = getT(a), tb = getT(b);
      if (tb !== ta) return tb - ta;
      return getN(a).localeCompare(getN(b));
    };
    // Bottom tie-breakers (asc by gwPoints, then lower totalPoints, then higher overallRank, then name)
    const cmpBottom = (a, b) => {
      const ga = getP(a), gb = getP(b);
      if (ga !== gb) return ga - gb;
      const ta = getT(a), tb = getT(b);
      if (ta !== tb) return ta - tb;
      const ra = Number(a?.overallRank || 1e12), rb = Number(b?.overallRank || 1e12);
      if (ra !== rb) return rb - ra;
      return getN(a).localeCompare(getN(b));
    };
    if (arr.length === 0) return;
    const top = arr.slice().sort(cmpTop)[0];
    const bot = arr.slice().sort(cmpBottom)[0];
    if (top) {
      const id = getId(top);
      const name = getN(top);
      idToName.set(id, name);
      fameCount.set(id, (fameCount.get(id) || 0) + 1);
    }
    if (bot) {
      const id = getId(bot);
      const name = getN(bot);
      idToName.set(id, name);
      shameCount.set(id, (shameCount.get(id) || 0) + 1);
    }
  }

  const active = [];
  let started = 0;
  let lastRowsLatest = [];

  const gws = Array.from({ length: currentGw }, (_, i) => i + 1);
  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  async function startOne(gw) {
    // Batch throttle: pause every 5 starts
    if (started > 0 && started % 5 === 0) await delay(250);
    started += 1;
    const key = `${gw}|${idKey}`;
    const existing = __rowsCache.get(key);
    if (existing) {
      try { processGw(existing); if (gw === currentGw) lastRowsLatest = existing; } catch(_) {}
      return;
    }
    try {
      const rows = await fetchRows(gw, entryIds);
      if (Array.isArray(rows)) {
        __rowsCache.set(key, rows);
        processGw(rows);
        if (gw === currentGw) lastRowsLatest = rows;
      }
    } catch (e) {
      try { console.warn('[highlights] rows fetch failed for gw', gw, e?.message || e); } catch(_) {}
    }
  }

  for (const gw of gws) {
    const p = startOne(gw).finally(() => {
      const idx = active.indexOf(p);
      if (idx >= 0) active.splice(idx, 1);
    });
    active.push(p);
    if (active.length >= 4) {
      await Promise.race(active);
    }
  }
  await Promise.all(active);

  // Compute winners
  const fameArr = Array.from(fameCount.entries());
  fameArr.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const na = String(idToName.get(a[0]) || '');
    const nb = String(idToName.get(b[0]) || '');
    return na.localeCompare(nb);
  });
  const shameArr = Array.from(shameCount.entries());
  shameArr.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const na = String(idToName.get(a[0]) || '');
    const nb = String(idToName.get(b[0]) || '');
    return na.localeCompare(nb);
  });

  const fame = fameArr.length ? { entryId: fameArr[0][0], playerName: String(idToName.get(fameArr[0][0]) || ''), count: fameArr[0][1] } : null;
  const shame = shameArr.length ? { entryId: shameArr[0][0], playerName: String(idToName.get(shameArr[0][0]) || ''), count: shameArr[0][1] } : null;

  // Current king from latest rows
  let currentKing = null;
  const rowsLatest = Array.isArray(lastRowsLatest) ? lastRowsLatest : [];
  if (rowsLatest.length) {
    const withFinite = rowsLatest.filter(r => Number.isFinite(Number(r?.overallRank)));
    let kingRow = null;
    if (withFinite.length) {
      kingRow = withFinite.slice().sort((a, b) => Number(a.overallRank) - Number(b.overallRank))[0];
    } else {
      const getT = (r) => Number(r?.totalPoints ?? r?.total_points ?? 0);
      const getN = (r) => String(r?.playerName || r?.displayName || r?.entry_name || r?.name || '');
      kingRow = rowsLatest.slice().sort((a, b) => {
        const tb = getT(b) - getT(a);
        if (tb !== 0) return tb;
        const ga = Number(a?.gwPoints ?? a?.latestGwPoints ?? a?.points ?? 0);
        const gb = Number(b?.gwPoints ?? b?.latestGwPoints ?? b?.points ?? 0);
        if (gb !== ga) return gb - ga;
        return getN(a).localeCompare(getN(b));
      })[0];
    }
    if (kingRow) {
      currentKing = { entryId: Number(kingRow?.entryId || kingRow?.entry || kingRow?.id || 0), playerName: String(kingRow?.playerName || kingRow?.displayName || '') };
    }
  }

  return { fame, shame, currentKing };
}

/**
 * Pick worst captain for current GW given optional captain points batch.
 * @param {WeeklyAggregate[]} rows
 * @param {{ entryId:number, captainPoints:number }[]|null} captains
 * @returns {{ playerName:string, teamName:string, captainPoints:number }|null}
 */
export function pickWorstCaptain(rows, captains) {
  if (!Array.isArray(rows) || !Array.isArray(captains)) return null;
  // Join by entryId
  const capMap = new Map(captains.map(c => [Number(c.entryId), Number(c.captainPoints)]));
  const candidates = rows
    .map(r => ({
      entryId: Number(r?.entryId || 0),
      playerName: String(r?.playerName || r?.displayName || ''),
      teamName: String(r?.teamName || ''),
      gwPoints: Number(r?.gwPoints ?? r?.latestGwPoints ?? 0),
      captainPoints: capMap.has(Number(r?.entryId)) ? Number(capMap.get(Number(r?.entryId))) : null
    }))
    .filter(x => Number.isFinite(x.captainPoints));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.captainPoints !== b.captainPoints) return Number(a.captainPoints) - Number(b.captainPoints);
    if (a.gwPoints !== b.gwPoints) return Number(a.gwPoints) - Number(b.gwPoints);
    return String(a.playerName).localeCompare(String(b.playerName));
  });
  const w = candidates[0];
  return { playerName: w.playerName, teamName: w.teamName, captainPoints: Number(w.captainPoints) };
}

