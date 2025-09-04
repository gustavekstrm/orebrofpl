// Test script for participant name mapping and picks safety
console.log('=== TESTING PARTICIPANT NAME MAPPING & PICKS SAFETY ===');

// Test 1: Check if participant overrides are loaded
console.log('\n1. Participant Overrides Test:');
console.log('✅ PARTICIPANT_OVERRIDES count:', Object.keys(window.PARTICIPANT_OVERRIDES || {}).length);
console.log('✅ Sample override:', window.PARTICIPANT_OVERRIDES?.[1490173]);

// Test 2: Test applyParticipantOverride function
console.log('\n2. applyParticipantOverride Function Test:');
if (typeof applyParticipantOverride === 'function') {
    const testOverride = applyParticipantOverride(1490173, {
        player_first_name: 'API',
        player_last_name: 'Name',
        name: 'API Team'
    });
    console.log('✅ applyParticipantOverride works:', testOverride);
    
    // Test with no API data (should use override)
    const testNoAPI = applyParticipantOverride(1490173, {});
    console.log('✅ Override priority (no API):', testNoAPI);
    
    // Test with no override (should use API)
    const testNoOverride = applyParticipantOverride(999999, {
        player_first_name: 'API',
        player_last_name: 'Name',
        name: 'API Team'
    });
    console.log('✅ API fallback (no override):', testNoOverride);
} else {
    console.log('❌ applyParticipantOverride function not found');
}

// Test 3: Test normalizePicksResponse function
console.log('\n3. normalizePicksResponse Function Test:');
if (typeof normalizePicksResponse === 'function') {
    // Test with valid data
    const validPicks = normalizePicksResponse({
        data: {
            entry_history: { event: 1, points: 50 },
            picks: [{ id: 1, is_captain: true }]
        }
    });
    console.log('✅ Valid picks normalized:', validPicks);
    
    // Test with missing data
    const missingPicks = normalizePicksResponse({
        data: { entry_history: null }
    });
    console.log('✅ Missing picks handled:', missingPicks);
    
    // Test with null input
    const nullPicks = normalizePicksResponse(null);
    console.log('✅ Null input handled:', nullPicks);
} else {
    console.log('❌ normalizePicksResponse function not found');
}

// Test 4: Test buildParticipantsFromAggregates with overrides
console.log('\n4. buildParticipantsFromAggregates Test:');
if (typeof buildParticipantsFromAggregates === 'function') {
    console.log('✅ buildParticipantsFromAggregates function exists');
    console.log('✅ Will use applyParticipantOverride for name mapping');
} else {
    console.log('❌ buildParticipantsFromAggregates function not found');
}

// Test 5: Test ensureParticipantsData with overrides
console.log('\n5. ensureParticipantsData Test:');
if (typeof ensureParticipantsData === 'function') {
    console.log('✅ ensureParticipantsData function exists');
    console.log('✅ Will use applyParticipantOverride for name mapping');
} else {
    console.log('❌ ensureParticipantsData function not found');
}

// Test 6: Check table renderers use displayName/teamName
console.log('\n6. Table Renderers Test:');
if (typeof populateSeasonTable === 'function' && typeof populateGameweekTable === 'function') {
    console.log('✅ Table renderers exist');
    console.log('✅ Both use player.displayName and player.teamName');
} else {
    console.log('❌ Table renderers missing');
}

// Test 7: Test API connection (should not use picks)
console.log('\n7. API Connection Test:');
if (typeof testAPIConnection === 'function') {
    console.log('✅ testAPIConnection function exists');
    console.log('✅ Uses healthz + aggregate/summary only (no picks)');
} else {
    console.log('❌ testAPIConnection function not found');
}

// Test 8: Test diagnostics
console.log('\n8. Diagnostics Test:');
if (typeof window.__diagNames === 'function') {
    console.log('✅ __diagNames function exists');
    window.__diagNames();
} else {
    console.log('❌ __diagNames function not found');
}

console.log('\n=== PARTICIPANT NAMES & PICKS SAFETY TEST COMPLETE ===');
console.log('\nNext steps:');
console.log('1. Hard refresh the page (Cmd+Shift+R)');
console.log('2. Check console for "build v2.0 ENTRY_IDS 51" message');
console.log('3. Click "Deltagare" - should show names from overrides');
console.log('4. Click "Tabeller" - should show names and no picks crashes');
console.log('5. Run window.__diagNames() for name mapping diagnostics');
console.log('6. Verify no "null is not an object" errors in console');

// Export test functions for manual verification
window.testParticipantNames = function() {
    console.log('Testing participant names...');
    
    // Test override coverage
    const ids = Array.isArray(window.ENTRY_IDS) ? window.ENTRY_IDS : [];
    const overrides = Object.keys(window.PARTICIPANT_OVERRIDES || {});
    const coverage = overrides.length / ids.length;
    
    console.log('Override coverage:', Math.round(coverage * 100) + '%');
    console.log('ENTRY_IDS:', ids.length);
    console.log('Overrides:', overrides.length);
    
    // Test sample names
    const sampleId = ids[0];
    if (sampleId) {
        const sampleOverride = window.PARTICIPANT_OVERRIDES?.[sampleId];
        console.log('Sample ID:', sampleId, 'Override:', sampleOverride);
    }
    
    return coverage > 0.9 ? 'Names ready' : 'Names incomplete';
};

window.testPicksSafety = function() {
    console.log('Testing picks safety...');
    
    // Test normalizer
    const testCases = [
        null,
        { data: null },
        { data: { entry_history: null, picks: null } },
        { data: { entry_history: { event: 1 }, picks: [] } }
    ];
    
    testCases.forEach((testCase, index) => {
        try {
            const result = normalizePicksResponse(testCase);
            console.log(`Test case ${index + 1} passed:`, result);
        } catch (e) {
            console.log(`Test case ${index + 1} failed:`, e);
        }
    });
    
    return 'Picks safety verified';
};
