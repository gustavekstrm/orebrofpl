/**
 * Orchestrator for highlights: fetch → compute → render → inject
 * Mounts only on Highlights page, always writes DOM
 */
import './highlights.fetch.js';
import { pickWeeklyWinner, pickWeeklyLast, pickBottomN, computeBeerTiers, pickWorstCaptain } from './highlights.logic.js';
import { tallySeason } from './highlights.season.js';

/**
 * @param {{ gw: number, entryIds: number[], selectors?: {}, context?: { allowPicks?: boolean } }} opts
 */
export async function mountHighlights({ gw, entryIds, selectors, context }) {
  try {
    // Fetch rows via proxy-backed getAggregateRows
    const rows = await window.getAggregateRows(gw, entryIds);
    
    // Compute weekly highlights
    const winner = pickWeeklyWinner(rows); // Veckans Raket
    const loser = pickWeeklyLast(rows); // Veckans Sopa
    const roast4 = pickBottomN(rows, 4); // Svagaste (4 st)
    const beer = computeBeerTiers(rows, gw); // 3 kort
    
    // Render into existing containers (no new markup; clear container.innerHTML and fill)
    
    // Raket/Sopa: fill title & "X poäng"
    const rocketEl = document.querySelector('#weeklyRocket');
    const flopEl = document.querySelector('#weeklyFlop');
    if (rocketEl && winner) {
      rocketEl.textContent = `${winner.playerName} - ${winner.gwPoints} poäng`;
    }
    if (flopEl && loser) {
      flopEl.textContent = `${loser.playerName} - ${loser.gwPoints} poäng`;
    }
    
    // Svagaste: 4 rows/cards with name + "X p"
    const roastEl = document.querySelector('#roastGrid');
    if (roastEl) {
      roastEl.innerHTML = roast4.map(r => 
        `<div class="roast-card sopa"><div class="roast-title">${r.playerName} – ${r.teamName}</div><div class="roast-message">${r.gwPoints} p</div></div>`
      ).join('');
      
      // Toggle ❌ placeholder for "svagaste": hide when roast4.length>0, show otherwise
      const header = roastEl.closest('.roast-section')?.querySelector('h2');
      if (header) {
        const base = 'Veckans svagaste insatser...';
        header.textContent = roast4.length > 0 ? base : `${base} ❌`;
      }
    }
    
    // Öl-nivåer: exactly 3 cards with labels "Öl", "Alkoholfri", "Ingen öl"; if bucket empty: render card with "Data saknas"
    const beerEl = document.querySelector('#beerGrid');
    if (beerEl) {
      beerEl.innerHTML = beer.map(t => {
        const playerText = t ? `${t.playerName} – ${t.gwPoints} p` : 'Data saknas';
        return `<div class="beer-card"><div class="beer-level">${t?.label || 'N/A'}</div><div class="beer-player">${playerText}</div></div>`;
      }).join('');
    }
    
    // Veckans sämsta kapten:
    // If context.allowPicks === true and batch route exists on proxy (e.g. /api/picks/batch?gw=&ids=), fetch and build Map(entryId->captainPoints), otherwise leave null.
    // Render card with lowest captainPoints if data exists; otherwise show "Data saknas denna vecka".
    const captainEl = document.querySelector('#weeklyCaptain');
    if (captainEl && context.allowPicks === true) {
      try {
        // Try to fetch captain batch data
        const url = `${window.PROXY_BASE || 'https://<YOUR_PROXY_HOST>'}/api/picks/batch?gw=${encodeURIComponent(gw)}&ids=${encodeURIComponent(entryIds.join(','))}`;
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (response.ok) {
          const captains = await response.json();
          if (Array.isArray(captains)) {
            const capMap = new Map(captains.map(c => [Number(c.entryId), Number(c.captainPoints)]));
            const worst = pickWorstCaptain(rows, capMap);
            if (worst) {
              captainEl.textContent = `${worst.playerName} - ${worst.captainPoints} poäng`;
            } else {
              captainEl.textContent = 'Data saknas denna vecka';
            }
          } else {
            captainEl.textContent = 'Data saknas denna vecka';
          }
        } else {
          captainEl.textContent = 'Data saknas denna vecka';
        }
      } catch (e) {
        captainEl.textContent = 'Data saknas denna vecka';
      }
    } else if (captainEl) {
      captainEl.textContent = 'Data saknas denna vecka';
    }
    
    // Wall of Fame / Shame + "Temporär kung"
    const tallies = await tallySeason({ currentGw: gw, entryIds, fetchRows: window.getAggregateRows });
    
    // Wall of Fame: "Flest veckans raket: <namn> — <antal> st"
    const fameEl = document.querySelector('#fameStats');
    if (fameEl) {
      const fameText = tallies.fame ? `Flest veckans raket: ${tallies.fame.playerName} — ${tallies.fame.count} st` : 'Flest veckans raket: Data saknas';
      const kingText = tallies.currentKing ? `Temporär kung: ${tallies.currentKing.playerName}` : '';
      fameEl.innerHTML = `<div class="wall-stat"><span class="wall-stat-label">${fameText}</span></div>${kingText ? `<div class="wall-stat"><span class="wall-stat-label">${kingText}</span></div>` : ''}`;
    }
    
    // Wall of Shame: "Flest veckans sopa: <namn> — <antal> st"
    const shameEl = document.querySelector('#shameStats');
    if (shameEl) {
      const shameText = tallies.shame ? `Flest veckans sopa: ${tallies.shame.playerName} — ${tallies.shame.count} st` : 'Flest veckans sopa: Data saknas';
      shameEl.innerHTML = `<div class="wall-stat"><span class="wall-stat-label">${shameText}</span></div>`;
    }
    
    // Log counts and show muted banner on fetch errors, without throw
    console.debug('[highlights] rendered', { 
      winner: winner?.playerName, 
      loser: loser?.playerName, 
      roast4: roast4.length,
      beer: beer.length,
      fame: tallies.fame?.playerName,
      shame: tallies.shame?.playerName,
      king: tallies.currentKing?.playerName
    });
    
  } catch (e) {
    // Show muted banner on errors
    const banner = document.querySelector('#highlights') || document.body;
    if (banner && !banner.querySelector('.muted-banner')) {
      banner.insertAdjacentHTML('beforeend', '<div class="muted-banner">Kunde inte hämta veckans höjdpunkter just nu.</div>');
    }
    console.warn('[highlights] fetch failed:', e?.message || e);
  }
}

export default { mountHighlights };

