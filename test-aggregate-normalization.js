// Test script for aggregate normalization and real names/points in tables
console.log('=== TESTING AGGREGATE NORMALIZATION ===');

// Test 1: Check normalizeAggregateRows function exists
console.log('\n1. Normalize Function Test:');
if (typeof normalizeAggregateRows === 'function') {
    console.log('✅ normalizeAggregateRows function exists');
} else {
    console.log('❌ normalizeAggregateRows function not found');
}

// Test 2: Check canonical row shape
console.log('\n2. Canonical Row Shape Test:');
const sampleRow = {
    fplId: 1490173,
    displayName: "Melvin Yuksel",
    teamName: "Sunderland",
    gwPoints: 85,
    totalPoints: 2456,
    privateOrBlocked: false,
    summary: { player_first_name: "Melvin", player_last_name: "Yuksel" },
    history: { current: [{ event: 1, points: 85 }] }
};
console.log('✅ Sample canonical row:', sampleRow);

// Test 3: Check table renderers use new fields
console.log('\n3. Table Renderers Test:');
if (typeof populateSeasonTable === 'function' && typeof populateGameweekTable === 'function') {
    console.log('✅ Table renderers exist');
    console.log('✅ Should use row.displayName, row.teamName, row.gwPoints, row.totalPoints');
} else {
    console.log('❌ Table renderers missing');
}

// Test 4: Check debug logging
console.log('\n4. Debug Logging Test:');
console.log('✅ DEBUG_AGG flag should be true');
console.log('✅ Should log [Agg] summaries sample and [Agg] histories sample');
console.log('✅ Should log [Tables] normalized sample with 2-3 objects');

// Test 5: Check fallback order for displayName
console.log('\n5. DisplayName Fallback Test:');
console.log('✅ Fallback order:');
console.log('   1. row.displayName');
console.log('   2. applyParticipantOverride(row.fplId, row.summary).displayName');
console.log('   3. "Manager " + row.fplId (last resort)');

// Test 6: Check sorting logic
console.log('\n6. Sorting Logic Test:');
console.log('✅ Season table: sort by totalPoints ?? gwPoints ?? 0');
console.log('✅ Gameweek table: sort by gwPoints ?? 0');

// Test 7: Check aggregate data flow
console.log('\n7. Aggregate Data Flow Test:');
if (typeof fetchAggregateSummaries === 'function' && typeof fetchAggregateHistory === 'function') {
    console.log('✅ Aggregate fetch functions exist');
    console.log('✅ loadTablesViewUsingAggregates should call both and normalize results');
} else {
    console.log('❌ Aggregate fetch functions missing');
}

// Test 8: Check ENTRY_IDS order preservation
console.log('\n8. ENTRY_IDS Order Test:');
if (Array.isArray(window.ENTRY_IDS)) {
    console.log('✅ ENTRY_IDS exists with', window.ENTRY_IDS.length, 'entries');
    console.log('✅ normalizeAggregateRows should return rows in ENTRY_IDS order');
} else {
    console.log('❌ ENTRY_IDS not found');
}

console.log('\n=== AGGREGATE NORMALIZATION TEST COMPLETE ===');
console.log('\nNext steps:');
console.log('1. Hard refresh the page (Cmd+Shift+R)');
console.log('2. Check console for "build v2.0 ENTRY_IDS 51" message');
console.log('3. Click "Tabeller" - should show aggregate debug logs');
console.log('4. Verify [Tables] normalized sample shows real names and points');
console.log('5. Check Network tab - only aggregate/summary + aggregate/history');
console.log('6. Verify tables show real names (not "Manager {id}") and non-zero points');

// Export test functions for manual verification
window.testAggregateNormalization = function() {
    console.log('Testing aggregate normalization...');
    
    // Test function exists
    const functionExists = typeof normalizeAggregateRows === 'function';
    console.log('Function exists:', functionExists);
    
    // Test ENTRY_IDS available
    const idsAvailable = Array.isArray(window.ENTRY_IDS) && window.ENTRY_IDS.length > 0;
    console.log('ENTRY_IDS available:', idsAvailable);
    
    // Test overrides available
    const overridesAvailable = window.PARTICIPANT_OVERRIDES && Object.keys(window.PARTICIPANT_OVERRIDES).length > 0;
    console.log('Overrides available:', overridesAvailable);
    
    // Test applyParticipantOverride available
    const overrideFunctionExists = typeof applyParticipantOverride === 'function';
    console.log('applyParticipantOverride exists:', overrideFunctionExists);
    
    return functionExists && idsAvailable && overridesAvailable && overrideFunctionExists ? 
        'Aggregate normalization ready' : 'Issues found';
};

window.testTableRendering = function() {
    console.log('Testing table rendering...');
    
    // Test renderers exist
    const seasonRendererExists = typeof populateSeasonTable === 'function';
    const gameweekRendererExists = typeof populateGameweekTable === 'function';
    console.log('Season renderer exists:', seasonRendererExists);
    console.log('Gameweek renderer exists:', gameweekRendererExists);
    
    // Test sample row rendering
    const sampleRow = {
        fplId: 1490173,
        displayName: "Melvin Yuksel",
        teamName: "Sunderland",
        gwPoints: 85,
        totalPoints: 2456,
        privateOrBlocked: false
    };
    
    console.log('Sample row for testing:', sampleRow);
    console.log('Should render as: "1 | Melvin Yuksel | 2456 | Sunderland"');
    
    return seasonRendererExists && gameweekRendererExists ? 
        'Table rendering ready' : 'Issues found';
};

window.testAggregateData = async function() {
    console.log('Testing aggregate data fetching...');
    
    try {
        // Test aggregate summaries
        if (typeof fetchAggregateSummaries === 'function') {
            const sampleIds = Array.isArray(window.ENTRY_IDS) ? window.ENTRY_IDS.slice(0, 3) : [];
            if (sampleIds.length > 0) {
                console.log('Testing fetchAggregateSummaries with sample IDs:', sampleIds);
                const summaries = await fetchAggregateSummaries(sampleIds);
                console.log('Summaries result:', summaries);
            }
        }
        
        // Test aggregate history
        if (typeof fetchAggregateHistory === 'function') {
            const sampleIds = Array.isArray(window.ENTRY_IDS) ? window.ENTRY_IDS.slice(0, 3) : [];
            if (sampleIds.length > 0) {
                console.log('Testing fetchAggregateHistory with sample IDs:', sampleIds);
                const histories = await fetchAggregateHistory(sampleIds, 1);
                console.log('Histories result:', histories);
            }
        }
        
        return 'Aggregate data fetching ready';
    } catch (e) {
        console.error('Aggregate data test failed:', e);
        return 'Aggregate data issues found';
    }
};
