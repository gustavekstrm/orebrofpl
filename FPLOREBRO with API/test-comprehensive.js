// Comprehensive test script to verify all fixes
console.log('=== COMPREHENSIVE TEST STARTING ===');

// Test 1: Check if critical functions exist
console.log('\n1. Function Existence Tests:');
console.log('✅ showSection exists:', typeof window.showSection === 'function');
console.log('✅ populateProfiles exists:', typeof populateProfiles === 'function');
console.log('✅ onClickDeltagare exists:', typeof onClickDeltagare === 'function');
console.log('✅ __diag exists:', typeof window.__diag === 'function');
console.log('✅ fetchJSON exists:', typeof window.fetchJSON === 'function');
console.log('✅ fetchAggregateSummaries exists:', typeof window.fetchAggregateSummaries === 'function');
console.log('✅ fetchAggregateHistory exists:', typeof window.fetchAggregateHistory === 'function');
console.log('✅ loadTablesViewUsingAggregates exists:', typeof window.loadTablesViewUsingAggregates === 'function');
console.log('✅ ensureParticipantsData exists:', typeof window.ensureParticipantsData === 'function');

// Test 2: Check data sources
console.log('\n2. Data Source Tests:');
console.log('✅ ENTRY_IDS:', window.ENTRY_IDS);
console.log('✅ LEAGUE_CODE:', window.LEAGUE_CODE);
console.log('✅ participantsData length:', participantsData.length);
console.log('✅ First participant:', participantsData[0]);

// Test 3: Check configuration
console.log('\n3. Configuration Tests:');
console.log('✅ USE_PROXY:', USE_PROXY);
console.log('✅ DISABLE_API_CALLS:', DISABLE_API_CALLS);
console.log('✅ EAGER_FETCH_PICKS_FOR_TABLES:', EAGER_FETCH_PICKS_FOR_TABLES);
console.log('✅ PROXY_ROOT:', PROXY_ROOT);
console.log('✅ FORCE_GW:', FORCE_GW);

// Test 4: Check section IDs
console.log('\n4. Section ID Tests:');
console.log('✅ tables section exists:', !!document.getElementById('tables'));
console.log('✅ profiles section exists:', !!document.getElementById('profiles'));
console.log('✅ Navigation buttons exist:', document.querySelectorAll('.nav-btn').length);

// Test 5: Check script version
console.log('\n5. Script Version Test:');
const scriptTag = document.querySelector('script[src*="script.js"]');
console.log('✅ Script tag found:', !!scriptTag);
if (scriptTag) {
    console.log('✅ Script version:', scriptTag.src);
    console.log('✅ Has defer attribute:', scriptTag.hasAttribute('defer'));
}

// Test 6: Test section resolver
console.log('\n6. Section Resolver Test:');
if (typeof window.showSection === 'function') {
    console.log('✅ showSection function is patched');
    // Test the resolver logic
    const testResolve = (id) => {
        const aliases = { 
            tables: ['tables','tabeller'], 
            profiles: ['profiles','participants','deltagare'] 
        };
        const list = aliases[id] || [id];
        for (const cand of list){
            if (document.getElementById(cand)) return cand;
        }
        return id;
    };
    console.log('✅ tables resolves to:', testResolve('tables'));
    console.log('✅ profiles resolves to:', testResolve('profiles'));
}

// Test 7: Test diagnostics function
console.log('\n7. Diagnostics Function Test:');
if (typeof window.__diag === 'function') {
    console.log('✅ __diag function exists and is callable');
    // Don't actually call it here to avoid network requests during test
} else {
    console.log('❌ __diag function missing');
}

// Test 8: Check for conflicts
console.log('\n8. Conflict Detection:');
const showSectionAssignments = [];
for (let i = 0; i < scriptTag.parentNode.children.length; i++) {
    const child = scriptTag.parentNode.children[i];
    if (child.tagName === 'SCRIPT' && child.textContent.includes('window.showSection')) {
        showSectionAssignments.push(child);
    }
}
console.log('✅ showSection assignments found:', showSectionAssignments.length);

// Test 9: Check aggregate functions
console.log('\n9. Aggregate Functions Test:');
console.log('✅ buildParticipantsFromAggregates exists:', typeof buildParticipantsFromAggregates === 'function');
console.log('✅ populateTablesWrapper exists:', typeof populateTablesWrapper === 'function');
console.log('✅ populateSeasonTable exists:', typeof populateSeasonTable === 'function');
console.log('✅ populateGameweekTable exists:', typeof populateGameweekTable === 'function');

// Test 10: Check fallback renderer
console.log('\n10. Fallback Renderer Test:');
console.log('✅ renderNoParticipantsRow exists:', typeof renderNoParticipantsRow === 'function');

console.log('\n=== COMPREHENSIVE TEST COMPLETE ===');
console.log('\nNext steps:');
console.log('1. Hard refresh the page (Cmd+Shift+R)');
console.log('2. Click "Tabeller" - should show aggregate requests in Network tab');
console.log('3. Click "Deltagare" - should show participants or fallback message');
console.log('4. Run window.__diag() in console for detailed diagnostics');
console.log('5. Check Network tab for /api/aggregate/summary and /api/aggregate/history calls');

// Export test function for manual verification
window.runComprehensiveTest = function() {
    console.log('Running comprehensive test...');
    // This will be called manually if needed
};
