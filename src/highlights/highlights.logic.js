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

