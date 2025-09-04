// Test script to verify the fixes
console.log('=== TESTING FIXES ===');

// Test 1: Check if critical functions exist
console.log('Test 1: Function existence');
console.log('populateProfiles exists:', typeof populateProfiles === 'function');
console.log('onClickDeltagare exists:', typeof onClickDeltagare === 'function');
console.log('showSection exists:', typeof showSection === 'function');
console.log('getKnownEntryIds exists:', typeof getKnownEntryIds === 'function');

// Test 2: Check data sources
console.log('\nTest 2: Data sources');
console.log('ENTRY_IDS:', window.ENTRY_IDS);
console.log('LEAGUE_CODE:', window.LEAGUE_CODE);
console.log('participantsData length:', participantsData.length);
console.log('First participant:', participantsData[0]);

// Test 3: Check configuration
console.log('\nTest 3: Configuration');
console.log('USE_PROXY:', USE_PROXY);
console.log('DISABLE_API_CALLS:', DISABLE_API_CALLS);
console.log('EAGER_FETCH_PICKS_FOR_TABLES:', EAGER_FETCH_PICKS_FOR_TABLES);
console.log('PROXY_ROOT:', PROXY_ROOT);

// Test 4: Check aggregate functions
console.log('\nTest 4: Aggregate functions');
console.log('fetchAggregateSummaries exists:', typeof fetchAggregateSummaries === 'function');
console.log('fetchAggregateHistory exists:', typeof fetchAggregateHistory === 'function');
console.log('buildParticipantsFromAggregates exists:', typeof buildParticipantsFromAggregates === 'function');
console.log('loadTablesViewUsingAggregates exists:', typeof loadTablesViewUsingAggregates === 'function');

// Test 5: Check table renderers
console.log('\nTest 5: Table renderers');
console.log('populateSeasonTable exists:', typeof populateSeasonTable === 'function');
console.log('populateGameweekTable exists:', typeof populateGameweekTable === 'function');

// Test 6: Check diagnostics function
console.log('\nTest 6: Diagnostics');
console.log('__diag exists:', typeof window.__diag === 'function');

console.log('\n=== TESTS COMPLETE ===');
console.log('If all tests pass, the fixes should work correctly.');
console.log('Use window.__diag() in console for additional debugging.');
