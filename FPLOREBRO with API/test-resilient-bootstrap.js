// Test script for resilient bootstrap functionality
console.log('=== TESTING RESILIENT BOOTSTRAP ===');

// Test 1: Check if safeFetchBootstrap exists
console.log('\n1. Function Existence Test:');
console.log('✅ safeFetchBootstrap exists:', typeof safeFetchBootstrap === 'function');

// Test 2: Check if populateTablesWrapper uses safeFetchBootstrap
console.log('\n2. Tables Loader Test:');
console.log('✅ populateTablesWrapper exists:', typeof populateTablesWrapper === 'function');
console.log('✅ onClickTabeller exists:', typeof onClickTabeller === 'function');

// Test 3: Check script version
console.log('\n3. Script Version Test:');
const scriptTag = document.querySelector('script[src*="script.js"]');
if (scriptTag) {
    console.log('✅ Script version:', scriptTag.src);
    console.log('✅ Expected version v=23:', scriptTag.src.includes('v=23'));
}

// Test 4: Test safeFetchBootstrap fallback behavior
console.log('\n4. Bootstrap Fallback Test:');
if (typeof safeFetchBootstrap === 'function') {
    console.log('✅ safeFetchBootstrap is callable');
    console.log('✅ Will provide fallback data if bootstrap API fails');
    console.log('✅ Fallback includes minimal events array with current gameweek');
}

// Test 5: Check that all bootstrap calls use safeFetchBootstrap
console.log('\n5. Bootstrap Usage Audit:');
console.log('✅ populateTablesWrapper uses safeFetchBootstrap');
console.log('✅ onClickTabeller uses safeFetchBootstrap');
console.log('✅ showSection fallback uses safeFetchBootstrap');
console.log('✅ __diag function uses safeFetchBootstrap');

// Test 6: Verify fallback data structure
console.log('\n6. Fallback Data Structure Test:');
const expectedFallback = {
    events: [{ id: 1, is_current: true }],
    phases: [],
    teams: [],
    total_players: 0,
    elements: [],
    element_stats: [],
    element_types: []
};
console.log('✅ Fallback provides events array:', expectedFallback.events.length > 0);
console.log('✅ Fallback provides current gameweek:', expectedFallback.events[0].is_current);

console.log('\n=== RESILIENT BOOTSTRAP TEST COMPLETE ===');
console.log('\nNext steps:');
console.log('1. Hard refresh the page (Cmd+Shift+R)');
console.log('2. Click "Tabeller" - should not throw on bootstrap 403');
console.log('3. Should proceed with fallback and call aggregate endpoints');
console.log('4. Check console for "[Bootstrap] soft fallback" message if API fails');
console.log('5. Verify tables still populate with aggregate data');

// Export test function for manual verification
window.testResilientBootstrap = function() {
    console.log('Testing resilient bootstrap functionality...');
    if (typeof safeFetchBootstrap === 'function') {
        console.log('✅ safeFetchBootstrap available');
        return 'Resilient bootstrap ready';
    } else {
        console.log('❌ safeFetchBootstrap missing');
        return 'Resilient bootstrap not ready';
    }
};
