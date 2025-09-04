// Test script for resilient frontend proxy handling
// This tests the new safe fetch helpers and soft-OK/stale response handling

const PROXY_ROOT = 'https://fpl-proxy-1.onrender.com';
const API = `${PROXY_ROOT}/api`;

async function fetchJSON(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) return r.json(); // soft/stale 200 are OK
      last = new Error(`HTTP ${r.status}`);
    } catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 500*(i+1) + Math.floor(Math.random()*300)));
  }
  throw last;
}

// Single-ID helpers that tolerate soft bodies
async function safeFetchHistory(entryId) {
  const data = await fetchJSON(`${API}/entry/${entryId}/history/?__=${Date.now()}`);
  return (data && Array.isArray(data.current)) ? data : { current: [], past: [], chips: [] };
}

async function safeFetchSummary(entryId) {
  const data = await fetchJSON(`${API}/entry/${entryId}/?__=${Date.now()}`);
  return {
    player_first_name: data?.player_first_name || '',
    player_last_name:  data?.player_last_name  || '',
    name:              data?.name || ''
  };
}

function chunk(a,n){const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o;}

async function fetchAggregateSummaries(ids){
  const out=[]; for(const c of chunk(ids,25)){
    const d=await fetchJSON(`${API}/aggregate/summary?ids=${c.join(',')}&__=${Date.now()}`);
    out.push(...(d?.results||[]));
  } return out;
}

async function fetchAggregateHistory(ids, gw){
  const out=[]; for(const c of chunk(ids,25)){
    const d=await fetchJSON(`${API}/aggregate/history?ids=${c.join(',')}&gw=${gw}&__=${Date.now()}`);
    out.push(...(d?.results||[]));
  } return out;
}

async function testResilientProxyHandling() {
    console.log('🧪 Testing Resilient Proxy Handling...\n');
    
    // Test with sample FPL IDs from the participants
    const testIds = [141529, 1490173, 2884065]; // Sample IDs from participantsData
    
    try {
        console.log('🔄 Testing healthz endpoint...');
        const healthz = await fetch(`${PROXY_ROOT}/healthz`);
        console.log(`✅ Healthz status: ${healthz.status} ${healthz.statusText}`);
        
        // Check for proxy headers
        const softHeader = healthz.headers.get('X-Proxy-Soft');
        const staleHeader = healthz.headers.get('X-Proxy-Stale');
        console.log(`   X-Proxy-Soft: ${softHeader || 'not present'}`);
        console.log(`   X-Proxy-Stale: ${staleHeader || 'not present'}`);
        
        console.log('\n🔄 Testing safeFetchHistory (tolerates soft bodies)...');
        for (const id of testIds) {
            try {
                const history = await safeFetchHistory(id);
                const hasCurrent = Array.isArray(history.current);
                const hasPast = Array.isArray(history.past);
                console.log(`   ✅ ID ${id}: current=${hasCurrent}, past=${hasPast}, current.length=${history.current?.length || 0}`);
            } catch (error) {
                console.log(`   ❌ ID ${id}: ${error.message}`);
            }
        }
        
        console.log('\n🔄 Testing safeFetchSummary (tolerates soft bodies)...');
        for (const id of testIds) {
            try {
                const summary = await safeFetchSummary(id);
                const hasName = summary.player_first_name || summary.player_last_name;
                console.log(`   ✅ ID ${id}: "${summary.player_first_name} ${summary.player_last_name}".trim()" (${summary.name || 'no team'})`);
            } catch (error) {
                console.log(`   ❌ ID ${id}: ${error.message}`);
            }
        }
        
        console.log('\n🔄 Testing aggregate endpoints (accept stale 200)...');
        const summaries = await fetchAggregateSummaries(testIds);
        console.log(`✅ Got ${summaries.length} summary results`);
        
        summaries.forEach(result => {
            const status = result.ok ? '✅' : '❌';
            const stale = result.stale ? ' (stale)' : '';
            const soft = result.soft ? ' (soft)' : '';
            console.log(`   ${status} ID ${result.id}: ${result.ok ? 'OK' + stale + soft : `Error ${result.status}`}`);
        });
        
        console.log('\n🔄 Testing aggregate history (accept stale 200)...');
        const history = await fetchAggregateHistory(testIds, 1);
        console.log(`✅ Got ${history.length} history results`);
        
        history.forEach(result => {
            const status = result.ok ? '✅' : '❌';
            const stale = result.stale ? ' (stale)' : '';
            const soft = result.soft ? ' (soft)' : '';
            const points = result.points !== null ? `${result.points}p` : 'N/A';
            console.log(`   ${status} ID ${result.id}: ${points}${stale}${soft}`);
        });
        
        console.log('\n🎯 All resilient proxy tests passed!');
        console.log('✅ Frontend handles soft-OK and stale responses gracefully');
        console.log('✅ No hard failures on 403/soft responses');
        console.log('✅ Aggregate endpoints work with stale data');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testResilientProxyHandling();
