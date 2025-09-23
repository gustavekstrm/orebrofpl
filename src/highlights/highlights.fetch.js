import { PROXY_BASE } from '../config/network.js';

export async function getAggregateRowsProxy(gw, entryIds) {
  if (!gw || !Array.isArray(entryIds) || entryIds.length === 0) return [];
  const ids = entryIds.join(',');
  const url = `${PROXY_BASE}/api/aggregate/rows?gw=${encodeURIComponent(gw)}&ids=${encodeURIComponent(ids)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`proxy rows ${r.status}`);
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } finally {
    clearTimeout(t);
  }
}

// expose for highlights only
if (typeof window !== 'undefined') {
  window.HIGHLIGHTS_GET_ROWS = getAggregateRowsProxy;
  console.debug('[highlights] using proxy via HIGHLIGHTS_GET_ROWS');
}

export default { getAggregateRowsProxy };


