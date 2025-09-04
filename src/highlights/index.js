/**
 * Orchestrator for highlights: fetch → compute → render → inject
 */
import './highlights.fetch.js';
import { fetchWeeklyAggregates } from './highlights.adapter.js';
import { computeWeeklyHighlights, pickBottomN, computeBeerLevels, pickWallSets } from './highlights.logic.js';
import { renderHighlightsHtml } from './highlights.view.js';

/**
 * @param {{ gw: number, entryIds: number[], mountSelector: string, context?: { allowPicksInHighlights?: boolean } }} opts
 */
export async function mountHighlights(opts) {
  const { gw, entryIds, selectors = {}, context = {}, mountSelector } = opts || {};
  try {
    const t0 = performance.now();
    const aggregates = await fetchWeeklyAggregates(gw, entryIds, context);
    const t1 = performance.now();
    const mount = document.querySelector(mountSelector || '#weekly-highlights');
    if (!Array.isArray(aggregates) || aggregates.length === 0) {
      if (mount) mount.innerHTML = '<div class="highlights__card highlights__card--disabled">Kunde inte hämta veckans höjdpunkter just nu.</div>';
      console.warn('[highlights] aggregates empty');
      // continue to attempt auxiliary sections with empty lists so placeholders can toggle
    }
    const hl = computeWeeklyHighlights(aggregates);
    const t2 = performance.now();
    const html = renderHighlightsHtml(hl);
    const t3 = performance.now();
    if (mount) mount.innerHTML = html;
    console.debug('[highlights][t=ms]', { fetch: Math.round(t1 - t0), compute: Math.round(t2 - t1), render: Math.round(t3 - t2) });

    // Populate auxiliary sections if present in DOM (reuse same aggregates)
    try {
      const roastSel = selectors.roast || '#roastGrid';
      const roastEl = document.querySelector(roastSel);
      if (roastEl) {
        const bottom = pickBottomN(aggregates, 3);
        roastEl.innerHTML = bottom.map(r => `<div class=\"roast-card sopa\"><div class=\"roast-title\">${r.playerName}</div><div class=\"roast-message\">${r.gwPoints} p</div></div>`).join('');
      } else {
        console.warn('[highlights] Missing container:', roastSel);
      }
      const beerSel = selectors.beer || '#beerGrid';
      const beerEl = document.querySelector(beerSel);
      if (beerEl) {
        const levels = computeBeerLevels(aggregates);
        beerEl.innerHTML = levels.map(r => `<div class=\"beer-card ${r.className}\"><div class=\"beer-level\">${r.level}</div><div class=\"beer-player\">${r.playerName} – ${r.gwPoints} p (${r.delta>=0?'+':''}${r.delta})</div></div>`).join('');
      } else {
        console.warn('[highlights] Missing container:', beerSel);
      }
      const fameSel = selectors.fame || '#fameStats';
      const shameSel = selectors.shame || '#shameStats';
      const fame = document.querySelector(fameSel);
      const shame = document.querySelector(shameSel);
      if (fame && shame) {
        const { top, bottom } = pickWallSets(aggregates, 3);
        fame.innerHTML = top.map(r => `<div class=\"wall-stat\"><span class=\"wall-stat-label\">${r.playerName}</span><span class=\"wall-stat-value\">${r.gwPoints} p</span></div>`).join('');
        shame.innerHTML = bottom.map(r => `<div class=\"wall-stat\"><span class=\"wall-stat-label\">${r.playerName}</span><span class=\"wall-stat-value\">${r.gwPoints} p</span></div>`).join('');
      } else {
        if (!fame) console.warn('[highlights] Missing container:', fameSel);
        if (!shame) console.warn('[highlights] Missing container:', shameSel);
      }
      // Debug available containers map
      console.debug('[highlights] containers', {
        roast: !!document.querySelector(roastSel),
        beer: !!document.querySelector(beerSel),
        fame: !!document.querySelector(fameSel),
        shame: !!document.querySelector(shameSel)
      });
    } catch (e) {
      console.warn('[highlights] aux render failed:', e?.message || e);
    }
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

export default { mountHighlights };

