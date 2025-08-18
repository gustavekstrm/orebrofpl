// Deployment script to enable API mode
// This script will be run before deployment to enable FPL API integration

const fs = require('fs');
const path = require('path');

console.log('🚀 Preparing for deployment...');

// Read the script.js file
const scriptPath = path.join(__dirname, 'script.js');
let scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Enable API calls for deployment
scriptContent = scriptContent.replace(
    /const DISABLE_API_CALLS = true;/,
    'const DISABLE_API_CALLS = false; // API enabled for deployment'
);

// Write the updated file
fs.writeFileSync(scriptPath, scriptContent);

console.log('✅ API mode enabled for deployment');
console.log('🌐 FPL API integration will be active when deployed to a proper server');
console.log('📊 All 51 participants will load real data from FPL API');
