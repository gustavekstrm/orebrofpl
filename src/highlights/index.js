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
    const t0 = performance.now();
    const aggregates = await fetchWeeklyAggregates(gw, entryIds, context);
    const t1 = performance.now();
    if (!Array.isArray(aggregates) || aggregates.length === 0) {
      const mount = document.querySelector(mountSelector);
      if (mount) mount.innerHTML = '<div class="highlights__card highlights__card--disabled">Kunde inte hämta veckans höjdpunkter just nu.</div>';
      console.warn('[highlights] aggregates empty');
      return;
    }
    const hl = computeWeeklyHighlights(aggregates);
    const t2 = performance.now();
    const html = renderHighlightsHtml(hl);
    const t3 = performance.now();
    const mount = document.querySelector(mountSelector);
    if (mount) mount.innerHTML = html;
    console.debug('[highlights][t=ms]', { fetch: Math.round(t1 - t0), compute: Math.round(t2 - t1), render: Math.round(t3 - t2) });
    // Warn (non-blocking) if some fack is null
    const nulls = [
      ['veckansKanon', hl.veckansKanon],
      ['veckansSopa', hl.veckansSopa],
      ['veckansRaket', hl.veckansRaket],
      ['veckansStörtdyk', hl.veckansStörtdyk]
    ].filter(([_, v]) => v == null);
    if (nulls.length) {
      console.warn('[highlights] Missing data for:', nulls.map(x => x[0]).join(', '));
    }
  } catch (e) {
    const mount = document.querySelector(opts?.mountSelector || '#weekly-highlights');
    if (mount) mount.innerHTML = '<div class="highlights__card highlights__card--disabled">Kunde inte hämta veckans höjdpunkter just nu.</div>';
    console.warn('[highlights] render failed:', e?.message || e);
  }
}

export default { renderHighlights };

