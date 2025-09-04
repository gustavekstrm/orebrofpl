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
export function pickBottomN(aggregates, n = 3) {
  const arr = Array.isArray(aggregates) ? aggregates.slice() : [];
  const sorted = arr.sort((a, b) => {
    const ga = Number(a?.gwPoints || 0);
    const gb = Number(b?.gwPoints || 0);
    if (ga !== gb) return ga - gb; // asc (bottom)
    const ta = Number(a?.totalPoints || 0);
    const tb = Number(b?.totalPoints || 0);
    if (ta !== tb) return ta - tb; // lower total first
    const ra = Number(a?.overallRank || 1e12);
    const rb = Number(b?.overallRank || 1e12);
    if (ra !== rb) return rb - ra; // higher rank number (worse) first
    return String(a?.playerName || '').localeCompare(String(b?.playerName || ''));
  });
  return sorted.slice(0, n);
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

