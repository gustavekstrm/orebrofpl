// Cache warmer script for Örebro FPL proxy
// Run this every 5-10 minutes on Render's cron to keep hit rates high
// and perceived latency low

const PROXY_ROOT = 'https://fpl-proxy-1.onrender.com';
const API = `${PROXY_ROOT}/api`;

// Sample FPL IDs from participants (adjust as needed)
const SAMPLE_IDS = [
  141529, 1490173, 2884065, 3666480, 78175, 1537567, 6316536, 1884529,
  4413902, 4971106, 1450793, 5735314, 908791, 8759848, 547800, 4294348
];

async function warmCache() {
    console.log('🔥 Warming Örebro FPL proxy cache...');
    const startTime = Date.now();
    
    try {
        // Warm healthz endpoint
        console.log('🔄 Warming healthz...');
        const healthz = await fetch(`${PROXY_ROOT}/healthz`);
        console.log(`   Healthz: ${healthz.status} ${healthz.statusText}`);
        
        // Warm bootstrap (long TTL, but good to have fresh)
        console.log('🔄 Warming bootstrap...');
        const bootstrap = await fetch(`${API}/bootstrap-static/?__=${Date.now()}`);
        console.log(`   Bootstrap: ${bootstrap.status} ${bootstrap.statusText}`);
        
        // Warm aggregate summaries (chunked to avoid overwhelming)
        console.log('🔄 Warming aggregate summaries...');
        const summaryChunks = chunk(SAMPLE_IDS, 8); // Smaller chunks for warming
        for (const chunk of summaryChunks) {
            const summary = await fetch(`${API}/aggregate/summary?ids=${chunk.join(',')}&__=${Date.now()}`);
            console.log(`   Summary chunk (${chunk.length} IDs): ${summary.status} ${summary.statusText}`);
            await sleep(100); // Small delay between chunks
        }
        
        // Warm aggregate history for current GW
        console.log('🔄 Warming aggregate history...');
        const historyChunks = chunk(SAMPLE_IDS, 8);
        for (const chunk of historyChunks) {
            const history = await fetch(`${API}/aggregate/history?ids=${chunk.join(',')}&gw=1&__=${Date.now()}`);
            console.log(`   History chunk (${chunk.length} IDs): ${history.status} ${history.statusText}`);
            await sleep(100);
        }
        
        const duration = Date.now() - startTime;
        console.log(`✅ Cache warming completed in ${duration}ms`);
        
    } catch (error) {
        console.error('❌ Cache warming failed:', error.message);
        process.exit(1);
    }
}

function chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run if called directly
if (require.main === module) {
    warmCache();
}

module.exports = { warmCache };
