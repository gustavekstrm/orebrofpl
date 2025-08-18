// Local development script to disable API mode
// This script will be run for local development to avoid CORS issues

const fs = require('fs');
const path = require('path');

console.log('🛠️  Setting up for local development...');

// Read the script.js file
const scriptPath = path.join(__dirname, 'script.js');
let scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Disable API calls for local development
scriptContent = scriptContent.replace(
    /const DISABLE_API_CALLS = false;/,
    'const DISABLE_API_CALLS = true; // API disabled for local development (CORS)'
);

// Write the updated file
fs.writeFileSync(scriptPath, scriptContent);

console.log('✅ Local development mode enabled');
console.log('📊 Using mock data to avoid CORS issues');
console.log('🌐 API integration will be active when deployed to a proper server');
