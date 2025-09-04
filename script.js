// Build information
const BUILD_SHA = '5s6t7u8'; // Current commit SHA for asset versioning
const BUILD_BANNER = `[ÖrebroFPL] build ${BUILD_SHA} – tables=aggregate-only`;
let DATA_SHA = null; // updated from data/manifest.json if available

// ---- BASE + version ----
// 1) Prefer <base href> if present
function getBaseFromTag() {
  const tag = document.querySelector('base');
  if (!tag?.href) return null;
  const u = new URL(tag.href, location.href);
  // ensure trailing slash
  return u.origin + u.pathname.replace(/\/?$/, '/');
}

// 2) Else derive from current script URL (works on GH Pages project sites)
function getBaseFromScript() {
  const current = document.currentScript;
  const src = current && current.src ? current.src : null;
  if (!src) return null;
  const u = new URL(src, location.href);
  // strip filename → /<repo>/
  return u.origin + u.pathname.replace(/[^/]+$/, '');
}

// 3) Else fallback to location (keeps first segment only)
function getBaseFromLocation() {
  const segs = location.pathname.split('/').filter(Boolean);
  const root = segs.length ? `/${segs[0]}/` : '/';
  return location.origin + root;
}

const BASE = getBaseFromTag() || getBaseFromScript() || getBaseFromLocation();

// Debug BASE resolution in development
if (typeof window !== 'undefined' && typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'true') {
  console.log('[BASE] Resolution debug:', {
    tag: getBaseFromTag(),
    script: getBaseFromScript(),
    location: getBaseFromLocation(),
    final: BASE,
    currentPath: location.pathname,
    currentScript: document.currentScript?.src
  });
}

function dataUrl(relativePath) {
  // relativePath like 'data/bootstrap-static.json' OR `data/entry/${id}/history.json`
  const ver = DATA_SHA || BUILD_SHA;
  const url = new URL(`${relativePath}?v=${ver}`, BASE).toString();
  if (typeof window !== 'undefined' && typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'true') {
    console.log(`[dataUrl] ${relativePath} -> ${url}`);
  }
  return url;
}

// Load data manifest to pick up data sha/version and freshness info (non-fatal)
async function loadManifest() {
  try {
    const u = new URL(`data/manifest.json?v=${BUILD_SHA}`, BASE).toString();
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    DATA_SHA = (j?.sha || '').slice(0, 7) || null;
    if (typeof window !== 'undefined') {
      window.__DEBUG_FPL = window.__DEBUG_FPL || {};
      window.__DEBUG_FPL.fallback = Object.assign({}, window.__DEBUG_FPL.fallback || {}, {
        lastSync: j?.lastSync,
        idsCount: Array.isArray(j?.ids) ? j.ids.length : undefined,
        sha: j?.sha
      });
    }
    console.log('[Manifest] Loaded manifest, DATA_SHA =', DATA_SHA);
  } catch (e) {
    console.warn('[Manifest] Could not load manifest:', e.message);
  }
}

// Test flags for development (dev-only, never commit defaults)
const FORCE_FALLBACK = new URLSearchParams(location.search).get('forceFallback') === 'true';
const FORCE_DIRECT = new URLSearchParams(location.search).get('forceDirect') === 'true';

if (FORCE_FALLBACK || FORCE_DIRECT) {
  console.warn(`[DEV] Test flag enabled: ${FORCE_FALLBACK ? 'FORCE_FALLBACK' : 'FORCE_DIRECT'}`);
}

// Map API paths to fallback file paths
function mapApiToFallback(path) {
  if (path === '/api/bootstrap-static/') return 'data/bootstrap-static.json';
  
  const m = path.match(/^\/api\/entry\/(\d+)\/history\/$/);
  if (m) return `data/entry/${m[1]}/history.json`;
  
  throw new Error(`No fallback mapping for ${path}`);
}

// Unified FPL fetch helper with bulletproof fallback
async function fplFetch(path, opts = {}) {
  const directUrl = 'https://fantasy.premierleague.com' + path;
  
  // Test flag handling
  if (FORCE_FALLBACK) {
    console.log(`[DEV] FORCE_FALLBACK: skipping direct API for ${path}`);
    throw new Error('FORCE_FALLBACK: Simulating direct API failure');
  }
  
  // Always try direct first (unless forced to fallback)
  try {
    console.log(`[FPL] Direct fetch: ${path}`);
    const r = await fetch(directUrl, { 
      cache: 'no-store', 
      mode: 'cors',
      ...opts 
    });
    
    if (r.ok) {
      console.log(`[FPL] Direct fetch successful: ${path}`);
      
      // Mark response as direct for debugging
      r._isFallback = false;
      r._source = 'direct';
      
      return r;
    }
    
    // Non-2xx status - fall through to fallback
    console.warn(`[FPL] Direct fetch returned ${r.status}, trying fallback`);
    
  } catch (e) {
    console.warn(`[FPL] Direct fetch failed for ${path}:`, e.name, e.message);
    // Swallow direct errors and try fallback
  }
  
  // Bulletproof fallback to same-origin data (from GitHub Actions sync)
  try {
    const fallbackPath = mapApiToFallback(path);
    const fallbackUrl = dataUrl(fallbackPath);
    console.log(`[FPL] Fallback to same-origin: ${fallbackUrl}`);
    
    const r2 = await fetch(fallbackUrl, { cache: 'no-store' });
    
    if (!r2.ok) {
      if (r2.status === 404) {
        throw new Error(`Fallback missing: ${fallbackPath} (404) - GitHub Action may not have synced yet`);
      }
      throw new Error(`Fallback HTTP ${r2.status}`);
    }
    
    console.log(`[FPL] Fallback successful: ${path} -> ${fallbackPath}`);
    
    // Mark response as fallback for debugging
    r2._isFallback = true;
    r2._fallbackPath = fallbackPath;
    r2._source = 'fallback';
    
    return r2;
    
  } catch (fallbackError) {
    console.error(`[FPL] Both direct and fallback failed for ${path}:`, {
      direct: 'failed or non-2xx',
      fallback: { name: fallbackError.name, message: fallbackError.message }
    });
    
    // Only throw if both paths failed
    throw new Error(`fplFetch failed (direct+fallback): ${path} - ${fallbackError.message}`);
  }
}

// Extract GW derivation logic for reuse
function deriveLatestFinishedGw(boot) {
  const events = Array.isArray(boot?.events) ? boot.events : [];
  
  if (events.length === 0) {
    throw new Error('No events found in bootstrap-static');
  }
  
  console.log(`[GW] Found ${events.length} events, checking for finished ones...`);
  
  // Prefer events with finished || data_checked
  const finished = events.filter(e => e.finished === true || e.data_checked === true);
  if (finished.length > 0) {
    const latestFinished = Math.max(...finished.map(e => Number(e.id ?? e.event)));
    console.log('[GW] Latest finished GW:', latestFinished, 'from', finished.length, 'finished events');
    return latestFinished;
  }
  
  // Fallback: last event whose deadline has passed
  const now = Date.now();
  const past = events.filter(e => new Date(e.deadline_time).getTime() <= now);
  if (past.length > 0) {
    const fallbackGw = Math.max(...past.map(e => Number(e.id ?? e.event)));
    console.log('[GW] Fallback GW (deadline passed):', fallbackGw);
    return fallbackGw;
  }
  
  throw new Error('No usable events in bootstrap');
}

// Derive season label (e.g., 2025/26) from bootstrap events
function deriveSeasonLabel(boot) {
  try {
    const events = Array.isArray(boot?.events) ? boot.events : [];
    if (events.length === 0) return '';
    const first = events[0];
    const dt = new Date(first.deadline_time);
    const startYear = Number.isFinite(dt.getUTCFullYear()) ? dt.getUTCFullYear() : new Date().getUTCFullYear();
    const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
    return `${startYear}/${endYearShort}`;
  } catch (_) {
    return '';
  }
}

// Robust GW resolver - single source of truth for latest finished GW
async function resolveLatestFinishedGw() {
  try {
    console.log('[GW] Resolving latest finished GW...');
    const res = await fplFetch('/api/bootstrap-static/');
    
    if (!res.ok) {
      throw new Error(`bootstrap-static failed: ${res.status}`);
    }
    
    const boot = await res.json();
    const gw = deriveLatestFinishedGw(boot);
    
    console.log(`[GW] Resolved GW ${gw} from ${res._source || 'unknown'} source`);
    return gw;
    
  } catch (directErr) {
    console.warn('[GW] Direct fetch failed, trying explicit fallback:', directErr.message);
    
    // If fplFetch already tried fallback internally and still threw, we need an explicit fallback here
    try {
      const url = dataUrl('data/bootstrap-static.json');
      console.log('[GW] Explicit fallback to:', url);
      
      const res2 = await fetch(url, { cache: 'no-store' });
      if (!res2.ok) {
        if (res2.status === 404) {
          throw new Error(`Fallback missing: ${url} - GitHub Action may not have synced yet`);
        }
        throw new Error(`Fallback HTTP ${res2.status}`);
      }
      
      const boot2 = await res2.json();
      const gw2 = deriveLatestFinishedGw(boot2);
      
      console.log(`[GW] Fallback successful, resolved GW ${gw2}`);
      return gw2;
      
    } catch (fallbackErr) {
      console.error('[GW] Both direct and fallback failed:', {
        direct: directErr.message,
        fallback: fallbackErr.message
      });
      
      // Only here do we surface a banner - both paths failed
      throw new Error(`GW resolution failed after fallback: ${fallbackErr.message}`);
    }
  }
}

// Single-flight guard for GW resolution to prevent duplicate calls
let _gwPromise;
function getLatestGwOnce() {
  if (!_gwPromise) {
    _gwPromise = resolveLatestFinishedGw();
  }
  return _gwPromise;
}

// Fetch entry history for a specific participant with retry
async function fetchEntryHistory(entryId) {
  try {
    console.log(`[History] Fetching history for entry ${entryId}...`);
    const res = await fplFetch(`/api/entry/${entryId}/history/`);
    
    if (!res.ok) {
      throw new Error(`history ${entryId} failed: ${res.status}`);
    }
    
    const data = await res.json();
    console.log(`[History] Successfully fetched history for entry ${entryId}`);
    return data;
    
  } catch (error) {
    console.error(`[History] Failed to fetch history for ${entryId}:`, error);
    throw error;
  }
}

// Concurrency control for parallel API calls
async function mapWithConcurrency(items, worker, limit = 6) {
  const queue = [...items];
  const results = [];
  
  const run = async () => {
    while (queue.length) {
      const i = items.length - queue.length;
      const item = queue.shift();
      results[i] = await worker(item);
    }
  };
  
  const workers = Array.from({ length: limit }, run);
  await Promise.all(workers);
  
  return results;
}

// Ranking helpers: never mutate base rows
function rankBy(rows, primaryKey, tieBreakKeys = []) {
  const sorted = [...rows].sort((a, b) => {
    const pa = Number(a?.[primaryKey] ?? 0);
    const pb = Number(b?.[primaryKey] ?? 0);
    if (pb !== pa) return pb - pa;
    for (const k of tieBreakKeys) {
      const va = Number(a?.[k] ?? 0);
      const vb = Number(b?.[k] ?? 0);
      if (vb !== va) return vb - va;
    }
    return Number(b?.entryId || 0) - Number(a?.entryId || 0);
  });
  return sorted; // caller adds position field name
}

function buildSeasonRows(baseRows) {
  const sorted = rankBy(baseRows, 'totalPoints', ['latestGwPoints']);
  return sorted.map((r, i) => ({ ...r, seasonPos: i + 1 }));
}

function buildLatestGwRows(baseRows) {
  const sorted = rankBy(baseRows, 'latestGwPoints', ['totalPoints']);
  return sorted.map((r, i) => ({ ...r, gwPos: i + 1 }));
}

// Retry mechanism for resilient API calls
async function fetchWithRetry(url, opts = {}, tries = 3) {
  let attempt = 0, lastErr;
  
  while (attempt < tries) {
    try {
      const res = await fetch(url, { cache: 'no-store', ...opts });
      
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`Retryable ${res.status}`);
      }
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      return res;
      
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 400 * Math.pow(2, attempt) + Math.random() * 300));
      attempt++;
    }
  }
  
  throw lastErr;
}

// Robust participant ID coercion
function coerceEntryId(p) {
  const candidates = [p.entryId, p.entry_id, p.id, p.fplId, p.fpl_id, p.entry];
  const n = candidates
    .map(v => (typeof v === 'string' ? parseInt(v, 10) : v))
    .find(v => Number.isInteger(v) && v > 0);
  return n ?? NaN;
}

// Normalize participant data with strict validation
function normalizeParticipant(p) {
  const entryId = coerceEntryId(p);
  return {
    entryId,
    displayName: p.displayName ?? p.name ?? p.entry_name ?? '',
    teamName: p.teamName ?? p.team_name ?? '',
    raw: p,
  };
}

// Single source of truth for participant data with strict validation
function getConfiguredParticipants() {
  try {
    let participants = [];
    
    // Priority 1: LEGACY_PARTICIPANTS (if available and valid)
    if (Array.isArray(window.LEGACY_PARTICIPANTS) && window.LEGACY_PARTICIPANTS.length > 0) {
      participants = window.LEGACY_PARTICIPANTS;
    }
    // Priority 2: PARTICIPANTS (if available and valid)
    else if (Array.isArray(window.PARTICIPANTS) && window.PARTICIPANTS.length > 0) {
      participants = window.PARTICIPANTS;
    }
    // Priority 3: ENTRY_IDS + PARTICIPANT_OVERRIDES
    else if (Array.isArray(window.ENTRY_IDS)) {
      const overrides = window.PARTICIPANT_OVERRIDES || {};
      participants = window.ENTRY_IDS.map(id => ({
        entryId: id,
        ...overrides[id],
      }));
    }
    // Priority 4: Backward-compat shim (ONLY if nothing else works)
    else if (typeof window.participantsData !== 'undefined') {
      participants = window.participantsData;
    }
    
    if (!Array.isArray(participants) || participants.length === 0) {
      throw new Error("No participants configuration found");
    }
    
    // Normalize and validate all participants
    const normalized = participants.map(normalizeParticipant);
    
    // Filter to only valid numeric entryId > 0
    const valid = normalized.filter(p => Number.isInteger(p.entryId) && p.entryId > 0);
    
    if (valid.length === 0) {
      throw new Error("No participants with valid entryId found");
    }
    
    console.log(`[Config] Resolved ${valid.length} valid participants from ${participants.length} total`);
    return valid;
    
  } catch (error) {
    console.error('[Config] Failed to resolve participants:', error);
    throw error;
  }
}

// Centralized status display system with deduplication
let _lastStatusHash = null;
let _lastStatusTime = 0;

function showStatus(type, message, options = {}) {
  const { details, persistent = false, debugOnly = false } = options;
  
  // In normal mode, only show warnings and errors
  if (!window.__DEBUG_MODE && type === 'info') {
    return;
  }
  
  // Create hash of message content for deduplication
  const statusHash = `${type}:${message}:${details || ''}`;
  const now = Date.now();
  
  // Skip if same message shown in last 10 seconds
  if (statusHash === _lastStatusHash && (now - _lastStatusTime) < 10000) {
    console.log('[Status] Skipping duplicate message:', message);
    return null;
  }
  
  // Update deduplication state
  _lastStatusHash = statusHash;
  _lastStatusTime = now;
  
  // Remove existing status
  const existingStatus = document.getElementById('statusIndicator');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  const colors = {
    info: '#3b82f6',    // Blue
    warn: '#f59e0b',    // Yellow/Orange
    error: '#dc2626'    // Red
  };
  
  const status = document.createElement('div');
  status.id = 'statusIndicator';
  status.style.cssText = `
    position: fixed;
    top: ${type === 'error' ? '0' : '60px'};
    left: 0;
    right: 0;
    background: ${colors[type] || colors.info};
    color: white;
    padding: ${type === 'error' ? '1rem' : '0.5rem'};
    text-align: center;
    font-weight: ${type === 'error' ? 'bold' : '500'};
    z-index: 10000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    font-size: ${type === 'error' ? '16px' : '14px'};
  `;
  
  status.textContent = message;
  if (details) {
    status.title = details;
  }
  
  document.body.appendChild(status);
  
  // Log status display for debugging
  console.log(`[Status] Showing ${type} banner:`, message, details ? `(${details})` : '');
  
  // Auto-hide info/warn messages unless persistent
  if (!persistent && type !== 'error') {
    setTimeout(() => {
      if (status.parentNode) {
        status.remove();
      }
    }, 8000);
  }
  
  return status;
}

// Debug mode detection (URL-based toggle)
const urlParams = typeof window !== 'undefined' && typeof window.location !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
const __DEBUG_MODE = urlParams.get('debug') === 'true';
if (typeof window !== 'undefined') {
  window.__DEBUG_MODE = __DEBUG_MODE;
}

// Dev-only guard to catch accidental direct FPL fetches (logs only)
if (__DEBUG_MODE) {
  (function guardDirectFPL(){
    const _fetch = window.fetch;
    window.fetch = function(url, opts){
      try{
        if (typeof url === 'string' && url.includes('fantasy.premierleague.com/api/')) {
          console.error('[BLOCKED] Direct FPL fetch detected. Use fplFetch(). URL=', url);
        }
      }catch{}
      return _fetch.apply(this, arguments);
    };
  })();
}

// Configuration
console.log('=== SCRIPT.JS LOADING ===');
console.info(BUILD_BANNER);
if (__DEBUG_MODE) {
    console.info('🔍 DEBUG MODE ENABLED - verbose logging and debug objects active');
}

// Debug probe to identify CORS/network issues and check fallback data
async function _debugProbe() {
  const results = {
    direct: null,
    fallback: null,
    baseUrl: BASE
  };
  
  // Skip direct API probe in production to avoid CORS noise; rely on fplFetch
  results.direct = { skipped: true };
  
  // Test fallback data availability
  try {
    console.log('[PROBE] Testing fallback data availability...');
    const manifestUrl = dataUrl('data/manifest.json');
    console.log('[PROBE] Manifest URL:', manifestUrl);
    
    const manifestRes = await fetch(manifestUrl, { cache: 'no-store' });
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      console.log('[PROBE] Fallback manifest found:', manifest);
      
      // Calculate freshness
      const lastSync = new Date(manifest.lastSync);
      const now = new Date();
      const ageMinutes = Math.floor((now - lastSync) / (1000 * 60));
      
      results.fallback = {
        success: true,
        lastSync: manifest.lastSync,
        idsCount: manifest.idsCount,
        latestEvent: manifest.latestEvent,
        ageMinutes: ageMinutes,
        freshness: ageMinutes < 30 ? 'fresh' : ageMinutes < 180 ? 'stale' : 'degraded'
      };
      
      console.log(`[PROBE] Fallback freshness: ${ageMinutes} minutes (${results.fallback.freshness})`);
    } else {
      console.warn('[PROBE] Fallback manifest not found:', manifestRes.status);
      results.fallback = { success: false, status: manifestRes.status };
    }
  } catch (e) {
    console.error('[PROBE] Fallback check failed:', e?.name, e?.message, e);
    results.fallback = { success: false, error: { name: e?.name, message: e?.message } };
  }
  
  return results;
}

// Execute debug probe if debug mode enabled
if (typeof window !== 'undefined' && typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'true') {
  _debugProbe().then(result => {
    console.log('[PROBE] Result:', result);
    window.__PROBE_RESULT = result;
  });
}

// Debug GW probe for troubleshooting (debug mode only)
if (typeof window !== 'undefined' && typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'true') {
  window.__DEBUG_FPL = window.__DEBUG_FPL || {};
  window.__DEBUG_FPL.gwProbe = async () => {
    try {
      console.log('[GW PROBE] Testing fplFetch with bootstrap-static...');
      const r = await fplFetch('/api/bootstrap-static/');
      const j = await r.json();
      const gw = deriveLatestFinishedGw(j);
      console.log('[GW PROBE] source OK, gw=', gw, 'events=', j?.events?.length, 'source=', r._source);
      return { success: true, gw, events: j?.events?.length, source: r._source };
    } catch (e) {
      console.error('[GW PROBE] failed after fallback:', e.message);
      return { success: false, error: e.message };
    }
  };
  
  // Add fallback existence checker
  window.__DEBUG_FPL.checkFallback = async (id) => {
    const u1 = dataUrl('data/bootstrap-static.json');
    const u2 = dataUrl(`data/entry/${id}/history.json`);
    const [r1, r2] = await Promise.all([
      fetch(u1, {method:'HEAD', cache:'no-store'}),
      fetch(u2, {method:'HEAD', cache:'no-store'})
    ]);
    console.table([
      { file: u1, status: r1.status },
      { file: u2, status: r2.status }
    ]);
    return { bootstrap: r1.status, history: r2.status };
  };
  
  console.log('[DEBUG] GW probe available: window.__DEBUG_FPL.gwProbe()');
  console.log('[DEBUG] Fallback checker available: window.__DEBUG_FPL.checkFallback(id)');
}

// Main tables loader with robust error handling and real data computation
async function loadTablesViewUsingAggregates() {
  try {
    console.info('[Tables] Starting tables load with aggregates...');
    
    // Step 1: Resolve latest finished GW as single source of truth (with fallback guarantee)
    console.info('[Tables] Resolving latest finished GW...');
    const latestGw = await getLatestGwOnce();
    console.info('[Tables] Latest finished GW resolved:', latestGw);
    
    // Validate GW is a positive integer
    if (!Number.isInteger(latestGw) || latestGw <= 0) {
      throw new Error(`Invalid GW resolved: ${latestGw} (must be positive integer)`);
    }
    
    // Step 2: Get valid participants with numeric entryId
    console.info('[Tables] Getting configured participants...');
    const validParticipants = getConfiguredParticipants();
    console.info('[Tables] Found', validParticipants.length, 'valid participants');
    
    if (validParticipants.length === 0) {
      throw new Error('No participants with valid entryId found');
    }
    
    // Step 3: Fetch bootstrap data for season resolution
    console.info('[Tables] Fetching bootstrap data...');
    const bootstrapRes = await fplFetch('/api/bootstrap-static/');
    const bootstrap = await bootstrapRes.json();
    
    // Determine data source for debugging
    const dataSource = bootstrapRes._source || 'unknown';
    console.info('[Tables] Using data source:', dataSource);
    
    // Step 4: Fetch entry histories with concurrency control
    console.info('[Tables] Fetching entry histories with concurrency...');
    
    // Worker function to fetch and compute data for each participant
    const worker = async (participant) => {
      try {
        const history = await fetchEntryHistory(participant.entryId);
        
        // Compute season total and latest GW points from history
        const current = Array.isArray(history?.current) ? history.current : [];
        
        // Season total: take the highest total_points in current
        const totalPoints = current.reduce((m, it) => Math.max(m, Number(it?.total_points || 0)), 0);
        
        // Latest GW points: find item where event === latestGw and read 'points'
        const gwItem = current.find(it => Number(it?.event) === Number(latestGw));
        const latestGwPoints = Number(gwItem?.points ?? 0);
        
        return {
          fplId: participant.entryId,
          entryId: participant.entryId,
          displayName: participant.displayName,
          teamName: participant.teamName,
          totalPoints: totalPoints,
          latestGw: latestGw,
          latestGwPoints: latestGwPoints,
          gwPoints: latestGwPoints, // For backward compatibility
          hasValidId: true,
          raw: participant.raw
        };
      } catch (error) {
        console.error(`[Worker] Failed for participant ${participant.entryId}:`, error);
        return {
          fplId: participant.entryId,
          entryId: participant.entryId,
          displayName: participant.displayName,
          teamName: participant.teamName,
          totalPoints: 0,
          latestGw: latestGw,
          latestGwPoints: 0,
          gwPoints: 0,
          hasValidId: true,
          error: error.message
        };
      }
    };
    
    // Process participants with concurrency control
    const rows = await mapWithConcurrency(validParticipants, worker, 6);
    console.info('[Tables] Processed', rows.length, 'participants with concurrency');
    
    // Build ranked rows (no mutation of base)
    const seasonRows = buildSeasonRows(rows);
    const gwRows = buildLatestGwRows(rows);

    // Expose base aggregates for other features (e.g., highlights) to reuse
    window.__aggregateBaseRows = rows;

    // Debug-only assertions for season ranking and positions
    if (__DEBUG_MODE) {
      if (seasonRows.length > 0) {
        console.assert(seasonRows[0].seasonPos === 1, 'Season pos[0] must be 1', seasonRows[0]);
      }
      for (let i = 1; i < seasonRows.length; i++) {
        console.assert(seasonRows[i].seasonPos === i + 1, 'Season pos mismatch at i=' + i, seasonRows[i]);
        console.assert(Number(seasonRows[i-1].totalPoints||0) >= Number(seasonRows[i].totalPoints||0), 'Season sort order broken', seasonRows[i-1], seasonRows[i]);
      }
    }

    // Store for debug utilities and health checks
    window.__lastRows = seasonRows; // Use season-sorted rows as primary
    
    // Add debug dump for inspection (only if debug mode enabled)
    if (__DEBUG_MODE) {
      const gw = latestGw;
      const season = '2025/26'; // TODO: derive from bootstrap events
      
      // Get fallback info if using fallback
      let fallbackInfo = null;
      let ageMinutes = 0;
      if (dataSource === 'fallback') {
        try {
          const manifestRes = await fetch(dataUrl('data/manifest.json'), { cache: 'no-store' });
          if (manifestRes.ok) {
            const manifest = await manifestRes.json();
            const lastSync = new Date(manifest.lastSync);
            const now = new Date();
            ageMinutes = Math.floor((now - lastSync) / (1000 * 60));
            
            fallbackInfo = {
              lastSync: manifest.lastSync,
              idsCount: manifest.idsCount,
              ageMinutes: ageMinutes,
              freshness: ageMinutes < 30 ? 'fresh' : ageMinutes < 180 ? 'stale' : 'degraded'
            };
          }
        } catch (e) {
          console.warn('[Debug] Could not fetch fallback manifest:', e);
        }
      }
      
      window.__DEBUG_FPL = {
        participants: validParticipants,
        sampleRow: seasonRows[0],
        season: season,
        gwInfo: { requestedGw: gw, latestGw, resolvedSeason: season },
        dataSource: dataSource,
        fallback: dataSource === 'fallback' ? {
          lastSync: fallbackInfo?.lastSync,
          idsCount: fallbackInfo?.idsCount,
          ageMinutes: ageMinutes,
          freshness: fallbackInfo?.freshness,
          baseUrl: BASE
        } : null,
        apiSamples: {
          entryIds: validParticipants.map(p => p.entryId).slice(0, 5),
          sampleHistory: sortedSeasonRows[0]
        },
        computedRows: seasonRows.slice(0, 5).map(row => ({
          pos: row.seasonPos,
          entryId: row.entryId,
          displayName: row.displayName,
          totalPoints: row.totalPoints,
          latestGwPoints: row.latestGwPoints,
          latestGw: row.latestGw
        }))
      };
      
      console.table('👀 DEBUG: Sample Row', [window.__DEBUG_FPL.sampleRow]);
      console.table('👀 DEBUG: Season Top 5', buildSeasonRows(rows).slice(0,5).map(r => ({ pos: r.pos, name: r.displayName, total: r.totalPoints, gwPts: r.latestGwPoints })));
      console.table('👀 DEBUG: First 5 Computed Rows', window.__DEBUG_FPL.computedRows);
      console.log('👀 DEBUG: Season & GW Info', { season, latestGw, requestedGw: gw });
      
      // Data provenance footer
      console.group('👀 DEBUG: Data Provenance');
      console.log('📊 Totals source: /api/entry/{id}/history/ (total_points)');
      console.log('📈 GW points source: /api/entry/{id}/history/ (points)');
      console.log('🌍 Season resolution: bootstrap-static events');
      console.log('🎯 GW resolution: bootstrap-static events (finished || data_checked)');
      console.log(`🔍 Data source: ${dataSource.toUpperCase()}`);
      if (dataSource === 'fallback') {
        const lastSync = new Date(fallbackInfo.lastSync).toLocaleString();
        console.log(`📅 Last sync: ${lastSync}`);
        console.log(`🆔 Synced IDs: ${fallbackInfo.idsCount}`);
        console.log(`⏰ Age: ${ageMinutes} minutes (${fallbackInfo.freshness})`);
      }
      console.groupEnd();
    }
    
    // Step 5: Render tables with the computed data
    populateSeasonTable?.(seasonRows, bootstrap);
    populateGameweekTable?.(gwRows, bootstrap, latestGw);
    
    console.info('[Tables] Successfully loaded with', rows.length, 'rows, GW:', latestGw);
    
  } catch (error) {
    console.error('[Tables] Failed to load tables:', error);
    
    // Show specific status based on error type
    if (error.message.includes('No participants with valid entryId')) {
      showStatus('error', 'No participants with valid entryId found');
    } else if (error.message.includes('Fallback missing')) {
      showStatus('error', `Fallback data not available: ${error.message}`, { 
        details: 'GitHub Action may not have synced yet. Check Actions tab.',
        persistent: true 
      });
    } else if (error.message.includes('GW resolution failed after fallback')) {
      showStatus('error', `Gameweek resolution failed: ${error.message}`, {
        details: 'Both direct API and fallback data failed. Check network and GitHub Actions.',
        persistent: true
      });
    } else if (error.message.includes('Invalid GW resolved')) {
      showStatus('error', `Invalid gameweek value: ${error.message}`, {
        details: 'GW resolution succeeded but returned invalid value.',
        persistent: true
      });
    } else if (error.message.includes('bootstrap-static failed')) {
      showStatus('warn', 'FPL API temporarily unavailable');
    } else if (error.message.includes('CORS/Network issue')) {
      // Don't show banner for CORS issues - this is normal and handled by fallback
      console.log('[Tables] CORS/Network issue handled by fallback - no banner needed');
    } else {
      showStatus('error', error.message);
    }
    
    // Don't render tables with invalid data
    populateSeasonTable?.([], bootstrap);
    populateGameweekTable?.([], bootstrap, 0);
  }
}

// Runtime health checks for data integrity
async function runHealthChecks() {
  try {
    console.info('[Health] Running health checks...');
    
    // HC-1: Valid participants count
    const participants = getConfiguredParticipants();
    if (participants.length === 0) {
      throw new Error('No participants with valid entryId found');
    }
    console.log('[Health] HC-1 PASS: Valid participants count:', participants.length);
    
    // HC-2: GW resolution
    const latestGw = await getLatestGwOnce();
    if (!Number.isInteger(latestGw) || latestGw <= 0) {
      throw new Error(`Invalid GW resolved: ${latestGw}`);
    }
    console.log('[Health] HC-2 PASS: GW resolution:', latestGw);
    
    // HC-3: Data join validation (if we have rows)
    if (window.__lastRows && window.__lastRows.length > 0) {
      const rows = window.__lastRows;
      const zeroTotalRows = rows.filter(r => r.totalPoints === 0).length;
      const lowGwRows = rows.filter(r => r.latestGwPoints <= 1).length;
      
      if (latestGw > 1 && (zeroTotalRows / rows.length > 0.6 || lowGwRows / rows.length > 0.6)) {
        throw new Error(`Data join failed: ${zeroTotalRows}/${rows.length} zero totals, ${lowGwRows}/${rows.length} low GW points`);
      }
      console.log('[Health] HC-3 PASS: Data join validation');
    }
    
    // HC-4: Fallback data freshness (if using fallback)
    try {
      const manifestRes = await fetch(dataUrl('data/manifest.json'), { cache: 'no-store' });
      if (manifestRes.ok) {
        const manifest = await manifestRes.json();
        const lastSync = new Date(manifest.lastSync);
        const now = new Date();
        const ageMinutes = Math.floor((now - lastSync) / (1000 * 60));
        
        if (ageMinutes >= 180) {
          console.warn('[Health] HC-4 WARN: Fallback data is degraded (age:', ageMinutes, 'minutes)');
        } else {
          console.log('[Health] HC-4 PASS: Fallback data freshness OK (age:', ageMinutes, 'minutes)');
        }
      }
    } catch (e) {
      console.warn('[Health] HC-4 WARN: Could not check fallback freshness:', e.message);
    }
    
    console.info('[Health] All health checks PASSED');
    window.__FPL_HEALTH = { ok: true, timestamp: new Date().toISOString() };
    
  } catch (error) {
    console.error('[Health] Health check failed:', error);
    window.__FPL_HEALTH = { ok: false, error: error.message, timestamp: new Date().toISOString() };
    
    // Show health check failure banner
    showStatus('error', `Health check failed: ${error.message}`);
  }
}

// Initialize the application
async function initializeApp() {
  try {
    console.info('[App] Initializing FPL ÖREBRO application...');
    // Render first, then health checks
    let step = 'render';
    try {
      await loadTablesViewUsingAggregates();
      console.info('[App] Rendered tables and headings');
    } catch (e) {
      console.error('[INIT_FATAL]', { step, errName: e.name, errMsg: e.message, stack: e.stack });
      showStatus('error', 'Application initialization failed', { details: e.message });
    }

    step = 'health_checks';
    try {
      await runHealthChecks();
      console.info('[App] Health checks completed');
    } catch (e) {
      console.error('[INIT_WARN]', { step, errName: e.name, errMsg: e.message, stack: e.stack });
      // Do not block the app; banner already shown by runHealthChecks
    }

    console.info('[App] Application initialized successfully');
  } catch (error) {
    console.error('[INIT_FATAL]', { step: 'top-level', errName: error.name, errMsg: error.message, stack: error.stack });
    showStatus('error', 'Application initialization failed', { details: error.message });
  }
}

// Table rendering functions
function populateSeasonTable(rows, bootstrap) {
  console.info('[Season Table] Rendering', rows.length, 'rows');
  
  const tbody = document.getElementById('seasonTableBody') || (function(){ const el = document.createElement('tbody'); el.id = 'seasonTableBody'; const table = document.querySelector('#seasonTable table'); if (table) table.appendChild(el); return el; })();
  if (!tbody) {
    console.warn('[Season Table] Table body not found');
    return;
  }
  
  tbody.innerHTML = '';
  
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const pos = i + 1; // derive from index to avoid stale/global pos
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${pos}</td>
      <td>${r.displayName}</td>
      <td>${r.totalPoints}</td>
      <td>${r.latestGw}</td>
    `;
    tbody.appendChild(tr);
  }
  
  // Update season header using derived label if available
  const seasonTitle = document.getElementById('seasonTitle') || document.querySelector('.season-title') || (function(){ const el = document.createElement('div'); el.id = 'seasonTitle'; const header = document.querySelector('#seasonTable .table-header'); if (header) header.appendChild(el); return el; })();
  if (seasonTitle && bootstrap) {
    const label = deriveSeasonLabel(bootstrap);
    seasonTitle.textContent = label ? `Säsong ${label}` : '';
  }
}

function populateGameweekTable(rows, bootstrap, latestGw) {
  console.info('[GW Table] Rendering', rows.length, 'rows for GW', latestGw);
  
  const tbody = document.getElementById('gameweekTableBody') || (function(){ const el = document.createElement('tbody'); el.id = 'gameweekTableBody'; const table = document.querySelector('#gameweekTable table'); if (table) table.appendChild(el); return el; })();
  if (!tbody) {
    console.warn('[GW Table] Table body not found');
    return;
  }
  
  tbody.innerHTML = '';
  
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const pos = r.gwPos ?? (i + 1);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${pos}</td>
      <td>${r.displayName}</td>
      <td>${r.latestGwPoints}</td>
      <td>${r.latestGw}</td>
    `;
    tbody.appendChild(tr);
  }
  
  // Update GW header
  const gwTitle = document.getElementById('latestGwTitle') || document.getElementById('currentGameweekLabel') || document.querySelector('.gw-title') || (function(){ const el = document.createElement('div'); el.id = 'latestGwTitle'; const header = document.querySelector('#gameweekTable .table-header'); if (header) header.appendChild(el); return el; })();
  if (gwTitle) {
    gwTitle.textContent = `Gameweek ${latestGw}`;
  }
}

// Export functions for global access
window.loadTablesViewUsingAggregates = loadTablesViewUsingAggregates;
window.runHealthChecks = runHealthChecks;
window.initializeApp = initializeApp;
window.showStatus = showStatus;
window.dataUrl = dataUrl;
window.fplFetch = fplFetch;
window.populateSeasonTable = populateSeasonTable;
window.populateGameweekTable = populateGameweekTable;
// Provide an aggregate accessor so other features can reuse the same data pipeline (no duplicate fetches)
window.getAggregateRows = async function() {
  try {
    if (Array.isArray(window.__aggregateBaseRows) && window.__aggregateBaseRows.length > 0) {
      return window.__aggregateBaseRows;
    }
    // Ensure tables pipeline runs to populate aggregates
    await loadTablesViewUsingAggregates();
    return Array.isArray(window.__aggregateBaseRows) ? window.__aggregateBaseRows : [];
  } catch (_) {
    return Array.isArray(window.__aggregateBaseRows) ? window.__aggregateBaseRows : [];
  }
};
// Expose highlights renderer if modules are not used
window.__renderHighlights__ = async function(opts){
  try {
    const mod = await import('./src/highlights/index.js');
    return mod.mountHighlights(opts);
  } catch (e) {
    console.warn('[Highlights] dynamic import failed:', e?.message);
  }
};

// Auto-initialize when DOM is ready
function safeInit() {
  try {
    window.addEventListener('error',  e => console.error('[ONERROR]', e.message, e.filename, e.lineno, e.colno, e.error?.stack));
    window.addEventListener('unhandledrejection', e => console.error('[UNHANDLED]', e.reason?.message || e.reason, e.reason?.stack));
  } catch (_) {}
  // Bind nav and tab interactions regardless of data load success
  (function bindNav(){
    const SECTIONS = ['home','tables','highlights','profiles'];
    function navigateTo(key){
      const k = SECTIONS.includes(key) ? key : 'home';
      SECTIONS.forEach(s => {
        const el = document.getElementById(s) || document.getElementById(`section-${s}`);
        if (el) el.classList.toggle('active', s === k);
        if (el) el.classList.toggle('hidden', s !== k);
      });
      document.querySelectorAll('[data-nav]').forEach(a=>{
        a.classList.toggle('active', a.dataset.nav === k);
      });
      try { history.replaceState(null, '', '#'+k); } catch(_) {}
    }
    window.showSection = (k) => navigateTo(k);
    document.addEventListener('click', (e)=>{
      const a = e.target.closest('[data-nav]');
      if (!a) return;
      e.preventDefault();
      navigateTo(a.dataset.nav);
    });
    const hash = (location.hash||'').replace('#','');
    navigateTo(SECTIONS.includes(hash) ? hash : 'home');

    // Table tabs
    function activateTab(name){
      const isSeason = name === 'season';
      document.querySelectorAll('[data-tab]').forEach(a=>{
        a.classList.toggle('active', a.dataset.tab === name);
      });
      const seasonEl = document.getElementById('seasonTable');
      const gwEl = document.getElementById('gameweekTable');
      if (seasonEl) seasonEl.classList.toggle('active', isSeason);
      if (gwEl) gwEl.classList.toggle('active', !isSeason);
    }
    document.addEventListener('click', (e)=>{
      const a = e.target.closest('[data-tab]');
      if (!a) return;
      e.preventDefault();
      activateTab(a.dataset.tab);
    });
    activateTab('season');

    // Attempt to mount highlights when tables/aggregates are ready
    (async function tryMountHighlights(){
      const start = performance.now();
      // Poll briefly for getAggregateRows
      const waitFor = async (pred, timeout=2000) => {
        const t0 = performance.now();
        while (performance.now() - t0 < timeout) {
          if (pred()) return true;
          await new Promise(r => setTimeout(r, 100));
        }
        return false;
      };
      try {
        const ok = await waitFor(() => typeof window.getAggregateRows === 'function');
        if (!ok) return;
        const latestGw = await getLatestGwOnce();
        if (typeof window.__renderHighlights__ === 'function') {
          await window.__renderHighlights__({
            gw: latestGw,
            entryIds: Array.isArray(window.ENTRY_IDS) ? window.ENTRY_IDS : [],
            selectors: {
              roast: document.querySelector('#roastGrid,[data-role="roast"]') ? '#roastGrid,[data-role="roast"]' : null,
              beer: document.querySelector('#beerGrid,[data-role="beer"]') ? '#beerGrid,[data-role="beer"]' : null,
              fame: document.querySelector('#fameStats,[data-role="wall-fame"]') ? '#fameStats,[data-role="wall-fame"]' : null,
              shame: document.querySelector('#shameStats,[data-role="wall-shame"]') ? '#shameStats,[data-role="wall-shame"]' : null
            },
            context: { allowPicksInHighlights: false }
          });
          console.debug('[highlights] mount ok in', Math.round(performance.now() - start), 'ms');
        }
      } catch (e) {
        console.warn('[highlights] mount failed:', e?.message || e);
      }
    })();
  })();
  // Load manifest first (non-fatal), then initialize
  loadManifest().finally(() => { void initializeApp(); });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInit);
} else {
  safeInit();
}