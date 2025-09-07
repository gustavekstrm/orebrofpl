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

  // Get base aggregates from a single source of truth for highlights:
  // Prefer proxy-backed window.getAggregateRows(gw, entryIds) when available.
  let rows = [];
  try {
    if (typeof window.getAggregateRows === 'function') {
      rows = await window.getAggregateRows(gw, entryIds);
    } else if (Array.isArray(window.__aggregateBaseRows)) {
      rows = window.__aggregateBaseRows;
    } else if (Array.isArray(window.__lastRows)) {
      rows = window.__lastRows; // legacy fallback
    }
  } catch (_) {
    // swallow; will fall back to any in-memory rows if present
    rows = Array.isArray(window.__aggregateBaseRows) ? window.__aggregateBaseRows : (Array.isArray(window.__lastRows) ? window.__lastRows : []);
  }

  const idSet = new Set((entryIds || []).map(n => Number(n)));
  const base = (Array.isArray(rows) ? rows : []).filter(r => r && idSet.has(Number(r.entryId || r.fplId || r.id || r.entry)));

  // Normalize row fields to WeeklyAggregate-compatible shape
  const normalized = base.map(r => {
    const entryId = Number(r.entryId || r.fplId || r.entry || r.id || 0);
    const playerName = String(r.playerName || r.displayName || r.entry_name || r.name || '');
    const teamName = String(r.teamName || r.team_name || '');
    const gwPoints = Number(r.gwPoints ?? r.latestGwPoints ?? r.points ?? 0);
    const totalPoints = Number(r.totalPoints ?? r.total_points ?? 0);
    const overallRank = Number.isFinite(r?.overallRank) ? Number(r.overallRank) : null;
    const prevOverallRank = Number.isFinite(r?.prevOverallRank) ? Number(r.prevOverallRank) : null;
    return { entryId, playerName, teamName, gwPoints, totalPoints, overallRank, prevOverallRank };
  });

  // If ranks are not provided, compute them from totals and previous totals
  const needRanks = normalized.some(x => !Number.isFinite(x.overallRank) || !Number.isFinite(x.prevOverallRank));
  if (needRanks) {
    // Helper to compute group rank map by a numeric accessor
    function rankMap(list, scoreKey) {
      const sorted = [...list].sort((a, b) => {
        const va = Number(a?.[scoreKey] || 0);
        const vb = Number(b?.[scoreKey] || 0);
        if (vb !== va) return vb - va; // desc
        // tie-break by other score and then entryId
        const altA = Number(a?.gwPoints || 0);
        const altB = Number(b?.gwPoints || 0);
        if (altB !== altA) return altB - altA;
        return Number(b?.entryId || 0) - Number(a?.entryId || 0);
      });
      const map = new Map();
      sorted.forEach((r, i) => map.set(Number(r.entryId), i + 1));
      return map;
    }

    const currentRanks = rankMap(normalized, 'totalPoints');
    const withPrevTotals = normalized.map(r => ({ ...r, __prevTotal: Number(r.totalPoints || 0) - Number(r.gwPoints || 0) }));
    const prevRanks = rankMap(withPrevTotals, '__prevTotal');

    for (const r of normalized) {
      if (!Number.isFinite(r.overallRank)) r.overallRank = currentRanks.get(r.entryId) ?? null;
      if (!Number.isFinite(r.prevOverallRank)) r.prevOverallRank = prevRanks.get(r.entryId) ?? null;
    }
  }

  // Ensure we include all requested ids (preserve ordering by entryIds)
  for (const id of idSet) {
    const row = normalized.find(x => Number(x.entryId) === Number(id));
    if (!row) {
      result.push({ entryId: Number(id), playerName: '', teamName: '', gwPoints: 0, totalPoints: 0, overallRank: null, prevOverallRank: null });
    } else {
      result.push(row);
    }
  }

  return result;
}

import { PROXY_BASE } from '../config/network.js';

/**
 * Optional batch captain points fetch. Returns null if unsupported.
 * @param {number} gw
 * @param {number[]} entryIds
 * @returns {Promise<{ entryId:number, captainPoints:number }[]|null>}
 */
export async function getCaptainPointsBatch(gw, entryIds) {
  try {
    if (!gw || !Array.isArray(entryIds) || entryIds.length === 0) return null;
    const ids = entryIds.join(',');
    const url = `${PROXY_BASE}/api/picks/batch?gw=${encodeURIComponent(gw)}&ids=${encodeURIComponent(ids)}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) {
      // If not implemented or not found, treat as unsupported
      if (r.status === 404 || r.status === 501) return null;
      // Other errors: also treat as unsupported (do not throw)
      return null;
    }
    const data = await r.json();
    const arr = Array.isArray(data) ? data : [];
    return arr.map(x => ({ entryId: Number(x?.entryId || x?.id || x?.entry || 0), captainPoints: Number(x?.captainPoints || 0) }));
  } catch (_) {
    // Network error: unsupported
    return null;
  }
}

export default { fetchWeeklyAggregates, getCaptainPointsBatch };

