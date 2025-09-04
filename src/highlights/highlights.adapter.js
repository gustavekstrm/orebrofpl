/**
 * Highlights adapter: build weekly aggregates from existing data without touching tables or new endpoints.
 *
 * - Prefers already-computed aggregate rows (window.__lastRows) from the tables pipeline
 * - Computes group ranks (overallRank) from totals and previous totals (prevOverallRank)
 * - Never calls single-ID endpoints; no /picks calls
 *
 * @module highlights.adapter
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

// No local history fetching in this adapter – we only use in-memory aggregates

/**
 * Build weekly aggregates from in-memory rows first; fallback to local /data when needed.
 * Never calls remote FPL API from the browser.
 *
 * @param {number} gw latest finished gameweek
 * @param {number[]} entryIds list of entry IDs to include
 * @param {{ allowPicksInHighlights?: boolean }} [context]
 * @returns {Promise<WeeklyAggregate[]>}
 */
export async function fetchWeeklyAggregates(gw, entryIds, context = {}) {
  const allowPicksInHighlights = Boolean(context.allowPicksInHighlights);
  void allowPicksInHighlights; // not used here by design

  /** @type {WeeklyAggregate[]} */
  const result = [];

  // Get base aggregates from the same pipeline as tables (no new endpoints)
  let rows = [];
  if (typeof window.getAggregateRows === 'function') {
    rows = await window.getAggregateRows();
  } else if (Array.isArray(window.__aggregateBaseRows)) {
    rows = window.__aggregateBaseRows;
  } else if (Array.isArray(window.__lastRows)) {
    rows = window.__lastRows; // legacy fallback
  }
  const idSet = new Set((entryIds || []).map(n => Number(n)));
  const base = rows.filter(r => r && idSet.has(Number(r.entryId)));

  // Helper to compute group rank map by a numeric score accessor
  function rankMap(list, scoreKey) {
    const sorted = [...list].sort((a, b) => {
      const va = Number(a?.[scoreKey] || 0);
      const vb = Number(b?.[scoreKey] || 0);
      if (vb !== va) return vb - va; // desc
      // tie-break by other score and then entryId
      const altA = Number(a?.latestGwPoints || 0);
      const altB = Number(b?.latestGwPoints || 0);
      if (altB !== altA) return altB - altA;
      return Number(b?.entryId || 0) - Number(a?.entryId || 0);
    });
    const map = new Map();
    sorted.forEach((r, i) => map.set(Number(r.entryId), i + 1));
    return map;
  }

  // Compute current group ranks by totalPoints
  const currentRanks = rankMap(base, 'totalPoints');
  // Compute previous totals cheaply and rank for prevOverallRank
  const withPrevTotals = base.map(r => ({ ...r, __prevTotal: Number(r.totalPoints || 0) - Number(r.latestGwPoints || 0) }));
  const prevRanks = rankMap(withPrevTotals, '__prevTotal');

  for (const id of idSet) {
    const row = base.find(r => Number(r.entryId) === Number(id));
    if (!row) {
      result.push({ entryId: Number(id), playerName: '', teamName: '', gwPoints: 0, totalPoints: 0, overallRank: null, prevOverallRank: null });
      continue;
    }
    const overallRank = currentRanks.get(Number(id)) ?? null;
    const prevOverallRank = prevRanks.get(Number(id)) ?? null;
    result.push({
      entryId: Number(id),
      playerName: String(row.displayName || ''),
      teamName: String(row.teamName || ''),
      gwPoints: Number(row.latestGwPoints || 0),
      totalPoints: Number(row.totalPoints || 0),
      overallRank: overallRank,
      prevOverallRank: prevOverallRank
    });
  }

  return result;
}

export default { fetchWeeklyAggregates };

