/**
 * Highlights adapter: build weekly aggregates from existing data without touching tables.
 *
 * - Prefers using already-computed aggregate rows if available (window.__lastRows)
 * - Optionally enriches rank deltas using same-origin fallback files in /data/entry/<id>/history.json
 * - Never calls FPL single-ID API directly from the browser; only same-origin fallback or precomputed rows
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

/**
 * Fetch a participant's same-origin history JSON if available.
 * Uses window.dataUrl to ensure proper base/version resolution.
 *
 * @param {number} entryId
 * @returns {Promise<any|null>}
 */
async function fetchLocalHistory(entryId) {
  try {
    const makeUrl = (window && typeof window.dataUrl === 'function')
      ? window.dataUrl
      : (rel) => rel; // fallback
    const url = makeUrl(`data/entry/${entryId}/history.json`);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

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
  // Not used yet; retained to honor contract and future extensions
  void allowPicksInHighlights;

  /** @type {WeeklyAggregate[]} */
  const result = [];

  // Prefer already computed rows from the tables pipeline
  const rows = Array.isArray(window.__lastRows) ? window.__lastRows : null;
  const byId = new Map();
  if (rows) {
    for (const r of rows) {
      if (!r || !r.entryId) continue;
      byId.set(Number(r.entryId), r);
    }
  }

  // Build base from memory if present; else plan to enrich with /data fallback
  for (const id of entryIds) {
    const entryId = Number(id);
    const base = byId.get(entryId);
    if (base) {
      result.push({
        entryId,
        playerName: base.displayName || '',
        teamName: base.teamName || '',
        gwPoints: Number(base.latestGwPoints || 0),
        totalPoints: Number(base.totalPoints || 0),
        overallRank: null,
        prevOverallRank: null
      });
    } else {
      // Defer population; will try local /data for this entry
      result.push({
        entryId,
        playerName: '',
        teamName: '',
        gwPoints: 0,
        totalPoints: 0,
        overallRank: null,
        prevOverallRank: null
      });
    }
  }

  // Enrich missing entries and optional rank deltas using same-origin data
  const pending = result.filter(r => r.playerName === '' || r.overallRank === null);
  if (pending.length) {
    // Limit concurrency to avoid flooding
    const limit = 6;
    let idx = 0;
    async function next() {
      const i = idx++;
      if (i >= pending.length) return;
      const r = pending[i];
      const hist = await fetchLocalHistory(r.entryId);
      if (hist && Array.isArray(hist.current)) {
        const current = hist.current;
        // Try to get displayName/teamName from window overrides if available
        const ov = (window.PARTICIPANT_OVERRIDES || {})[r.entryId] || {};
        r.playerName = r.playerName || ov.displayName || String(r.entryId);
        r.teamName = r.teamName || ov.teamName || '';
        // Compute totals from history
        let seasonTotal = 0;
        let gwPts = 0;
        let overallRank = null;
        let prevOverallRank = null;
        for (const it of current) {
          const tp = Number(it?.total_points || 0);
          if (tp > seasonTotal) seasonTotal = tp;
          const ev = Number(it?.event || 0);
          if (ev === Number(gw)) {
            gwPts = Number(it?.points || 0);
            overallRank = Number(it?.overall_rank || NaN);
            if (!Number.isFinite(overallRank)) overallRank = null;
          }
          if (ev === Number(gw) - 1) {
            const pr = Number(it?.overall_rank || NaN);
            if (Number.isFinite(pr)) prevOverallRank = pr;
          }
        }
        r.totalPoints = r.totalPoints || seasonTotal;
        r.gwPoints = r.gwPoints || gwPts;
        r.overallRank = r.overallRank ?? overallRank;
        r.prevOverallRank = r.prevOverallRank ?? prevOverallRank;
      }
      await next();
    }
    const runners = Array.from({ length: Math.min(limit, pending.length) }, () => next());
    await Promise.all(runners);
  }

  return result;
}

export default { fetchWeeklyAggregates };

