/**
 * Test Script for Elara AI Agent Scanner
 *
 * Tests the scanner client with real API calls and edge fallback.
 */

import { authClient } from './src/api/auth-client';
import { scannerClient } from './src/api/scanner-client';

// Test URLs
const testUrls = [
  'https://kbb-vision.com',           // Typosquatting (should be DANGEROUS)
  'https://google.com',                // Safe
  'https://paypa1.com',                // Typosquatting (should be DANGEROUS)
  'https://192.168.1.1',               // IP address (should be SUSPICIOUS)
  'https://login-microsoft.tk',        // Typosquatting + risky TLD (should be DANGEROUS)
  'https://example.com',               // Neutral
];

async function testScanner() {
  console.log('='.repeat(80));
  console.log('ELARA AI AGENT - SCANNER TEST');
  console.log('='.repeat(80));
  console.log('');

  // Test authentication
  console.log('1. Testing Authentication...');
  await authClient.initialize();
  const loginResult = await authClient.login();

  if (loginResult.success) {
    console.log('   ✅ Authentication successful');
    console.log('   Token:', authClient.getAccessToken()?.substring(0, 20) + '...');
  } else {
    console.log('   ❌ Authentication failed:', loginResult.error);
    console.log('   Will use edge fallback only');
  }
  console.log('');

  // Test scanner initialization
  console.log('2. Initializing Scanner...');
  await scannerClient.initialize();
  console.log('   ✅ Scanner initialized');
  console.log('');

  // Test each URL
  console.log('3. Testing URL Scans...');
  console.log('');

  for (const url of testUrls) {
    console.log('-'.repeat(80));
    console.log(`Testing: ${url}`);
    console.log('-'.repeat(80));

    try {
      const result = await scannerClient.hybridScan(url);

      console.log(`   Verdict:     ${result.verdict}`);
      console.log(`   Risk Level:  ${result.riskLevel} (${result.riskScore}%)`);
      console.log(`   Confidence:  ${(result.confidence * 100).toFixed(0)}%`);
      console.log(`   Scan Type:   ${result.scanType}`);
      console.log(`   Latency:     ${result.latency.toFixed(0)}ms`);

      if (result.reasoning && result.reasoning.length > 0) {
        console.log(`   Reasoning:`);
        result.reasoning.slice(0, 3).forEach(r => console.log(`     - ${r}`));
      }

      if (result.indicators && result.indicators.length > 0) {
        console.log(`   Indicators:`);
        result.indicators.slice(0, 3).forEach(ind => {
          console.log(`     - [${ind.severity}] ${ind.description}`);
        });
      }

      // Validate kbb-vision.com detection
      if (url.includes('kbb-vision')) {
        if (result.verdict === 'DANGEROUS' || result.verdict === 'SUSPICIOUS') {
          console.log('   ✅ PASS: Correctly detected typosquatting');
        } else {
          console.log('   ❌ FAIL: Should detect typosquatting (got: ' + result.verdict + ')');
        }
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }

    console.log('');
  }

  console.log('='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

// Run tests
testScanner().catch(console.error);
