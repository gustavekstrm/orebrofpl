// Configuration
console.log('=== SCRIPT.JS LOADING ===');

// Ensure these functions exist (use no-op fallbacks if undefined)
window.fetchJSON = window.fetchJSON || (async () => ({}));
window.fetchAggregateSummaries = window.fetchAggregateSummaries || (async () => ({ results: [] }));
window.fetchAggregateHistory = window.fetchAggregateHistory || (async () => ({ results: [], gw: 1 }));
window.loadTablesViewUsingAggregates = window.loadTablesViewUsingAggregates || (async () => {});
window.ensureParticipantsData = window.ensureParticipantsData || (async () => { window.participantsData = window.participantsData || []; });

// Diagnostics (dev-only)
window.__diag = async function () {
  try {
    const PROXY_ROOT = 'https://fpl-proxy-1.onrender.com';
    const API = `${PROXY_ROOT}/api`;
    
    // Get final IDs used for aggregates
    const finalIds = getKnownEntryIds();

    console.log('[DIAG] ENTRY_IDS count:', (window.ENTRY_IDS||[]).length, 
                'participantsData:', (window.participantsData||[]).length,
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

// Global variables for aggregate endpoints
// window.LEAGUE_CODE and window.ENTRY_IDS are now set by participants.config.js

// Single source of truth for Entry IDs
function getKnownEntryIds() {
  const a = [];
  // Read from window.ENTRY_IDS first (from config)
  if (Array.isArray(window.ENTRY_IDS)) a.push(...window.ENTRY_IDS);
  // Then from participantsData as backup
  if (Array.isArray(window.participantsData)) {
    for (const p of window.participantsData) if (p?.fplId) a.push(p.fplId);
  }
  // dedupe + numeric
  return Array.from(new Set(a.map(n => Number(n)).filter(Boolean)));
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
  const cur = Array.isArray(historyData?.current) ? historyData.current : [];
  const row = cur.find(x => x?.event === gw);
  // FPL uses `points`; sometimes only `total_points` is present
  return (row?.points ?? row?.total_points ?? 0);
}

// Safe picks response normalizer
function normalizePicksResponse(rec){
  const data = rec?.data || rec || {};
  return {
    entry_history: data.entry_history || null,
    picks: Array.isArray(data.picks) ? data.picks : [],
  };
}

// Helper function to update ENTRY_IDS from participantsData (legacy - now handled by config)
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

async function getPicksCached(entryId, gw) {
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
    // render points from rec.history (if available), and show "—" for captain/bench
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

// 4. Fallback: if fplId is null, continue using mock/manual values
const participantsData = [
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
    for (const participant of participantsData) {
        const updated = await fetchParticipantFPLData(participant);
        updatedParticipants.push(updated);
    }
    
    // Update the global participantsData array
    participantsData.length = 0;
    participantsData.push(...updatedParticipants);
    
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
    
    participantsData.forEach((participant, index) => {
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
    if (index >= 0 && index < participantsData.length) {
        participantsData[index][field] = value;
        
        // Update the card styling based on new values
        const card = document.querySelector(`#adminParticipantsList .admin-participant-card:nth-child(${index + 1})`);
        if (card) {
            card.classList.remove('warning', 'error');
            
            if (!participantsData[index].fplId) {
                card.classList.add('warning');
            }
            if (!participantsData[index].profilRoast || participantsData[index].profilRoast.trim() === '') {
                card.classList.add('error');
            }
        }
    }
}

function saveParticipantChanges(index) {
    if (index >= 0 && index < participantsData.length) {
        // Update ENTRY_IDS for aggregate endpoints
        updateEntryIds();
        
        // Save to localStorage immediately
        try {
            localStorage.setItem('fplParticipantsData', JSON.stringify(participantsData));
            
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
    if (confirm(`Är du säker på att du vill ta bort ${participantsData[index].namn}?`)) {
        participantsData.splice(index, 1);
        
        // Update ENTRY_IDS for aggregate endpoints
        updateEntryIds();
        
        // Save to localStorage immediately
        try {
            localStorage.setItem('fplParticipantsData', JSON.stringify(participantsData));
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
    const fplId = document.getElementById('newFplId').value ? parseInt(document.getElementById('newFplId').value) : null;
    const roast = document.getElementById('newRoast').value.trim();
    const image = document.getElementById('newImage').value.trim();
    
    if (!name || !team) {
        alert('Namn och favoritlag är obligatoriska!');
        return;
    }
    
    const newParticipant = {
        namn: name,
        totalPoäng: 2000, // Default starting points
        favoritlag: team,
        fplId: fplId,
        profilRoast: roast || '',
        image: image || generateAvatarDataURL(name.charAt(0)),
        lastSeasonRank: 50, // Default rank
        bestGameweek: 60 // Default best GW
    };
    
    participantsData.push(newParticipant);
    
    // Update ENTRY_IDS for aggregate endpoints
    updateEntryIds();
    
    // Save to localStorage immediately
    try {
        localStorage.setItem('fplParticipantsData', JSON.stringify(participantsData));
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
    const dataStr = JSON.stringify(participantsData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'participants-data.json';
    link.click();
    
    URL.revokeObjectURL(url);
    alert('Data exporterad som participants-data.json');
}

function saveToLocalStorage() {
    // Update ENTRY_IDS for aggregate endpoints
    updateEntryIds();
    
    try {
        localStorage.setItem('fplParticipantsData', JSON.stringify(participantsData));
        
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
                participantsData.splice(0, participantsData.length, ...parsedData);
                console.log('Loaded participants data from localStorage:', participantsData.length, 'participants');
                
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
    
    // Add data source indicator immediately
    addDataSourceIndicator();
    
    checkLoginStatus();
    setupEventListeners();
    loadFromLocalStorage(); // Load saved participant data
    
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
function normalizeAggregateRows(summaries, histories, gw) {
  const ids = Array.isArray(window.ENTRY_IDS) ? window.ENTRY_IDS.map(Number) : [];
  const byId = new Map();

  const resultsS = Array.isArray(summaries?.results) ? summaries.results : [];
  for (const r of resultsS) {
    const id = Number(r?.id);
    if (!Number.isFinite(id)) continue;
    const api = r?.data || {};
    const ov  = applyParticipantOverride(id, api);
    // Try common total/overall fields from FPL summary:
    const total =
      api?.summary_overall_points ??
      api?.overall_points ?? // safety alias
      api?.summary_event_points ?? null;

    byId.set(id, {
      fplId: id,
      displayName: ov.displayName,
      teamName: ov.teamName,
      gwPoints: null,
      totalPoints: total,
      privateOrBlocked: false,
      summary: api
    });
  }

  const resultsH = Array.isArray(histories?.results) ? histories.results : [];
  for (const r of resultsH) {
    const id = Number(r?.id);
    if (!Number.isFinite(id)) continue;
    const api = r?.data || {};
    
    const gwPoints = deriveGwPointsFromHistory(api, gw);

    // ensure presence
    if (!byId.has(id)) {
      const ov = applyParticipantOverride(id, {});
      byId.set(id, {
        fplId: id,
        displayName: ov.displayName,
        teamName: ov.teamName,
        gwPoints: null,
        totalPoints: null,
        privateOrBlocked: true
      });
    }
    const obj = byId.get(id);
    obj.gwPoints = Number.isFinite(gwPoints) ? gwPoints : 0;
    obj.history  = api;
    // if we had to synthesize, keep privateOrBlocked = true
  }

  // Return rows in ENTRY_IDS order, filling gaps
  return ids.map(id => {
    if (byId.has(id)) {
      const obj = byId.get(id);
      // Update totalPoints if we have summary data
      if (obj.summary) {
        const total =
          obj.summary?.summary_overall_points ??
          obj.summary?.overall_points ?? // safety alias
          obj.summary?.summary_event_points ?? null;
        obj.totalPoints = Number.isFinite(total) ? total : (obj.totalPoints ?? 0);
      }
      // privateOrBlocked should be true only if both summary and history are missing
      const rFromSummary = resultsS.find(r => Number(r?.id) === id);
      const rFromHistory = resultsH.find(r => Number(r?.id) === id);
      obj.privateOrBlocked = !(rFromSummary || rFromHistory);
      return obj;
    }
    const ov = applyParticipantOverride(id, {});
    return {
      fplId: id,
      displayName: ov.displayName,
      teamName: ov.teamName,
      gwPoints: 0,
      totalPoints: 0,
      privateOrBlocked: true
    };
  });
}

// Tables loader (aggregates only; no /picks)
async function loadTablesViewUsingAggregates(entryIds, gw, bootstrap){
  console.info('[Tables] Using aggregates only. No picks will be fetched here.');
  
  // Fetch aggregate data
  const summaries = await fetchAggregateSummaries(entryIds);
  const histories = await fetchAggregateHistory(entryIds, gw);
  
  // Debug flag & one-shot logs (dev only; no UI change)
  const DEBUG_AGG = true; // set to false later
  if (DEBUG_AGG) {
    console.info('[Agg] summaries sample:', summaries?.results?.slice(0,1)[0]);
    console.info('[Agg] histories sample:', histories?.results?.slice(0,1)[0]);
  }
  
  // Normalize into canonical row shape
  const rows = normalizeAggregateRows(summaries, histories, gw);
  console.info('[Tables] normalized sample:', rows.slice(0,3));
  
  // Store for debug utilities
  window.__lastRows = rows;

  // reuse existing renderers (unchanged UI)
  populateSeasonTable?.(rows, bootstrap);
  populateGameweekTable?.(rows, bootstrap, gw);
}

// Hook "Tabeller"
async function onClickTabeller(){
  if (window.__loadingTables) return; window.__loadingTables=true;
  try{
    const bootstrap = await safeFetchBootstrap();
    const current = (bootstrap?.events||[]).find(e=>e.is_current) || (bootstrap?.events||[])[0];
    const gw = (typeof FORCE_GW==='number'&&FORCE_GW>0)?FORCE_GW:(current?.id??1);

    const ids = Array.from(new Set(
      (Array.isArray(window.ENTRY_IDS)?window.ENTRY_IDS:[])
        .map(n=>Number(n)).filter(Boolean)
    ));

    // fallback: derive IDs from league once if needed
    if (!ids.length && window.LEAGUE_CODE){
      const s=await fetchJSON(`${API}/leagues-classic/${window.LEAGUE_CODE}/standings/?page_new_entries=1&page_standings=1&phase=1&__=${Date.now()}`);
      ids.push(...(s?.standings?.results||[]).map(r=>r.entry).filter(Boolean));
    }

    await loadTablesViewUsingAggregates(ids, gw, bootstrap);
  } finally { window.__loadingTables=false; }
}

window.onClickTabeller = onClickTabeller;

// Participants (Deltagare) should build from aggregates if empty
async function ensureParticipantsData() {
  // Use existing participantsData if available
  if (Array.isArray(participantsData) && participantsData.length > 0) {
    console.log('Using existing participantsData:', participantsData.length, 'participants');
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
          participantsData.length = 0;
          participantsData.push(...res.map(r => {
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
  
  console.log('Updated participantsData from aggregates:', participantsData);
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
  console.log('participantsData length:', participantsData.length);
  console.log('First 3 participants:', participantsData.slice(0, 3));
  
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
        const participant = participantsData.find(p => p.fplId === result.id);
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
    console.log('Initial participantsData:', participantsData);
    
    // Count participants with FPL IDs
    const participantsWithFPL = participantsData.filter(p => p.fplId && p.fplId !== null);
    console.log(`📊 Found ${participantsWithFPL.length} participants with FPL IDs`);
    
    if (participantsWithFPL.length === 0) {
        throw new Error('No participants with FPL IDs found. Cannot proceed with API-only mode.');
    }
    
    // Update each participant with real FPL data
    for (let i = 0; i < participantsData.length; i++) {
        const participant = participantsData[i];
        
        if (participant.fplId && participant.fplId !== null) {
            console.log(`🔄 Updating participant ${participant.namn} with FPL ID ${participant.fplId}`);
            
            const playerData = await fetchPlayerData(participant.fplId);
            if (playerData) {
                const { currentData, historyData } = playerData;
                console.log(`✅ FPL data received for ${participant.namn}`);
                
                // Update with real data while preserving custom fields
                const override = applyParticipantOverride(participant.fplId, currentData);
                participantsData[i] = {
                    ...participant, // Keep existing custom data (roasts, image, favoritlag, etc.)
                    namn: override.displayName,
                    displayName: override.displayName,
                    teamName: override.teamName,
                    totalPoäng: currentData.summary_overall_points,
                    lastSeasonRank: historyData.past?.find(past => past.season_name === '2023/24')?.rank || 'N/A',
                    bestGameweek: Math.max(...historyData.current.map(gw => gw.points), 0)
                };
                
                console.log(`✅ Updated ${participant.namn} with real data:`, participantsData[i]);
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
    localStorage.setItem('fplParticipantsData', JSON.stringify(participantsData));
    console.log('💾 Participants data updated and saved to localStorage');
    console.log('📊 Final participantsData:', participantsData);
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
    const allParticipants = participantsData.filter(p => p.fplId && p.fplId !== null);
    
    if (allParticipants.length === 0) {
        throw new Error('No participants with FPL IDs found. Cannot calculate highlights.');
    }
    
    console.log(`📊 Calculating highlights for ${allParticipants.length} participants`);
    
    // Note: This function uses picks data - should only be called for detail views, not tables
    if (!EAGER_FETCH_PICKS) {
        console.log('⚠️ calculateWeeklyHighlightsFromAPI: picks fetching disabled, using fallback highlights');
        // Use fallback highlights when picks are disabled
        leagueData.highlights = {
            rocket: 'Highlights disabled (no picks)',
            flop: 'Highlights disabled (no picks)',
            captain: 'Highlights disabled (no picks)',
            bench: 'Highlights disabled (no picks)'
        };
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
        const entryIds = participantsData.filter(p => p.fplId).map(p => p.fplId);
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
        console.log('👥 Final participantsData:', participantsData);
        
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
                const entryIds = participantsData.filter(p => p.fplId).map(p => p.fplId);
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
    const allParticipants = participantsData.filter(p => p.fplId && p.fplId !== null);
    
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
    if (participantsData.length === 0) {
        console.log('No participants data found, attempting to load from localStorage...');
        loadFromLocalStorage();
    }
    
    console.log('participantsData length:', participantsData.length);
    console.log('participantsData:', participantsData);
    
    // Validate participantsData
    if (!participantsData || participantsData.length === 0) {
        console.error('CRITICAL ERROR: participantsData is empty or undefined!');
        alert('CRITICAL ERROR: participantsData is empty or undefined!');
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
        seasonTable: participantsData.map((participant, index) => ({
            position: index + 1,
            name: participant.namn,
            points: participant.totalPoäng,
            gameweek: currentGameweek,
            managerId: participant.fplId || (123456 + index) // Fallback ID if no FPL ID
        })),
        gameweekTable: participantsData.map((participant, index) => ({
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
        players: participantsData.map(participant => ({
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
            console.log('🧪 Player test successful:', {
                name: `${playerData.player_first_name} ${playerData.player_last_name}`,
                points: playerData.summary_overall_points,
                season: '2024/25'
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
          ...(Array.isArray(window.participantsData) ? window.participantsData.map(p => p.fplId) : [])
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
          populateProfiles(window.participantsData || []);
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
    
    // Add debug assert
    const currentGW = FORCE_GW ?? bootstrap?.events?.find(e => e?.is_current)?.id ?? 1;
    console.info('[Tables] GW=', currentGW, 'sample row=', rows[0]);
    
    tbody.innerHTML = '';
    
    // Sort by total points (descending) - use totalPoints if available, fallback to gwPoints
    const sortedRows = [...rows].sort((a, b) => {
        const aPoints = a.totalPoints ?? a.gwPoints ?? 0;
        const bPoints = b.totalPoints ?? b.gwPoints ?? 0;
        return bPoints - aPoints;
    });
    
    sortedRows.forEach((player, index) => {
        console.log(`Creating row ${index + 1} for player:`, player);
        
        // Ensure displayName with fallback order
        const displayName = 
            player.displayName ||
            (player.summary ? applyParticipantOverride(player.fplId, player.summary).displayName : null) ||
            `Manager ${player.fplId}`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${displayName}</td>
            <td>${player.totalPoints ?? 0}</td>
            <td>${player.teamName || '—'}</td>
        `;
        
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
    
    // Add debug assert
    const gw = currentGW ?? FORCE_GW ?? bootstrap?.events?.find(e => e?.is_current)?.id ?? 1;
    console.info('[Tables] GW=', gw, 'sample row=', rows[0]);
    
    tbody.innerHTML = '';
    
    // Sort by gameweek points (descending)
    const sortedRows = [...rows].sort((a, b) => (b.gwPoints ?? 0) - (a.gwPoints ?? 0));
    
    sortedRows.forEach((player, index) => {
        console.log(`Creating GW row ${index + 1} for player:`, player);
        
        // Ensure displayName with fallback order
        const displayName = 
            player.displayName ||
            (player.summary ? applyParticipantOverride(player.fplId, player.summary).displayName : null) ||
            `Manager ${player.fplId}`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${displayName}</td>
            <td>${gw}</td>
            <td>${player.gwPoints ?? 0}</td>
        `;
        
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
        console.log('Using mock data for highlights');
        
        // Check if participantsData is available
        if (!participantsData || participantsData.length === 0) {
            console.error('CRITICAL ERROR: participantsData is empty or undefined!');
            weeklyRocketElement.textContent = 'Ingen data tillgänglig';
            weeklyFlopElement.textContent = 'Ingen data tillgänglig';
            return;
        }
        
        // Use random participants for mock highlights
        const shuffledParticipants = [...participantsData].sort(() => 0.5 - Math.random());
        
        // Generate realistic gameweek points (30-85 range for a single week)
        const rocketPoints = Math.floor(Math.random() * 55) + 30; // 30-85 points
        const flopPoints = Math.floor(Math.random() * 25) + 15; // 15-40 points
        
        // Veckans Raket - Random participant with high gameweek points
        const rocket = shuffledParticipants[0];
        weeklyRocketElement.textContent = `${rocket.namn} - ${rocketPoints} poäng`;
        
        // Veckans Sopa - Random participant with low gameweek points
        const flop = shuffledParticipants[1];
        weeklyFlopElement.textContent = `${flop.namn} - ${flopPoints} poäng`;
        
        // Mock captain data
        const captain = shuffledParticipants[2];
        document.getElementById('weeklyCaptain').textContent = `${captain.namn} - Haaland (2 poäng)`;
        
    } else {
        // Use real data from leagueData
        if (!leagueData.gameweekTable || leagueData.gameweekTable.length === 0) {
            console.error('CRITICAL ERROR: No gameweek data available!');
            return;
        }
        
        // Veckans Raket - Highest gameweek points
        const rocket = leagueData.gameweekTable[0];
        weeklyRocketElement.textContent = `${rocket.name} - ${rocket.points} poäng`;
        
        // Veckans Sopa - Lowest gameweek points
        const flop = leagueData.gameweekTable[leagueData.gameweekTable.length - 1];
        weeklyFlopElement.textContent = `${flop.name} - ${flop.points} poäng`;
        
        // Use fallback captain and bench data if API is not available
        if (bootstrapData.players && Object.keys(bootstrapData.players).length > 0) {
            await fetchCaptainAndBenchData();
        } else {
            // Use fallback highlights
            document.getElementById('weeklyCaptain').textContent = leagueData.highlights.captain;
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
    console.log('participantsData:', participantsData);
    console.log('participantsData length:', participantsData ? participantsData.length : 'UNDEFINED');
    
    const profilesGrid = document.getElementById('profilesGrid');
    console.log('profilesGrid element:', profilesGrid);
    
    if (!profilesGrid) {
        console.error('CRITICAL ERROR: profilesGrid not found!');
        return;
    }
    
    if (!participantsData || participantsData.length === 0) {
        console.error('CRITICAL ERROR: participantsData is empty!');
        profilesGrid.innerHTML = '<div style="text-align: center; padding: 2rem; color: #94a3b8;">No participants available</div>';
        return;
    }
    
    profilesGrid.innerHTML = '';
    
    participantsData.forEach((player, index) => {
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
    
    console.log('Profiles populated with', participantsData.length, 'cards');
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
    const allParticipants = participantsData.filter(p => p.fplId && p.fplId !== null);
    
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
    const participantStats = participantsData.map(participant => {
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
    console.log('participantsData length:', participantsData.length);
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