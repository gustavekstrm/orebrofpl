/**
 * Orchestrator for highlights: fetch → compute → render → inject
 */
import { fetchWeeklyAggregates } from './highlights.adapter.js';
import { computeWeeklyHighlights } from './highlights.logic.js';
import { renderHighlightsHtml } from './highlights.view.js';

/**
 * @param {{ gw: number, entryIds: number[], mountSelector: string, context?: { allowPicksInHighlights?: boolean } }} opts
 */
export async function renderHighlights(opts) {
  const { gw, entryIds, mountSelector, context = {} } = opts || {};
  try {
    const aggregates = await fetchWeeklyAggregates(gw, entryIds, context);
    const hl = computeWeeklyHighlights(aggregates);
    const html = renderHighlightsHtml(hl);
    const mount = document.querySelector(mountSelector);
    if (mount) mount.innerHTML = html;
    // Warn (non-blocking) if some fack is null
    const nulls = [
      ['veckansKanon', hl.veckansKanon],
      ['veckansSopa', hl.veckansSopa],
      ['veckansRaket', hl.veckansRaket],
      ['veckansStörtdyk', hl.veckansStörtdyk]
    ].filter(([_, v]) => v == null);
    if (nulls.length) {
      console.warn('[Highlights] Missing data for:', nulls.map(x => x[0]).join(', '));
    }
  } catch (e) {
    console.warn('[Highlights] Failed to render highlights:', e?.message);
  }
}

export default { renderHighlights };

