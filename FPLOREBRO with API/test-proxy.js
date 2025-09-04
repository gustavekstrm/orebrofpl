// Test script to verify FPL API proxy functionality
// Run this before deploying to ensure everything works

const testProxy = async () => {
    console.log('🧪 Testing FPL API Proxy...\n');
    
    // Test endpoints
    const endpoints = [
        '/api/bootstrap-static/',
        '/api/entry/1490173/',
        '/api/entry/1490173/event/1/picks/'
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`🔄 Testing: ${endpoint}`);
            
            // Test direct API (should work from Node.js)
            const directResponse = await fetch(`https://fantasy.premierleague.com${endpoint}`);
            console.log(`✅ Direct API: ${directResponse.status}`);
            
            // Test proxy (replace with your actual proxy URL)
            const proxyUrl = 'https://fpl-proxy-1.onrender.com'; // Replace with actual URL
            const proxyResponse = await fetch(`${proxyUrl}${endpoint}`);
            console.log(`✅ Proxy API: ${proxyResponse.status}`);
            
            // Check CORS headers
            const corsHeader = proxyResponse.headers.get('Access-Control-Allow-Origin');
            console.log(`✅ CORS Header: ${corsHeader}`);
            
            console.log('---\n');
            
        } catch (error) {
            console.error(`❌ Error testing ${endpoint}:`, error.message);
            console.log('---\n');
        }
    }
    
    console.log('🎯 Test completed!');
};

// Run the test
testProxy();
