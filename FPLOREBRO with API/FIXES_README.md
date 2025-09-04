# FPL ÖREBRO - Data Flow Fixes

## Overview

Fixed critical data flow issues where tables showed participant names but totals and latest GW points were incorrect (showing 0 and 1 respectively).

## Issues Identified & Fixed

### 1. Field Mapping Mismatches

**Problem**: API responses used different field names than frontend expected

- API returned `summary_overall_points` but frontend expected `totalPoints`
- API returned `points` for GW data but frontend expected `gwPoints`

**Fix**: Updated `deriveTotalPoints()` and `deriveGwPointsFromHistory()` functions to handle multiple field name variations and properly map API responses.

### 2. History Data Structure Handling

**Problem**: Different history endpoints returned data in different formats

- `/aggregate/history` returns `{ points, raw }`
- `/entry/{id}/history` returns `{ current: [{ event, points }] }`

**Fix**: Enhanced `deriveGwPointsFromHistory()` to handle multiple data structures and extract points correctly.

### 3. Current GW Detection

**Problem**: Tables hardcoded to show GW 1 instead of actual current GW

**Fix**: Improved `resolveCurrentGW()` function to:

- Find the latest finished GW or current GW from bootstrap data
- Properly update gameweek labels in tables
- Add logging for debugging

### 4. Data Normalization

**Problem**: Normalization function didn't properly map history data structure

**Fix**: Updated `normalizeAggregateRows()` to:

- Correctly map history data from aggregate endpoints
- Add debug logging for first few entries
- Store debug data in `window.__DEBUG_FPL` for inspection

## Data Flow Pipeline

```
1. Entry IDs from participants.config.js
   ↓
2. fetchAggregateSummaries(ids) → /api/aggregate/summary
   ↓
3. fetchAggregateHistory(ids, gw) → /api/aggregate/history
   ↓
4. normalizeAggregateRows() → maps API fields to frontend fields
   ↓
5. populateSeasonTable() & populateGameweekTable() → renders data
```

## Key Functions Updated

### `deriveTotalPoints(summaryApi, historyApi)`

- Handles multiple field names: `summary_overall_points`, `overall_points`, `summary.overall_points`, `summary.total_points`
- Falls back to history data if summary doesn't have totals
- Returns 0 only if no valid data found

### `deriveGwPointsFromHistory(historyData, gw)`

- Handles direct `points` field from aggregate/history
- Handles `current` array from full history endpoint
- Handles `raw` data from aggregate/history
- Returns 0 only if no valid data found

### `resolveCurrentGW()`

- Finds latest finished GW or current GW from bootstrap events
- Adds logging for debugging
- Falls back to GW 1 only if bootstrap fails

### `normalizeAggregateRows()`

- Properly maps history data structure
- Adds debug logging for first 3 entries
- Creates `window.__DEBUG_FPL` object for inspection

## Testing

1. **Load the page** and check console for any errors
2. **Click "Tabeller"** button to load tables
3. **Check console** for debug output:
   - `[Tables] Entry IDs: [...] GW: X`
   - `[Agg] summaries sample: {...}`
   - `[Agg] histories sample: {...}`
   - `[Normalize] Entry X: {...}`
4. **Inspect `window.__DEBUG_FPL`** object for API response samples

## Expected Results

- **Totalpoäng column**: Shows actual season totals from API
- **Senaste Gameweek column**: Shows actual latest GW points (not hardcoded 1)
- **GW label**: Updates to show actual current GW
- **Sorting**: Works numerically on both columns
- **No silent zeros**: All data properly mapped from API

## Debug Objects

### `window.__DEBUG_FPL`

Contains latest normalized row sample and API response samples for debugging:

```javascript
{
  latestRowSample: { fplId, displayName, totalPoints, gwPoints, ... },
  apiSamples: {
    summaries: [...],
    histories: [...],
    gw: X,
    entryIds: [...]
  }
}
```

### `window.__lastRows`

Contains the last normalized rows passed to table renderers.

## API Endpoints Used

- **`/api/aggregate/summary?ids=1,2,3`** - Batch entry summaries
- **`/api/aggregate/history?ids=1,2,3&gw=X`** - Batch GW history
- **`/api/bootstrap-static/`** - Current GW and season info

## Field Mappings

| Frontend Field | API Source          | Field Names                                |
| -------------- | ------------------- | ------------------------------------------ |
| `totalPoints`  | Summary             | `summary_overall_points`, `overall_points` |
| `gwPoints`     | History             | `points`, `current[].points`               |
| `displayName`  | Summary + Overrides | `player_first_name`, `player_last_name`    |
| `teamName`     | Summary + Overrides | `name`                                     |

## Notes

- Tables are aggregates-only (no picks data)
- Legacy participants data commented out but preserved
- Debug logging enabled for development
- All functions handle missing/partial data gracefully
- Current GW detection prioritizes finished GWs over current GW

## Participant Data Fixes (Latest Update)

### Removed `participantsData` References
- Eliminated all `participantsData` variable references throughout the codebase
- Replaced with `getConfiguredParticipants()` helper function for single source of truth
- Added `normalizeParticipant()` function for consistent data format

### New Participant Sourcing System
```javascript
// Single source of truth for participant data
function getConfiguredParticipants() {
  // Prefer LEGACY_PARTICIPANTS if available
  if (Array.isArray(window.LEGACY_PARTICIPANTS) && window.LEGACY_PARTICIPANTS.length) {
    return window.LEGACY_PARTICIPANTS;
  }
  
  // Fallback to ENTRY_IDS + PARTICIPANT_OVERRIDES
  if (Array.isArray(window.ENTRY_IDS)) {
    const overrides = window.PARTICIPANT_OVERRIDES || {};
    return window.ENTRY_IDS.map(id => ({
      fplId: id,
      displayName: overrides[id]?.displayName || `Manager ${id}`,
      // ... other fields
    }));
  }
  
  throw new Error("Missing participants configuration");
}
```

### Corrected Error Classification
- **Configuration errors** (missing participants) now show "Participants configuration missing" banner
- **API errors** only show when actual network requests fail
- No more misleading "FPL API unreachable" messages for missing variables

### Updated Functions
- `populateProfiles()` - now uses `getConfiguredParticipants()`
- `populateAdminParticipantsList()` - now uses normalized participant data
- `updateHighlightsFromData()` - now uses configured participants
- All admin functions updated to use new participant sourcing

### Debug Objects
- `window.__DEBUG_FPL.participants` - contains resolved participant data
- Console logging shows participant count and configuration status
- Clear error messages for configuration vs API issues

## Post-Fix Hardening (Latest Update)

### Runtime Health Checks
- **`runHealthChecks()`** - Comprehensive runtime validation
  - Participants configuration validation (> 0 participants)
  - Table data quality validation (numeric totalPoints > 0, gwPoints > 1)
  - Deprecated globals detection
  - Results exposed on `window.__FPL_HEALTH`

### URL-Based Debug Toggle
- **`?debug=true`** - Enables verbose logging and debug objects
- **Default**: Debug OFF (no logs, no globals)
- **Debug objects**: `window.__DEBUG_FPL` with participants, sample row, and GW info
- **Console output**: `console.table()` for structured data inspection

### Error Classification System
- **Single helper**: `showErrorBanner(error, type)` maps exceptions to user banners
- **Explicit catch branches**: ReferenceError and TypeError handled separately
- **Configuration errors**: Red banner at top
- **Health check failures**: Red banner below config banner (non-blocking)
- **API errors**: Only shown for actual network failures

### Asset Versioning
- **Script tags**: `?v=7714af2` (current commit SHA)
- **Build banner**: `[ÖrebroFPL] build 7714af2 – tables=aggregate-only`
- **Cache busting**: GitHub Pages never serves stale JS

### CI Health Checks
- **GitHub Actions workflow**: `.github/workflows/health-check.yml`
- **Fast execution**: <10 seconds
- **Tests**: 
  - Participants resolve to > 0
  - No deprecated globals (`participantsData`)
  - Health checks pass
  - Script versioning verified
- **Dependencies**: jsdom for Node.js testing environment

### Guard Functions
- **`assertNoDeprecatedGlobals()`** - Unit-style assertions
- **Early failure**: Fails fast if deprecated globals detected
- **Runtime protection**: Prevents regressions during development

## Live Site Data Fixes (Latest Update)

### Removed Hardcoded Values
- **Season labels**: No more "Säsong 2024/25" - now dynamically resolved from FPL API
- **Gameweek labels**: No more "Gameweek 38" - now shows actual current/last finished GW
- **Highlights**: No more static names/points - now computed from live table data
- **Fallback data**: Eliminated hardcoded highlights and demo objects

### Dynamic Season & GW Resolution
- **`resolveCurrentSeason()`** - Fetches from bootstrap-static events
- **`resolveCurrentGW()`** - Finds current GW or latest finished GW
- **No fallbacks**: Throws clear errors instead of defaulting to stale values
- **DOM updates**: Automatically updates season and GW headings

### Enhanced Data Validation
- **EntryId validation**: Ensures all participants have numeric, positive entryId
- **Data quality checks**: Monitors >60% data join failure threshold
- **Health checks**: Enhanced to detect data join vs API vs configuration issues
- **Dev assertions**: `console.assert()` for entryId validation in debug mode

### Real API Data Flow
- **Season table**: Uses manager summary or accumulated history for totalPoints
- **Latest GW table**: Uses latest finished GW points from entry history
- **Highlights**: Computed from table data when picks unavailable
- **No zero masking**: Throws errors instead of `|| 0` / `|| 1` fallbacks

### Debug Enhancements
- **Season & GW info**: Added to `window.__DEBUG_FPL` object
- **Data provenance**: Shows which endpoints populate totals and GW points
- **Validation logging**: EntryId validation and data quality metrics
- **Error classification**: Clear distinction between data join, API, and config issues

### DOM Updates
- **Season heading**: `Säsong 2024/25` → `Säsong 2025/26` (dynamic)
- **GW heading**: `Gameweek 38` → `Gameweek X` (current/last finished)
- **Page title**: Updated if contains season information
- **Automatic updates**: Applied after bootstrap and participant resolution

## Live Data Flow Fixes (Latest Update)

### Participant Source & Normalization (Strict)
- **Enhanced `getConfiguredParticipants()`** - Priority-based sourcing with strict validation
- **Priority order**: LEGACY_PARTICIPANTS → ENTRY_IDS + overrides → localStorage (filtered)
- **Strict entryId validation**: Only numeric, positive IDs included
- **Invalid localStorage handling**: Invalid entries ignored, logged for admin to fix
- **Coercion function**: `coerceEntryId()` handles common key variants (entryId, fplId, id, etc.)

### GW Column Mapping Bug Fixed
- **Column definitions**: Explicit column configs prevent mapping errors
- **Season table**: GW column now shows current GW number (not teamName)
- **Gameweek table**: GW column shows GW number, points column shows GW points
- **Validation**: Dev assertions ensure GW is integer 1-59, points are numeric

### Admin UI Alignment
- **FPL ID required**: Admin form now enforces numeric FPL ID for table inclusion
- **Validation**: On-blur and submit validation with inline error messages
- **Export format**: JSON export uses `entryId: number` as primary key
- **Backward compatibility**: Legacy fields preserved for existing integrations

### Enhanced Health Checks
- **HC-1**: Valid participants count > 0 (else banner + abort)
- **HC-2**: Data join failure detection (>60% zero/one points while GW > 1)
- **HC-3**: GW validation (integer 1-59)
- **Targeted failures**: Clear distinction between config, API, and data-join issues

### Debug Enhancements
- **Participant table**: Shows first 5 with key fields (displayName, entryId, teamName, hasValidId)
- **Column validation**: Console assertions for row data types
- **GW validation**: Ensures latestGw is number, not teamName
- **Data provenance**: Clear source documentation for totals and GW points
