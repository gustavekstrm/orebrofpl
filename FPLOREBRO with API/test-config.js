// Test script for centralized configuration
console.log('=== TESTING CENTRALIZED CONFIGURATION ===');

// Test 1: Check if config file loaded
console.log('\n1. Configuration Loading Test:');
console.log('✅ LEAGUE_CODE:', window.LEAGUE_CODE);
console.log('✅ ENTRY_IDS count:', (window.ENTRY_IDS || []).length);
console.log('✅ BUILD_TAG:', window.__BUILD_TAG__);

// Test 2: Verify all 51 IDs are present
console.log('\n2. Entry IDs Verification:');
if (window.ENTRY_IDS && window.ENTRY_IDS.length === 51) {
    console.log('✅ All 51 entry IDs loaded correctly');
    console.log('✅ First 5 IDs:', window.ENTRY_IDS.slice(0, 5));
    console.log('✅ Last 5 IDs:', window.ENTRY_IDS.slice(-5));
} else {
    console.log('❌ Expected 51 IDs, got:', window.ENTRY_IDS ? window.ENTRY_IDS.length : 0);
}

// Test 3: Check getKnownEntryIds function
console.log('\n3. getKnownEntryIds Function Test:');
if (typeof getKnownEntryIds === 'function') {
    const ids = getKnownEntryIds();
    console.log('✅ getKnownEntryIds() returns:', ids.length, 'IDs');
    console.log('✅ First 5 from getKnownEntryIds:', ids.slice(0, 5));
} else {
    console.log('❌ getKnownEntryIds function not found');
}

// Test 4: Check script loading order
console.log('\n4. Script Loading Order Test:');
const scripts = document.querySelectorAll('script[src*="script.js"], script[src*="participants.config.js"]');
console.log('✅ Found', scripts.length, 'relevant script tags');
scripts.forEach((script, index) => {
    console.log(`   ${index + 1}. ${script.src}`);
});

// Test 5: Verify one-liner wiring
console.log('\n5. Wiring Verification:');
console.log('build', window.__BUILD_TAG__, 'ENTRY_IDS', (window.ENTRY_IDS||[]).length);

// Test 6: Check diagnostics function
console.log('\n6. Diagnostics Function Test:');
if (typeof window.__diag === 'function') {
    console.log('✅ __diag function exists');
    console.log('✅ Will log ENTRY_IDS count and aggregate results');
} else {
    console.log('❌ __diag function missing');
}

// Test 7: Test tables loader with IDs
console.log('\n7. Tables Loader Test:');
if (typeof populateTablesWrapper === 'function') {
    console.log('✅ populateTablesWrapper function exists');
    console.log('✅ Will use', (window.ENTRY_IDS || []).length, 'IDs for aggregates');
} else {
    console.log('❌ populateTablesWrapper function missing');
}

console.log('\n=== CONFIGURATION TEST COMPLETE ===');
console.log('\nNext steps:');
console.log('1. Hard refresh the page (Cmd+Shift+R)');
console.log('2. Check console for "build v1.0 ENTRY_IDS 51" message');
console.log('3. Click "Tabeller" - should show aggregate requests with 51 IDs');
console.log('4. Run window.__diag() for detailed diagnostics');
console.log('5. Verify Network tab shows /api/aggregate/summary?ids=... calls');

// Export test function for manual verification
window.testConfig = function() {
    console.log('Testing configuration...');
    const configOk = window.ENTRY_IDS && window.ENTRY_IDS.length === 51;
    const leagueOk = window.LEAGUE_CODE === '46mnf2';
    const buildOk = window.__BUILD_TAG__ === 'v1.0';
    
    console.log('Config OK:', configOk);
    console.log('League OK:', leagueOk);
    console.log('Build OK:', buildOk);
    
    return configOk && leagueOk && buildOk ? 'Configuration ready' : 'Configuration issues found';
};
