/**
 * Highlights adapter: build weekly aggregates from existing data without touching tables or new endpoints.
 *
 * - Prefers already-computed aggregate rows (window.__lastRows) from the tables pipeline
 * - Computes group ranks (overallRank) from totals and previous totals (prevOverallRank)
 * - Never calls single-ID endpoints; no /picks calls
 *
 * DISABLED: Use private HIGHLIGHTS_GET_ROWS instead
 * @module highlights.adapter
 */

// Export empty functions to prevent conflicts with new highlights pipeline
export const fetchWeeklyAggregates = () => Promise.resolve([]);
export const getCaptainPointsBatch = () => Promise.resolve(null);
export default { fetchWeeklyAggregates, getCaptainPointsBatch };