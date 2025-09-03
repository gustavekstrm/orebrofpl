// New robust functions for FPL ÖREBRO

// Robust GW resolver - single source of truth for latest finished GW
async function resolveLatestFinishedGw() {
  try {
    const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', { 
      cache: 'no-store', 
      mode: 'cors' 
    });
    
    if (!res.ok) {
      throw new Error(`bootstrap-static failed: ${res.status}`);
    }
    
    const boot = await res.json();
    const events = Array.isArray(boot?.events) ? boot.events : [];
    
    if (events.length === 0) {
      throw new Error('No events found in bootstrap-static');
    }
    
    // Prefer events with finished || data_checked
    const finished = events.filter(e => e.finished === true || e.data_checked === true);
    if (finished.length > 0) {
      const latestFinished = Math.max(...finished.map(e => e.id || e.event));
      console.log('[GW] Latest finished GW:', latestFinished, 'from', finished.length, 'finished events');
      return latestFinished;
    }
    
    // Fallback: event with is_current true and deadline passed
    const now = Date.now();
    const current = events.find(e => e.is_current === true) || 
                   events.find(e => new Date(e.deadline_time).getTime() <= now);
    
    if (current?.id || current?.event) {
      const fallbackGw = current.id ?? current.event;
      console.log('[GW] Fallback GW (current/deadline passed):', fallbackGw);
      return fallbackGw;
    }
    
    throw new Error('No GW resolvable from bootstrap-static');
  } catch (error) {
    console.error('[GW] Failed to resolve latest finished GW:', error);
    throw error;
  }
}

// Fetch entry history for a specific participant with retry
async function fetchEntryHistory(entryId) {
  try {
    const url = `https://fantasy.premierleague.com/api/entry/${entryId}/history/`;
    const res = await fetch(url, { cache: 'no-store', mode: 'cors' });
    
    if (!res.ok) {
      throw new Error(`history ${entryId} failed: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error(`[History] Failed to fetch history for ${entryId}:`, error);
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

// Updated tables loader with robust GW resolution and entry history joins
async function loadTablesViewUsingAggregates(entryIds, gw, bootstrap){
  console.info('[Tables] Loading with robust GW resolution and entry history joins');
  console.info('[Tables] Entry IDs:', entryIds.slice(0, 5), 'Requested GW:', gw);
  
  try {
    // Step 1: Resolve latest finished GW as single source of truth
    const latestGw = await resolveLatestFinishedGw();
    console.info('[Tables] Latest finished GW resolved:', latestGw);
    
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
        const { seasonTotal, latestGwPoints } = computeSeasonAndGw(history, latestGw);
        
        return {
          fplId: participant.entryId,
          entryId: participant.entryId,
          displayName: participant.displayName,
          teamName: participant.teamName,
          totalPoints: seasonTotal,
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
    
    // Store for debug utilities and health checks
    window.__lastRows = rows;
    
    // Add debug dump for inspection (only if debug mode enabled)
    if (window.__DEBUG_MODE) {
      try {
        const season = await resolveCurrentSeason();
        
        window.__DEBUG_FPL = {
          participants: validParticipants,
          sampleRow: rows[0],
          season: season,
          gwInfo: { requestedGw: gw, latestGw, resolvedSeason: season },
          apiSamples: {
            entryIds: validParticipants.map(p => p.entryId).slice(0, 5),
            sampleHistory: rows[0]
          }
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
        console.log('👀 DEBUG: Season & GW Info', { season, latestGw, requestedGw: gw });
        
        // Data provenance footer
        console.group('👀 DEBUG: Data Provenance');
        console.log('📊 Totals source: /api/entry/{id}/history/ (total_points)');
        console.log('📈 GW points source: /api/entry/{id}/history/ (points)');
        console.log('🌍 Season resolution: bootstrap-static events');
        console.log('🎯 GW resolution: bootstrap-static events (finished || data_checked)');
        console.groupEnd();
      } catch (error) {
        console.error('👀 DEBUG: Failed to resolve season/GW:', error);
      }
    }
    
    // Step 3: Update DOM headings with resolved season and GW
    await updateDOMHeadings();
    
    // Step 4: Render tables with the computed data
    populateSeasonTable?.(rows, bootstrap);
    populateGameweekTable?.(rows, bootstrap, latestGw);
    
    console.info('[Tables] Successfully loaded with', rows.length, 'rows, GW:', latestGw);
    
  } catch (error) {
    console.error('[Tables] Failed to load tables:', error);
    
    // Show specific error banner based on error type
    if (error.message.includes('No participants with valid entryId')) {
      showErrorBanner(error, 'error');
    } else if (error.message.includes('bootstrap-static failed')) {
      showErrorBanner(new Error('FPL API temporarily unavailable'), 'warning');
    } else {
      showErrorBanner(error, 'error');
    }
    
    // Don't render tables with invalid data
    populateSeasonTable?.([], bootstrap);
    populateGameweekTable?.([], bootstrap, 0);
  }
}

// Export functions for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    resolveLatestFinishedGw,
    fetchEntryHistory,
    computeSeasonAndGw,
    mapWithConcurrency,
    fetchWithRetry,
    loadTablesViewUsingAggregates
  };
}
