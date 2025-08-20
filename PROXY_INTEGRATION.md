# Örebro FPL Proxy Integration

## Overview

The Örebro FPL application uses a resilient proxy system to handle FPL API requests with graceful degradation, caching, and soft-OK responses.

## Proxy Behavior

### Soft-OK Responses

The proxy returns 200 with minimal JSON for 403 on:

- `/entry/{id}/` → `{ player_first_name:"", player_last_name:"", name:"" }`
- `/entry/{id}/history/` → `{ current:[], past:[], chips:[] }`
- `/picks` → `{ entry_history:null, picks:[] }`

### Response Headers

The proxy adds diagnostic headers:

- `X-Proxy-Soft: 1` → soft body served (403 upstream)
- `X-Proxy-Stale: 1` → stale cached body served (upstream error/403/429/5xx)
- `X-Proxy-Cache: HIT|MISS`
- `X-Proxy-Upstream-Status: <code|ERR>`

### Aggregate Endpoints

Batch endpoints for efficient data fetching:

- `/api/aggregate/summary?ids=1,2,3,4,5`
- `/api/aggregate/history?ids=1,2,3,4,5&gw=1`

## Frontend Behavior

### Tabeller (Tables)

- **Calls**: `aggregate/summary` + `aggregate/history` only
- **No picks**: Never calls `/picks` endpoints
- **Performance**: 1-2 aggregate calls instead of 51 individual calls
- **Resilience**: Accepts stale 200 responses

### Highlights

- **Points**: Uses history data for gameweek points
- **Picks**: Tries picks lazily via circuit breaker
- **Fallback**: Shows "—" for captain/bench if blocked
- **Graceful**: Never crashes on 403/soft responses

### API Fetching

- `fetchJSON()` treats any HTTP 200 as OK (soft/stale included)
- `safeFetchHistory()` & `safeFetchSummary()` normalize empty bodies
- Circuit breaker prevents API hammering
- Session storage cache for picks data

## Configuration

### Proxy Settings (Render Environment)

```bash
UPSTREAM_CONCURRENCY=2
UPSTREAM_DELAY_MS=200
STALE_HOURS=12
TTL_BOOTSTRAP_MS=900000      # 15 minutes
TTL_HISTORY_MS=300000        # 5 minutes
TTL_PICKS_MS=60000          # 1 minute
TTL_SUMMARY_MS=86400000     # 24 hours
```

### Frontend Constants

```javascript
const PROXY_ROOT = "https://fpl-proxy-1.onrender.com";
const API = `${PROXY_ROOT}/api`;
const PICKS_CONCURRENCY = 3;
const PICKS_PACING_MIN_MS = 200;
const PICKS_PACING_MAX_MS = 400;
```

## Monitoring

### Dev Console Logging

The frontend logs soft/stale responses:

```javascript
console.info("[FPL] served", { url, soft, stale });
```

### Health Checks

- `/healthz` → Proxy health status
- `testAPIConnection()` → Frontend connectivity test

## Cache Warming

Run the cache warmer script every 5-10 minutes:

```bash
node cache-warmer.js
```

Or set up a Render cron job:

```bash
# Every 10 minutes
*/10 * * * * cd /opt/render/project/src && node cache-warmer.js
```

## Troubleshooting

### High 403 Rates

1. Lower `UPSTREAM_CONCURRENCY` to 1
2. Increase `UPSTREAM_DELAY_MS` to 400-600
3. Increase `TTL_HISTORY_MS` to 600000 (10m)

### Performance Issues

1. Check cache hit rates via headers
2. Verify aggregate endpoints are working
3. Monitor proxy logs for upstream errors

### Frontend Issues

1. Check browser console for soft/stale logs
2. Verify `testAPIConnection()` passes
3. Ensure cache-busting version is loaded

## Rollback Plan

If upstream starts blocking harder:

1. **Immediate**: Lower concurrency and increase delays
2. **Cache**: Increase TTLs to improve hit rates
3. **Frontend**: Will continue working due to soft/stale handling

The system is designed to degrade gracefully and maintain functionality even under heavy upstream restrictions.
