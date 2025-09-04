/**
 * Minimal view layer for weekly highlights – returns HTML string.
 * @module highlights.view
 */

/**
 * @param {import('./highlights.logic.js').Highlights} data
 * @returns {string} HTML string for injection
 */
export function renderHighlightsHtml(data) {
  function card(title, aggOrWrap, metaFn) {
    const agg = aggOrWrap && aggOrWrap.agg ? aggOrWrap.agg : aggOrWrap;
    if (!agg) {
      return `
        <div class="highlights__card highlights__card--disabled" title="Data saknas denna vecka" aria-disabled="true">
          <div class="highlights__title">${title}</div>
          <div class="highlights__meta">Data saknas denna vecka</div>
        </div>`;
    }
    const name = agg.playerName || `ID ${agg.entryId}`;
    const team = agg.teamName || '';
    const meta = metaFn ? metaFn(aggOrWrap) : null;
    return `
      <div class="highlights__card">
        <div class="highlights__title">${title}</div>
        <div class="highlights__meta">${name}${team ? ' — ' + team : ''}</div>
        ${meta ? `<div class="highlights__meta">${meta}</div>` : ''}
      </div>`;
  }

  const fmtDelta = (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
    const sign = n > 0 ? '+' : '';
    return `${sign}${n}`;
  };

  const raketMetaFn = (wrap) => {
    if (!wrap || typeof wrap.delta !== 'number') return null;
    const s = fmtDelta(wrap.delta);
    return s ? `${s} i overall-rank • ${wrap.agg.gwPoints} p` : `${wrap.agg.gwPoints} p`;
  };

  const dykMetaFn = (wrap) => {
    if (!wrap || typeof wrap.delta !== 'number') return null;
    const s = fmtDelta(wrap.delta);
    return s ? `${s} i overall-rank • ${wrap.agg.gwPoints} p` : `${wrap.agg.gwPoints} p`;
  };

  return `
    <section class="highlights" aria-label="Veckans höjdpunkter">
      ${card('Veckans kanon', data.veckansKanon, (a)=> `${a.gwPoints} poäng`)}
      ${card('Veckans raket', data.veckansRaket, raketMetaFn)}
      ${card('Veckans störtdyk', data.veckansStörtdyk, dykMetaFn)}
      ${card('Veckans sopa', data.veckansSopa, (a)=> `${a.gwPoints} poäng`)}
      ${card('Flest bänkpoäng', null, null)}
      ${card('Sämsta kapten', null, null)}
    </section>
  `;
}

export default { renderHighlightsHtml };

