# Elara AI Agent - Testing Guide

## Quick Start (3 Steps)

### 1. Load the Extension

```bash
# Navigate to Chrome Extensions
chrome://extensions

# Enable Developer Mode (toggle in top-right)
# Click "Load unpacked"
# Select: D:\Elara_MVP\elara-ai-agent-v2\dist
```

### 2. Open the Sidepanel

- Click the Elara AI Agent icon in Chrome toolbar
- Or right-click → "Scan this page with Elara"
- Sidepanel will open on the right side

### 3. Test with kbb-vision.com

Type in the chat:
```
Is kbb-vision.com safe?
```

**Expected Response**:
```
DANGEROUS - Risk Level: E (85%)

Indicators Found:
- Typosquatting attempt on Kelley Blue Book (kbb.com)
- Brand impersonation detected
- Hyphenated brand name (common phishing technique)

Threat Intelligence:
- [IF IN TI DB] Blacklisted by [source]
- [OR] Matched suspicious pattern

ML Analysis:
- MobileBERT: 87% phishing probability
- pirocheto: 82% phishing probability
- Ensemble confidence: HIGH

Recommendation: DO NOT visit this URL. It shows signs of malicious activity.

Scan completed in [X]ms (edge/hybrid/deep)
```

---

## Detailed Test Scenarios

### Test 1: Known Safe URL

**Input**: `Check https://google.com`

**Expected**:
- Verdict: SAFE
- Risk Level: A (< 10%)
- TI: Whitelisted
- Latency: < 200ms (TI lookup)

### Test 2: Typosquatting Detection

**Input**: `Is kbb-vision.com dangerous?`

**Expected**:
- Verdict: DANGEROUS
- Risk Level: E-F (80-95%)
- Indicators: Typosquatting, brand impersonation
- ML Models: Both MobileBERT and pirocheto flag it
- Latency: < 100ms (edge) or 1-3s (hybrid)

### Test 3: Deep Scan

**Input**: `Deep scan https://suspicious-site.xyz`

**Expected**:
- Full Scanner V2 pipeline (10-30s)
- 17 ML model predictions
- TI data from 18+ sources
- Gemini-generated summary
- ICP calibrated confidence interval

### Test 4: Fact Checking

**Input**: `Fact check: The Earth is flat`

**Expected**:
- Educational response
- Sources recommended
- No URL scan triggered

### Test 5: Security Education

**Input**: `What is phishing?`

**Expected**:
- Detailed explanation
- Warning signs
- Protection tips
- No API calls

---

## Monitoring & Debugging

### Service Worker Console

```bash
# Open service worker console
chrome://serviceworker-internals

# Find "Elara AI Agent" and click "Inspect"
```

**Look for**:
- `[AuthClient] Login successful` - Auth working
- `[EdgeClient] Elara Edge Engine found` - Edge Engine connected
- `[ScannerClient] Hybrid scan` - TI lookup triggered
- `[ScannerClient] Deep scan` - Scanner V2 triggered
- `[FunctionRouter] Executing function: scan_url` - Function calling working

### Expected Log Flow for URL Scan

```
1. [Orchestrator] Classified intent: scan_url (confidence: 0.98)
2. [FunctionRouter] Executing function: scan_url
3. [FunctionRouter] Auto scan starting for: kbb-vision.com
4. [EdgeClient] Edge scan successful (78ms)
5. [ConfidenceRouter] Confidence: 0.88 (HIGH) - using edge result
6. [Orchestrator] Scan complete - returning result
```

---

## API Endpoints Used

### TI Lookup (Hybrid Scan)
```
POST https://dev-api.thiefdroppers.com/api/v2/ti/lookup
Authorization: Bearer {token}
{
  "url": "https://kbb-vision.com"
}
```

### Scanner V2 (Deep Scan)
```
POST https://dev-api.thiefdroppers.com/api/scanner/v2/scan
Authorization: Bearer {token}
{
  "url": "https://kbb-vision.com",
  "options": {
    "skipScreenshot": false,
    "skipStage2": false
  }
}
```

### Authentication
```
1. GET https://dev-api.thiefdroppers.com/api/csrf-token
2. POST https://dev-api.thiefdroppers.com/api/v2/auth/login
   X-CSRF-Token: {token}
   {
     "email": "admin@oelara.com",
     "password": "ElaraAdmin2025!"
   }
```

---

## Troubleshooting

### Issue: "CSRF token missing"

**Cause**: Cookies not being sent properly

**Fix**: Extension uses `credentials: 'include'` - this should work automatically in browser. If still failing, check Network tab for cookie headers.

### Issue: "Edge Engine not available"

**Cause**: Elara Edge Engine extension not installed or not running

**Impact**: Falls back to cloud API (TI lookup + Scanner V2)

**Fix**: Install Edge Engine extension for on-device ML inference

### Issue: "Authentication failed"

**Cause**: Invalid credentials or API down

**Fix**:
1. Check credentials in `src/api/auth-client.ts`
2. Verify API is reachable: `curl https://dev-api.thiefdroppers.com/api/csrf-token`
3. Check service worker console for detailed error

### Issue: Slow responses (> 5s)

**Possible Causes**:
- Scanner V2 deep scan triggered (10-30s is normal)
- API latency
- Network issues

**Check**:
- Look for "Deep scan" in console logs
- Check Network tab for slow requests
- Verify internet connection

---

## Performance Benchmarks

### Edge Scan (On-Device ML)
- **Latency**: 50-100ms
- **Models**: MobileBERT + pirocheto
- **Accuracy**: ~99% (trained on Elara TI DB)
- **Confidence**: 0.85-0.95

### Hybrid Scan (Edge + TI)
- **Latency**: 1-3s
- **Sources**: 18+ TI sources (3 tiers)
- **Accuracy**: ~99.5%
- **Confidence**: 0.90-0.98

### Deep Scan (Full ML Pipeline)
- **Latency**: 10-30s
- **Models**: 17 baby models (6 families)
- **Accuracy**: >99.8%
- **Confidence**: 0.95-0.99 (ICP calibrated)

---

## Test Data

### Known Phishing URLs (for testing)

```
kbb-vision.com           - Typosquatting (Kelley Blue Book)
paypa1-secure.com        - Typosquatting (PayPal)
arnazon-login.com        - Typosquatting (Amazon)
microsoft-verify.xyz     - Brand + suspicious TLD
secure-banklogin.tk      - Suspicious keywords + risky TLD
```

### Known Safe URLs

```
google.com
microsoft.com
github.com
amazon.com
facebook.com
```

---

## Success Criteria Checklist

- [ ] Extension loads without errors
- [ ] Sidepanel opens and displays chat interface
- [ ] Authentication succeeds (check console for "Login successful")
- [ ] TI lookup returns results for google.com (whitelisted)
- [ ] kbb-vision.com flagged as DANGEROUS
- [ ] Edge Engine integration working (if installed)
- [ ] Scanner V2 deep scan completes
- [ ] Function calling router working (check console)
- [ ] Conversational AI responds to greetings
- [ ] Security education questions answered

---

## Next Steps After Successful Testing

1. **Load Testing**: Test with 10+ concurrent URL scans
2. **Error Scenarios**: Test with invalid URLs, network failures
3. **Edge Engine**: Install Edge Engine for on-device ML testing
4. **WebLLM**: Enable real LLM inference (currently using mocks)
5. **Production Deploy**: Package for Chrome Web Store

---

## Support & Logs

### Key Log Files

- Service Worker Console: `chrome://serviceworker-internals`
- Extension Console: Right-click extension icon → Inspect
- Network Tab: DevTools → Network (filter by dev-api.thiefdroppers.com)

### Common Log Prefixes

- `[AuthClient]` - Authentication
- `[ScannerClient]` - API calls
- `[EdgeClient]` - Edge Engine communication
- `[Orchestrator]` - Intent classification & routing
- `[FunctionRouter]` - Function execution
- `[WebLLMEngine]` - LLM inference

---

**Last Updated**: 2025-12-05
**Build**: Development v2.0.0-beta
**Status**: Ready for Testing ✅
