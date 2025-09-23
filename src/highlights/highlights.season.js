/**
 * Season-wide highlights: Wall of Fame/Shame and Temporär kung
 * @module highlights.season
 */

/**
 * Tally season-wide tops (Veckans Raket) and bottoms (Veckans Sopa), and compute current king.
 * Aggregates over 1..currentGw using the same proxy-backed getAggregateRows
 * @param {{ currentGw: number, entryIds: number[], fetchRows: (gw: number, entryIds: number[]) => Promise<any[]> }} args
 * @returns {Promise<{ fame: { playerName: string, count: number }|null, shame: { playerName: string, count: number }|null, currentKing: { playerName: string }|null }>}
 */
export async function tallySeason({ currentGw, entryIds, fetchRows }) {
  const topCount = new Map();   // # of gw wins (Veckans Raket)
  const botCount = new Map();   // # of gw losses (Veckans Sopa)
  
  for (let gw = 1; gw <= currentGw; gw++) {
    try {
      const rows = await fetchRows(gw, entryIds);
      if (!rows || !rows.length) continue;
      
      const win = (rows => rows.sort((a, b) => 
        (b.gwPoints - a.gwPoints) || 
        (b.totalPoints - a.totalPoints) || 
        (a.overallRank - b.overallRank) || 
        (a.playerName.localeCompare(b.playerName))
      ))(rows)[0];
      
      const lose = (rows => rows.sort((a, b) => 
        (a.gwPoints - b.gwPoints) || 
        (a.totalPoints - b.totalPoints) || 
        (b.overallRank - a.overallRank) || 
        (a.playerName.localeCompare(b.playerName))
      ))(rows)[0];
      
      if (win) topCount.set(win.entryId, (topCount.get(win.entryId) || 0) + 1);
      if (lose) botCount.set(lose.entryId, (botCount.get(lose.entryId) || 0) + 1);
    } catch (e) { 
      console.warn('[highlights][season] skip gw', gw, e); 
    }
  }
  
  const entryById = new Map();
  const latest = await fetchRows(currentGw, entryIds);
  latest?.forEach(r => entryById.set(r.entryId, r));
  
  const fame = [...topCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const shame = [...botCount.entries()].sort((a, b) => b[1] - a[1])[0];
  
  const fameRow = fame && entryById.get(fame[0]);  // {playerName}
  const shameRow = shame && entryById.get(shame[0]);
  
  const currentKing = latest?.find(r => r.overallRank === 1) || 
    (latest?.sort((a, b) => a.overallRank - b.overallRank)[0] ?? null);
  
  return {
    fame: fameRow ? { playerName: fameRow.playerName, count: fame[1] } : null,
    shame: shameRow ? { playerName: shameRow.playerName, count: shame[1] } : null,
    currentKing: currentKing ? { playerName: currentKing.playerName } : null
  };
}

export default { tallySeason };
