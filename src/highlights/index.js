/**
 * Orchestrator for highlights: fetch → compute → render → inject
 */
import './highlights.fetch.js';
import { fetchWeeklyAggregates, getCaptainPointsBatch } from './highlights.adapter.js';
import { computeWeeklyHighlights, pickBottomN, computeBeerTiers, pickWallSets, tallySeasonTopsAndBottoms, pickWorstCaptain } from './highlights.logic.js';
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
    let html = renderHighlightsHtml(hl);
    const t3 = performance.now();
    if (mount) mount.innerHTML = html;
    console.debug('[highlights][t=ms]', { fetch: Math.round(t1 - t0), compute: Math.round(t2 - t1), render: Math.round(t3 - t2) });

    // Populate auxiliary sections if present in DOM (reuse same aggregates)
    try {
      // Dev-only debug helper
      if (typeof window !== 'undefined') {
        window.debugHighlights = async () => {
          try {
            const latest = await (window.getLatestGwOnce?.() ?? Promise.resolve(gw));
            const rows = await window.getAggregateRows?.(latest, window.ENTRY_IDS);
            if (Array.isArray(rows)) {
              try { console.table(rows.slice(0,5)); } catch(_) { console.log(rows.slice(0,5)); }
              const bottom = pickBottomN(rows, 4).map(x => [x.playerName, x.gwPoints]);
              console.log('bottom4', bottom);
              const beer = computeBeerTiers(rows, latest).map(x => [x.label, x.playerName, x.gwRank]);
              console.log('beer', beer);
            } else {
              console.warn('debugHighlights: no rows');
            }
          } catch (e) {
            console.warn('debugHighlights failed:', e?.message || e);
          }
        };
      }
      const roastSel = selectors.roast || '#roastGrid';
      const roastEl = document.querySelector(roastSel);
      if (roastEl) {
        let rows = [];
        try {
          if (typeof window.getAggregateRows === 'function') {
            rows = await window.getAggregateRows(gw, entryIds);
          }
        } catch(_) { rows = []; }
        const roastItems = pickBottomN(rows, 4);
        const html = roastItems.map(r => `<div class=\"roast-card sopa\"><div class=\"roast-title\">${r.playerName} – ${r.teamName}</div><div class=\"roast-message\">${r.gwPoints} p</div></div>`).join('');
        roastEl.innerHTML = html;
        const header = roastEl.closest('.roast-section')?.querySelector('h2');
        if (header) {
          const base = 'Veckans svagaste insatser...';
          header.textContent = roastItems.length > 0 ? base : `${base} ❌`;
        }
      } else {
        console.warn('[highlights] Missing container:', roastSel);
      }
      const beerSel = selectors.beer || '#beerGrid';
      const beerEl = document.querySelector(beerSel);
      if (beerEl) {
        let beerRows = [];
        try {
          if (typeof window.getAggregateRows === 'function') {
            beerRows = await window.getAggregateRows(gw, entryIds);
          }
        } catch(_) { beerRows = []; }
        const tiers = computeBeerTiers(beerRows, gw);
        // Exactly three cards; reuse existing classes/markup
        beerEl.innerHTML = tiers.map(t => {
          const playerText = t.disabled ? 'Data saknas' : `${t.playerName} – ${t.gwPoints} p`;
          return `<div class=\"beer-card\"><div class=\"beer-level\">${t.label}</div><div class=\"beer-player\">${playerText}</div></div>`;
        }).join('');
      } else {
        console.warn('[highlights] Missing container:', beerSel);
      }
      const fameSel = selectors.fame || '#fameStats';
      const shameSel = selectors.shame || '#shameStats';
      const fame = document.querySelector(fameSel);
      const shame = document.querySelector(shameSel);
      if (fame && shame) {
        let tallies = { fame: null, shame: null, currentKing: null };
        try {
          const fetchRows = typeof window.getAggregateRows === 'function' ? window.getAggregateRows : null;
          tallies = await tallySeasonTopsAndBottoms({ currentGw: gw, entryIds, fetchRows });
        } catch (e) {
          console.warn('[highlights] tally failed:', e?.message || e);
        }
        const fameText = tallies.fame ? `Flest veckans raket: ${tallies.fame.playerName} — ${tallies.fame.count} st` : 'Flest veckans raket: Data saknas';
        const shameText = tallies.shame ? `Flest veckans sopa: ${tallies.shame.playerName} — ${tallies.shame.count} st` : 'Flest veckans sopa: Data saknas';
        const kingText = tallies.currentKing ? `Temporär kung: ${tallies.currentKing.playerName}` : '';
        const kingHtml = kingText ? `<div class=\"wall-stat\"><span class=\"wall-stat-label\">Temporär kung</span><span class=\"wall-stat-value\">${tallies.currentKing.playerName}</span></div>` : '';
        fame.innerHTML = `<div class=\"wall-stat\"><span class=\"wall-stat-label\">${fameText}</span></div>${kingHtml}`;
        shame.innerHTML = `<div class=\"wall-stat\"><span class=\"wall-stat-label\">${shameText}</span></div>`;
      } else {
        if (!fame) console.warn('[highlights] Missing container:', fameSel);
        if (!shame) console.warn('[highlights] Missing container:', shameSel);
      }

      // Sämsta kapten (optional, proxy batch only)
      const ENABLE_HIGHLIGHTS_CAPTAIN = true;
      if (ENABLE_HIGHLIGHTS_CAPTAIN) {
        try {
          const captains = await getCaptainPointsBatch(gw, entryIds);
          const worst = captains ? pickWorstCaptain(aggregates, captains) : null;
          // Replace the default "Sämsta kapten" card in the highlights header section
          const container = mount || document.querySelector('#weekly-highlights');
          if (container) {
            const cards = container.querySelectorAll('.highlights__card');
            // The 6th card is "Sämsta kapten" in renderHighlightsHtml order
            const kaptenCard = cards && cards[5];
            if (kaptenCard) {
              const title = kaptenCard.querySelector('.highlights__title');
              if (title && title.textContent && title.textContent.toLowerCase().includes('kapten')) {
                const metas = kaptenCard.querySelectorAll('.highlights__meta');
                if (!worst || captains === null) {
                  // Show disabled state text
                  if (kaptenCard.classList) kaptenCard.classList.add('highlights__card--disabled');
                  if (metas[0]) metas[0].textContent = 'Data saknas denna vecka';
                  if (metas[1]) metas[1].textContent = '';
                } else {
                  if (kaptenCard.classList) kaptenCard.classList.remove('highlights__card--disabled');
                  if (metas[0]) metas[0].textContent = `${worst.playerName}${worst.teamName ? ' — ' + worst.teamName : ''}`;
                  if (metas[1]) metas[1].textContent = `${worst.captainPoints} poäng`;
                  else {
                    // If second meta missing, append one
                    const meta = document.createElement('div');
                    meta.className = 'highlights__meta';
                    meta.textContent = `${worst.captainPoints} poäng`;
                    kaptenCard.appendChild(meta);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn('[highlights] captain batch unsupported or failed:', e?.message || e);
        }
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

