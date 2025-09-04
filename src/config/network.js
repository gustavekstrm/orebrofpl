// Network configuration for proxy-backed endpoints (frontend-safe)
// Prefer window override, then env, then a placeholder default

// eslint-disable-next-line no-undef
const ENV_PROXY_BASE = (typeof process !== 'undefined' && process?.env && process.env.PROXY_BASE) ? process.env.PROXY_BASE : undefined;

export const PROXY_BASE = (typeof window !== 'undefined' && window.PROXY_BASE) || ENV_PROXY_BASE || 'https://<YOUR_PROXY_HOST>';

export default { PROXY_BASE };


