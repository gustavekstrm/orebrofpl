// Test script to temporarily enable API mode for testing
// This will allow you to test API integration locally

const fs = require('fs');
const path = require('path');

console.log('🧪 Enabling API mode for testing...');

// Read the script.js file
const scriptPath = path.join(__dirname, 'script.js');
let scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Enable API calls for testing
scriptContent = scriptContent.replace(
    /const DISABLE_API_CALLS = true;/,
    'const DISABLE_API_CALLS = false; // API enabled for testing'
);

// Write the updated file
fs.writeFileSync(scriptPath, scriptContent);

console.log('✅ API mode enabled for testing');
console.log('⚠️  Note: You may see CORS errors in the browser console');
console.log('🌐 This is normal when testing locally');
console.log('📊 API integration will work when deployed to a proper server');
console.log('');
console.log('To revert back to local development mode:');
console.log('node local-dev.js');
