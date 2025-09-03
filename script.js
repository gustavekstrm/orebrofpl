// Build information
const BUILD_SHA = '9i0j1k2'; // Current commit SHA for asset versioning
const BUILD_BANNER = `[ÖrebroFPL] build ${BUILD_SHA} – tables=aggregate-only`;

// Debug probe to identify CORS/network issues and check fallback data
async function _debugProbe() {
  const results = {
    direct: null,
    fallback: null,
    baseUrl: getBaseUrl()
  };
  
  // Test direct FPL API access
  const url = 'https://fantasy.premierleague.com/api/bootstrap-static/';
  try {
    console.log('[PROBE] Testing direct FPL API access...');
    const res = await fetch(url, { cache: 'no-store', mode: 'cors' }); // NO custom headers
    console.log('[PROBE] status=', res.status, 'acao=', res.headers.get('access-control-allow-origin'));
    const j = await res.json();
    console.log('[PROBE] ok, events len=', j?.events?.length);
    results.direct = { success: true, status: res.status, eventsCount: j?.events?.length };
  } catch (e) {
    console.error('[PROBE] bootstrap-static failed:', e?.name, e?.message, e);
    results.direct = { success: false, error: { name: e?.name, message: e?.message } };
  }
  
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
if (typeof window !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'true') {
  _debugProbe().then(result => {
    console.log('[PROBE] Result:', result);
    window.__PROBE_RESULT = result;
  });
}

// Test flags for development (dev-only, never commit defaults)
const FORCE_FALLBACK = new URLSearchParams(location.search).get('forceFallback') === 'true';
const FORCE_DIRECT = new URLSearchParams(location.search).get('forceDirect') === 'true';

if (FORCE_FALLBACK || FORCE_DIRECT) {
  console.warn(`[DEV] Test flag enabled: ${FORCE_FALLBACK ? 'FORCE_FALLBACK' : 'FORCE_DIRECT'}`);
}

// Debug GW probe for troubleshooting (debug mode only)
if (typeof window !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'true') {
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

// ---- BASE + version ----
// BUILD_SHA is already declared at the top of the file

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
  const src = (document.currentScript && document.currentScript.src) || (typeof import !== 'undefined' ? import.meta.url : null);
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

function dataUrl(relativePath) {
  // rel like 'data/bootstrap-static.json' OR `data/entry/${id}/history.json`
  return new URL(`${rel}?v=${BUILD_SHA}`, BASE).toString();
}

// Unified FPL fetch helper with bulletproof fallback and test flags
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

// Map API paths to fallback file paths
function mapApiToFallback(path) {
  if (path === '/api/bootstrap-static/') return 'data/bootstrap-static.json';
  
  const m = path.match(/^\/api\/entry\/(\d+)\/history\/$/);
  if (m) return `data/entry/${m[1]}/history.json`;
  
  throw new Error(`No fallback mapping for ${path}`);
}

// Debug mode detection (URL-based toggle)
const urlParams = new URLSearchParams(window.location.search);
const __DEBUG_MODE = urlParams.get('debug') === 'true';
window.__DEBUG_MODE = __DEBUG_MODE;

// Configuration
console.log('=== SCRIPT.JS LOADING ===');
console.info(BUILD_BANNER);
if (__DEBUG_MODE) {
    console.info('🔍 DEBUG MODE ENABLED - verbose logging and debug objects active');
}

// Ensure these functions exist (use no-op fallbacks if undefined)
window.fetchJSON = window.fetchJSON || (async () => ({}));
window.fetchAggregateSummaries = window.fetchAggregateSummaries || (async () => ({ results: [] }));
window.fetchAggregateHistory = window.fetchAggregateHistory || (async () => ({ results: [], gw: 1 }));
window.loadTablesViewUsingAggregates = window.loadTablesViewUsingAggregates || (async () => {});

// Diagnostics (dev-only)
window.__diag = async function () {
  try {
    const PROXY_ROOT = 'https://fpl-proxy-1.onrender.com';
    const API = `${PROXY_ROOT}/api`;
    
    // Get final IDs used for aggregates
    const finalIds = getKnownEntryIds();

    console.log('[DIAG] ENTRY_IDS count:', (window.ENTRY_IDS||[]).length, 
                'LEAGUE_CODE:', window.LEAGUE_CODE,
                'final ids for aggregates:', finalIds.length, finalIds.slice(0, 10));

    // bootstrap & gw
    const bj = await safeFetchBootstrap();
    const cur = (bj?.events||[]).find(e=>e.is_current) || (bj?.events||[])[0] || { id: 1 };
    const gw = cur.id || 1;

    if (finalIds.length){
      const s = await fetch(`${API}/aggregate/summary?ids=${finalIds.slice(0,25).join(',')}&__=${Date.now()}`);
      const sj = await s.json();
      const h = await fetch(`${API}/aggregate/history?ids=${finalIds.slice(0,25).join(',')}&gw=${gw}&__=${Date.now()}`);
      const hj = await h.json();
      console.log('[DIAG] agg summary:', s.status, sj?.results?.length, 'agg history:', h.status, hj?.results?.length, 'gw:', gw);
    } else {
      console.warn('[DIAG] No IDs detected — check ENTRY_IDS init or LEAGUE_CODE fallback.');
    }
  } catch (e) {
    console.error('[DIAG] failed:', e);
  }
};

const CORRECT_PASSWORD = 'fantasyorebro';
const ADMIN_PASSWORD = 'Pepsie10';
// FPL API Configuration - Using Render Proxy (LIVE)
const FPL_API_BASE = 'https://fpl-proxy-1.onrender.com/api';
const FPL_PROXY_BASE = FPL_API_BASE;

// Build banner (using constant)
console.info(BUILD_BANNER);

// Dev sentinel to detect picks calls outside details
(function hookFetchForTablesGuard(){
  const orig = window.fetch;
  window.fetch = function(url, opts){
    if (typeof url === 'string' && /\/api\/.*\/picks/i.test(url)) {
      console.warn('[Sentinel] picks fetch detected outside details:', url);
    }
    return orig.apply(this, arguments);
  };
})();

// Global variables for aggregate endpoints
// window.LEAGUE_CODE and window.ENTRY_IDS are now set by participants.config.js

// Single source of truth for Entry IDs
function getKnownEntryIds() {
  const a = [];
  // Read from window.ENTRY_IDS first (from config)
  if (Array.isArray(window.ENTRY_IDS)) a.push(...window.ENTRY_IDS);
  // dedupe + numeric
  return Array.from(new Set(a.map(n => Number(n)).filter(Boolean)));
}

// Single source of truth for participant data with strict validation
function getConfiguredParticipants() {
  try {
    let participants = [];
    
    // Priority 1: LEGACY_PARTICIPANTS (if available and valid)
    if (Array.isArray(window.LEGACY_PARTICIPANTS) && window.LEGACY_PARTICIPANTS.length > 0) {
      participants = window.LEGACY_PARTICIPANTS;
      console.log('[Config] Using LEGACY_PARTICIPANTS:', participants.length, 'entries');
    }
    // Priority 2: ENTRY_IDS + PARTICIPANT_OVERRIDES
    else if (Array.isArray(window.ENTRY_IDS) && window.ENTRY_IDS.length > 0) {
      const overrides = window.PARTICIPANT_OVERRIDES || {};
      participants = window.ENTRY_IDS.map(id => ({
        fplId: id,
        entryId: id,
        namn: overrides[id]?.displayName || `Manager ${id}`,
        displayName: overrides[id]?.displayName || `Manager ${id}`,
        teamName: overrides[id]?.teamName || '',
        totalPoäng: 0, // Will be populated from API
        favoritlag: '',
        profilRoast: 'Ny deltagare - välkommen!',
        image: generateAvatarDataURL(overrides[id]?.displayName?.charAt(0) || 'M'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
      }));
      console.log('[Config] Using ENTRY_IDS + overrides:', participants.length, 'entries');
    }
    // Priority 3: Check localStorage (but only merge valid entries)
    else {
      try {
        const savedData = localStorage.getItem('fplParticipantsData');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            // Only include entries with valid entryId
            const validSaved = parsedData.filter(p => {
              const entryId = coerceEntryId(p);
              return Number.isFinite(entryId) && entryId > 0;
            });
            
            if (validSaved.length > 0) {
              participants = validSaved;
              console.log('[Config] Using localStorage (filtered):', validSaved.length, 'valid of', parsedData.length, 'total');
              
              // Log invalid entries for admin to fix
              const invalidSaved = parsedData.filter(p => {
                const entryId = coerceEntryId(p);
                return !Number.isFinite(entryId) || entryId <= 0;
              });
              if (invalidSaved.length > 0) {
                console.warn('[Config] Invalid localStorage entries (ignored):', 
                  invalidSaved.map(p => ({ name: p.namn || p.displayName, rawId: p.fplId || p.entryId || p.id })));
              }
            }
          }
        }
      } catch (localStorageError) {
        console.warn('[Config] localStorage error (ignored):', localStorageError);
      }
    }
    
    if (participants.length === 0) {
      throw new Error("No participants found in any source (LEGACY_PARTICIPANTS / ENTRY_IDS / localStorage)");
    }
    
    // Normalize and validate all participants
    const normalized = participants.map(normalizeParticipant);
    const validParticipants = normalized.filter(p => p.hasValidId);
    
    if (validParticipants.length === 0) {
      throw new Error(`No participants with valid entryId found (${normalized.length} total, 0 valid)`);
    }
    
    console.log('[Config] Participants resolved:', validParticipants.length, 'valid of', normalized.length, 'total');
    
    // Log invalid entries for admin to fix
    const invalidParticipants = normalized.filter(p => !p.hasValidId);
    if (invalidParticipants.length > 0) {
      console.warn('[Config] Invalid participants (will be excluded):', 
        invalidParticipants.map(p => ({ 
          name: p.displayName, 
          rawId: p.raw?.fplId || p.raw?.entryId || p.raw?.id,
          normalizedId: p.entryId 
        })));
    }
    
    return validParticipants;
    
  } catch (error) {
    // Explicit error classification
    if (error instanceof ReferenceError) {
      console.error('[Config] ReferenceError in participant resolution:', error);
      throw new Error('Configuration error: Missing required global variables');
    } else if (error instanceof TypeError) {
      console.error('[Config] TypeError in participant resolution:', error);
      throw new Error('Configuration error: Invalid data types in configuration');
    } else {
      console.error('[Config] Error in participant resolution:', error);
      throw error; // Re-throw as-is
    }
  }
}

// Coerce entryId from various key variants
function coerceEntryId(p) {
  const candidates = [
    p.entryId, p.entry_id, p.id, p.fplId, p.fpl_id, p.entry,
    p.fpl_id, p.entry_id, p.manager_id, p.managerId
  ];
  
  const n = candidates
    .map(v => (typeof v === 'string' ? parseInt(v, 10) : v))
    .find(v => Number.isInteger(v) && v > 0);
  
  return n ?? NaN;
}

// Normalize participant data to consistent format with strict validation
function normalizeParticipant(p) {
  const entryId = coerceEntryId(p);
  
  // Validate entryId is numeric and positive
  if (!Number.isFinite(entryId) || entryId <= 0) {
    console.warn('[Normalize] Invalid entryId for participant:', p, 'entryId:', entryId);
  }
  
  return {
    fplId: entryId,
    entryId: entryId, // Add explicit entryId field for consistency
    displayName: p.displayName ?? p.namn ?? p.name ?? p.entry_name ?? `Manager ${entryId}`,
    teamName: p.teamName ?? p.team_name ?? p.favoritlag ?? '',
    totalPoäng: p.totalPoäng ?? p.totalPoints ?? 0,
    favoritlag: p.favoritlag ?? p.teamName ?? '',
    profilRoast: p.profilRoast ?? 'Ny deltagare - välkommen!',
    image: p.image || generateAvatarDataURL((p.displayName || p.namn || 'M').charAt(0)),
    lastSeasonRank: p.lastSeasonRank ?? 'N/A',
    bestGameweek: p.bestGameweek ?? 0,
    hasValidId: Number.isFinite(entryId) && entryId > 0,
    raw: p, // Keep raw data for debugging
    ...p,
  };
}

// Helper function to apply participant overrides
function applyParticipantOverride(id, fromSummary = {}) {
  const o = (window.PARTICIPANT_OVERRIDES && window.PARTICIPANT_OVERRIDES[id]) || {};
  const first = fromSummary?.player_first_name || '';
  const last  = fromSummary?.player_last_name  || '';
  const displayNameFromAPI = (first || last) ? `${first} ${last}`.trim() : '';
  return {
    displayName: o.displayName || displayNameFromAPI || `Manager ${id}`,
    teamName:    o.teamName    || fromSummary?.name || '',
  };
}

// Helper to extract GW points from history
function deriveGwPointsFromHistory(historyData, gw) {
  // Handle different history data structures from API
  if (historyData?.points !== undefined) {
    // Direct points from aggregate/history endpoint
    return Number(historyData.points) || 0;
  }
  
  if (Array.isArray(historyData?.current)) {
    // Full history data from entry/history endpoint
    const row = historyData.current.find(x => Number(x?.event) === Number(gw));
    return Number(row?.points) || 0;
  }
  
  if (historyData?.raw) {
    // Raw row data from aggregate/history endpoint
    return Number(historyData.raw?.points) || 0;
  }
  
  return 0;
}

// Helper to compute total points from summary and history
function deriveTotalPoints(summaryApi, historyApi) {
  // Support multiple field names seen in different payloads
  const candidates = [
    summaryApi?.summary_overall_points,
    summaryApi?.overall_points,
    summaryApi?.summary?.overall_points,
    summaryApi?.summary?.total_points,
    // From history if summary doesn't have it
    historyApi?.current?.length ? historyApi.current[historyApi.current.length-1]?.overall_points : null,
  ].map(Number);
  
  const val = candidates.find(n => Number.isFinite(n) && n > 0);
  return Number.isFinite(val) ? val : 0;
}

// Helper to compute season label
function computeSeasonLabel() {
  // Use bootstrap->events or fallback to calendar
  const now = new Date();
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1; // Jul–Jun cycle
  return `${y}/${(y+1).toString().slice(-2)}`;
}

// Helper to resolve current GW from bootstrap or FORCE_GW
async function resolveCurrentGW() {
  if (typeof FORCE_GW === 'number' && FORCE_GW > 0) {
    return FORCE_GW;
  }
  
  try {
    // Use the robust GW resolver as single source of truth
    return await resolveLatestFinishedGw();
  } catch (e) {
    console.error('[GW] Failed to resolve current GW:', e);
    throw new Error(`Gameweek resolution failed: ${e.message}`);
  }
}

// Helper to resolve current season from bootstrap
async function resolveCurrentSeason() {
  try {
    const bootstrap = await safeFetchBootstrap();
    const events = bootstrap?.events || [];
    
    if (!events || events.length === 0) {
      throw new Error('No events found in bootstrap data');
    }
    
    // Get season from first event (should be consistent across all events)
    const firstEvent = events[0];
    if (firstEvent?.season_name) {
      console.log('[Season] Resolved season:', firstEvent.season_name);
      return firstEvent.season_name;
    }
    
    // Fallback: compute from current date and event deadlines
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1; // 0-indexed
    
    // FPL season typically starts in August (month 8)
    if (month >= 8) {
      const season = `${currentYear}/${(currentYear + 1).toString().slice(-2)}`;
      console.log('[Season] Computed season from date:', season);
      return season;
    } else {
      const season = `${currentYear - 1}/${currentYear.toString().slice(-2)}`;
      console.log('[Season] Computed season from date:', season);
      return season;
    }
  } catch (e) {
    console.error('[Season] Failed to resolve current season:', e);
    throw new Error(`Season resolution failed: ${e.message}`);
  }
}

// Safe picks response normalizer
function normalizePicksResponse(rec){
  const data = rec?.data || rec || {};
  return {
    entry_history: data.entry_history || null,
    picks: Array.isArray(data.picks) ? data.picks : [],
  };
}

// Helper function to update ENTRY_IDS (legacy - now handled by config)
function updateEntryIds() {
    // This function is kept for backward compatibility but ENTRY_IDS are now managed by participants.config.js
    console.log('updateEntryIds called - ENTRY_IDS are now managed by participants.config.js');
}

// Always use proxy to avoid CORS issues
const USE_PROXY = true;
const LEAGUE_CODE = '46mnf2';

// Global flag to disable API calls for local development
const DISABLE_API_CALLS = false; // API enabled for deployment // Set to true for local development due to CORS, false when deployed

// Throttling knobs (tweak here if FPL tightens WAF)
const PICKS_CONCURRENCY = 3;           // was 4 - tightened for interactive routes
const PICKS_PACING_MIN_MS = 200;        // was 120 - increased for less pressure
const PICKS_PACING_MAX_MS = 400;        // was 240 - increased for less pressure

// Tables must not fetch /picks/ - hard switch
const EAGER_FETCH_PICKS_FOR_TABLES = false; // DO NOT change design; just disable picks for tables
const EAGER_FETCH_PICKS = false; // must remain false in production
const SHOW_PICKS_TOOLTIP_IN_TABLES = false;
const ALLOW_PICKS_IN_TABLES = false;

// Debug flag for FPL API logging
const DEBUG_FPL = false; // set true only when debugging

// GW handling flexibility
const FORCE_GW = null; // sätt till t.ex. 1 om du alltid vill visa GW1

// ---- Circuit Breaker for /picks ----
const PICKS_CIRCUIT = {
  WINDOW_MS: 30_000,     // sliding window to count failures
  THRESHOLD: 8,          // trip after 8 failures within window
  COOLDOWN_MS: 120_000,  // keep circuit open for 2 minutes
  windowStart: 0,
  failCount: 0,
  openUntil: 0
};

function picksCircuitIsOpen() {
  return Date.now() < PICKS_CIRCUIT.openUntil;
}

function recordPicksFailure() {
  const now = Date.now();
  if (now - PICKS_CIRCUIT.windowStart > PICKS_CIRCUIT.WINDOW_MS) {
    PICKS_CIRCUIT.windowStart = now;
    PICKS_CIRCUIT.failCount = 1;
  } else {
    PICKS_CIRCUIT.failCount++;
  }
  if (PICKS_CIRCUIT.failCount >= PICKS_CIRCUIT.THRESHOLD) {
    PICKS_CIRCUIT.openUntil = now + PICKS_CIRCUIT.COOLDOWN_MS;
    // reset window for the next period
    PICKS_CIRCUIT.windowStart = now;
    PICKS_CIRCUIT.failCount = 0;
    if (typeof DEBUG_FPL !== 'undefined' && DEBUG_FPL) {
      console.info(`[PICKS] Circuit OPEN for ${PICKS_CIRCUIT.COOLDOWN_MS/1000}s`);
    }
  }
}

function recordPicksSuccess() {
  // on success, gently recover by clearing counters
  PICKS_CIRCUIT.windowStart = Date.now();
  PICKS_CIRCUIT.failCount = 0;
}

// --- Picks cache & in-flight deduper ---
const PICKS_TTL_MS = 5 * 60 * 1000; // 5 min
const picksCache = new Map(); // key -> { ts, status: 'ok'|'blocked'|'error', data?, history? }
const picksInFlight = new Map(); // key -> Promise
const PICKS_SS_KEY = 'fpl_picks_cache_v1';

function picksKey(entryId, gw) { return `${entryId}:${gw}`; }

function logPicksBlocked(entryId, err) {
  if (DEBUG_FPL) console.info(`Picks blocked for ${entryId}: ${err}`);
}

function markBlockedRow(rowEl, entryId) {
  if (!rowEl) return;
  rowEl.dataset.picksStatus = 'blocked';                 // ev. framtida logik
  // Sätt bara title så användaren får en hover-hint, ingen layout påverkas
  rowEl.title = `Picks är inte tillgängliga för ${entryId} (privat/403). Poäng visas från history.`;
}

function loadPicksCacheFromSession() {
  try {
    const raw = sessionStorage.getItem(PICKS_SS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    const now = Date.now();
    for (const [key, rec] of Object.entries(obj)) {
      if (now - rec.ts < PICKS_TTL_MS) picksCache.set(key, rec);
    }
  } catch {}
}

function savePicksCacheToSession() {
  try {
    const obj = {};
    const now = Date.now();
    for (const [key, rec] of picksCache.entries()) {
      if (now - rec.ts < PICKS_TTL_MS) obj[key] = rec;
    }
    sessionStorage.setItem(PICKS_SS_KEY, JSON.stringify(obj));
  } catch {}
}

// Load cache from session on startup
loadPicksCacheFromSession();

function onIdle(cb, timeout=1200) {
  const rif = window.requestIdleCallback || ((fn) => setTimeout(fn, timeout));
  rif(cb, { timeout });
}

function prefetchSomeDetails(entryIds, gw, max=4) {
  if (!EAGER_FETCH_PICKS) {
    console.info('[Prefetch] Disabled by EAGER_FETCH_PICKS flag');
    return;
  }
  
  const subset = entryIds.slice(0, max);
  onIdle(async () => {
    for (const id of subset) {
      try {
        await getPicksCached(id, gw);     // använder cache + fallback + throttling
        await new Promise(r => setTimeout(r, 200 + Math.random()*300));
      } catch {}
    }
  });
}

async function getPicksCached(entryId, gw, {context='details'} = {}) {
  if (context !== 'details' && !ALLOW_PICKS_IN_TABLES) {
    console.warn('[Block] picks call blocked in context:', context);
    return { status: 'blocked', data: null, history: null };
  }
  
  const key = picksKey(entryId, gw);
  const now = Date.now();

  // Serve fresh cache
  const cached = picksCache.get(key);
  if (cached && (now - cached.ts) < PICKS_TTL_MS) return cached;

  // Coalesce concurrent callers
  const inflight = picksInFlight.get(key);
  if (inflight) return inflight;

  // Actual fetch with fallback to /history/
  const p = (async () => {
    try {
      const data = await fetchPicks(entryId, gw); // your existing retrying helper
      const rec = { ts: Date.now(), status: 'ok', data };
      picksCache.set(key, rec);
      savePicksCacheToSession();
      return rec;
    } catch (e) {
      // Circuit open or real 403/429/5xx → graceful fallback to history
      if (typeof DEBUG_FPL !== 'undefined' && DEBUG_FPL) {
        if (e?.code === 'CIRCUIT_OPEN') {
          console.info(`[PICKS] Circuit open, using history for ${entryId} GW${gw}`);
        } else {
          console.info(`[PICKS] Fallback to history for ${entryId} GW${gw}: ${String(e)}`);
        }
      }
      let history = null;
      try { history = await fetchHistory(entryId); } catch {}
      const rec = { ts: Date.now(), status: 'blocked', history, error: String(e) };
      picksCache.set(key, rec);
      savePicksCacheToSession();
      return rec;
    } finally {
      picksInFlight.delete(key);
    }
  })();

  picksInFlight.set(key, p);
  return p;
}

async function ensurePicksForDetail(entryId, gw) {
  const rec = await getPicksCached(entryId, gw);
  if (rec.status === 'ok') {
    // render captain/bench/formation from rec.data
    return { success: true, data: rec.data };
  } else {
    // render points from rec.history (if available), and show "-" for captain/bench
    return { success: false, history: rec.history, error: rec.error };
  }
}

// --- Retry helper with backoff + jitter ---
async function fetchWithRetry(url, init = {}, tries = 3, baseDelayMs = 700) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      lastErr = new Error(`HTTP error! status: ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    const jitter = Math.floor(Math.random() * 300);
    await new Promise(r => setTimeout(r, baseDelayMs * (i + 1) + jitter));
  }
  throw lastErr;
}

// --- Small worker pool to limit parallel requests ---
async function mapPool(items, mapper, concurrency = PICKS_CONCURRENCY) {
  const out = new Array(items.length);
  let idx = 0;
  async function worker() {
    for (;;) {
      const i = idx++;
      if (i >= items.length) break;
      try { out[i] = await mapper(items[i], i); }
      catch (e) { out[i] = { error: e }; }
      // pacing between requests
      const delay = Math.floor(Math.random() * (PICKS_PACING_MAX_MS - PICKS_PACING_MIN_MS + 1)) + PICKS_PACING_MIN_MS;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

// Global data storage
let isLoggedIn = false;
let isAdminAuthenticated = false;
let currentGameweek = 1; // Start with GW1 for new season
let leagueData = {
    seasonTable: [],
    gameweekTable: [],
    highlights: {
        rocket: '',
        flop: '',
        captain: '',
        bench: ''
    },
    players: []
};
let bootstrapData = {};

// Prize Chart Variables
let prizeChart = null;
let prizeTotal = 4200; // Default prize total
let roastsExpanded = false; // Global state for roast expansion toggle

// Modular participant data - easy to edit manually
// TODO: After Gameweek 1, replace with FPL API integration using fplId
// 
// FPL API Integration Plan:
// 1. When fplId is set for a participant, fetch real data from:
//    - /entry/{fplId}/ (current season stats)
//    - /entry/{fplId}/history/ (historical data, best GW, last season rank)
// 2. Replace mock values with live data:
//    - totalPoäng: from current season total
//    - lastSeasonRank: from history data
//    - bestGameweek: calculated from historical gameweek points
// 3. Dynamic binding: when new players join and get linked to FPL ID,
//    their profile auto-updates with real stats
// Helper function to generate data URL for participant avatars
function generateAvatarDataURL(initial) {
    const svg = `<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="60" height="60" fill="#1e293b"/>
        <text x="30" y="35" font-family="Arial, sans-serif" font-size="24" fill="#06b6d4" text-anchor="middle" dy=".3em">${initial}</text>
    </svg>`;
    try {
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    } catch (error) {
        console.error('Error generating avatar URL:', error);
        // Fallback to a simple colored div
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMWUyOTNiIi8+Cjx0ZXh0IHg9IjMwIiB5PSIzNSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjMDZiNmQ0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+WDwvdGV4dD4KPC9zdmc+';
    }
}

// 4. Legacy: Renamed to LEGACY_PARTICIPANTS - DO NOT USE (ENTRY_IDS + PARTICIPANT_OVERRIDES from config are single source of truth)
const LEGACY_PARTICIPANTS = [
    {
        namn: 'Melvin Yuksel',
        totalPoäng: 2456,
        favoritlag: 'Sunderland',
        fplId: 1490173, // Real FPL ID
        profilRoast: 'Har haft fler minuspoäng än rena lakan den här säsongen.',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 12,
        bestGameweek: 98
    },
    {
        namn: 'Jakob Gårlin',
        totalPoäng: 2412,
        favoritlag: 'Liverpool',
        fplId: 1450793, // Real FPL ID
        profilRoast: 'Enda som är sämre än din kaptensval är din senaste bortamatch.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 8,
        bestGameweek: 87
    },
    {
        namn: 'Joel A-Segerlind',
        totalPoäng: 2389,
        favoritlag: 'Arsenal',
        fplId: 133147, // Real FPL ID
        profilRoast: 'Din transferstrategi liknar en blindfolded dart game.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 15,
        bestGameweek: 92
    },
    {
        namn: 'Viggo Svedin',
        totalPoäng: 2356,
        favoritlag: 'Chelsea',
        fplId: 8759848, // Real FPL ID
        profilRoast: 'Bench boost på GW1? Bara du som kan komma på det.',
        image: generateAvatarDataURL('V'),
        lastSeasonRank: 22,
        bestGameweek: 85
    },
    {
        namn: 'Julius Höglund',
        totalPoäng: 2321,
        favoritlag: 'Manchester City',
        fplId: 2703061, // Real FPL ID
        profilRoast: 'Flest flaskor bubbel - förutom när det gäller kaptensval.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 5,
        bestGameweek: 89
    },
    {
        namn: 'Erik Rotsenius',
        totalPoäng: 2289,
        favoritlag: 'Tottenham',
        fplId: 2269283, // Real FPL ID
        profilRoast: 'Kaptenkaos är ditt mellannamn.',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 18,
        bestGameweek: 76
    },
    {
        namn: 'William Kuyumcu',
        totalPoäng: 2256,
        favoritlag: 'Newcastle',
        fplId: 5527279, // Real FPL ID
        profilRoast: 'Bench Boost Fuskare deluxe edition.',
        image: generateAvatarDataURL('W'),
        lastSeasonRank: 25,
        bestGameweek: 82
    },
    {
        namn: 'Axel Ekström',
        totalPoäng: 2223,
        favoritlag: 'Aston Villa',
        fplId: 4096096, // Real FPL ID
        profilRoast: 'Trigger Happy - mer transfers än poäng.',
        image: generateAvatarDataURL('A'),
        lastSeasonRank: 30,
        bestGameweek: 79
    },
    {
        namn: 'Gustav Ekström',
        totalPoäng: 2189,
        favoritlag: 'Arsenal',
        fplId: 348966, // Real FPL ID
        profilRoast: 'Bench God - men bara när du inte använder Bench Boost.',
        image: generateAvatarDataURL('G'),
        lastSeasonRank: 28,
        bestGameweek: 75
    },
    {
        namn: 'David Jansson',
        totalPoäng: 2100,
        favoritlag: 'Ipswich',
        fplId: 2884065, // Real FPL ID
        profilRoast: 'Nykomling i ligan - hoppas du klarar dig!',
        image: generateAvatarDataURL('D'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Alex Pettersson',
        totalPoäng: 2050,
        favoritlag: 'Tottenham',
        fplId: 412417, // Real FPL ID
        profilRoast: 'Spurs supporter - förklarar allt!',
        image: generateAvatarDataURL('A'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Sigge Carlsson',
        totalPoäng: 2156,
        favoritlag: 'West Ham',
        fplId: 5990179, // Real FPL ID
        profilRoast: 'Mest minuspoäng i ligan - grattis!',
        image: generateAvatarDataURL('S'),
        lastSeasonRank: 32,
        bestGameweek: 71
    },
    {
        namn: 'Johan Pauly',
        totalPoäng: 2123,
        favoritlag: 'Crystal Palace',
        fplId: 4382408, // Real FPL ID
        profilRoast: 'Veckans Sopa - en titel du verkligen förtjänar.',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 35,
        bestGameweek: 68
    },
    {
        namn: 'Filip Nieminen',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 3666480, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen till kaoset!',
        image: generateAvatarDataURL('F'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Edvin Möller',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 78175, // Real FPL ID
        profilRoast: 'Ny deltagare - hoppas du överlever!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Johan Ivarsson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1537567, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Jacob Åhlander',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 6316536, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen!',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Victor Celik',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1884529, // Real FPL ID
        profilRoast: 'Ny deltagare - kör hårt!',
        image: generateAvatarDataURL('V'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Felix Möller',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 4413902, // Real FPL ID
        profilRoast: 'Ny deltagare - spela smart!',
        image: generateAvatarDataURL('F'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Markus Rosdahl',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 4971106, // Real FPL ID
        profilRoast: 'Ny deltagare - gör ditt bästa!',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Tobias Pettersson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 5735314, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('T'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Robin Damström',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 908791, // Real FPL ID
        profilRoast: 'Ny deltagare - kör på!',
        image: generateAvatarDataURL('R'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'David Alfredsson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 547800, // Real FPL ID
        profilRoast: 'Ny deltagare - spela klokt!',
        image: generateAvatarDataURL('D'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Karl Weckström',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 4294348, // Real FPL ID
        profilRoast: 'Ny deltagare - gör det bra!',
        image: generateAvatarDataURL('K'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Oliver S',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 8456844, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen!',
        image: generateAvatarDataURL('O'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Nisse Karlsson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 3017284, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('N'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Enis Krivdic',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 6176435, // Real FPL ID
        profilRoast: 'Ny deltagare - kör hårt!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Sebbe Sundkvist',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 35100, // Real FPL ID
        profilRoast: 'Ny deltagare - spela smart!',
        image: generateAvatarDataURL('S'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Leo Vasikisson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1435536, // Real FPL ID
        profilRoast: 'Ny deltagare - gör ditt bästa!',
        image: generateAvatarDataURL('L'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Gustaf Jorman Bergholm',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 6069375, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('G'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Alex Bowern',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 542217, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen!',
        image: generateAvatarDataURL('A'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'David Ivarsson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 2563309, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('D'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Elton Vallberg',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 8779490, // Real FPL ID
        profilRoast: 'Ny deltagare - kör hårt!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Noah Freij',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 141529, // Real FPL ID
        profilRoast: 'Ny deltagare - spela smart!',
        image: generateAvatarDataURL('N'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'WIlgot Rydborg',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 5378419, // Real FPL ID
        profilRoast: 'Ny deltagare - gör ditt bästa!',
        image: generateAvatarDataURL('W'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Edvin Mårtensson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1146757, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Hugo Sundquist',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 990189, // Real FPL ID
        profilRoast: 'Ny deltagare - kör på!',
        image: generateAvatarDataURL('H'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Kevin Schultze',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 2009407, // Real FPL ID
        profilRoast: 'Ny deltagare - spela klokt!',
        image: generateAvatarDataURL('K'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Adrian Torabi',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 2162629, // Real FPL ID
        profilRoast: 'Ny deltagare - gör det bra!',
        image: generateAvatarDataURL('A'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Elias Sundh',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1289520, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Dimitris Bakalokos',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 5746665, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('D'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Hugo Nilsson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 7634954, // Real FPL ID
        profilRoast: 'Ny deltagare - kör hårt!',
        image: generateAvatarDataURL('H'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Emil Vide',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 6001484, // Real FPL ID
        profilRoast: 'Ny deltagare - spela smart!',
        image: generateAvatarDataURL('E'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Max Rotschild Lundin',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1084577, // Real FPL ID
        profilRoast: 'Ny deltagare - gör ditt bästa!',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Melker Johansson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 190340, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'macsnizz Victor',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 1989237, // Real FPL ID
        profilRoast: 'Ny deltagare - kör på!',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Teodor Tjernberg',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 9180666, // Real FPL ID
        profilRoast: 'Ny deltagare - spela klokt!',
        image: generateAvatarDataURL('T'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Simon Edberger Persson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 759543, // Real FPL ID
        profilRoast: 'Ny deltagare - gör det bra!',
        image: generateAvatarDataURL('S'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Juan Pedersson',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 3030499, // Real FPL ID
        profilRoast: 'Ny deltagare - välkommen!',
        image: generateAvatarDataURL('J'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Wilmer Bremvik',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 3652477, // Real FPL ID
        profilRoast: 'Ny deltagare - lycka till!',
        image: generateAvatarDataURL('W'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    },
    {
        namn: 'Malte L',
        totalPoäng: 2000,
        favoritlag: '',
        fplId: 9340368, // Real FPL ID
        profilRoast: 'Ny deltagare - kör hårt!',
        image: generateAvatarDataURL('M'),
        lastSeasonRank: 'N/A',
        bestGameweek: 0
    }
];

// Legacy participants data - DO NOT USE (ENTRY_IDS + PARTICIPANT_OVERRIDES from config are single source of truth)

// Bootstrap data cache

// FPL API Integration for individual participants
async function fetchParticipantFPLData(participant) {
    // Disabled for local development to avoid CORS issues
    console.log(`API calls disabled for local development. Using mock data for ${participant.namn}`);
    return participant;
    
    /* 
    // API calls disabled for local development due to CORS restrictions
    // Uncomment when deployed to a proper server
    if (!participant.fplId) {
        console.log(`No FPL ID for ${participant.namn}, using mock data`);
        return participant;
    }
    
    try {
        // Fetch current season data
        const currentResponse = await fetch(`${FPL_PROXY_BASE}/entry/${participant.fplId}/`);
        const currentData = await currentResponse.json();
        
        // Fetch historical data
        const historyResponse = await fetch(`${FPL_PROXY_BASE}/entry/${participant.fplId}/history/`);
        const historyData = await historyResponse.json();
        
        // Update participant with real data
        const updatedParticipant = {
            ...participant,
            totalPoäng: currentData.summary_overall_points || participant.totalPoäng,
            lastSeasonRank: historyData.past?.find(p => p.season_name === '2023/24')?.rank || participant.lastSeasonRank,
            bestGameweek: Math.max(...historyData.current?.map(gw => gw.points) || [participant.bestGameweek])
        };
        
        console.log(`Updated ${participant.namn} with real FPL data`);
        return updatedParticipant;
        
    } catch (error) {
        console.error(`Error fetching FPL data for ${participant.namn}:`, error);
        return participant; // Return original data on error
    }
    */
}

// Function to update all participants with FPL data
async function updateParticipantsWithFPLData() {
    console.log('Updating participants with FPL data...');
    
    const updatedParticipants = [];
    const participants = getConfiguredParticipants().map(normalizeParticipant);
    for (const participant of participants) {
        const updated = await fetchParticipantFPLData(participant);
        updatedParticipants.push(updated);
    }
    
    // Update the global participantsData array
            LEGACY_PARTICIPANTS.length = 0;
        LEGACY_PARTICIPANTS.push(...updatedParticipants);
    
    // Regenerate league data
    useFallbackData();
    
    // Update UI
    populateProfiles();
    populateTables();
    updateHighlightsFromData();
}

// Admin Panel Functions
function showAdminPasswordPrompt() {
    console.log('showAdminPasswordPrompt called');
    console.log('ADMIN_PASSWORD:', ADMIN_PASSWORD);
    
    try {
        const password = prompt('Ange adminlösenord:');
        console.log('Password entered:', password ? '***' : 'null');
        
        if (password === ADMIN_PASSWORD) {
            isAdminAuthenticated = true;
            console.log('Admin authentication successful');
            showAdminPanel();
        } else if (password !== null) {
            console.log('Admin authentication failed - wrong password');
            alert('Felaktigt lösenord!');
        } else {
            console.log('Admin authentication cancelled');
        }
    } catch (error) {
        console.error('Error in showAdminPasswordPrompt:', error);
        alert('Fel vid admin-inloggning: ' + error.message);
    }
}

function showAdminPanel() {
    if (!isAdminAuthenticated) {
        console.log('Admin panel requested but not authenticated');
        showAdminPasswordPrompt();
        return;
    }
    
    console.log('Showing admin panel');
    const adminModal = document.getElementById('adminModal');
    adminModal.classList.add('show');
    populateAdminParticipantsList();
    
    // Show prize total input for admin
    showPrizeTotalInput();
}

function hideAdminPanel() {
    const adminModal = document.getElementById('adminModal');
    adminModal.classList.remove('show');
    hideAddParticipantForm();
    
    // Hide prize total input when admin panel is closed
    hidePrizeTotalInput();
}

function populateAdminParticipantsList() {
    const adminList = document.getElementById('adminParticipantsList');
    if (!adminList) return;
    
    adminList.innerHTML = '';
    
    // Update current prize total display
    const currentPrizeTotal = document.getElementById('currentPrizeTotal');
    if (currentPrizeTotal) {
        currentPrizeTotal.textContent = prizeTotal;
    }
    
    const participants = getConfiguredParticipants().map(normalizeParticipant);
    participants.forEach((participant, index) => {
        const card = document.createElement('div');
        card.className = 'admin-participant-card';
        
        // Add warning classes for missing data
        if (!participant.fplId) {
            card.classList.add('warning');
        }
        if (!participant.profilRoast || participant.profilRoast.trim() === '') {
            card.classList.add('error');
        }
        
        card.innerHTML = `
            <div class="admin-participant-header">
                <h3 class="admin-participant-name">${participant.namn}</h3>
                <div class="admin-participant-actions">
                    <button class="admin-btn primary" onclick="saveParticipantChanges(${index})">
                        <i class="fas fa-save"></i> Spara
                    </button>
                    <button class="admin-btn secondary" onclick="deleteParticipant(${index})">
                        <i class="fas fa-trash"></i> Ta bort
                    </button>
                </div>
            </div>
            <div class="admin-participant-fields">
                <div class="admin-field">
                    <label>Namn:</label>
                    <input type="text" value="${participant.namn}" onchange="updateParticipantField(${index}, 'namn', this.value)">
                </div>
                <div class="admin-field">
                    <label>Favoritlag:</label>
                    <input type="text" value="${participant.favoritlag}" onchange="updateParticipantField(${index}, 'favoritlag', this.value)">
                </div>
                <div class="admin-field">
                    <label>FPL ID:</label>
                    <input type="number" value="${participant.fplId || ''}" placeholder="Lämna tomt om okänt" onchange="updateParticipantField(${index}, 'fplId', this.value ? parseInt(this.value) : null)">
                </div>
                <div class="admin-field">
                    <label>Profilroast:</label>
                    <textarea onchange="updateParticipantField(${index}, 'profilRoast', this.value)" placeholder="En rolig kommentar om deltagaren...">${participant.profilRoast || ''}</textarea>
                </div>
                <div class="admin-field">
                    <label>Profilbild URL:</label>
                    <input type="url" value="${participant.image || ''}" placeholder="https://..." onchange="updateParticipantField(${index}, 'image', this.value)">
                </div>
                <div class="admin-field">
                    <label>Totala poäng:</label>
                    <input type="number" value="${participant.totalPoäng}" onchange="updateParticipantField(${index}, 'totalPoäng', parseInt(this.value))">
                </div>
                <div class="admin-field">
                    <label>Förra årets placering:</label>
                    <input type="number" value="${participant.lastSeasonRank}" onchange="updateParticipantField(${index}, 'lastSeasonRank', parseInt(this.value))">
                </div>
                <div class="admin-field">
                    <label>Bästa GW någonsin:</label>
                    <input type="number" value="${participant.bestGameweek}" onchange="updateParticipantField(${index}, 'bestGameweek', parseInt(this.value))">
                </div>
            </div>
        `;
        
        adminList.appendChild(card);
    });
}

function updateParticipantField(index, field, value) {
    if (index >= 0 && index < LEGACY_PARTICIPANTS.length) {
        LEGACY_PARTICIPANTS[index][field] = value;
        
        // Update the card styling based on new values
        const card = document.querySelector(`#adminParticipantsList .admin-participant-card:nth-child(${index + 1})`);
        if (card) {
            card.classList.remove('warning', 'error');
            
            if (!LEGACY_PARTICIPANTS[index].fplId) {
                card.classList.add('warning');
            }
            if (!LEGACY_PARTICIPANTS[index].profilRoast || LEGACY_PARTICIPANTS[index].profilRoast.trim() === '') {
                card.classList.add('error');
            }
        }
    }
}

function saveParticipantChanges(index) {
    if (index >= 0 && index < LEGACY_PARTICIPANTS.length) {
        // Update ENTRY_IDS for aggregate endpoints
        updateEntryIds();
        
        // Save to localStorage immediately
        try {
            localStorage.setItem('fplParticipantsData', JSON.stringify(LEGACY_PARTICIPANTS));
            
            // Show save confirmation
            const saveButton = document.querySelector(`[onclick="saveParticipantChanges(${index})"]`);
            if (saveButton) {
                const originalText = saveButton.textContent;
                saveButton.textContent = 'Ändringar sparade!';
                saveButton.style.background = '#10b981';
                setTimeout(() => {
                    saveButton.textContent = originalText;
                    saveButton.style.background = '';
                }, 2000);
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            alert('Kunde inte spara ändringar. Försök igen.');
            return;
        }
        
        // Regenerate league data with updated participants
        useFallbackData();
        
        // Update UI
        populateProfiles();
        populateTables();
        updateHighlightsFromData();
    }
}

function deleteParticipant(index) {
    if (confirm(`Är du säker på att du vill ta bort ${LEGACY_PARTICIPANTS[index].namn}?`)) {
        LEGACY_PARTICIPANTS.splice(index, 1);
        
        // Update ENTRY_IDS for aggregate endpoints
        updateEntryIds();
        
        // Save to localStorage immediately
        try {
            localStorage.setItem('fplParticipantsData', JSON.stringify(LEGACY_PARTICIPANTS));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            alert('Kunde inte spara ändringar. Försök igen.');
            return;
        }
        
        populateAdminParticipantsList();
        
        // Regenerate league data
        useFallbackData();
        
        // Update UI
        populateProfiles();
        populateTables();
        updateHighlightsFromData();
        
        alert('Deltagare borttagen!');
    }
}

function showAddParticipantForm() {
    const form = document.getElementById('addParticipantForm');
    form.classList.remove('hidden');
    
    // Clear form fields
    document.getElementById('newName').value = '';
    document.getElementById('newTeam').value = '';
    document.getElementById('newFplId').value = '';
    document.getElementById('newRoast').value = '';
    document.getElementById('newImage').value = '';
}

function hideAddParticipantForm() {
    const form = document.getElementById('addParticipantForm');
    form.classList.add('hidden');
}

function addNewParticipant(event) {
    event.preventDefault();
    
    const name = document.getElementById('newName').value.trim();
    const team = document.getElementById('newTeam').value.trim();
    const fplIdInput = document.getElementById('newFplId').value.trim();
    const roast = document.getElementById('newRoast').value.trim();
    const image = document.getElementById('newImage').value.trim();
    
    // Validate required fields
    if (!name || !team) {
        alert('Namn och favoritlag är obligatoriska!');
        return;
    }
    
    // Validate FPL ID is required and numeric
    if (!fplIdInput) {
        alert('FPL ID är obligatoriskt för att visa data i tabellerna!');
        document.getElementById('newFplId').focus();
        return;
    }
    
    const fplId = parseInt(fplIdInput);
    if (!Number.isInteger(fplId) || fplId <= 0) {
        alert('FPL ID måste vara ett positivt heltal!');
        document.getElementById('newFplId').focus();
        return;
    }
    
    const newParticipant = {
        namn: name,
        totalPoäng: 2000, // Default starting points
        favoritlag: team,
        fplId: fplId,
        entryId: fplId, // Ensure entryId is set
        profilRoast: roast || '',
        image: image || generateAvatarDataURL(name.charAt(0)),
        lastSeasonRank: 50, // Default rank
        bestGameweek: 60 // Default best GW
    };
    
    // Add to LEGACY_PARTICIPANTS instead of participantsData
    if (Array.isArray(window.LEGACY_PARTICIPANTS)) {
        window.LEGACY_PARTICIPANTS.push(newParticipant);
    }
    
    // Update ENTRY_IDS for aggregate endpoints
    updateEntryIds();
    
    // Save to localStorage immediately
    try {
        const participants = getConfiguredParticipants().map(normalizeParticipant);
        localStorage.setItem('fplParticipantsData', JSON.stringify(participants));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        alert('Kunde inte spara ändringar. Försök igen.');
        return;
    }
    
    // Hide form and refresh admin list
    hideAddParticipantForm();
    populateAdminParticipantsList();
    
    // Regenerate league data
    useFallbackData();
    
    // Update UI
    populateProfiles();
    populateTables();
    updateHighlightsFromData();
    
    alert('Ny deltagare tillagd!');
}

function exportParticipantsData() {
    const participants = getConfiguredParticipants().map(normalizeParticipant);
    
    // Ensure export uses entryId (number) format
    const exportData = participants.map(p => ({
        entryId: p.entryId, // Primary key
        displayName: p.displayName,
        teamName: p.teamName,
        totalPoäng: p.totalPoäng,
        favoritlag: p.favoritlag,
        profilRoast: p.profilRoast,
        image: p.image,
        lastSeasonRank: p.lastSeasonRank,
        bestGameweek: p.bestGameweek,
        // Legacy fields for backward compatibility
        fplId: p.entryId,
        namn: p.displayName
    }));
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'participants-data.json';
    link.click();
    
    URL.revokeObjectURL(url);
    alert('Data exporterad som participants-data.json med entryId som primärnyckel');
}

function saveToLocalStorage() {
    // Update ENTRY_IDS for aggregate endpoints
    updateEntryIds();
    
    try {
        const participants = getConfiguredParticipants().map(normalizeParticipant);
        localStorage.setItem('fplParticipantsData', JSON.stringify(participants));
        
        // Show save confirmation
        const saveButton = document.querySelector('[onclick="saveToLocalStorage()"]');
        if (saveButton) {
            const originalText = saveButton.textContent;
            saveButton.textContent = 'Data sparad!';
            saveButton.style.background = '#10b981';
            setTimeout(() => {
                saveButton.textContent = originalText;
                saveButton.style.background = '';
            }, 2000);
        } else {
            alert('Data sparad till localStorage!');
        }
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        alert('Kunde inte spara till localStorage. Data för stor?');
    }
}

// Load data from localStorage on page load
function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('fplParticipantsData');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            if (Array.isArray(parsedData) && parsedData.length > 0) {
                // Clear existing data and load from localStorage
                        LEGACY_PARTICIPANTS.splice(0, LEGACY_PARTICIPANTS.length, ...parsedData);
        console.log('Loaded participants data from localStorage:', LEGACY_PARTICIPANTS.length, 'participants');
                
                // Update ENTRY_IDS for aggregate endpoints
                updateEntryIds();
                
                return true; // Indicate that data was loaded
            }
        }
        console.log('No saved data found in localStorage, using default data');
        return false; // Indicate that no data was loaded
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return false;
    }
}

// Export admin functions to global scope for HTML onclick handlers
window.showAdminPanel = showAdminPanel;
window.hideAdminPanel = hideAdminPanel;
window.showAddParticipantForm = showAddParticipantForm;
window.hideAddParticipantForm = hideAddParticipantForm;
window.addNewParticipant = addNewParticipant;
window.exportParticipantsData = exportParticipantsData;
window.saveToLocalStorage = saveToLocalStorage;
window.saveParticipantChanges = saveParticipantChanges;
window.deleteParticipant = deleteParticipant;
window.updateParticipantField = updateParticipantField;
window.showPrizeTotalInput = showPrizeTotalInput;
window.hidePrizeTotalInput = hidePrizeTotalInput;
window.hideAdminPrizeInput = hideAdminPrizeInput;
window.updatePrizeTotal = updatePrizeTotal;
// showAllParticipants function removed - not needed
// removeParticipant function removed - not needed
window.testButton = testButton;

// Alternative admin access function (for debugging)
window.openAdmin = function() {
    console.log('Admin access requested via console function');
    console.log('showAdminPasswordPrompt function exists:', typeof showAdminPasswordPrompt);
    console.log('ADMIN_PASSWORD:', ADMIN_PASSWORD);
    showAdminPasswordPrompt();
};

// Test function to check if admin functions are working
window.testAdmin = function() {
    console.log('=== ADMIN FUNCTION TEST ===');
    console.log('showAdminPasswordPrompt:', typeof showAdminPasswordPrompt);
    console.log('showAdminPanel:', typeof showAdminPanel);
    console.log('ADMIN_PASSWORD:', ADMIN_PASSWORD);
    console.log('isAdminAuthenticated:', isAdminAuthenticated);
    console.log('adminModal element:', document.getElementById('adminModal'));
    
    // Try to show admin panel directly
    try {
        showAdminPasswordPrompt();
    } catch (error) {
        console.error('Error calling showAdminPasswordPrompt:', error);
    }
};

// Test function to verify global scope access
window.testPrizeFunction = function() {
    console.log('testPrizeFunction called - global scope is working');
    showPrizeTotalInput();
};

// Prize Chart Functions
function initializePrizeChart() {
    // Load saved prize total from localStorage
    const savedTotal = localStorage.getItem('fplPrizeTotal');
    if (savedTotal) {
        prizeTotal = parseInt(savedTotal);
    }
    
    // Create the prize chart
    createPrizeChart();
    updatePrizeBreakdown();
    
    // Add event listener for prize total input (only visible to admin)
    const prizeTotalInput = document.getElementById('prizeTotal');
    if (prizeTotalInput) {
        // Set the value if we have a saved total
        if (savedTotal) {
            prizeTotalInput.value = prizeTotal;
        }
        
        prizeTotalInput.addEventListener('input', function() {
            prizeTotal = parseInt(this.value) || 0;
            localStorage.setItem('fplPrizeTotal', prizeTotal.toString());
            updatePrizeChart();
            updatePrizeBreakdown();
            console.log('Prize total updated to:', prizeTotal);
        });
    }
    
    // Hide prize total input by default (only admin can see it)
    hidePrizeTotalInput();
}

function createPrizeChart() {
    const ctx = document.getElementById('prizeChart');
    if (!ctx) return;
    
    const chartData = {
                    labels: ['1:a', '2:a', '3:a', 'Cupen'],
        datasets: [{
            data: [50, 25, 15, 10],
            backgroundColor: [
                '#8b5cf6', // Purple
                '#1e40af', // Dark blue
                '#06b6d4', // Light blue
                '#ec4899'  // Pink
            ],
            borderColor: [
                '#7c3aed',
                '#1e3a8a',
                '#0891b2',
                '#db2777'
            ],
            borderWidth: 3,
            hoverBorderWidth: 5,
            hoverOffset: 10
        }]
    };
    
    const config = {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const percentage = context.parsed;
                            const amount = Math.round((prizeTotal * percentage) / 100);
                            return `${context.label}: ${percentage}% (${amount} kr)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1000,
                easing: 'easeOutQuart'
            },
            cutout: '60%'
        }
    };
    
    if (prizeChart) {
        prizeChart.destroy();
    }
    
    prizeChart = new Chart(ctx, config);
}

function updatePrizeChart() {
    if (prizeChart) {
        // Update tooltip with new amounts
        prizeChart.options.plugins.tooltip.callbacks.label = function(context) {
            const percentage = context.parsed;
            const amount = Math.round((prizeTotal * percentage) / 100);
            return `${context.label}: ${percentage}% (${amount} kr)`;
        };
        prizeChart.update('none'); // Update without animation for smooth number changes
    }
    
    // Update the current prize total display in admin panel
    const currentPrizeTotal = document.getElementById('currentPrizeTotal');
    if (currentPrizeTotal) {
        currentPrizeTotal.textContent = prizeTotal;
    }
}

function updatePrizeBreakdown() {
    const breakdown = document.getElementById('prizeBreakdown');
    if (!breakdown) return;
    
    const prizes = [
        { label: '1:a', percentage: 50 },
        { label: '2:a', percentage: 25 },
        { label: '3:a', percentage: 15 },
        { label: 'Cupen', percentage: 10 }
    ];
    
    breakdown.innerHTML = '';
    
    prizes.forEach(prize => {
        const amount = Math.round((prizeTotal * prize.percentage) / 100);
        const item = document.createElement('div');
        item.className = 'prize-breakdown-item';
        item.innerHTML = `
            <div class="prize-breakdown-label">${prize.label}</div>
            <div class="prize-breakdown-amount" data-amount="${amount}">${amount} kr</div>
            <div class="prize-breakdown-percentage">${prize.percentage}%</div>
        `;
        breakdown.appendChild(item);
    });
    
    // Animate the amounts
    animateNumbers();
}

function animateNumbers() {
    const amountElements = document.querySelectorAll('.prize-breakdown-amount');
    
    amountElements.forEach(element => {
        const targetAmount = parseInt(element.dataset.amount);
        const currentAmount = 0;
        const duration = 1000; // 1 second
        const steps = 60;
        const increment = targetAmount / steps;
        let currentStep = 0;
        
        const timer = setInterval(() => {
            currentStep++;
            const currentValue = Math.round(increment * currentStep);
            
            if (currentStep >= steps) {
                element.textContent = `${targetAmount} kr`;
                clearInterval(timer);
            } else {
                element.textContent = `${currentValue} kr`;
            }
        }, duration / steps);
    });
}

function showPrizeTotalInput() {
    console.log('showPrizeTotalInput function called');
    
    const adminPrizeInput = document.getElementById('adminPrizeTotalInput');
    console.log('adminPrizeInput element:', adminPrizeInput);
    
    if (adminPrizeInput) {
        // Show the admin prize input field
        adminPrizeInput.classList.remove('hidden');
        
        // Set the current value in the input field
        const inputField = document.getElementById('adminPrizeTotal');
        if (inputField) {
            inputField.value = prizeTotal;
            inputField.focus();
            inputField.select();
            console.log('Admin prize input field shown and focused');
        }
        
        console.log('Admin prize total input field shown');
    } else {
        console.log('adminPrizeInput element not found!');
    }
}

// Simple test function that should always work
function testButton() {
    console.log('Test button clicked!');
    alert('Button is working!');
}

function hidePrizeTotalInput() {
    const prizeTotalInput = document.getElementById('prizeTotalInput');
    if (prizeTotalInput) {
        prizeTotalInput.style.display = 'none';
    }
}

function hideAdminPrizeInput() {
    const adminPrizeInput = document.getElementById('adminPrizeTotalInput');
    if (adminPrizeInput) {
        adminPrizeInput.classList.add('hidden');
    }
}

function updatePrizeTotal() {
    const inputField = document.getElementById('adminPrizeTotal');
    if (inputField && inputField.value) {
        const newTotal = parseInt(inputField.value);
        if (newTotal >= 0) {
            prizeTotal = newTotal;
            
            // Update the chart
            updatePrizeChart();
            
            // Update the current prize total display in admin panel
            const currentPrizeTotal = document.getElementById('currentPrizeTotal');
            if (currentPrizeTotal) {
                currentPrizeTotal.textContent = newTotal;
            }
            
            // Save to localStorage
            localStorage.setItem('fplPrizeTotal', newTotal.toString());
            
            // Hide the input field
            hideAdminPrizeInput();
            
            console.log('Prize total updated to:', newTotal);
        }
    }
}

// Chart instance

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM CONTENT LOADED ===');
    console.log('DISABLE_API_CALLS:', DISABLE_API_CALLS);
    console.log('FPL_API_BASE:', FPL_API_BASE);
    console.log('LEAGUE_CODE:', LEAGUE_CODE);
    
    // Check participant configuration first
    try {
        const participants = getConfiguredParticipants();
        console.log('✅ Participant configuration loaded:', participants.length, 'participants');
    } catch (error) {
        console.error('❌ Participant configuration error:', error);
        // Show UI banner for configuration issues (not API issues)
        showConfigurationErrorBanner('Participants configuration missing or not loaded.');
        return; // Don't proceed with initialization
    }
    
    // Add data source indicator immediately
    addDataSourceIndicator();
    
    checkLoginStatus();
    setupEventListeners();
    loadFromLocalStorage(); // Load saved participant data
    
    // Run health checks after bootstrap
    setTimeout(async () => {
        try {
            assertNoDeprecatedGlobals();
            
            // Update DOM headings with resolved season and GW
            await updateDOMHeadings();
            
            const health = await runHealthChecks();
            if (health.ok) {
                console.log('✅ Runtime health checks passed');
            }
        } catch (error) {
            console.error('❌ Health check assertion failed:', error);
        }
    }, 1000);
    
    // Add Enter key handler for password input
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                checkPassword();
            }
        });
    }
    
    // Bind explicit click handlers (in case inline onclick isn't firing)
    const q = s => document.querySelector(s);
    const btnTables = q('[data-section="tables"], #nav-tables, a[href="#tables"]');
    const btnProfiles = q('[data-section="profiles"], #nav-profiles, a[href="#profiles"], a[href="#participants"], a[href="#deltagare"]');

    if (btnTables) btnTables.addEventListener('click', () => window.showSection('tables'));
    if (btnProfiles) btnProfiles.addEventListener('click', () => window.showSection('profiles'));

    console.info('[Boot] handlers bound, script v21');
});

// Safe fetch helpers (accept soft/stale 200)
const PROXY_ROOT = 'https://fpl-proxy-1.onrender.com';
const API = `${PROXY_ROOT}/api`;

async function fetchJSON(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) {
        const soft  = r.headers.get('X-Proxy-Soft') === '1';
        const stale = r.headers.get('X-Proxy-Stale') === '1';
        if (soft || stale) console.info('[FPL] served', { url, soft, stale });
        return r.json();
      }
      last = new Error(`HTTP ${r.status}`);
    } catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 500*(i+1) + Math.floor(Math.random()*300)));
  }
  throw last;
}

async function safeFetchBootstrap(){
  try {
    const data = await fetchJSON(`${API}/bootstrap-static/?__=${Date.now()}`);
    return data;
  } catch (e) {
    console.info('[Bootstrap] soft fallback due to', e?.message || e);
    // Minimal skeleton to proceed
    return {
      events: [{ id: (typeof FORCE_GW==='number' && FORCE_GW>0) ? FORCE_GW : 1, is_current: true }],
      phases: [], teams: [], total_players: 0,
      elements: [], element_stats: [], element_types: []
    };
  }
}

function chunk(a,n){const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o;}

// Single-ID helpers that tolerate soft bodies
async function safeFetchHistory(entryId) {
  const data = await fetchJSON(`${API}/entry/${entryId}/history/?__=${Date.now()}`);
  return (data && Array.isArray(data.current)) ? data : { current: [], past: [], chips: [] };
}

async function safeFetchSummary(entryId) {
  const data = await fetchJSON(`${API}/entry/${entryId}/?__=${Date.now()}`);
  return {
    player_first_name: data?.player_first_name || '',
    player_last_name:  data?.player_last_name  || '',
    name:              data?.name || ''
  };
}

async function fetchAggregateSummaries(ids) {
  const url = `${API}/aggregate/summary?ids=${ids.join(',')}&__=${Date.now()}`;
  const data = await fetchJSON(url);
  if (!data || !Array.isArray(data.results)) {
    console.warn('[Agg] summaries.results missing/empty', data);
    return { results: [] };
  }
  return data;
}

async function fetchAggregateHistory(ids, gw) {
  const url = `${API}/aggregate/history?ids=${ids.join(',')}&gw=${gw}&__=${Date.now()}`;
  const data = await fetchJSON(url);
  if (!data || !Array.isArray(data.results)) {
    console.warn('[Agg] histories.results missing/empty', data);
    return { results: [] };
  }
  return data;
}

// Participants (no "undefined" names)
async function buildParticipantsFromAggregates(entryIds){
  const res = await fetchAggregateSummaries(entryIds);
  return res.map(r=>{
    if (r.ok && r.data){
      const override = applyParticipantOverride(r.id, r.data);
      return { fplId:r.id, displayName: override.displayName, teamName: override.teamName };
    }
    return { fplId:r.id, displayName:`Manager ${r.id}`, teamName: '' };
  });
}

// Canonical row shape used by both tables
// {
//   fplId: number,
//   displayName: string,
//   teamName: string,
//   gwPoints: number|null,     // points for current GW
//   totalPoints: number|null,  // overall points (if available)
//   privateOrBlocked: boolean, // true if we had to fall back / no data
//   summary?: object,          // raw entry summary (optional)
//   history?: object           // raw history for the gw (optional)
// }

// Normalizer that merges aggregate/summary + aggregate/history for a given GW
function normalizeAggregateRows({ ids, summaries, histories, gw }) {
  const mapSum = new Map(summaries?.results?.map(r => [Number(r?.id), r?.data || {}]) || []);
  const mapHist = new Map(histories?.results?.map(r => [Number(r?.id), r]) || []);

  return ids.map(id => {
    const fplId = Number(id);
    const sum = mapSum.get(fplId) || {};
    const hist = mapHist.get(fplId) || {};

    const override = applyParticipantOverride(fplId, sum);
    const displayName = override.displayName || [sum.player_first_name, sum.player_last_name].filter(Boolean).join(' ') || `Manager ${fplId}`;
    const teamName    = override.teamName || sum.name || '';

    // Debug logging for first few entries
    if (fplId <= 3) {
      console.log(`[Normalize] Entry ${fplId}:`, {
        summary: sum,
        history: hist,
        gw,
        derivedGwPoints: deriveGwPointsFromHistory(hist, gw),
        derivedTotalPoints: deriveTotalPoints(sum, hist)
      });
    }

    // Dev-only validation
    if (window.__DEBUG_MODE) {
      console.assert(typeof fplId === 'number' && fplId > 0, 
        `Invalid entryId in row builder: ${fplId} for ${displayName}`);
    }
    
    return {
      fplId,
      displayName,
      teamName,              // used only in Season table "Team" column
      gwPoints: deriveGwPointsFromHistory(hist, gw),
      totalPoints: deriveTotalPoints(sum, hist),
      summary: sum,
      history: hist,
      privateOrBlocked: !hist?.ok && !sum?.player_first_name, // heuristic
    };
  });
}

// Tables loader with robust GW resolution and entry history joins
async function loadTablesViewUsingAggregates(entryIds, gw, bootstrap){
  console.info('[Tables] Loading with robust GW resolution and entry history joins');
  console.info('[Tables] Entry IDs:', entryIds.slice(0, 5), 'Requested GW:', gw);
  
  try {
    // Step 1: Resolve latest finished GW as single source of truth (with fallback guarantee)
    console.info('[Tables] Resolving latest finished GW...');
    const latestGw = await getLatestGwOnce();
    console.info('[Tables] Latest finished GW resolved:', latestGw);
    
    // Validate GW is a positive integer
    if (!Number.isInteger(latestGw) || latestGw <= 0) {
      throw new Error(`Invalid GW resolved: ${latestGw} (must be positive integer)`);
    }
    
    // Step 2: Fetch entry history for each participant with concurrency control
    const participants = getConfiguredParticipants().map(normalizeParticipant);
    const validParticipants = participants.filter(p => p.hasValidId);
    
    if (validParticipants.length === 0) {
      throw new Error('No participants with valid entryId found');
    }
    
    console.info('[Tables] Processing', validParticipants.length, 'valid participants');
    
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
    
    // Compute positions and sort rows
    const sortedSeasonRows = [...rows].sort((a, b) => b.totalPoints - a.totalPoints);
    const sortedGwRows = [...rows].sort((a, b) => {
      // Sort by latest GW points, then by total points for ties
      if (b.latestGwPoints !== a.latestGwPoints) {
        return b.latestGwPoints - a.latestGwPoints;
      }
      return b.totalPoints - a.totalPoints;
    });
    
    // Add position numbers
    sortedSeasonRows.forEach((row, index) => {
      row.pos = index + 1;
    });
    sortedGwRows.forEach((row, index) => {
      row.pos = index + 1;
    });
    
    // Store for debug utilities and health checks
    window.__lastRows = sortedSeasonRows; // Use season-sorted rows as primary
    
    // Add debug dump for inspection (only if debug mode enabled)
    if (window.__DEBUG_MODE) {
      try {
        const season = await resolveCurrentSeason();
        
        // Determine data source and freshness
        const dataSource = window.__lastRows?.[0]?._isFallback ? 'fallback' : 'direct';
        const fallbackInfo = window.__PROBE_RESULT?.fallback;
        const ageMinutes = fallbackInfo?.ageMinutes || 0;
        
        window.__DEBUG_FPL = {
          participants: validParticipants,
          sampleRow: sortedSeasonRows[0],
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
          computedRows: sortedSeasonRows.slice(0, 5).map(row => ({
            pos: row.pos,
            entryId: row.entryId,
            displayName: row.displayName,
            totalPoints: row.totalPoints,
            latestGwPoints: row.latestGwPoints,
            latestGw: row.latestGw
          }))
        };
        
        // Debug participants table (first 5 with key fields)
        console.table('👀 DEBUG: Participants (first 5)', 
          window.__DEBUG_FPL.participants.slice(0, 5).map(p => ({
            displayName: p.displayName,
            entryId: p.entryId,
            teamName: p.teamName,
            hasValidId: p.hasValidId
          }))
        );
        
        console.table('👀 DEBUG: Sample Row', [window.__DEBUG_FPL.sampleRow]);
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
        
        // Render data source indicator with freshness logic
        renderDataSourceIndicator({ 
          source: dataSource, 
          lastSync: fallbackInfo?.lastSync, 
          ageMinutes: ageMinutes,
          fallbackInfo: window.__DEBUG_FPL.fallback
        });
        
        // Add debug footer with provenance (debug mode only)
        if (window.__DEBUG_MODE) {
          const footer = document.createElement('div');
          footer.id = 'debugFooter';
          footer.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-family: monospace;
            z-index: 10001;
            max-width: 400px;
            word-break: break-all;
          `;
          
          const provenance = `Provenance: ${dataSource} • GW ${latestGw} • Sync ${fallbackInfo?.lastSync ? new Date(fallbackInfo.lastSync).toLocaleString() : 'N/A'} • SHA ${BUILD_SHA}`;
          footer.textContent = provenance;
          footer.title = `Data source: ${dataSource}\nGameweek: ${dataSource === 'fallback' ? latestGw : 'N/A'}\nLast sync: ${fallbackInfo?.lastSync || 'N/A'}\nBuild SHA: ${BUILD_SHA}`;
          
          document.body.appendChild(footer);
        }
      } catch (error) {
        console.error('👀 DEBUG: Failed to resolve season/GW:', error);
      }
    }
    
    // Step 3: Update DOM headings with resolved season and GW
    await updateDOMHeadings();
    
    // Step 4: Runtime assertions for data correctness (debug mode only)
    if (window.__DEBUG_MODE) {
      try {
        // Assert GW correctness
        console.assert(Number.isInteger(latestGw) && latestGw > 0, 'Bad GW', latestGw);
        
        // Assert participant data correctness
        rows.forEach((row, index) => {
          console.assert(Number.isInteger(row.latestGw) && row.latestGw > 0, 'Bad row GW', row.entryId, row.latestGw);
          console.assert(Number.isFinite(row.totalPoints) && row.totalPoints >= 0, 'Bad seasonTotal', row.entryId, row.totalPoints);
          console.assert(Number.isFinite(row.latestGwPoints) && row.latestGwPoints >= 0, 'Bad latestGwPoints', row.entryId, row.latestGwPoints);
        });
        
        console.log('✅ [DEBUG] All data assertions passed');
      } catch (assertionError) {
        console.error('❌ [DEBUG] Data assertion failed:', assertionError);
      }
    }
    
    // Step 5: Render tables with the computed data
    populateSeasonTable?.(sortedSeasonRows, bootstrap);
    populateGameweekTable?.(sortedGwRows, bootstrap, latestGw);
    
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

// Single helper to map exceptions to user banners
function showErrorBanner(error, type = 'error') {
    const banner = document.createElement('div');
    const colors = {
        'error': '#dc2626',
        'warning': '#f59e0b',
        'info': '#3b82f6'
    };
    
    banner.style.cssText = `
        position: fixed;
        top: ${type === 'error' ? '0' : '60px'};
        left: 0;
        right: 0;
        background: ${colors[type] || colors.error};
        color: white;
        padding: 1rem;
        text-align: center;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    
    let message = error.message || error.toString();
    let prefix = '⚠️';
    
    if (type === 'error') {
        prefix = '❌';
        if (error instanceof ReferenceError) {
            message = `Configuration error: ${message}`;
        } else if (error instanceof TypeError) {
            message = `Data error: ${message}`;
        }
    } else if (type === 'warning') {
        prefix = '⚠️';
    } else if (type === 'info') {
        prefix = 'ℹ️';
    }
    
    banner.textContent = `${prefix} ${message}`;
    document.body.appendChild(banner);
    
    console.error(`[${type.toUpperCase()}] Banner shown:`, error);
}

// Show configuration error banner (not API error)
function showConfigurationErrorBanner(message) {
    showErrorBanner(new Error(message), 'error');
}

// Update DOM headings with resolved season and GW
async function updateDOMHeadings() {
    try {
        const season = await resolveCurrentSeason();
        const gw = await resolveCurrentGW();
        
        // Update season heading
        const seasonLabel = document.querySelector('.gameweek-label');
        if (seasonLabel && seasonLabel.textContent.includes('Säsong')) {
            seasonLabel.textContent = `Säsong ${season}`;
            console.log('[DOM] Updated season heading:', season);
        }
        
        // Update GW heading
        const gwLabel = document.getElementById('currentGameweekLabel');
        if (gwLabel) {
            gwLabel.textContent = `Gameweek ${gw}`;
            console.log('[DOM] Updated GW heading:', gw);
        }
        
        // Update page title if it contains season info
        if (document.title.includes('2024/25')) {
            document.title = document.title.replace('2024/25', season);
        }
        
        return { season, gw };
    } catch (error) {
        console.error('[DOM] Failed to update headings:', error);
        showErrorBanner(error, 'warning');
        throw error;
    }
}

// Show health check error banner (non-blocking)
function showHealthCheckBanner(message) {
    showErrorBanner(new Error(`Health check failed: ${message}`), 'warning');
}

// Runtime health checks to prevent regressions
async function runHealthChecks() {
    const health = {
        ok: true,
        checks: {},
        timestamp: new Date().toISOString(),
        errors: []
    };
    
    try {
        // Check 1: Participants configuration (strict validation)
        const participants = getConfiguredParticipants();
        if (!participants || participants.length === 0) {
            throw new Error('No participants configured');
        }
        
        // Validate participants have valid entryId
        const validParticipants = participants.filter(p => p.hasValidId);
        if (validParticipants.length === 0) {
            throw new Error('No participants with valid entryId found');
        }
        
        if (validParticipants.length < participants.length * 0.8) { // Less than 80% valid
            console.warn('[Health] Some participants lack valid entryId:', 
                participants.length - validParticipants.length, 'of', participants.length);
        }
        
        health.checks.participants = {
            ok: true,
            count: participants.length,
            validIds: validParticipants.length,
            message: `Found ${participants.length} participants (${validParticipants.length} with valid entryId)`
        };
        
        // HC-1: validParticipantsCount > 0 (else banner + abort)
        if (validParticipants.length === 0) {
            throw new Error('HC-1 FAILED: No valid participants found');
        }
        
        // Check 2: Table data quality (if available)
        if (window.__lastRows && window.__lastRows.length > 0) {
            const sampleRow = window.__lastRows[0];
            const hasValidPoints = sampleRow && 
                typeof sampleRow.totalPoints === 'number' && 
                sampleRow.totalPoints > 0 &&
                typeof sampleRow.latestGwPoints === 'number' && 
                sampleRow.latestGwPoints > 1;
            
            if (!hasValidPoints) {
                throw new Error('Table data shows invalid points (totalPoints or latestGwPoints is 0/1)');
            }
            
            // Check data join quality - if >60% have zero/one points, data join likely failed
            const validRows = window.__lastRows.filter(row => 
                typeof row.totalPoints === 'number' && row.totalPoints > 0 &&
                typeof row.latestGwPoints === 'number' && row.latestGwPoints > 1
            );
            
            const dataQualityRatio = validRows.length / window.__lastRows.length;
            
            // HC-2: If >60% of valid participants have totalPoints === 0 or latestGwPoints <= 1 while latestGW > 1, flag "Data join failed"
            const currentGW = await resolveCurrentGW().catch(() => 1);
            if (currentGW > 1 && dataQualityRatio < 0.4) { // Less than 40% valid data
                throw new Error(`HC-2 FAILED: Data join failed - only ${Math.round(dataQualityRatio * 100)}% of participants have valid points (GW ${currentGW})`);
            }
            
            // HC-3: Verify typeof firstRow.latestGw === 'number' and < 60
            const gw = await resolveCurrentGW().catch(() => 1);
            if (typeof gw !== 'number' || !Number.isInteger(gw) || gw <= 0 || gw >= 60) {
                throw new Error(`HC-3 FAILED: Invalid GW value: ${gw} (must be integer 1-59)`);
            }
            
            health.checks.tableData = {
                ok: true,
                sampleRow: {
                    totalPoints: sampleRow.totalPoints,
                    latestGwPoints: sampleRow.latestGwPoints,
                    displayName: sampleRow.displayName,
                    entryId: sampleRow.fplId,
                    latestGw: gw
                },
                dataQuality: `${Math.round(dataQualityRatio * 100)}% valid data`,
                message: 'Table data shows valid points and good data quality'
            };
        } else {
            health.checks.tableData = {
                ok: true,
                message: 'No table data yet (normal on first load)'
            };
        }
        
        // Check 4: Fallback data freshness (if using fallback)
        const fallbackInfo = window.__PROBE_RESULT?.fallback;
        if (fallbackInfo?.success && window.__lastRows?.[0]?._isFallback) {
            const ageMinutes = fallbackInfo.ageMinutes || 0;
            
            if (ageMinutes >= 180) {
                throw new Error(`Fallback data is too old (${ageMinutes} minutes) - results may be outdated`);
            } else if (ageMinutes >= 30) {
                console.warn('[Health] Fallback data is stale:', ageMinutes, 'minutes');
            }
            
            health.checks.fallbackData = {
                ok: true,
                ageMinutes: ageMinutes,
                freshness: fallbackInfo.freshness,
                message: `Fallback data is ${fallbackInfo.freshness} (${ageMinutes} minutes old)`
            };
        } else if (window.__lastRows?.[0]?._source === 'direct') {
            health.checks.fallbackData = {
                ok: true,
                message: 'Using direct FPL API'
            };
        }
        
        // Check 3: No deprecated globals
        if (typeof window.participantsData !== 'undefined') {
            throw new Error('Deprecated participantsData global still exists');
        }
        health.checks.noDeprecatedGlobals = {
            ok: true,
            message: 'No deprecated globals detected'
        };
        
        console.log('✅ Health checks passed:', health.checks);
        
    } catch (error) {
        health.ok = false;
        health.errors.push(error.message);
        
        // Show non-blocking health check banner
        showHealthCheckBanner(error.message);
        
        console.error('❌ Health check failed:', error);
    }
    
    // Expose health status globally
    window.__FPL_HEALTH = health;
    
    return health;
}

// Guard against deprecated globals (unit-style assertions)
function assertNoDeprecatedGlobals() {
    const deprecated = [
        'participantsData',
        'oldParticipantsData',
        'legacyParticipantsData'
    ];
    
    const found = deprecated.filter(name => typeof window[name] !== 'undefined');
    if (found.length > 0) {
        throw new Error(`Deprecated globals detected: ${found.join(', ')}`);
    }
    
    return true;
}

// Hook "Tabeller"
async function onClickTabeller(){
  if (window.__loadingTables) return; window.__loadingTables=true;
  try{
    const ids = getKnownEntryIds();                // from ENTRY_IDS only
    const gw  = await resolveCurrentGW();          // from bootstrap or FORCE_GW
    const bootstrap = await safeFetchBootstrap();
    
    await loadTablesViewUsingAggregates(ids, gw, bootstrap);
  } finally { window.__loadingTables=false; }
}

window.onClickTabeller = onClickTabeller;

// Participants (Deltagare) should build from aggregates if empty
async function ensureParticipantsData() {
  // Use existing participantsData if available
      if (Array.isArray(LEGACY_PARTICIPANTS) && LEGACY_PARTICIPANTS.length > 0) {
        console.log('Using existing LEGACY_PARTICIPANTS:', LEGACY_PARTICIPANTS.length, 'participants');
    return;
  }

  let ids = getKnownEntryIds();
  console.log('ensureParticipantsData: got IDs:', ids);

  // fallback to league standings
  if ((!ids || !ids.length) && window.LEAGUE_CODE) {
    console.log('No IDs found, deriving from league standings...');
    const s = await fetchJSON(`${API}/leagues-classic/${window.LEAGUE_CODE}/standings/?page_new_entries=1&page_standings=1&phase=1&__=${Date.now()}`);
    ids = (s?.standings?.results || []).map(r => r.entry).filter(Boolean);
    console.log('Derived IDs from league:', ids);
  }

  if (!ids || !ids.length) {
    console.warn('No entry IDs available for participants');
    return;
  }

  // build participants via aggregate summaries
  console.log('Building participants from aggregate summaries...');
  const res = await fetchAggregateSummaries(ids);
  console.log('Aggregate summaries result:', res);
  
            // Update the global participantsData array with aggregate data
                      LEGACY_PARTICIPANTS.length = 0;
            LEGACY_PARTICIPANTS.push(...res.map(r => {
            const override = applyParticipantOverride(r.id, r?.data);
            return {
              fplId: r.id,
              namn: override.displayName,
              displayName: override.displayName,
              teamName: override.teamName,
              totalPoäng: 2000, // Default value
              favoritlag: '',
              profilRoast: 'Ny deltagare - välkommen!',
              image: generateAvatarDataURL(override.displayName.charAt(0)),
              lastSeasonRank: 'N/A',
              bestGameweek: 0
            };
          }));
  
  console.log('Updated LEGACY_PARTICIPANTS from aggregates:', LEGACY_PARTICIPANTS.length, 'participants');
}

async function onClickDeltagare() {
  console.log('onClickDeltagare called');
  await ensureParticipantsData();
  // Use the correct function name
  populateProfiles();
}
// Route old handlers safely
window.onClickDeltagare = onClickDeltagare;

// Add diagnostics function for debugging
window.__diag = async function() {
  console.log('=== DIAGNOSTICS ===');
  console.log('ENTRY_IDS:', window.ENTRY_IDS);
  console.log('LEAGUE_CODE:', window.LEAGUE_CODE);
  console.log('LEGACY_PARTICIPANTS length:', LEGACY_PARTICIPANTS.length);
  console.log('First 3 participants:', LEGACY_PARTICIPANTS.slice(0, 3));
  
  try {
    const ids = getKnownEntryIds();
    console.log('getKnownEntryIds():', ids);
    
    if (ids.length > 0) {
      console.log('Testing aggregate summary...');
      const summaries = await fetchAggregateSummaries(ids.slice(0, 3));
      console.log('Aggregate summaries (first 3):', summaries);
    }
  } catch (e) {
    console.error('Diagnostics error:', e);
  }
};

// API self-test: use healthz + tiny summary (don't fail on bootstrap)
async function testAPIConnection(){
  try {
    const h = await fetch(`${PROXY_ROOT}/healthz`);
    if (!h.ok) throw new Error(`healthz ${h.status}`);

    const sampleId = (Array.isArray(window.ENTRY_IDS) && window.ENTRY_IDS[0]) || 1;
    const r = await fetch(`${API}/aggregate/summary?ids=${sampleId}&__=${Date.now()}`);
    if (!r.ok) throw new Error(`summary ${r.status}`);

    showAPIOkBadge?.();
  } catch (e) {
    showAPIFailBadge?.(String(e));
  }
}

// FPL API Integration Functions (legacy - kept for compatibility)
async function fetchBootstrapData() {
    try {
        console.log('🔄 Fetching bootstrap data from FPL API via Render proxy...');
        const response = await fetchWithRetry(`${FPL_PROXY_BASE}/bootstrap-static/`);
        const data = await response.json();
        console.log('✅ Bootstrap data fetched successfully!');
        console.log('📊 Data structure:', {
            events: data.events?.length || 0,
            teams: data.teams?.length || 0,
            elements: data.elements?.length || 0
        });
        
        bootstrapData = data;
        return data;
    } catch (error) {
        console.error('❌ Error fetching bootstrap data:', error);
        throw error;
    }
}

async function fetchHistory(entryId) {
    try {
        console.log(`🔄 Fetching history data for FPL ID: ${entryId}`);
        const response = await fetchWithRetry(`${FPL_PROXY_BASE}/entry/${entryId}/history/`);
        const data = await response.json();
        console.log(`✅ History data fetched successfully for FPL ID ${entryId}`);
        return data;
    } catch (error) {
        console.error(`❌ Error fetching history for FPL ID ${entryId}:`, error);
        return null;
    }
}

async function fetchPicks(entryId, gw) {
    if (picksCircuitIsOpen()) {
        const err = new Error('CIRCUIT_OPEN');
        err.code = 'CIRCUIT_OPEN';
        throw err; // force fallback to /history/
    }

    try {
        console.log(`🔄 Fetching GW${gw} picks for FPL ID: ${entryId}`);
        const response = await fetchWithRetry(`${FPL_PROXY_BASE}/entry/${entryId}/event/${gw}/picks/?_=${Date.now()}`);
        
        if (!response.ok) {
            // Count only 403/429/5xx as "circuit-worthy" failures
            if (response.status === 403 || response.status === 429 || response.status >= 500) {
                recordPicksFailure();
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        recordPicksSuccess();
        console.log(`✅ Picks data fetched successfully for FPL ID ${entryId}, GW${gw}`);
        return data;
    } catch (error) {
        // treat parse error as failure, unlikely but safe
        if (error.code !== 'CIRCUIT_OPEN') {
            recordPicksFailure();
        }
        console.error(`❌ Error fetching picks for FPL ID ${entryId}, GW${gw}:`, error);
        throw error;
    }
}

async function loadAllPicksWithFallback(entryIds, gw) {
    console.log(`🔄 Loading data for ${entryIds.length} entries...`);
    
    // If tables are disabled from fetching picks, only fetch history
    if (!EAGER_FETCH_PICKS_FOR_TABLES) {
        console.log('📊 Tables mode: fetching history only (no picks)...');
        return mapPool(entryIds, async (id) => {
            try {
                const history = await fetchHistory(id);
                return { id, picks: null, history, privateOrBlocked: false };
            } catch (e) {
                logPicksBlocked(id, e);
                return { id, picks: null, history: null, privateOrBlocked: true, error: String(e) };
            }
        }, PICKS_CONCURRENCY);
    }
    
    // Full picks + fallback mode (for highlights/details)
    console.log('🔄 Full mode: loading picks with fallback to history...');
    return mapPool(entryIds, async (id) => {
        try {
            const picks = await fetchPicks(id, gw);
            return { id, picks, history: null, privateOrBlocked: false };
        } catch (e) {
            logPicksBlocked(id, e);
            let history = null;
            try { 
                history = await fetchHistory(id); 
            } catch (historyError) {
                console.log(`❌ History also failed for FPL ID ${id}:`, historyError);
            }
            return { id, picks: null, history, privateOrBlocked: true, error: String(e) };
        }
    }, PICKS_CONCURRENCY);
}

async function processPicksResults(results, bootstrap) {
    console.log('🔄 Processing picks results and updating league data...');
    
    // Initialize league data structures
    leagueData.seasonTable = [];
    leagueData.gameweekTable = [];
    leagueData.highlights = {
        rocket: '',
        flop: '',
        captain: '',
        bench: ''
    };
    
    // Process each result
    for (const result of results) {
        const participant = LEGACY_PARTICIPANTS.find(p => p.fplId === result.id);
        if (!participant) continue;
        
        let gameweekPoints = 0;
        let captainPoints = 0;
        let benchPoints = 0;
        let transfers = 0;
        
        if (result.picks && !result.privateOrBlocked) {
            // Use picks data for full details
            const picks = result.picks;
            gameweekPoints = picks.entry_history?.points || 0;
            captainPoints = picks.entry_history?.points_on_bench || 0; // This might need adjustment
            benchPoints = picks.entry_history?.points_on_bench || 0;
            transfers = picks.entry_history?.event_transfers || 0;
            
            // Update participant with real data
            participant.gameweekPoints = gameweekPoints;
            participant.captainPoints = captainPoints;
            participant.benchPoints = benchPoints;
            participant.transfers = transfers;
            participant.privateOrBlocked = false;
            
        } else if (result.history) {
            // Use history data for points only (no captain/bench details)
            const historyEntry = result.history.current?.find(h => h.event === currentGameweek);
            if (historyEntry) {
                gameweekPoints = historyEntry.points || 0;
                participant.gameweekPoints = gameweekPoints;
                participant.privateOrBlocked = result.privateOrBlocked || false;
                console.log(`📊 Using history data for FPL ID ${result.id}: ${gameweekPoints} points`);
            }
        }
        
        // Add to league tables
        leagueData.seasonTable.push({
            namn: participant.namn,
            totalPoäng: participant.totalPoäng,
            favoritlag: participant.favoritlag,
            fplId: participant.fplId,
            image: participant.image,
            privateOrBlocked: participant.privateOrBlocked || false
        });
        
        leagueData.gameweekTable.push({
            namn: participant.namn,
            gameweekPoints: gameweekPoints,
            captainPoints: captainPoints,
            benchPoints: benchPoints,
            transfers: transfers,
            favoritlag: participant.favoritlag,
            fplId: participant.fplId,
            image: participant.image,
            privateOrBlocked: participant.privateOrBlocked || false
        });
    }
    
    // Sort tables
    leagueData.seasonTable.sort((a, b) => b.totalPoäng - a.totalPoäng);
    leagueData.gameweekTable.sort((a, b) => b.gameweekPoints - a.gameweekPoints);
    
    // Calculate highlights
    const validGameweekEntries = leagueData.gameweekTable.filter(entry => !entry.privateOrBlocked);
    
    if (validGameweekEntries.length > 0) {
        // Weekly rocket (highest points)
        const rocket = validGameweekEntries[0];
        leagueData.highlights.rocket = `${rocket.namn} (${rocket.gameweekPoints}p)`;
        
        // Weekly flop (lowest points)
        const flop = validGameweekEntries[validGameweekEntries.length - 1];
        leagueData.highlights.flop = `${flop.namn} (${flop.gameweekPoints}p)`;
        
        // Captain fail (lowest captain points) - only if picks data available
        if (EAGER_FETCH_PICKS_FOR_TABLES) {
            const captainFail = validGameweekEntries
                .filter(entry => entry.captainPoints !== undefined && entry.captainPoints > 0)
                .sort((a, b) => a.captainPoints - b.captainPoints)[0];
            if (captainFail) {
                leagueData.highlights.captain = `${captainFail.namn} (${captainFail.captainPoints}p)`;
            }
            
            // Bench boost fail (highest bench points) - only if picks data available
            const benchFail = validGameweekEntries
                .filter(entry => entry.benchPoints !== undefined && entry.benchPoints > 0)
                .sort((a, b) => b.benchPoints - a.benchPoints)[0];
            if (benchFail) {
                leagueData.highlights.bench = `${benchFail.namn} (${benchFail.benchPoints}p)`;
            }
        } else {
            // Tables mode - leave captain/bench empty
            leagueData.highlights.captain = '';
            leagueData.highlights.bench = '';
        }
    }
    
    console.log('✅ Picks results processed successfully!');
    console.log('📊 Highlights:', leagueData.highlights);
}

async function fetchPlayerData(fplId) {
    try {
        console.log(`🔄 Fetching player data for FPL ID: ${fplId}`);
        
        // Fetch current season data
        const currentUrl = `${FPL_PROXY_BASE}/entry/${fplId}/`;
        console.log(`📡 Current season URL: ${currentUrl}`);
        
        const currentResponse = await fetch(currentUrl);
        console.log(`📡 Current response status: ${currentResponse.status}`);
        
        if (!currentResponse.ok) {
            throw new Error(`Current season HTTP error! status: ${currentResponse.status}`);
        }
        const currentData = await currentResponse.json();
        console.log(`✅ Current season data for FPL ID ${fplId}:`, currentData);
        
        // Fetch historical data
        const historyUrl = `${FPL_PROXY_BASE}/entry/${fplId}/history/`;
        console.log(`📡 History URL: ${historyUrl}`);
        
        const historyResponse = await fetch(historyUrl);
        console.log(`📡 History response status: ${historyResponse.status}`);
        
        if (!historyResponse.ok) {
            throw new Error(`History HTTP error! status: ${historyResponse.status}`);
        }
        const historyData = await historyResponse.json();
        console.log(`✅ History data for FPL ID ${fplId}:`, historyData);
        
        console.log(`✅ Player data fetched successfully for FPL ID ${fplId}`);
        return { currentData, historyData };
    } catch (error) {
        console.error(`❌ Error fetching player data for FPL ID ${fplId}:`, error);
        console.error(`❌ Error details:`, {
            message: error.message,
            stack: error.stack
        });
        return null;
    }
}

async function fetchGameweekPicks(fplId, gameweek) {
    try {
        const apiUrl = `${FPL_PROXY_BASE}/entry/${fplId}/event/${gameweek}/picks/`;
        console.log(`🔄 Fetching GW${gameweek} picks for FPL ID: ${fplId}`);
        console.log(`📡 API URL: ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`⚠️ GW${gameweek} data not available for FPL ID ${fplId} (404)`);
                return null;
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
        
        const data = await response.json();
        console.log(`✅ GW${gameweek} picks fetched for FPL ID ${fplId}`);
        return data;
    } catch (error) {
        // Check for CORS errors specifically
        if (error.message.includes('CORS') || error.message.includes('Access-Control-Allow-Origin')) {
            console.log(`⚠️ CORS blocked GW${gameweek} picks for FPL ID ${fplId} - this is expected on public hosting`);
            return null;
        } else {
            console.error(`❌ Error fetching GW${gameweek} picks for FPL ID ${fplId}:`, error);
        }
        return null;
    }
}

async function fetchLeagueData() {
    try {
        console.log('Fetching league data from FPL API via Render proxy...');
        const response = await fetch(`${FPL_PROXY_BASE}/leagues-classic/${LEAGUE_CODE}/standings/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('League data fetched successfully:', data);
        return data;
    } catch (error) {
        console.error('Error fetching league data:', error);
        return null;
    }
}

// Function to update participantsData with real FPL data - API-Only Mode
async function updateParticipantsWithFPLData() {
    console.log('=== UPDATING PARTICIPANTS WITH FPL DATA (API-ONLY) ===');
    const participants = getConfiguredParticipants().map(normalizeParticipant);
    console.log('Initial participants:', participants.length);
    
    // Count participants with FPL IDs
    const participantsWithFPL = LEGACY_PARTICIPANTS.filter(p => p.fplId && p.fplId !== null);
    console.log(`📊 Found ${participantsWithFPL.length} participants with FPL IDs`);
    
    if (participantsWithFPL.length === 0) {
        throw new Error('No participants with FPL IDs found. Cannot proceed with API-only mode.');
    }
    
    // Update each participant with real FPL data
    for (let i = 0; i < LEGACY_PARTICIPANTS.length; i++) {
        const participant = LEGACY_PARTICIPANTS[i];
        
        if (participant.fplId && participant.fplId !== null) {
            console.log(`🔄 Updating participant ${participant.namn} with FPL ID ${participant.fplId}`);
            
            const playerData = await fetchPlayerData(participant.fplId);
            if (playerData) {
                const { currentData, historyData } = playerData;
                console.log(`✅ FPL data received for ${participant.namn}`);
                
                // Update with real data while preserving custom fields
                const override = applyParticipantOverride(participant.fplId, currentData);
                LEGACY_PARTICIPANTS[i] = {
                    ...participant, // Keep existing custom data (roasts, image, favoritlag, etc.)
                    namn: override.displayName,
                    displayName: override.displayName,
                    teamName: override.teamName,
                    totalPoäng: currentData.summary_overall_points,
                    lastSeasonRank: historyData.past?.find(past => past.season_name === '2023/24')?.rank || 'N/A',
                    bestGameweek: Math.max(...historyData.current.map(gw => gw.points), 0)
                };
                
                console.log(`✅ Updated ${participant.namn} with real data:`, LEGACY_PARTICIPANTS[i]);
            } else {
                console.log(`❌ Failed to fetch FPL data for ${participant.namn} (ID: ${participant.fplId})`);
                // In API-only mode, we should throw an error if we can't fetch data
                throw new Error(`Failed to fetch FPL data for ${participant.namn} (ID: ${participant.fplId})`);
            }
        } else {
            console.log(`❌ Participant ${participant.namn} has no FPL ID - this should not happen in API-only mode`);
            throw new Error(`Participant ${participant.namn} has no FPL ID. All participants must have valid FPL IDs in API-only mode.`);
        }
    }
    
    // Save updated data to localStorage
    localStorage.setItem('fplParticipantsData', JSON.stringify(LEGACY_PARTICIPANTS));
    console.log('💾 Participants data updated and saved to localStorage');
    console.log('📊 Final LEGACY_PARTICIPANTS:', LEGACY_PARTICIPANTS);
}

// Function to calculate weekly highlights from real FPL data - API-Only Mode
async function calculateWeeklyHighlightsFromAPI() {
    console.log('=== CALCULATING WEEKLY HIGHLIGHTS FROM API (API-ONLY) ===');
    
    if (!bootstrapData || !bootstrapData.events) {
        throw new Error('No bootstrap data available. Cannot calculate highlights in API-only mode.');
    }
    
    const currentGW = currentGameweek;
    console.log(`🔄 Calculating highlights for GW${currentGW}`);
    
    const gwHighlights = {
        rocket: { player: null, points: 0 },
        flop: { player: null, points: 999 },
        captain: { player: null, captain: '', points: 0 },
        bench: { player: null, points: 0 }
    };
    
    // Get all participants (should all have FPL IDs in API-only mode)
    const allParticipants = LEGACY_PARTICIPANTS.filter(p => p.fplId && p.fplId !== null);
    
    if (allParticipants.length === 0) {
        throw new Error('No participants with FPL IDs found. Cannot calculate highlights.');
    }
    
    console.log(`📊 Calculating highlights for ${allParticipants.length} participants`);
    
    // Note: This function uses picks data - should only be called for detail views, not tables
    if (!EAGER_FETCH_PICKS) {
        console.log('⚠️ calculateWeeklyHighlightsFromAPI: picks fetching disabled, highlights will be computed from table data');
        // Don't set fallback highlights - let the table data drive highlights
        return;
    }
    
    for (const participant of allParticipants) {
        const picksResult = await getPicksCached(participant.fplId, currentGW);
        if (picksResult && picksResult.status === 'ok' && picksResult.data) {
            const safe = normalizePicksResponse(picksResult.data);
            const gwPoints = safe.entry_history?.points ?? 0;
            const captain = safe.picks.find(pick => pick.is_captain)?.element || null;
            const benchPoints = safe.picks.filter(pick => pick.position > 11).reduce((sum, pick) => sum + (pick.multiplier > 0 ? pick.points : 0), 0);
            
            // Update highlights
            if (gwPoints > gwHighlights.rocket.points) {
                gwHighlights.rocket = { player: participant, points: gwPoints };
            }
            if (gwPoints < gwHighlights.flop.points) {
                gwHighlights.flop = { player: participant, points: gwPoints };
            }
            if (benchPoints > gwHighlights.bench.points) {
                gwHighlights.bench = { player: participant, points: benchPoints };
            }
            
            // Captain highlight (lowest captain points)
            if (captain && gwPoints < gwHighlights.captain.points) {
                const captainName = bootstrapData.elements.find(el => el.id === captain)?.web_name || 'Unknown';
                gwHighlights.captain = { player: participant, captain: captainName, points: gwPoints };
            }
        } else {
            console.log(`⚠️ No gameweek data for ${participant.namn} (GW${currentGW})`);
        }
    }
    
    // Update league data with calculated highlights
    leagueData.highlights = {
        rocket: gwHighlights.rocket.player ? `${gwHighlights.rocket.player.namn} - ${gwHighlights.rocket.points} poäng` : 'Ingen data tillgänglig',
        flop: gwHighlights.flop.player ? `${gwHighlights.flop.player.namn} - ${gwHighlights.flop.points} poäng` : 'Ingen data tillgänglig',
        captain: gwHighlights.captain.player ? `${gwHighlights.captain.player.namn} - ${gwHighlights.captain.captain} (${gwHighlights.captain.points} poäng)` : 'Ingen data tillgänglig',
        bench: gwHighlights.bench.player ? `${gwHighlights.bench.player.namn} - ${gwHighlights.bench.points} poäng` : 'Ingen data tillgänglig'
    };
    
    console.log('✅ Weekly highlights calculated from API:', leagueData.highlights);
}

// Initialize FPL data - API-Only Mode with Throttling
async function initializeFPLData() {
    console.log('=== INITIALIZING FPL DATA (API-ONLY MODE WITH THROTTLING) ===');
    console.log('DISABLE_API_CALLS:', DISABLE_API_CALLS);
    
    if (DISABLE_API_CALLS) {
        console.log('❌ API calls disabled for local development (CORS restriction)');
        updateDataSourceIndicator('📊 Mock Data (Local Dev)', '#f59e0b', '#000');
        useFallbackData();
        return;
    }
    
    console.log('✅ API-ONLY MODE: Fetching real data from FPL API with throttling...');
    
    try {
        // Step 1: Fetch bootstrap data and determine current gameweek
        console.log('🔄 Step 1: Fetching bootstrap data...');
        const bootstrap = await fetchBootstrapData();
        if (!bootstrap) {
            throw new Error('Failed to fetch bootstrap data from FPL API');
        }
        
        // Determine current gameweek from bootstrap data
        const currentEvent = bootstrap?.events?.find(e => e.is_current);
        const gw = FORCE_GW ?? currentEvent?.id ?? 1;
        currentGameweek = gw;
        console.log(`✅ Gameweek determined: ${currentGameweek} (forced: ${FORCE_GW !== null})`);
        
        // Update UI labels if they exist
        document.querySelector('#gwLabel')?.replaceChildren(document.createTextNode(`Gameweek ${currentGameweek}`));
        if (currentEvent?.season_name) {
            document.querySelector('#seasonLabel')?.replaceChildren(document.createTextNode(currentEvent.season_name));
        }
        
        console.log(`📅 Available events:`, bootstrap.events.map(e => ({ id: e.id, name: e.name, finished: e.finished, is_current: e.is_current })));
        
        // Wake the proxy (helps cold starts)
        console.log('🔄 Waking up the proxy...');
        try {
            await fetchWithRetry('https://fpl-proxy-1.onrender.com/healthz');
        } catch (e) {
            console.log('⚠️ Proxy health check failed, continuing anyway...');
        }
        
        // Step 2: Update all participants with real FPL data
        console.log('🔄 Step 2: Updating all participants with real FPL data...');
        await updateParticipantsWithFPLData();
        
        // Step 3: Batch load picks with fallback to history
        console.log('🔄 Step 3: Batch loading picks with fallback to history...');
        const entryIds = LEGACY_PARTICIPANTS.filter(p => p.fplId).map(p => p.fplId);
        console.log(`📊 Loading data for ${entryIds.length} participants...`);
        
        const results = await loadAllPicksWithFallback(entryIds, currentGameweek);
        
        // Step 4: Process results and update league data
        console.log('🔄 Step 4: Processing results and updating league data...');
        await processPicksResults(results, bootstrap);
        
        // Step 5: Generate roasts from real data
        console.log('🔄 Step 5: Generating roasts from real data...');
        await generateRealRoasts();
        
        console.log('✅ FPL API data loaded successfully with throttling!');
        console.log('📊 Final leagueData:', leagueData);
        console.log('👥 Final LEGACY_PARTICIPANTS:', LEGACY_PARTICIPANTS);
        
        // Update data source indicator
        updateDataSourceIndicator('🌐 Live FPL Data (via Render Proxy)', '#10b981', '#000');
        
        // Populate UI with real data
        setTimeout(() => {
            console.log('🔄 Populating UI with real data...');
            populateTables();
            populateProfiles();
            updateHighlightsFromData();
            generateRoastMessages();
            
            // Idle prefetch of top 4 players for better UX (disabled in production)
            if (EAGER_FETCH_PICKS) {
                const entryIds = LEGACY_PARTICIPANTS.filter(p => p.fplId).map(p => p.fplId);
                if (entryIds.length > 0) {
                    console.log('🔄 Scheduling idle prefetch of top 4 players...');
                    prefetchSomeDetails(entryIds, currentGameweek, 4);
                }
            }
        }, 100);
        
    } catch (error) {
        console.error('❌ CRITICAL ERROR: FPL API is unreachable:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            type: error.name
        });
        
        // Check if it's a proxy error
        if (error.message.includes('CORS') || error.message.includes('Access-Control-Allow-Origin')) {
            console.log('⚠️ CORS error detected - proxy may not be working');
            updateDataSourceIndicator('⚠️ Proxy Error', '#f59e0b', '#000');
            showAPIErrorNotification('CORS error detected. The Render proxy may not be working correctly. Using fallback data.');
        } else if (error.message.includes('Network error') || error.message.includes('Failed to fetch')) {
            console.log('⚠️ Network error detected - Render proxy may be unavailable');
            updateDataSourceIndicator('⚠️ Proxy Unavailable', '#f59e0b', '#000');
            showAPIErrorNotification('Network error - Render proxy may be temporarily unavailable. Using fallback data.');
        } else {
            updateDataSourceIndicator('❌ API Error', '#ef4444', '#fff');
            showAPIErrorNotification(`API Error: ${error.message}. Using fallback data.`);
        }
        
        // Use fallback data
        console.log('🔄 Using fallback data due to API failure...');
        useFallbackData();
    }
}

// Function to generate league tables from API data - API-Only Mode
async function generateLeagueTablesFromAPI() {
    console.log('=== GENERATING LEAGUE TABLES FROM API (API-ONLY) ===');
    
    if (!bootstrapData || !bootstrapData.events) {
        throw new Error('No bootstrap data available. Cannot generate league tables in API-only mode.');
    }
    
    // Get all participants (should all have FPL IDs in API-only mode)
    const allParticipants = LEGACY_PARTICIPANTS.filter(p => p.fplId && p.fplId !== null);
    
    if (allParticipants.length === 0) {
        throw new Error('No participants with FPL IDs found. Cannot generate league tables.');
    }
    
    console.log(`📊 Generating tables for ${allParticipants.length} participants`);
    
    // Generate season table from real data
    leagueData.seasonTable = allParticipants
        .map(participant => ({
            position: 0, // Will be calculated after sorting
            name: participant.namn,
            points: participant.totalPoäng,
            gameweek: currentGameweek,
            managerId: participant.fplId
        }))
        .sort((a, b) => b.points - a.points)
        .map((player, index) => ({ ...player, position: index + 1 }));
    
    // Generate gameweek table from real data
    console.log(`🔄 Fetching gameweek ${currentGameweek} data for all participants...`);
    const gwData = [];
    
    // Note: This function uses picks data - should only be called for detail views, not tables
    if (!EAGER_FETCH_PICKS) {
        console.log('⚠️ generateLeagueTablesFromAPI: picks fetching disabled, using season totals only');
        for (const participant of allParticipants) {
            gwData.push({
                position: 0,
                name: participant.namn,
                points: participant.totalPoäng || 0,
                gameweek: currentGameweek,
                managerId: participant.fplId
            });
        }
    } else {
        for (const participant of allParticipants) {
            const picksResult = await getPicksCached(participant.fplId, currentGameweek);
            if (picksResult && picksResult.status === 'ok' && picksResult.data && picksResult.data.entry_history) {
                gwData.push({
                    position: 0, // Will be calculated after sorting
                    name: participant.namn,
                    points: picksResult.data.entry_history.points,
                    gameweek: currentGameweek,
                    managerId: participant.fplId
                });
                console.log(`✅ Added ${participant.namn} with ${picksResult.data.entry_history.points} points`);
            } else {
                console.log(`⚠️ No gameweek data for ${participant.namn} (GW${currentGameweek}) - using season total`);
                // Use season total points if gameweek data unavailable
                gwData.push({
                    position: 0,
                    name: participant.namn,
                    points: participant.totalPoäng || 0,
                    gameweek: currentGameweek,
                    managerId: participant.fplId
                });
            }
        }
    }
    
    leagueData.gameweekTable = gwData
        .sort((a, b) => b.points - a.points)
        .map((player, index) => ({ ...player, position: index + 1 }));
    
    console.log('✅ League tables generated from API:', {
        seasonTable: leagueData.seasonTable.length,
        gameweekTable: leagueData.gameweekTable.length
    });
}

// Use fallback data when API is completely unreachable (last resort)
function useFallbackData() {
    console.log('=== USING FALLBACK DATA (API UNAVAILABLE) ===');
    
    // Determine the appropriate indicator text
    let indicatorText = '📊 Mock Data';
    let indicatorColor = '#f59e0b';
    let textColor = '#000';
    
    if (DISABLE_API_CALLS) {
        indicatorText = '📊 Mock Data (Local Dev)';
    } else {
        indicatorText = '📊 Mock Data (API Failed)';
    }
    
    updateDataSourceIndicator(indicatorText, indicatorColor, textColor);
    
    // Try to load from localStorage first if we haven't already
    if (LEGACY_PARTICIPANTS.length === 0) {
        console.log('No participants data found, attempting to load from localStorage...');
        loadFromLocalStorage();
    }
    
    console.log('LEGACY_PARTICIPANTS length:', LEGACY_PARTICIPANTS.length);
    console.log('LEGACY_PARTICIPANTS:', LEGACY_PARTICIPANTS);
    
    // Validate LEGACY_PARTICIPANTS
    if (!LEGACY_PARTICIPANTS || LEGACY_PARTICIPANTS.length === 0) {
        console.error('CRITICAL ERROR: LEGACY_PARTICIPANTS is empty or undefined!');
        alert('CRITICAL ERROR: LEGACY_PARTICIPANTS is empty or undefined!');
        return;
    }
    
    // Clear bootstrap data to ensure mock roasts are used
    bootstrapData = {
        teams: {},
        players: {},
        events: []
    };
    
    // Generate fallback data from modular participant data
    leagueData = {
        seasonTable: LEGACY_PARTICIPANTS.map((participant, index) => ({
            position: index + 1,
            name: participant.namn,
            points: participant.totalPoäng,
            gameweek: currentGameweek,
            managerId: participant.fplId || (123456 + index) // Fallback ID if no FPL ID
        })),
        gameweekTable: LEGACY_PARTICIPANTS.map((participant, index) => ({
            position: index + 1,
            name: participant.namn,
            points: Math.floor(Math.random() * 50) + 45, // Mock gameweek points
            gameweek: currentGameweek,
            managerId: participant.fplId || (123456 + index)
        })).sort((a, b) => b.points - a.points).map((player, index) => ({ ...player, position: index + 1 })),
        highlights: {
            rocket: 'Melvin Yuksel - 89 poäng',
            flop: 'Johan Pauly - 45 poäng',
            captain: 'Erik Rotsenius - Harry Kane (2 poäng)',
            bench: 'Jakob Gårlin - 15 poäng'
        },
        players: LEGACY_PARTICIPANTS.map(participant => ({
            name: participant.namn,
            image: participant.image,
            points: participant.totalPoäng,
            team: participant.favoritlag,
            lastSeasonRank: participant.lastSeasonRank,
            bestGameweek: participant.bestGameweek,
            managerId: participant.fplId || null,
            profilRoast: participant.profilRoast
        }))
    };
    
    console.log('Generated leagueData:', leagueData);
    console.log('Season table length:', leagueData.seasonTable.length);
    console.log('Gameweek table length:', leagueData.gameweekTable.length);
    console.log('Players length:', leagueData.players.length);
    
    // Set current gameweek (should already be set to 1, but ensure it's correct)
    if (currentGameweek !== 1) {
        currentGameweek = 1;
        console.log('Updated currentGameweek to 1 for new season');
    }
    
    // Initialize prize chart
    console.log('Initializing prize chart...');
    initializePrizeChart();
    
    // Update the UI with fallback data - with a small delay to ensure DOM is ready
    console.log('=== POPULATING UI ===');
    setTimeout(() => {
        // Ensure main content is visible for population
        const mainContent = document.getElementById('mainContent');
        if (mainContent && mainContent.classList.contains('hidden')) {
            console.log('Making main content visible for data population...');
            mainContent.classList.remove('hidden');
        }
        
        console.log('Populating tables...');
        populateTables();
        console.log('Populating profiles...');
        populateProfiles();
        console.log('Updating highlights...');
        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            updateHighlightsFromData();
        }, 200);
        console.log('=== UI POPULATION COMPLETE ===');
        
        // Show info message about fallback data
        showFallbackInfo();
    }, 100);
}

// Show info about fallback data
function showFallbackInfo() {
    const infoDiv = document.createElement('div');
    infoDiv.id = 'fallbackInfo';
    infoDiv.innerHTML = `
        <div class="fallback-info">
            <i class="fas fa-info-circle"></i>
            <p>Visar exempeldata tills FPL-säsongen startar. Live-data kommer att laddas automatiskt när säsongen börjar.</p>
            <button onclick="this.parentElement.parentElement.remove()">Stäng</button>
        </div>
    `;
    document.body.appendChild(infoDiv);
}

// Show loading state
function showLoadingState() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingOverlay';
    loadingDiv.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>Hämtar FPL-data...</p>
        </div>
    `;
    document.body.appendChild(loadingDiv);
}

// Hide loading state
function hideLoadingState() {
    const loadingDiv = document.getElementById('loadingOverlay');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Show error state
function showErrorState() {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'errorOverlay';
    errorDiv.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Fel vid hämtning av data</h3>
            <p>Kunde inte hämta FPL-data. Försök igen senare.</p>
            <button onclick="location.reload()">Ladda om</button>
        </div>
    `;
    document.body.appendChild(errorDiv);
}

// Check if user is already logged in
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('fplLoggedIn');
    if (isLoggedIn === 'true') {
        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            showMainContent();
        }, 100);
    }
}

// Password check function
function checkPassword() {
    const passwordInput = document.getElementById('passwordInput');
    const password = passwordInput.value.trim(); // Remove whitespace
    
    console.log('Password entered:', password);
    console.log('Correct password:', CORRECT_PASSWORD);
    console.log('Password match:', password === CORRECT_PASSWORD);
    
    if (password === CORRECT_PASSWORD) {
        console.log('Password correct! Logging in...');
        localStorage.setItem('fplLoggedIn', 'true');
        showMainContent();
        passwordInput.value = '';
    } else {
        console.log('Password incorrect!');
        alert('Fel lösenord! Kontakta mig för att få rätt lösenord.');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// Show main content after successful login
function showMainContent() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainContent').classList.remove('hidden');
    
    // Initialize FPL data when user logs in
    console.log('Initializing FPL data after login...');
    initializeFPLData();
}

// Add data source indicator to the page
function addDataSourceIndicator() {
    // Remove existing indicator if it exists
    const existingIndicator = document.getElementById('dataSourceIndicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'dataSourceIndicator';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #1e293b;
        color: #06b6d4;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        z-index: 1000;
        border: 1px solid #334155;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: all 0.3s ease;
    `;
    indicator.textContent = '🔄 Loading...';
    indicator.onclick = testAPIConnection;
    
    // Add to body so it's always visible
    document.body.appendChild(indicator);
    
    // Update indicator based on data source immediately
    if (DISABLE_API_CALLS) {
        indicator.textContent = '📊 Mock Data (Local Dev)';
        indicator.style.background = '#f59e0b';
        indicator.style.color = '#000';
    } else {
        indicator.textContent = '🌐 Live FPL Data (via Render Proxy)';
        indicator.style.background = '#10b981';
        indicator.style.color = '#fff';
    }
}

// Test API connection manually
async function testAPIConnection() {
    console.log('🧪 MANUAL API TEST TRIGGERED');
    
    // Check if API calls are disabled
    if (DISABLE_API_CALLS) {
        console.log('🧪 API calls are disabled for local development');
        alert('API calls are currently disabled for local development.\n\nTo test API integration:\n1. Run: node deploy.js\n2. Deploy to a proper web server\n3. API will work when hosted (not file://)');
        return;
    }
    
    try {
        console.log('🧪 Testing bootstrap API via Render proxy...');
        const bootstrapTest = await fetch(`${FPL_PROXY_BASE}/bootstrap-static/`);
        console.log('🧪 Bootstrap response status:', bootstrapTest.status);
        
        if (bootstrapTest.ok) {
            const bootstrapData = await bootstrapTest.json();
            console.log('🧪 Bootstrap test successful:', {
                events: bootstrapData.events?.length || 0,
                teams: bootstrapData.teams?.length || 0
            });
        } else {
            throw new Error(`Bootstrap API returned status: ${bootstrapTest.status}`);
        }
        
        console.log('🧪 Testing player API for ID 1490173 (Melvin Yuksel)...');
        const playerTest = await fetch(`${FPL_PROXY_BASE}/entry/1490173/`);
        console.log('🧪 Player response status:', playerTest.status);
        
        if (playerTest.ok) {
            const playerData = await playerTest.json();
            const season = await resolveCurrentSeason().catch(() => 'Unknown');
            console.log('🧪 Player test successful:', {
                name: `${playerData.player_first_name} ${playerData.player_last_name}`,
                points: playerData.summary_overall_points,
                season: season
            });
        } else {
            throw new Error(`Player API returned status: ${playerTest.status}`);
        }
        
        console.log('🧪 Testing current gameweek picks...');
        const picksTest = await fetch(`${FPL_PROXY_BASE}/entry/1490173/event/${currentGameweek}/picks/`);
        console.log('🧪 Picks response status:', picksTest.status);
        
        if (picksTest.ok) {
            const picksData = await picksTest.json();
            const safe = normalizePicksResponse(picksData);
            console.log('🧪 Picks test successful:', {
                gameweek: safe.entry_history?.event ?? 'unknown',
                points: safe.entry_history?.points ?? 'unknown'
            });
        } else {
            console.log('⚠️ Picks API returned status:', picksTest.status, '- this may be normal for new season');
        }
        
        alert('✅ API test successful!\n\nFPL API is working correctly via Render proxy.\nCheck console for detailed results.');
        
    } catch (error) {
        console.error('🧪 API test failed:', error);
        
        if (error.message.includes('CORS')) {
            alert('❌ API test failed due to CORS restrictions.\n\nThis is expected when running locally.\nDeploy to a proper web server to enable API integration.');
        } else {
            alert(`❌ API test failed!\n\nError: ${error.message}\n\nCheck console for detailed error information.`);
        }
    }
}

// Update data source indicator
function updateDataSourceIndicator(text, bgColor, textColor) {
    const indicator = document.getElementById('dataSourceIndicator');
    if (indicator) {
        indicator.textContent = text;
        indicator.style.background = bgColor;
        indicator.style.color = textColor;
    }
}

// Show API error notification to admin
function showAPIErrorNotification(errorMessage = 'Unknown error') {
    const notification = document.createElement('div');
    notification.id = 'apiErrorNotification';
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ef4444;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        text-align: center;
        max-width: 400px;
    `;
    notification.innerHTML = `
        <div style="margin-bottom: 0.5rem;">⚠️ FPL API Error</div>
        <div style="font-size: 0.9rem; font-weight: normal;">
            Unable to fetch real-time data from FPL API.<br>
            Error: ${errorMessage}<br>
            Using fallback data. Check console for details.
        </div>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 1rem;
            background: white;
            color: #ef4444;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
        ">OK</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);
}

// Note: Duplicate API functions removed - using the ones defined earlier in the file

// Calculate gameweek scores
function calculateGameweekScores() {
    leagueData.gameweekTable = leagueData.seasonTable.map(player => ({
        ...player,
        points: player.gameweekPoints ? player.gameweekPoints[player.gameweekPoints.length - 1] : 0
    })).sort((a, b) => b.points - a.points);
    
    // Update positions
    leagueData.gameweekTable.forEach((player, index) => {
        player.position = index + 1;
    });
}

// Update player profiles
function updatePlayerProfiles() {
    leagueData.players = leagueData.seasonTable.map(player => ({
        name: player.name,
        image: generateAvatarDataURL(player.name.charAt(0)),
        points: player.points,
        team: 'Manchester United', // This would be fetched from team data
        lastSeasonRank: player.lastSeasonRank,
        bestGameweek: player.bestGameweek,
        managerId: player.managerId
    }));
}



// Save data (admin function)
function saveData() {
    localStorage.setItem('leagueData', JSON.stringify(leagueData));
}

// Admin panel constants

// Function to check if user is currently authenticated as admin
function isUserAdmin() {
    return isAdminAuthenticated || (document.getElementById('adminModal') && document.getElementById('adminModal').classList.contains('show'));
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Admin panel keyboard shortcut (Shift + A)
    document.addEventListener('keydown', function(e) {
        console.log('Key pressed:', e.key, 'Shift:', e.shiftKey);
        if (e.shiftKey && e.key === 'A') {
            console.log('Admin shortcut detected!');
            e.preventDefault();
            showAdminPasswordPrompt();
        }
    });
    
    // Close admin panel when clicking outside
    document.addEventListener('click', function(e) {
        const adminModal = document.getElementById('adminModal');
        if (e.target === adminModal) {
            hideAdminPanel();
        }
    });
    
    console.log('Event listeners set up successfully');
}

// Loading state guards
let loadingTables = false;

// Navigation functions
function resolveSectionId(id){
  const aliases = { 
    tables: ['tables','tabeller'], 
    profiles: ['profiles','participants','deltagare'] 
  };
  const list = aliases[id] || [id];
  for (const cand of list){
    if (document.getElementById(cand)) return cand;
  }
  return id;
}

const __origShowSection = typeof window.showSection === 'function' ? window.showSection : null;
window.showSection = function patchedShowSection(sectionId) {
  const resolved = resolveSectionId(sectionId);
  if (resolved !== sectionId) console.info('[Section alias]', sectionId, '→', resolved);

  // Guard against invalid input
  if (!resolved) return;

  console.log('showSection called with:', resolved);
  
  // Hide all sections
  const sections = document.querySelectorAll('.section');
  sections.forEach(section => section.classList.remove('active'));
  
  // Show selected section
  const targetSection = document.getElementById(resolved);
  if (targetSection) {
      targetSection.classList.add('active');
  }
  
  // Update navigation buttons
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => btn.classList.remove('active'));
  
  // Find and activate the correct button (safer than event.target)
  const activeButton = document.querySelector(`[onclick*="showSection('${sectionId}')"]`);
  if (activeButton) {
      activeButton.classList.add('active');
  }

  if (resolved === 'tables') {
    if (typeof populateTablesWrapper === 'function') {
      populateTablesWrapper().catch(e => console.error('Tables load failed', e));
    } else if (typeof loadTablesViewUsingAggregates === 'function') {
      // fallback direct
      (async () => {
        const b = await safeFetchBootstrap();
        const cur = (b?.events||[]).find(e=>e.is_current) || (b?.events||[])[0] || { id: 1 };
        const gw = (typeof FORCE_GW === 'number' && FORCE_GW > 0) ? FORCE_GW : (cur.id || 1);
        const ids = Array.from(new Set([
          ...(Array.isArray(window.ENTRY_IDS) ? window.ENTRY_IDS : []),
          ...(Array.isArray(window.LEGACY_PARTICIPANTS) ? window.LEGACY_PARTICIPANTS.map(p => p.fplId) : [])
        ].map(Number).filter(Boolean)));
        await loadTablesViewUsingAggregates(ids, gw, b);
      })().catch(e => console.error('Tables direct load failed', e));
    }
  }

  if (resolved === 'profiles') {
    if (typeof onClickDeltagare === 'function') {
      onClickDeltagare().catch(e => console.error('Profiles load failed', e));
    } else {
      // generic fallback
      (async () => {
        await ensureParticipantsData();
        if (typeof populateProfiles === 'function') {
          const participants = getConfiguredParticipants().map(normalizeParticipant);
          populateProfiles(participants);
        } else {
          console.warn('[Profiles] populateProfiles() not found');
        }
      })().catch(e => console.error('Profiles direct load failed', e));
    }
  }
  
  // Generate roast messages when highlights section is shown
  if (resolved === 'highlights') {
      console.log('Highlights section shown, generating roast messages...');
      setTimeout(() => {
          generateRoastMessages();
          generateBeerLevels();
          updateWallOfFameShame();
      }, 100);
  }

  return __origShowSection ? __origShowSection(resolved) : undefined;
};

function showTable(tableType) {
    // Guard against invalid input
    if (!tableType) return;
    
    // Hide all table containers
    const tableContainers = document.querySelectorAll('.table-container');
    tableContainers.forEach(container => container.classList.remove('active'));
    
    // Show selected table
    const targetTable = document.getElementById(tableType + 'Table');
    if (targetTable) {
        targetTable.classList.add('active');
    }
    
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Find and activate the correct button (safer than event.target)
    const activeButton = document.querySelector(`[onclick*="showTable('${tableType}')"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

// Ensure Tabeller uses the aggregate loader
async function populateTablesWrapper() {
  const bootstrap = await safeFetchBootstrap();
  const current = (bootstrap?.events||[]).find(e=>e.is_current) || (bootstrap?.events||[])[0];
  const gw = (typeof FORCE_GW==='number' && FORCE_GW>0) ? FORCE_GW : (current?.id || 1);

  let ids = getKnownEntryIds();
  if ((!ids || !ids.length) && window.LEAGUE_CODE){
    const s = await fetchJSON(`${API}/leagues-classic/${window.LEAGUE_CODE}/standings/?page_new_entries=1&page_standings=1&phase=1&__=${Date.now()}`);
    const derived = (s?.standings?.results || []).map(r => r.entry).filter(Boolean);
    ids = Array.from(new Set([...(ids||[]), ...derived]));
  }
  
  // If still no IDs after trying LEAGUE_CODE fallback, don't call aggregates
  if (!ids || !ids.length) {
    console.info('[Tables] No participants found (0 IDs) - missing ENTRY_IDS and standings empty/soft');
    // Render fallback row
    populateSeasonTable([], bootstrap);
    populateGameweekTable([], bootstrap);
    return;
  }
  
  await loadTablesViewUsingAggregates(ids, gw, bootstrap);
}

// Route all old calls here (no UI change)
window.populateTables = populateTablesWrapper;

// Populate tables with data (legacy - now routes to wrapper)
function populateTables() {
    populateTablesWrapper().catch(e => console.error('Tables load failed', e));
}

// Participants fallback renderer (no blank screen)
function renderNoParticipantsRow(){
  const tbody = document.querySelector('#profilesTableBody, #participantsTableBody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 6; td.textContent = 'No participants found (0 IDs)';
  tr.appendChild(td); tbody.appendChild(tr);
}

function populateSeasonTable(rows, bootstrap) {
    console.log('=== POPULATE SEASON TABLE (AGGREGATE) ===');
    console.log('Rows:', rows);
    console.log('Rows length:', rows ? rows.length : 'UNDEFINED');
    
    const tbody = document.getElementById('seasonTableBody');
    console.log('seasonTableBody element:', tbody);
    
    if (!tbody) {
        console.error('CRITICAL ERROR: seasonTableBody not found!');
        return;
    }
    
    // Make table renderers tolerate empty input (no "CRITICAL ERROR")
    function safeArray(a){ return Array.isArray(a) ? a : []; }
    rows = safeArray(rows);
    if (!rows.length) {
        console.info('[Tables] No rows to render (empty dataset)');
        tbody.innerHTML = '<tr><td colspan="4">No data available</td></tr>';
        return;
    }
    
    // Column definition for season table
    const COLS_SEASON = [
        { key: 'pos', render: (row, index) => index + 1 },
        { key: 'displayName', render: (row) => row.displayName || `Manager ${row.fplId}` },
        { key: 'totalPoints', render: (row) => row.totalPoints ?? 0 },
        { key: 'currentGW', render: () => currentGW }
    ];
    
    // Add debug assert
    const currentGW = FORCE_GW ?? bootstrap?.events?.find(e => e?.is_current)?.id ?? 1;
    console.info('[Tables] GW=', currentGW, 'sample row=', rows[0]);
    
    // Validate column data
    if (window.__DEBUG_MODE) {
        rows.slice(0, 3).forEach((row, index) => {
            console.assert(typeof row.totalPoints === 'number', 
                `Row ${index} totalPoints must be number:`, row);
            console.assert(typeof row.fplId === 'number' && row.fplId > 0,
                `Row ${index} fplId must be positive number:`, row);
        });
    }
    
    tbody.innerHTML = '';
    
    // Sort by total points (descending) - use totalPoints if available, fallback to gwPoints
    const sortedRows = [...rows].sort((a, b) => {
        const aPoints = a.totalPoints ?? a.gwPoints ?? 0;
        const bPoints = b.totalPoints ?? b.gwPoints ?? 0;
        return bPoints - aPoints;
    });
    
    sortedRows.forEach((player, index) => {
        console.log(`Creating row ${index + 1} for player:`, player);
        
        const row = document.createElement('tr');
        row.innerHTML = COLS_SEASON.map(col => 
            `<td>${col.render(player, index)}</td>`
        ).join('');
        
        // Add tooltip for blocked teams (only if enabled for tables)
        if (SHOW_PICKS_TOOLTIP_IN_TABLES && player.privateOrBlocked && player.fplId) {
            markBlockedRow(row, player.fplId);
        }
        
        tbody.appendChild(row);
    });
    
    console.log('Season table populated with', sortedRows.length, 'rows');
}

function populateGameweekTable(rows, bootstrap, currentGW) {
    console.log('=== POPULATE GAMEWEEK TABLE (AGGREGATE) ===');
    console.log('Rows:', rows);
    console.log('Rows length:', rows ? rows.length : 'UNDEFINED');
    
    const tbody = document.getElementById('gameweekTableBody');
    console.log('gameweekTableBody element:', tbody);
    
    if (!tbody) {
        console.error('CRITICAL ERROR: gameweekTableBody not found!');
        return;
    }
    
    // Make table renderers tolerate empty input (no "CRITICAL ERROR")
    function safeArray(a){ return Array.isArray(a) ? a : []; }
    rows = safeArray(rows);
    if (!rows.length) {
        console.info('[Tables] No rows to render (empty dataset)');
        tbody.innerHTML = '<tr><td colspan="4">No gameweek data available</td></tr>';
        return;
    }
    
    // Column definition for gameweek table
    const COLS_LATEST = [
        { key: 'pos', render: (row, index) => index + 1 },
        { key: 'displayName', render: (row) => row.displayName || `Manager ${row.fplId}` },
        { key: 'latestGw', render: () => gw },
        { key: 'latestGwPoints', render: (row) => row.gwPoints ?? 0 }
    ];
    
    // Add debug assert
    const gw = currentGW ?? FORCE_GW ?? bootstrap?.events?.find(e => e?.is_current)?.id ?? 1;
    console.info('[Tables] GW=', gw, 'sample row=', rows[0]);
    
    // Validate column data
    if (window.__DEBUG_MODE) {
        rows.slice(0, 3).forEach((row, index) => {
            console.assert(typeof row.gwPoints === 'number', 
                `Row ${index} gwPoints must be number:`, row);
            console.assert(typeof row.fplId === 'number' && row.fplId > 0,
                `Row ${index} fplId must be positive number:`, row);
            console.assert(Number.isInteger(gw) && gw > 0 && gw < 60,
                `GW must be valid integer (1-59):`, gw);
        });
    }
    
    tbody.innerHTML = '';
    
    // Sort by gameweek points (descending)
    const sortedRows = [...rows].sort((a, b) => (b.gwPoints ?? 0) - (a.gwPoints ?? 0));
    
    sortedRows.forEach((player, index) => {
        console.log(`Creating GW row ${index + 1} for player:`, player);
        
        const row = document.createElement('tr');
        row.innerHTML = COLS_LATEST.map(col => 
            `<td>${col.render(player, index)}</td>`
        ).join('');
        
        // Add tooltip for blocked teams (only if enabled for tables)
        if (SHOW_PICKS_TOOLTIP_IN_TABLES && player.privateOrBlocked && player.fplId) {
            markBlockedRow(row, player.fplId);
        }
        
        tbody.appendChild(row);
    });
    
    // Update gameweek label
    const gameweekLabel = document.getElementById('currentGameweekLabel');
    if (gameweekLabel) {
        gameweekLabel.textContent = `Gameweek ${gw}`;
    }
    
    console.log('Gameweek table populated with', sortedRows.length, 'rows');
}









// Highlights: never crash on 403; degrade gracefully
async function buildHighlight(entryId, gw) {
  const hist = await safeFetchHistory(entryId);
  const row  = (hist.current || []).find(x => x.event === gw) || null;
  const points = row?.points ?? null;

  let captain = '—', benchPoints = '—';
  try {
    const rec = await getPicksCached(entryId, gw); // your existing cached wrapper
    if (rec && rec.status === 'ok' && Array.isArray(rec.data?.picks)) {
      // derive captain/bench as you already do
      // captain = ...
      // benchPoints = ...
    }
  } catch (_) {} // don't crash highlights

  return { entryId, points, captain, benchPoints };
}

// Compute highlights from table data (when picks are not available)
function computeHighlightsFromTableData(seasonTable, gameweekTable) {
    if (!seasonTable || !gameweekTable || seasonTable.length === 0 || gameweekTable.length === 0) {
        return null;
    }
    
    try {
        // Veckans Raket - Highest gameweek points
        const rocket = gameweekTable[0];
        const rocketText = rocket ? `${rocket.name} - ${rocket.points} poäng` : 'Ingen data tillgänglig';
        
        // Veckans Sopa - Lowest gameweek points
        const flop = gameweekTable[gameweekTable.length - 1];
        const flopText = flop ? `${flop.name} - ${flop.points} poäng` : 'Ingen data tillgänglig';
        
        // Veckans Sämsta Kapten - Can't determine without picks, so omit
        const captainText = 'Ingen data tillgänglig (kräver picks-data)';
        
        return {
            rocket: rocketText,
            flop: flopText,
            captain: captainText,
            source: 'table-data'
        };
    } catch (error) {
        console.error('[Highlights] Failed to compute from table data:', error);
        return null;
    }
}

// Update highlights from gameweek data (resilient version)
async function updateHighlightsFromData() {
    console.log('=== UPDATE HIGHLIGHTS FROM DATA (RESILIENT) ===');
    
    // Check if DOM elements exist
    const weeklyRocketElement = document.getElementById('weeklyRocket');
    const weeklyFlopElement = document.getElementById('weeklyFlop');
    
    if (!weeklyRocketElement || !weeklyFlopElement) {
        console.error('CRITICAL ERROR: Highlight DOM elements not found!');
        return;
    }
    
    // Check if we have real data or should use mock data
    const useMockData = DISABLE_API_CALLS || !leagueData.gameweekTable || leagueData.gameweekTable.length === 0;
    
    if (useMockData) {
        console.log('No real data available for highlights - showing placeholder');
        
        // Show placeholder when no real data is available
        weeklyRocketElement.textContent = 'Ingen data tillgänglig ännu';
        weeklyFlopElement.textContent = 'Ingen data tillgänglig ännu';
        
        const captainElement = document.getElementById('weeklyCaptain');
        if (captainElement) {
            captainElement.textContent = 'Ingen data tillgänglig ännu';
        }
        
        return;
        
        } else {
        // Use real data from leagueData
        if (!leagueData.gameweekTable || leagueData.gameweekTable.length === 0) {
            console.error('CRITICAL ERROR: No gameweek data available!');
            return;
        }
        
        // Compute highlights from table data
        const highlights = computeHighlightsFromTableData(leagueData.seasonTable, leagueData.gameweekTable);
        
        if (highlights) {
            weeklyRocketElement.textContent = highlights.rocket;
            weeklyFlopElement.textContent = highlights.flop;
            
            const captainElement = document.getElementById('weeklyCaptain');
            if (captainElement) {
                captainElement.textContent = highlights.captain;
            }
            
            console.log('[Highlights] Updated from table data:', highlights);
        } else {
            console.warn('[Highlights] Could not compute highlights from table data');
            weeklyRocketElement.textContent = 'Ingen data tillgänglig ännu';
            weeklyFlopElement.textContent = 'Ingen data tillgänglig ännu';
            
            const captainElement = document.getElementById('weeklyCaptain');
            if (captainElement) {
                captainElement.textContent = 'Ingen data tillgänglig ännu';
            }
        }
    }
    
    // Generate gamified roast messages
    generateRoastMessages();
    generateBeerLevels();
    updateWallOfFameShame();
}

// Fetch captain and bench data for the current gameweek
async function fetchCaptainAndBenchData() {
    // Disabled for local development to avoid CORS issues
    console.log('API calls disabled for local development. Using mock captain and bench data');
    
    /* 
    // API calls disabled for local development due to CORS restrictions
    // Uncomment when deployed to a proper server
    try {
        const captainPromises = leagueData.gameweekTable.map(async (player) => {
            try {
                const response = await fetch(`${FPL_PROXY_BASE}/entry/${player.managerId}/event/${currentGameweek}/picks/`);
                const data = await response.json();
                
                // Find captain (multiplier = 2)
                const captain = data.picks.find(pick => pick.multiplier === 2);
                const captainPlayer = bootstrapData.players[captain?.element];
                
                // Calculate bench points
                const benchPicks = data.picks.filter(pick => pick.position > 11);
                const benchPoints = benchPicks.reduce((total, pick) => {
                    const player = bootstrapData.players[pick.element];
                    return total + (player?.total_points || 0);
                }, 0);
                
                return {
                    name: player.name,
                    captain: captainPlayer?.name || 'Okänd',
                    captainPoints: captainPlayer?.total_points || 0,
                    benchPoints: benchPoints,
                    managerId: player.managerId
                };
            } catch (error) {
                console.error(`Error fetching picks for ${player.name}:`, error);
                return null;
            }
        });
        
        const captainData = (await Promise.all(captainPromises)).filter(Boolean);
        
        if (captainData.length > 0) {
            // Veckans Sämsta Kapten - Lowest captain points
            const worstCaptain = captainData.reduce((worst, current) => 
                current.captainPoints < worst.captainPoints ? current : worst);
            document.getElementById('weeklyCaptain').textContent = 
                `${worstCaptain.name} - ${worstCaptain.captain} (${worstCaptain.captainPoints} poäng)`;
            
            // Bäst bänk - Highest bench points
            const bestBench = captainData.reduce((best, current) => 
                current.benchPoints > best.benchPoints ? current : best);
            document.getElementById('weeklyBench').textContent = 
                `${bestBench.name} - ${bestBench.benchPoints} poäng`;
        }
        
    } catch (error) {
        console.error('Error fetching captain and bench data:', error);
    }
    */
}

// Update highlights (admin function - commented out for regular users)
function updateHighlights() {
    const rocket = document.getElementById('rocketInput').value;
    const flop = document.getElementById('flopInput').value;
    const captain = document.getElementById('captainInput').value;
    
    if (rocket) {
        leagueData.highlights.rocket = rocket;
        document.getElementById('weeklyRocket').textContent = rocket;
        document.getElementById('rocketInput').value = '';
    }
    
    if (flop) {
        leagueData.highlights.flop = flop;
        document.getElementById('weeklyFlop').textContent = flop;
        document.getElementById('flopInput').value = '';
    }
    
    if (captain) {
        leagueData.highlights.captain = captain;
        document.getElementById('weeklyCaptain').textContent = captain;
        document.getElementById('captainInput').value = '';
    }
    
    saveData();
}

// Populate player profiles
function populateProfiles() {
    console.log('=== POPULATE PROFILES ===');
    
    const participants = getConfiguredParticipants().map(normalizeParticipant);
    console.log('participants:', participants);
    console.log('participants length:', participants ? participants.length : 'UNDEFINED');
    
    const profilesGrid = document.getElementById('profilesGrid');
    console.log('profilesGrid element:', profilesGrid);
    
    if (!profilesGrid) {
        console.error('CRITICAL ERROR: profilesGrid not found!');
        return;
    }
    
    if (!participants || participants.length === 0) {
        console.error('CRITICAL ERROR: No participants available!');
        profilesGrid.innerHTML = '<div style="text-align: center; padding: 2rem; color: #94a3b8;">No participants available</div>';
        return;
    }
    
    profilesGrid.innerHTML = '';
    
    participants.forEach((player, index) => {
        console.log(`Creating profile card ${index + 1} for player:`, player);
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        
        // Get team icon from bootstrap data or use placeholder
        const teamIcon = bootstrapData.teams && bootstrapData.teams[player.team] 
            ? `https://resources.premierleague.com/premierleague/badges/t${bootstrapData.teams[player.team]}.png`
            : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMWUyOTNiIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmaWxsPSIjMDZiNmQ0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+4p2Q8L3RleHQ+Cjwvc3ZnPg==';
        
        playerCard.innerHTML = `
            <div class="player-header">
                <img src="${player.image}" alt="${player.namn}" class="player-avatar">
                <div class="player-info">
                    <h3 title="Bästa GW någonsin: ${player.bestGameweek} poäng">
                        ${player.namn}
                        ${player.favoritlag ? `<span class="team-name">(${player.favoritlag})</span>` : ''}
                        <i class="fas fa-trophy" style="color: #f59e0b; font-size: 0.875rem;"></i>
                    </h3>
                    <p>${player.favoritlag || 'Inget favoritlag'}</p>
                </div>
            </div>
            <div class="player-stats">
                <div class="stat">
                    <span class="stat-label">Totala poäng</span>
                    <span class="stat-value">${player.totalPoäng}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Förra årets placering</span>
                    <span class="stat-value">${player.lastSeasonRank}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Bästa GW någonsin</span>
                    <span class="stat-value">${player.bestGameweek}</span>
                </div>
            </div>
            ${player.profilRoast ? `
            <div class="player-roast">
                <p>${player.profilRoast}</p>
            </div>
            ` : ''}
        `;
        profilesGrid.appendChild(playerCard);
    });
    
    console.log('Profiles populated with', participants.length, 'cards');
}

// Add player (admin function - commented out for regular users)
function addPlayer() {
    const name = document.getElementById('playerName').value;
    const image = document.getElementById('playerImage').value;
    const points = parseInt(document.getElementById('playerPoints').value);
    const team = document.getElementById('playerTeam').value;
    
    if (name && points >= 0 && team) {
        const newPlayer = {
            name: name,
            image: image || generateAvatarDataURL(name.charAt(0)),
            points: points,
            team: team,
            lastSeasonRank: 'N/A',
            bestGameweek: 0
        };
        
        leagueData.players.push(newPlayer);
        populateProfiles();
        saveData();
        
        // Clear form
        document.getElementById('playerName').value = '';
        document.getElementById('playerImage').value = '';
        document.getElementById('playerPoints').value = '';
        document.getElementById('playerTeam').value = '';
    }
}

// Copy league code to clipboard
function copyLeagueCode() {
    const leagueCode = document.getElementById('leagueCode').textContent;
    const copyFeedback = document.getElementById('copyFeedback');
    
    navigator.clipboard.writeText(leagueCode).then(() => {
        // Show feedback
        copyFeedback.classList.remove('hidden');
        
        // Hide feedback after 3 seconds
        setTimeout(() => {
            copyFeedback.classList.add('hidden');
        }, 3000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Kunde inte kopiera koden. Kopiera manuellt: 46mnf2');
    });
}

// Generate gamified roast messages - API-Only Mode
function generateRoastMessages() {
    const roastGrid = document.getElementById('roastGrid');
    
    if (!roastGrid) {
        console.error('roastGrid element not found!');
        return;
    }
    
    roastGrid.innerHTML = '';
    
    // In API-only mode, we always use real data
    console.log('🔄 Generating roast messages from API data...');
    
    // Generate roasts from real data
    generateRealRoasts().then(realRoasts => {
        if (realRoasts && realRoasts.length > 0) {
            realRoasts.forEach(roast => {
                roastGrid.appendChild(createRoastCard(roast));
            });
            console.log(`✅ Displayed ${realRoasts.length} roasts from API data`);
        } else {
            // Fallback message if no roasts generated
            const fallbackCard = createRoastCard({
                type: 'fallback',
                title: 'Ingen data tillgänglig',
                message: 'Kunde inte ladda roast-data från FPL API just nu.',
                player: 'System',
                emoji: '⚠️'
            });
            roastGrid.appendChild(fallbackCard);
            console.log('⚠️ No roasts generated, showing fallback message');
        }
    }).catch(error => {
        console.error('❌ Error generating roasts:', error);
        // Show error message
        const errorCard = createRoastCard({
            type: 'error',
            title: 'API Fel',
            message: 'Kunde inte ladda roast-data från FPL API.',
            player: 'System',
            emoji: '❌'
        });
        roastGrid.appendChild(errorCard);
    });
}

// Create roast card element
function createRoastCard(roast) {
    const card = document.createElement('div');
    card.className = `roast-card ${roast.type}`;
    card.innerHTML = `
        <div class="roast-title">
            ${roast.title} <span class="roast-emoji">${roast.emoji}</span>
        </div>
        <div class="roast-message">
            ${roast.message.replace(roast.player, `<span class="roast-player">${roast.player}</span>`)}
        </div>
    `;
    return card;
}

// Generate real roasts from API data - API-Only Mode
async function generateRealRoasts() {
    console.log('=== GENERATING REAL ROASTS FROM API (API-ONLY) ===');
    
    const roasts = [];
    
    // Get all participants (should all have FPL IDs in API-only mode)
    const allParticipants = LEGACY_PARTICIPANTS.filter(p => p.fplId && p.fplId !== null);
    
    if (allParticipants.length === 0) {
        throw new Error('No participants with FPL IDs found. Cannot generate roasts in API-only mode.');
    }
    
    console.log(`📊 Generating roasts for ${allParticipants.length} participants`);
    
    // Calculate various roast-worthy statistics
    const roastStats = [];
    
    for (const participant of allParticipants) {
        const picksResult = await getPicksCached(participant.fplId, currentGameweek);
        if (picksResult && picksResult.status === 'ok' && picksResult.data) {
            const safe = normalizePicksResponse(picksResult.data);
            const gwPoints = safe.entry_history?.points ?? 0;
            const captain = safe.picks.find(pick => pick.is_captain);
            const captainPoints = captain ? captain.points * captain.multiplier : 0;
            const benchPoints = safe.picks.filter(pick => pick.position > 11).reduce((sum, pick) => sum + (pick.multiplier > 0 ? pick.points : 0), 0);
            const transfers = safe.entry_history?.event_transfers ?? 0;
            const transferCost = safe.entry_history?.event_transfers_cost ?? 0;
            
            roastStats.push({
                participant,
                gwPoints,
                captainPoints,
                benchPoints,
                transfers,
                transferCost
            });
        } else {
            console.log(`⚠️ No gameweek data for ${participant.namn} (GW${currentGameweek})`);
        }
    }
    
    // Generate roasts based on real data
    if (roastStats.length > 0) {
        // Worst gameweek performance
        const worstPlayer = roastStats.reduce((worst, current) => 
            current.gwPoints < worst.gwPoints ? current : worst
        );
        
        roasts.push({
            type: 'sopa',
            title: 'Veckans Sopa',
            message: `${worstPlayer.participant.namn} fick bara ${worstPlayer.gwPoints} poäng den här veckan. Pinsamt.`,
            player: worstPlayer.participant.namn,
            emoji: '🍺🚫'
        });
        
        // Worst captain choice
        const worstCaptain = roastStats.reduce((worst, current) => 
            current.captainPoints < worst.captainPoints ? current : worst
        );
        
        if (worstCaptain.captainPoints < 4) {
            roasts.push({
                type: 'captain',
                title: 'Kaptenmiss',
                message: `${worstCaptain.participant.namn} kapten fick bara ${worstCaptain.captainPoints} poäng. Kaptenkaos!`,
                player: worstCaptain.participant.namn,
                emoji: '❗'
            });
        }
        
        // Most transfers (wasteful)
        const transferHappy = roastStats.reduce((most, current) => 
            current.transfers > most.transfers ? current : most
        );
        
        if (transferHappy.transfers > 2) {
            roasts.push({
                type: 'transfers',
                title: 'Transfer Happy',
                message: `${transferHappy.participant.namn} gjorde ${transferHappy.transfers} transfers (-${transferHappy.transferCost} poäng). Trigger happy!`,
                player: transferHappy.participant.namn,
                emoji: '🔄'
            });
        }
        
        // Best bench points (if significant)
        const bestBench = roastStats.reduce((best, current) => 
            current.benchPoints > best.benchPoints ? current : best
        );
        
        if (bestBench.benchPoints > 10) {
            roasts.push({
                type: 'bench',
                title: 'Skön bänk kungen 🙄',
                message: `${bestBench.participant.namn} hade ${bestBench.benchPoints}p på bänken. Bästa bänken någonsin!`,
                player: bestBench.participant.namn,
                emoji: '🔥'
            });
        }
    }
    
    console.log(`✅ Generated ${roasts.length} roasts from API data`);
    return roasts;
}

// Toggle roast expansion
function toggleRoasts() {
    console.log('toggleRoasts called, roastsExpanded:', roastsExpanded);
    const roastGrid = document.getElementById('roastGrid');
    const expandBtn = document.getElementById('expandRoastsBtn');
    
    if (!roastGrid || !expandBtn) {
        console.error('Required elements not found for toggleRoasts');
        return;
    }
    
    const remainingRoasts = JSON.parse(roastGrid.dataset.remainingRoasts || '[]');
    console.log('remainingRoasts:', remainingRoasts);
    
    if (!roastsExpanded && remainingRoasts.length > 0) {
        // Expand
        console.log('Expanding roasts...');
        remainingRoasts.forEach(roast => {
            roastGrid.appendChild(createRoastCard(roast));
        });
        expandBtn.innerHTML = '<i class="fas fa-chevron-up"></i><span>Visa färre</span>';
        expandBtn.classList.add('expanded');
        roastsExpanded = true;
    } else {
        // Collapse
        console.log('Collapsing roasts...');
        const cards = roastGrid.querySelectorAll('.roast-card');
        for (let i = 3; i < cards.length; i++) {
            cards[i].remove();
        }
        expandBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>Visa fler horribla insatser</span>';
        expandBtn.classList.remove('expanded');
        roastsExpanded = false;
    }
}

// Generate beer levels
function generateBeerLevels() {
    const beerGrid = document.getElementById('beerGrid');
    beerGrid.innerHTML = '';
    
    // Check if we have real data or should use mock data
    const useMockData = !bootstrapData.players || Object.keys(bootstrapData.players).length === 0;
    
    if (useMockData) {
        // Use mock beer data
        const mockBeerLevels = [
            {
                level: '🟢',
                message: 'Du förtjänar en iskall öl!',
                player: 'Melvin Yuksel',
                type: 'green'
            },
            {
                level: '🟡',
                message: 'Du förtjänar... en alkoholfri.',
                player: 'Jakob Gårlin',
                type: 'yellow'
            },
            {
                level: '🔴',
                message: 'Du förtjänar inte en öl denna vecka.',
                player: 'Johan Pauly',
                type: 'red'
            }
        ];
        
        mockBeerLevels.forEach(beer => {
            beerGrid.appendChild(createBeerCard(beer));
        });
    } else {
        // Generate beer levels from real data
        const realBeerLevels = generateRealBeerLevels();
        realBeerLevels.forEach(beer => {
            beerGrid.appendChild(createBeerCard(beer));
        });
    }
}

// Create beer card element
function createBeerCard(beer) {
    const card = document.createElement('div');
    card.className = `beer-card ${beer.type}`;
    card.innerHTML = `
        <div class="beer-level">${beer.level}</div>
        <div class="beer-message">${beer.message}</div>
        <div class="beer-player">${beer.player}</div>
    `;
    return card;
}

// Generate real beer levels from API data
function generateRealBeerLevels() {
    const beerLevels = [];
    
    if (leagueData.gameweekTable.length > 0) {
        // Top performer gets green
        const topPlayer = leagueData.gameweekTable[0];
        beerLevels.push({
            level: '🟢',
            message: 'Du förtjänar en iskall öl!',
            player: topPlayer.name,
            type: 'green'
        });
        
        // Middle performer gets yellow
        const middleIndex = Math.floor(leagueData.gameweekTable.length / 2);
        const middlePlayer = leagueData.gameweekTable[middleIndex];
        beerLevels.push({
            level: '🟡',
            message: 'Du förtjänar... en alkoholfri.',
            player: middlePlayer.name,
            type: 'yellow'
        });
        
        // Worst performer gets red
        const worstPlayer = leagueData.gameweekTable[leagueData.gameweekTable.length - 1];
        beerLevels.push({
            level: '🔴',
            message: 'Du förtjänar inte en öl denna vecka.',
            player: worstPlayer.name,
            type: 'red'
        });
    }
    
    return beerLevels;
}

// Update wall of fame/shame
function updateWallOfFameShame() {
    const fameStats = document.getElementById('fameStats');
    const shameStats = document.getElementById('shameStats');
    
    // Check if we have real data or should use mock data
    const useMockData = !bootstrapData.players || Object.keys(bootstrapData.players).length === 0;
    
    if (useMockData) {
        // Use mock wall data
        fameStats.innerHTML = `
            <div class="wall-stat">
                <span class="wall-stat-label">Veckans Raket</span>
                <span class="wall-stat-value">Melvin Yuksel (3)</span>
            </div>
            <div class="wall-stat">
                <span class="wall-stat-label">Bästa GW någonsin</span>
                <span class="wall-stat-value">98p - Melvin Yuksel</span>
            </div>
            <div class="wall-stat">
                                        <span class="wall-stat-label">Flest flaskor bubbel</span>
                <span class="wall-stat-value">Julius Höglund</span>
            </div>
        `;
        
        shameStats.innerHTML = `
            <div class="wall-stat">
                <span class="wall-stat-label">Veckans Sopa</span>
                <span class="wall-stat-value">Johan Pauly (5)</span>
            </div>
            <div class="wall-stat">
                <span class="wall-stat-label">Sämsta Kapten</span>
                <span class="wall-stat-value">Erik Rotsenius (4)</span>
            </div>
            <div class="wall-stat">
                <span class="wall-stat-label">Mest Minuspoäng</span>
                <span class="wall-stat-value">Sigge Carlsson (-16p)</span>
            </div>
        `;
    } else {
        // Generate real wall data
        const fameData = generateRealFameStats();
        const shameData = generateRealShameStats();
        
        fameStats.innerHTML = fameData;
        shameStats.innerHTML = shameData;
    }
}

// Generate real fame stats
function generateRealFameStats() {
    // Count gameweeks over 100 points for each participant
    const participantStats = LEGACY_PARTICIPANTS.map(participant => {
        // For mock data, generate random number of 100+ point gameweeks
        const highScoreWeeks = Math.floor(Math.random() * 8) + 1; // 1-8 weeks
        return {
            name: participant.namn,
            highScoreWeeks: highScoreWeeks
        };
    });
    
    // Find participant with most 100+ point gameweeks
    const mostBubbles = participantStats.reduce((max, current) => 
        current.highScoreWeeks > max.highScoreWeeks ? current : max);
    
    return `
        <div class="wall-stat">
            <span class="wall-stat-label">Veckans Raket</span>
            <span class="wall-stat-value">${leagueData.gameweekTable[0]?.name || 'N/A'} (1)</span>
        </div>
        <div class="wall-stat">
            <span class="wall-stat-label">Flest flaskor bubbel</span>
            <span class="wall-stat-value">${mostBubbles.name} (${mostBubbles.highScoreWeeks})</span>
        </div>
    `;
}

// Generate real shame stats
function generateRealShameStats() {
    // Placeholder for real shame stats
    return `
        <div class="wall-stat">
            <span class="wall-stat-label">Veckans Sopa</span>
            <span class="wall-stat-value">${leagueData.gameweekTable[leagueData.gameweekTable.length - 1]?.name || 'N/A'} (1)</span>
        </div>
    `;
}

// Auto-refresh data every 5 minutes (optional)
setInterval(() => {
    // Refresh data periodically
    console.log('Auto-refresh not implemented yet');
}, 300000);

// Export functions to window for global access
window.checkPassword = checkPassword;
// window.showSection is already patched above - don't override
window.showTable = showTable;
// logout function removed - not needed
window.copyLeagueCode = copyLeagueCode;
window.toggleRoasts = toggleRoasts;

window.showAdminPasswordPrompt = showAdminPasswordPrompt;
window.hideAdminPanel = hideAdminPanel;
window.updateParticipantField = updateParticipantField;
window.saveParticipantChanges = saveParticipantChanges;
window.deleteParticipant = deleteParticipant;
window.showAddParticipantForm = showAddParticipantForm;
window.hideAddParticipantForm = hideAddParticipantForm;
window.addNewParticipant = addNewParticipant;
window.exportParticipantsData = exportParticipantsData;
window.saveToLocalStorage = saveToLocalStorage;
window.showPrizeTotalInput = showPrizeTotalInput;
window.hidePrizeTotalInput = hidePrizeTotalInput;
window.hideAdminPrizeInput = hideAdminPrizeInput;
window.updatePrizeTotal = updatePrizeTotal;





console.log('=== SCRIPT.JS LOADED COMPLETELY ===');

// Add a simple global test function that should always be available
window.testScriptLoaded = function() {
    console.log('Script is loaded!');
    console.log('ADMIN_PASSWORD:', ADMIN_PASSWORD);
    console.log('LEGACY_PARTICIPANTS length:', LEGACY_PARTICIPANTS.length);
    return 'Script loaded successfully';
};

// One-liner to verify wiring
console.log('build', window.__BUILD_TAG__, 'ENTRY_IDS', (window.ENTRY_IDS||[]).length);

// Diagnostics for unresolved IDs (dev-only)
window.__diagNames = function(){
  const ids = Array.isArray(window.ENTRY_IDS) ? window.ENTRY_IDS : [];
  const missing = [];
  for (const id of ids) {
    const o = window.PARTICIPANT_OVERRIDES?.[id];
    if (!o || !o.displayName) missing.push(id);
  }
  console.info('[Names] overrides:', Object.keys(window.PARTICIPANT_OVERRIDES||{}).length,
               'ENTRY_IDS:', ids.length, 'missing names for ids:', missing.slice(0,20));
};

// State printer for quick verification
window.__printState = function(){
  const ids = Array.isArray(window.ENTRY_IDS) ? window.ENTRY_IDS : [];
  const o   = window.PARTICIPANT_OVERRIDES || {};
  console.log('[State] ENTRY_IDS len:', ids.length, 'first10:', ids.slice(0,10));
  console.log('[State] overrides count:', Object.keys(o).length);
  // Quick sample mapping check:
  const sample = ids.slice(0,5).map(id => ({ id, name: (o[id]&&o[id].displayName) || null }));
  console.log('[State] sample overrides:', sample);
};

// Quick debug utilities
window.__dumpNormalized = () => {
  console.log('[Dump] first 3 rows:', (window.__lastRows || []).slice(0,3));
  return (window.__lastRows || []).slice(0,3);
};

// Self-check for table data
window.__assertTables = () => {
  const rows = window.__lastRows || [];
  const anyNonZeroGW = rows.some(r => r.gwPoints > 0);
  const anyNonZeroTot = rows.some(r => r.totalPoints > 0);
  console.info('[Assert] anyNonZeroGW=', anyNonZeroGW, 'anyNonZeroTot=', anyNonZeroTot);
  return { anyNonZeroGW, anyNonZeroTot };
};

// Add direct admin access that doesn't rely on function exports
window.adminLogin = function() {
    console.log('Direct admin login attempt');
    const password = prompt('Ange adminlösenord:');
    if (password === 'Pepsie10') {
        console.log('Admin login successful');
        // Try to show admin panel directly
        const adminModal = document.getElementById('adminModal');
        if (adminModal) {
            adminModal.classList.add('show');
            console.log('Admin panel should now be visible');
        } else {
            console.error('Admin modal not found');
        }
    } else {
        console.log('Admin login failed');
        alert('Felaktigt lösenord!');
    }
};

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
        throw new Error(`Fallback bootstrap not found: ${res2.status}`);
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
    console.error(`[History] Failed to fetch history for ${entryId}:`, error.name, error.message);
    
    // Provide more specific error context
    if (error.name === 'TypeError' && error.message.includes('Load failed')) {
      throw new Error(`CORS/Network issue: Cannot fetch history for entry ${entryId}. Using fallback data.`);
    }
    
    throw error;
  }
}

// Compute season total and GW points from entry history
function computeSeasonAndGw(historyJson, latestGw) {
  try {
    const current = Array.isArray(historyJson?.current) ? historyJson.current : [];
    
    if (current.length === 0) {
      console.warn('[Compute] No history data for GW computation');
      return { seasonTotal: 0, latestGwPoints: 0 };
    }
    
    // Season total: take the highest total_points in current (usually last item)
    const seasonTotal = current.reduce((m, it) => Math.max(m, Number(it?.total_points || 0)), 0);
    
    // Latest GW points: find item where event === latestGw and read 'points'
    const gwItem = current.find(it => Number(it?.event) === Number(latestGw));
    const latestGwPoints = Number(gwItem?.points ?? NaN);
    
    console.log(`[Compute] Entry: seasonTotal=${seasonTotal}, latestGw=${latestGw}, latestGwPoints=${latestGwPoints}`);
    
    return { seasonTotal, latestGwPoints };
  } catch (error) {
    console.error('[Compute] Failed to compute season and GW data:', error);
    return { seasonTotal: 0, latestGwPoints: 0 };
  }
}

// Concurrency mapper with limit
async function mapWithConcurrency(items, worker, limit = 6) {
  const queue = [...items];
  const results = new Array(items.length);
  
  const run = async () => {
    while (queue.length) {
      const item = queue.shift();
      const index = items.indexOf(item);
      try {
        results[index] = await worker(item);
      } catch (error) {
        console.error(`[Concurrency] Worker failed for item ${index}:`, error);
        results[index] = { error: error.message };
      }
    }
  };
  
  const workers = Array.from({ length: limit }, run);
  await Promise.all(workers);
  return results;
}

// Fetch with retry and exponential backoff
async function fetchWithRetry(url, opts = {}, tries = 3) {
  let attempt = 0, lastErr;
  
  while (attempt < tries) {
    try {
      const res = await fetch(url, { 
        cache: 'no-store', 
        mode: 'cors', 
        ...opts 
      });
      
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`Retryable ${res.status}`);
      }
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      return res;
    } catch (e) {
      lastErr = e;
      attempt++;
      
      if (attempt < tries) {
        const delay = 400 * Math.pow(2, attempt) + Math.random() * 300;
        console.log(`[Retry] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms:`, e.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw lastErr;
}

// Centralized status display system
function showStatus(type, message, options = {}) {
  const { details, persistent = false, debugOnly = false } = options;
  
  // In normal mode, only show warnings and errors
  if (!window.__DEBUG_MODE && type === 'info') {
    return;
  }
  
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
  
  // Auto-hide info/warn messages unless persistent
  if (!persistent && type !== 'error') {
    setTimeout(() => {
      if (status.parentNode) {
        status.remove();
      }
    }, 8000);
  }
}

// Subtle data source indicator (normal mode) and detailed indicator (debug mode)
function renderDataSourceIndicator({ source, lastSync, ageMinutes, fallbackInfo }) {
  // Remove existing indicators
  ['dataSourceIndicator', 'dataSourceDot'].forEach(id => {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
  });
  
  if (source === 'direct') {
    // Direct API - no indicator needed in normal mode
    if (window.__DEBUG_MODE) {
      showStatus('info', 'Data source: Direct API', { debugOnly: true });
    }
    return;
  }
  
  if (source === 'fallback') {
    // Determine freshness status
    let freshnessStatus = 'fresh';
    let statusType = 'info';
    let statusMessage = '';
    
    if (ageMinutes >= 180) {
      freshnessStatus = 'degraded';
      statusType = 'error';
      statusMessage = `Synkad data är för gammal (senast: ${new Date(lastSync).toLocaleString()}). Resultaten kan vara inaktuella.`;
    } else if (ageMinutes >= 30) {
      freshnessStatus = 'stale';
      statusType = 'warn';
      statusMessage = `Synkad data är äldre än 30 min (senast: ${new Date(lastSync).toLocaleString()}).`;
    } else {
      freshnessStatus = 'fresh';
      statusType = 'info';
      statusMessage = `Using synced data (last sync: ${new Date(lastSync).toLocaleString()})`;
    }
    
    // Show status based on freshness
    if (freshnessStatus !== 'fresh') {
      showStatus(statusType, statusMessage, { 
        details: `Fallback data age: ${ageMinutes} minutes`,
        persistent: freshnessStatus === 'degraded'
      });
    }
    
    // In normal mode, show subtle indicator for fresh data
    if (freshnessStatus === 'fresh' && !window.__DEBUG_MODE) {
      const dot = document.createElement('div');
      dot.id = 'dataSourceDot';
      dot.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 8px;
        height: 8px;
        background: #3b82f6;
        border-radius: 50%;
        z-index: 10001;
        cursor: help;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      `;
      dot.title = `Using synced data (last sync: ${new Date(lastSync).toLocaleString()})`;
      document.body.appendChild(dot);
    }
    
    // In debug mode, show detailed indicator
    if (window.__DEBUG_MODE) {
      const indicator = document.createElement('div');
      indicator.id = 'dataSourceIndicator';
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: ${statusType === 'error' ? '#dc2626' : statusType === 'warn' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        z-index: 10001;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        font-family: monospace;
      `;
      
      const text = `Data: ${source.toUpperCase()} • ${freshnessStatus.toUpperCase()} • ${new Date(lastSync).toLocaleString()}`;
      indicator.textContent = text;
      indicator.title = `Data source: ${source}\nFreshness: ${freshnessStatus}\nLast sync: ${lastSync}\nAge: ${ageMinutes} minutes`;
      
      document.body.appendChild(indicator);
    }
  }
}