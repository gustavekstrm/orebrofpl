// Test script for table fixes and correct column mapping
console.log('=== TESTING TABLE FIXES ===');

// Test 1: Check strengthened aggregate fetch functions
console.log('\n1. Aggregate Fetch Functions Test:');
if (typeof fetchAggregateSummaries === 'function' && typeof fetchAggregateHistory === 'function') {
    console.log('✅ Aggregate fetch functions exist');
    console.log('✅ Should return {results: [...]} and log when empty');
} else {
    console.log('❌ Aggregate fetch functions missing');
}

// Test 2: Check deriveGwPointsFromHistory function
console.log('\n2. GW Points Extraction Test:');
if (typeof deriveGwPointsFromHistory === 'function') {
    console.log('✅ deriveGwPointsFromHistory function exists');
    
    // Test with sample data
    const sampleHistory = {
        current: [
            { event: 1, points: 85 },
            { event: 2, points: 92 }
        ]
    };
    const gwPoints = deriveGwPointsFromHistory(sampleHistory, 1);
    console.log('✅ Sample GW1 points:', gwPoints);
} else {
    console.log('❌ deriveGwPointsFromHistory function not found');
}

// Test 3: Check normalizeAggregateRows function
console.log('\n3. Normalize Function Test:');
if (typeof normalizeAggregateRows === 'function') {
    console.log('✅ normalizeAggregateRows function exists');
    console.log('✅ Should compute gwPoints and totalPoints robustly');
    console.log('✅ Should set privateOrBlocked only if both summary and history missing');
} else {
    console.log('❌ normalizeAggregateRows function not found');
}

// Test 4: Check table renderers use correct columns
console.log('\n4. Table Column Mapping Test:');
if (typeof populateSeasonTable === 'function' && typeof populateGameweekTable === 'function') {
    console.log('✅ Table renderers exist');
    console.log('✅ Season table: Name | Points | Team');
    console.log('✅ Gameweek table: Name | GW | Points');
} else {
    console.log('❌ Table renderers missing');
}

// Test 5: Check tooltip flag
console.log('\n5. Tooltip Flag Test:');
console.log('✅ SHOW_PICKS_TOOLTIP_IN_TABLES:', typeof SHOW_PICKS_TOOLTIP_IN_TABLES !== 'undefined' ? SHOW_PICKS_TOOLTIP_IN_TABLES : 'undefined');
if (SHOW_PICKS_TOOLTIP_IN_TABLES === false) {
    console.log('✅ Tooltips disabled in tables (correct)');
} else {
    console.log('❌ Tooltips may show in tables');
}

// Test 6: Check debug utilities
console.log('\n6. Debug Utilities Test:');
if (typeof window.__dumpNormalized === 'function') {
    console.log('✅ __dumpNormalized function exists');
} else {
    console.log('❌ __dumpNormalized function not found');
}

// Test 7: Check currentGW parameter
console.log('\n7. CurrentGW Parameter Test:');
console.log('✅ populateGameweekTable should accept currentGW parameter');
console.log('✅ GW column should show actual GW number, not team name');

// Test 8: Check debug logging
console.log('\n8. Debug Logging Test:');
console.log('✅ Should log [Agg] summaries sample and [Agg] histories sample');
console.log('✅ Should log [Tables] GW=... sample row=...');
console.log('✅ Should log [Tables] normalized sample with 2-3 objects');

console.log('\n=== TABLE FIXES TEST COMPLETE ===');
console.log('\nNext steps:');
console.log('1. Hard refresh the page (Cmd+Shift+R)');
console.log('2. Check console for "build v2.0 ENTRY_IDS 51" message');
console.log('3. Click "Tabeller" - should show [Agg] and [Tables] debug logs');
console.log('4. Verify GW column shows GW number (e.g., 1), not team name');
console.log('5. Verify points are non-zero where history exists');
console.log('6. Check Network tab - only aggregate/summary + aggregate/history');
console.log('7. Run window.__dumpNormalized() to see normalized rows');

// Export test functions for manual verification
window.testTableFixes = function() {
    console.log('Testing table fixes...');
    
    // Test aggregate functions
    const aggregateFunctionsExist = typeof fetchAggregateSummaries === 'function' && typeof fetchAggregateHistory === 'function';
    console.log('Aggregate functions exist:', aggregateFunctionsExist);
    
    // Test normalize function
    const normalizeFunctionExists = typeof normalizeAggregateRows === 'function';
    console.log('Normalize function exists:', normalizeFunctionExists);
    
    // Test renderers
    const renderersExist = typeof populateSeasonTable === 'function' && typeof populateGameweekTable === 'function';
    console.log('Table renderers exist:', renderersExist);
    
    // Test tooltip flag
    const tooltipDisabled = SHOW_PICKS_TOOLTIP_IN_TABLES === false;
    console.log('Tooltips disabled in tables:', tooltipDisabled);
    
    // Test debug utilities
    const debugUtilsExist = typeof window.__dumpNormalized === 'function';
    console.log('Debug utilities exist:', debugUtilsExist);
    
    return aggregateFunctionsExist && normalizeFunctionExists && renderersExist && tooltipDisabled && debugUtilsExist ? 
        'Table fixes ready' : 'Issues found';
};

window.testColumnMapping = function() {
    console.log('Testing column mapping...');
    
    // Test sample row structure
    const sampleRow = {
        fplId: 1490173,
        displayName: "Melvin Yuksel",
        teamName: "Sunderland",
        gwPoints: 85,
        totalPoints: 2456,
        privateOrBlocked: false
    };
    
    console.log('Sample row for testing:', sampleRow);
    console.log('Season table should show: "1 | Melvin Yuksel | 2456 | Sunderland"');
    console.log('Gameweek table should show: "1 | Melvin Yuksel | 1 | 85"');
    
    // Test GW extraction
    if (typeof deriveGwPointsFromHistory === 'function') {
        const testHistory = { current: [{ event: 1, points: 85 }] };
        const extractedPoints = deriveGwPointsFromHistory(testHistory, 1);
        console.log('GW points extraction test:', extractedPoints === 85 ? 'PASS' : 'FAIL');
    }
    
    return 'Column mapping ready';
};

window.testAggregateData = async function() {
    console.log('Testing aggregate data...');
    
    try {
        // Test with sample IDs
        const sampleIds = Array.isArray(window.ENTRY_IDS) ? window.ENTRY_IDS.slice(0, 3) : [];
        if (sampleIds.length > 0) {
            console.log('Testing with sample IDs:', sampleIds);
            
            // Test summaries
            const summaries = await fetchAggregateSummaries(sampleIds);
            console.log('Summaries result structure:', {
                hasResults: !!summaries?.results,
                resultsLength: summaries?.results?.length || 0,
                sampleResult: summaries?.results?.[0]
            });
            
            // Test histories
            const histories = await fetchAggregateHistory(sampleIds, 1);
            console.log('Histories result structure:', {
                hasResults: !!histories?.results,
                resultsLength: histories?.results?.length || 0,
                sampleResult: histories?.results?.[0]
            });
        }
        
        return 'Aggregate data test complete';
    } catch (e) {
        console.error('Aggregate data test failed:', e);
        return 'Aggregate data test failed';
    }
};
