const fs = require('fs');
const path = require('path');

console.log('🔧 Checking .env.local for line break issues...');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

console.log('Current NEXT_PUBLIC_SALESFORCE_CLIENT_ID:');
const lines = envContent.split('\n');
const clientIdLines = lines.filter(line => line.includes('NEXT_PUBLIC_SALESFORCE_CLIENT_ID'));
clientIdLines.forEach((line, index) => {
  console.log(`Line ${index + 1}: "${line}"`);
});

// Check if there's a line break issue
const hasLineBreak = clientIdLines.some(line => line.includes('\n') || !line.endsWith('"'));

if (hasLineBreak) {
  console.log('\n❌ Line break detected in NEXT_PUBLIC_SALESFORCE_CLIENT_ID');
  console.log('🔧 Please manually fix this in .env.local:');
  console.log('Replace the broken line with:');
  console.log('NEXT_PUBLIC_SALESFORCE_CLIENT_ID="3MVG9rZSDEiGkwu_ztMAGYhlHBgQYfaAEBH8HipH2F1we_F4w7i8Wt9v9Txmz3ou7VblRKwJW26UAOcLCOIGG"');
} else {
  console.log('✅ No line break issues detected');
}

// Also check the main SALESFORCE_CLIENT_ID
const mainClientId = process.env.SALESFORCE_CLIENT_ID;
console.log('\nSALESFORCE_CLIENT_ID from process.env:');
console.log(`"${mainClientId}"`);
console.log(`Length: ${mainClientId ? mainClientId.length : 0}`);

if (mainClientId && mainClientId.startsWith('3MVG') && mainClientId.length > 80) {
  console.log('✅ SALESFORCE_CLIENT_ID looks correct');
} else {
  console.log('❌ SALESFORCE_CLIENT_ID has issues');
} 