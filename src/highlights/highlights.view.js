/**
 * Minimal view layer for weekly highlights – returns HTML string.
 * @module highlights.view
 */

/**
 * @param {import('./highlights.logic.js').Highlights} data
 * @returns {string} HTML string for injection
 */
export function renderHighlightsHtml(data) {
  function card(title, agg, meta) {
    if (!agg) {
      return `
        <div class="highlights__card highlights__card--disabled" title="Data saknas" aria-disabled="true">
          <div class="highlights__title">${title}</div>
          <div class="highlights__meta">Data saknas</div>
        </div>`;
    }
    const name = agg.playerName || `ID ${agg.entryId}`;
    const team = agg.teamName || '';
    return `
      <div class="highlights__card">
        <div class="highlights__title">${title}</div>
        <div class="highlights__meta">${name}${team ? ' — ' + team : ''}</div>
        ${meta ? `<div class="highlights__meta">${meta}</div>` : ''}
      </div>`;
  }

  const raketMeta = data.veckansRaket ? `+${data.veckansRaket.delta} i overall-rank • ${data.veckansRaket.agg.gwPoints}p` : null;
  const dykMeta = data.veckansStörtdyk ? `${data.veckansStörtdyk.delta} i overall-rank • ${data.veckansStörtdyk.agg.gwPoints}p` : null;

  return `
    <section class="highlights" aria-label="Veckans höjdpunkter">
      ${card('Veckans Kanon', data.veckansKanon, data.veckansKanon ? `${data.veckansKanon.gwPoints} poäng` : null)}
      ${card('Veckans Sopa', data.veckansSopa, data.veckansSopa ? `${data.veckansSopa.gwPoints} poäng` : null)}
      ${card('Veckans Raket', data.veckansRaket && data.veckansRaket.agg || null, raketMeta)}
      ${card('Veckans Störtdyk', data.veckansStörtdyk && data.veckansStörtdyk.agg || null, dykMeta)}
      ${card('Flest Bänkpoäng', null, null)}
      ${card('Sämsta Kapten', null, null)}
    </section>
  `;
}

export default { renderHighlightsHtml };

