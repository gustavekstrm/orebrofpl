#!/usr/bin/env node

// Enhanced Proxy Deployment Helper
// Run this script to prepare and deploy the enhanced proxy

const fs = require('fs');
const path = require('path');

console.log('🚀 Enhanced FPL Proxy Deployment Helper\n');

// Check if required files exist
const requiredFiles = [
  'proxy-enhanced.js',
  'package.json',
  'test-enhanced-proxy.js'
];

console.log('📋 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Missing required files. Please ensure all files are present.');
  process.exit(1);
}

console.log('\n✅ All required files found!');

// Display deployment instructions
console.log('\n📋 Deployment Instructions:');
console.log('1. Create a new repository for the proxy (separate from frontend)');
console.log('2. Upload these files to the repository:');
requiredFiles.forEach(file => console.log(`   - ${file}`));

console.log('\n3. Create a new Render Web Service:');
console.log('   - Connect to your proxy repository');
console.log('   - Environment: Node');
console.log('   - Build Command: npm install');
console.log('   - Start Command: npm start');

console.log('\n4. Set environment variables in Render:');
console.log('   FPL_API_BASE=https://fantasy.premierleague.com/api/');
console.log('   ALLOWED_ORIGINS=https://gustavekstrm.github.io');
console.log('   UPSTREAM_CONCURRENCY=2');
console.log('   UPSTREAM_DELAY_MS=200');
console.log('   TTL_BOOTSTRAP_MS=900000');
console.log('   TTL_HISTORY_MS=300000');
console.log('   TTL_PICKS_MS=60000');
console.log('   TTL_SUMMARY_MS=86400000');
console.log('   STALE_HOURS=12');

console.log('\n5. Deploy and test:');
console.log('   - Wait for deployment to complete (2-3 minutes)');
console.log('   - Run: node test-enhanced-proxy.js');
console.log('   - Check health endpoint: curl https://your-proxy-url.onrender.com/healthz');

console.log('\n6. Update frontend:');
console.log('   - Update FPL_PROXY_BASE in script.js to new proxy URL');
console.log('   - Deploy frontend changes');

console.log('\n📚 For detailed instructions, see: ENHANCED_PROXY_DEPLOYMENT.md');

// Check package.json dependencies
console.log('\n🔍 Validating package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  const requiredDeps = [
    'axios', 'compression', 'cors', 'express', 
    'express-rate-limit', 'helmet', 'lru-cache', 'morgan'
  ];
  
  const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
  
  if (missingDeps.length > 0) {
    console.log(`❌ Missing dependencies: ${missingDeps.join(', ')}`);
  } else {
    console.log('✅ All required dependencies found');
  }
  
  if (packageJson.scripts && packageJson.scripts.start) {
    console.log('✅ Start script configured');
  } else {
    console.log('❌ Missing start script in package.json');
  }
  
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
}

console.log('\n🎯 Ready for deployment!');
console.log('   Follow the instructions above to deploy your enhanced proxy.');
console.log('   The enhanced proxy will provide:');
console.log('   - Server-side caching with stale-if-error');
console.log('   - Upstream queue management');
console.log('   - Aggregate endpoints for batch requests');
console.log('   - Health monitoring and metrics');
console.log('   - Better reliability and performance');

console.log('\n🚀 Good luck with your deployment!');
