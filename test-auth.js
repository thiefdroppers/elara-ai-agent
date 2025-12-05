#!/usr/bin/env node
/**
 * Test Authentication Flow
 *
 * Verifies that the Elara AI Agent can authenticate with the API
 * and make successful TI lookups and scans.
 */

const API_BASE = 'https://dev-api.thiefdroppers.com';
const CREDENTIALS = {
  email: 'admin@oelara.com',
  password: 'ElaraAdmin2025!'
};

// Test URLs
const TEST_URLS = [
  'https://google.com',              // Known safe
  'https://kbb-vision.com',          // Typosquatting phishing
  'https://github.com',              // Known safe
];

// Store cookies for session management
let cookieJar = '';

async function getCSRFToken() {
  console.log('📥 Fetching CSRF token...');

  const response = await fetch(`${API_BASE}/api/csrf-token`, {
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`CSRF fetch failed: ${response.status}`);
  }

  // Store cookies from response
  const setCookies = response.headers.get('set-cookie');
  if (setCookies) {
    cookieJar = setCookies;
    console.log(`📦 Stored cookies for session`);
  }

  const data = await response.json();
  console.log(`✅ Got CSRF token: ${data.csrfToken.substring(0, 16)}...`);
  return data.csrfToken;
}

async function login(csrfToken) {
  console.log('🔑 Logging in...');

  const headers = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  };

  // Include cookies if we have them
  if (cookieJar) {
    headers['Cookie'] = cookieJar;
  }

  const response = await fetch(`${API_BASE}/api/v2/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify(CREDENTIALS)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Login failed (${response.status}): ${errorText}`);
  }

  // Update cookies from login response
  const setCookies = response.headers.get('set-cookie');
  if (setCookies) {
    cookieJar = setCookies;
  }

  const data = await response.json();

  if (!data.success || !data.accessToken) {
    throw new Error('Login response missing accessToken');
  }

  console.log(`✅ Login successful`);
  console.log(`   Access token: ${data.accessToken.substring(0, 20)}...`);

  return data.accessToken;
}

async function testTILookup(url, token) {
  console.log(`\n🔍 Testing TI Lookup: ${url}`);
  const startTime = Date.now();

  const response = await fetch(`${API_BASE}/api/v2/ti/lookup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ url })
  });

  const latency = Date.now() - startTime;

  if (!response.ok) {
    console.log(`   ❌ Error: ${response.status} - ${await response.text()}`);
    return;
  }

  const data = await response.json();

  if (data.success && data.data) {
    const result = data.data;
    console.log(`   ⏱️  Latency: ${latency}ms`);
    console.log(`   📊 Domain: ${result.domain || 'N/A'}`);
    console.log(`   📈 Hits: Whitelist=${result.whitelistHits || 0}, Blacklist=${result.blacklistHits || 0}`);

    if (result.whitelist) {
      console.log(`   ✅ WHITELIST: ${result.whitelist.source} (${result.whitelist.confidence}%)`);
    } else if (result.blacklist) {
      console.log(`   🚫 BLACKLIST: ${result.blacklist.source} - ${result.blacklist.threatType}`);
      console.log(`      Severity: ${result.blacklist.severity}, Confidence: ${result.blacklist.confidence}%`);
    } else {
      console.log(`   ⚪ No definitive whitelist/blacklist match`);
    }
  } else {
    console.log(`   ❌ Lookup failed: ${data.error || 'Unknown error'}`);
  }
}

async function testScannerV2(url, token) {
  console.log(`\n🔬 Testing Scanner V2: ${url}`);
  const startTime = Date.now();

  const response = await fetch(`${API_BASE}/api/scanner/v2/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      url,
      options: {
        skipScreenshot: true,
        skipStage2: true  // Fast scan for testing
      }
    })
  });

  const latency = Date.now() - startTime;

  if (!response.ok) {
    console.log(`   ❌ Error: ${response.status} - ${await response.text()}`);
    return;
  }

  const data = await response.json();

  if (data.riskScore !== undefined) {
    console.log(`   ⏱️  Latency: ${latency}ms`);
    console.log(`   🎯 Risk Score: ${(data.riskScore * 100).toFixed(1)}%`);
    console.log(`   📊 Risk Level: ${data.riskLevel || 'N/A'}`);
    console.log(`   ⚖️  Decision: ${data.decision || 'N/A'}`);
    console.log(`   🔍 Is Phishing: ${data.isPhishing || false}`);

    if (data.tiData) {
      console.log(`   📡 TI Blacklist Hits: ${data.tiData.blacklistHits || 0}`);
      if (data.tiData.hasDualTier1) {
        console.log(`   ⚠️  DUAL TIER-1 BLACKLIST DETECTED`);
      }
    }

    if (data.summary) {
      console.log(`   💬 Summary: ${data.summary}`);
    }
  } else {
    console.log(`   ❌ Scan failed: ${data.error || 'Unknown error'}`);
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Elara AI Agent - Authentication & API Test              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Get CSRF token
    const csrfToken = await getCSRFToken();

    // Step 2: Login
    const accessToken = await login(csrfToken);

    // Step 3: Test TI Lookups
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  TI LOOKUP TESTS');
    console.log('═══════════════════════════════════════════════════════════');

    for (const url of TEST_URLS) {
      await testTILookup(url, accessToken);
    }

    // Step 4: Test Scanner V2 (if available)
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  SCANNER V2 TESTS');
    console.log('═══════════════════════════════════════════════════════════');

    for (const url of TEST_URLS) {
      await testScannerV2(url, accessToken);
    }

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ ALL TESTS COMPLETED SUCCESSFULLY                      ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
