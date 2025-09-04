import { PROXY_BASE } from '../config/network.js';

export async function proxyHealthy(timeoutMs = 3000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${PROXY_BASE}/health`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' }
    });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export default { proxyHealthy };


