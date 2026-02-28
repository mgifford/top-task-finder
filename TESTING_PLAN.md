# Testing Plan for URL Discovery Fixes

## Overview
This document outlines how to test the fixes for URL discovery issues affecting mn.gov, gov.gr, and other bot-protected sites.

## Changes to Test

### 1. sourcesAttempted Tracking Fix
**What Changed**: The discovery summary now correctly includes 'crawl' in `sourcesAttempted` when crawling is attempted.

**How to Verify**:
```bash
# Trigger a cache refresh for any domain
# Check the generated JSON file
cat cache/example.com-100.json | jq '.discoverySummary.sourcesAttempted'

# Expected output should include "crawl" if crawling was attempted:
# ["sitemap", "homepage-fallback", "crawl"]
```

### 2. Browser-Like Headers
**What Changed**: The `fetchText` function now uses realistic browser headers including a Chrome user-agent.

**How to Verify**:
1. Trigger cache refresh for mn.gov:
   - Via GitHub Actions workflow dispatch: Go to Actions → Refresh URL Cache → Run workflow
   - Input: `https://mn.gov`, Count: `100`

2. Check the generated cache file:
   ```bash
   cat cache/mn.gov-100.json | jq '{
     returnedCount: .returnedCount,
     warnings: .discoverySummary.warnings,
     sourceCounts: .discoverySummary.sourceCounts
   }'
   ```

3. **Success indicators**:
   - `returnedCount` > 1 (ideally 50-100)
   - No redirect to `validate.perfdrive.com` in warnings
   - `sourceCounts.raw.sitemap` > 0 OR `sourceCounts.raw["homepage-fallback"]` > 0

4. **If still blocked**:
   - Warnings should show more descriptive errors (e.g., "HTTP 403 Forbidden" instead of just "fetch failed")
   - The improved diagnostics help understand what's failing

### 3. Improved Error Messages
**What Changed**: Error messages now include HTTP status codes and better context.

**How to Verify**:
```bash
# Look at warnings in cache files for failed sites
cat cache/*.json | jq -r 'select(.returnedCount == 1) | 
  "\(.selectedUrls[0] | split("/")[2]): " + (.discoverySummary.warnings | join(" | "))'
```

**Expected improvements**:
- Before: "Homepage fallback unavailable: fetch failed"
- After: "Homepage fallback unavailable: HTTP 403 Forbidden" or "Homepage fallback unavailable: fetch failed: network error"

## Testing Scenarios

### Scenario 1: Previously Blocked Site (mn.gov)
**Steps**:
1. Clear existing cache: `rm cache/mn.gov-100.json`
2. Run cache builder: `node scripts/build-cache.mjs --domain-url https://mn.gov --requested-count 100`
3. Check results: `cat cache/mn.gov-100.json`

**Expected Results**:
- Best case: 50-100 URLs discovered
- Acceptable: More descriptive error messages if still blocked
- `sourcesAttempted` includes attempted sources

### Scenario 2: Failed Site (gov.gr)
**Steps**:
1. Clear existing cache: `rm cache/gov.gr-100.json`
2. Run cache builder: `node scripts/build-cache.mjs --domain-url https://gov.gr --requested-count 100`
3. Check results: `cat cache/gov.gr-100.json`

**Expected Results**:
- May still fail if geographic/IP restrictions apply
- Error messages should be more specific
- `sourcesAttempted` should show all three methods were tried

### Scenario 3: Working Site (Control Test)
**Steps**:
1. Test with a known working site: `node scripts/build-cache.mjs --domain-url https://gsa.gov --requested-count 75`
2. Verify it still works correctly

**Expected Results**:
- Should return close to 75 URLs
- No regressions in functionality

## Automated Testing via GitHub Actions

### Using Workflow Dispatch
1. Go to: https://github.com/mgifford/top-task-finder/actions/workflows/cache-refresh.yml
2. Click "Run workflow"
3. Enter domain: `mn.gov` (or `gov.gr`)
4. Enter count: `100`
5. Run workflow
6. After completion, check the committed cache file

### Monitoring Scheduled Runs
The cache refresh workflow runs on a schedule for configured targets. Monitor the workflow runs to see if:
- More URLs are being discovered for previously problematic domains
- Error messages are more informative
- `sourcesAttempted` is correctly populated

## Success Criteria

### Primary Goals ✅
1. `sourcesAttempted` correctly shows which methods were attempted
2. Browser-like headers reduce bot detection blocking
3. Error messages provide actionable diagnostic information

### Secondary Goals 🎯
1. mn.gov returns more than 1 URL (target: 50+)
2. gov.gr returns more than 1 URL (target: 50+)
3. No regressions for working sites

### Documentation Goals 📚
1. Investigation summary explains the issues
2. Testing plan provides clear verification steps
3. Cache files include clear diagnostic information

## Troubleshooting

### If Sites Still Return Only 1 URL:

**Check 1**: Verify headers are being used
```bash
# Run with verbose logging to see actual requests
# (May require adding debug logging to fetchText)
```

**Check 2**: Review specific warnings
```bash
cat cache/mn.gov-100.json | jq '.discoverySummary.warnings'
```

**Check 3**: Check if IP-based blocking
- GitHub Actions runners use specific IP ranges
- Sites may block entire IP ranges regardless of headers

**Check 4**: Try alternative discovery methods
- Users can use browser-based discovery from the web interface
- Browser fetch uses their own IP and browser credentials

### If Regressions Occur:

**Rollback**: The changes are isolated to `scripts/build-cache.mjs`
```bash
git revert <commit-hash>
```

**Debug**: Check git history for the specific change that caused issues
```bash
git log --oneline scripts/build-cache.mjs
git show <commit-hash>
```

## Next Steps After Testing

1. **If successful**: 
   - Close the issue
   - Update documentation with findings
   - Consider adding retry logic for transient failures

2. **If partially successful**:
   - Document which sites improved
   - Document which sites still have issues and why
   - Consider site-specific workarounds or user guidance

3. **If unsuccessful**:
   - Review logs for specific failure reasons
   - Consider alternative approaches (proxies, different timing, etc.)
   - Document limitations in README
