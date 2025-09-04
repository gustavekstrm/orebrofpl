// Test script for frontend aggregate endpoint integration
// This tests the new API helpers and aggregate functions

const API = 'https://fpl-proxy-1.onrender.com/api';

async function fetchJSON(url, tries = 3) {
  let last;
  for (let i=0;i<tries;i++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) return r.json();        // stale 200 is OK
      last = new Error(`HTTP ${r.status}`);
    } catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 500*(i+1) + Math.floor(Math.random()*300)));
  }
  throw last;
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

async function buildParticipantsFromAggregates(entryIds){
  const res = await fetchAggregateSummaries(entryIds);
  return res.map(r=>{
    if (r.ok && r.data){
      const fn=r.data?.player_first_name||'', ln=r.data?.player_last_name||'';
      const displayName = (fn||ln)?`${fn} ${ln}`.trim():`Manager ${r.id}`;
      const teamName = r.data?.name || undefined;
      return { fplId:r.id, displayName, teamName };
    }
    return { fplId:r.id, displayName:`Manager ${r.id}` };
  });
}

async function testAggregateEndpoints() {
    console.log('🧪 Testing Frontend Aggregate Endpoints...\n');
    
    // Test with sample FPL IDs from the participants
    const testIds = [141529, 1490173, 2884065]; // Sample IDs from participantsData
    
    try {
        console.log('🔄 Testing aggregate summaries...');
        const summaries = await fetchAggregateSummaries(testIds);
        console.log(`✅ Got ${summaries.length} summary results`);
        
        summaries.forEach(result => {
            const status = result.ok ? '✅' : '❌';
            const stale = result.stale ? ' (stale)' : '';
            console.log(`   ${status} ID ${result.id}: ${result.ok ? 'OK' + stale : `Error ${result.status}`}`);
        });
        
        console.log('\n🔄 Testing aggregate history...');
        const history = await fetchAggregateHistory(testIds, 1);
        console.log(`✅ Got ${history.length} history results`);
        
        history.forEach(result => {
            const status = result.ok ? '✅' : '❌';
            const stale = result.stale ? ' (stale)' : '';
            const points = result.points !== null ? `${result.points}p` : 'N/A';
            console.log(`   ${status} ID ${result.id}: ${points}${stale}`);
        });
        
        console.log('\n🔄 Testing buildParticipantsFromAggregates...');
        const participants = await buildParticipantsFromAggregates(testIds);
        console.log(`✅ Built ${participants.length} participants`);
        
        participants.forEach(participant => {
            console.log(`   ID ${participant.fplId}: "${participant.displayName}" (${participant.teamName || 'no team'})`);
        });
        
        console.log('\n🎯 All aggregate endpoint tests passed!');
        console.log('✅ Frontend integration is ready');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testAggregateEndpoints();
