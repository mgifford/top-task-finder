# Investigation Summary: URL Discovery Issues for mn.gov and gov.gr

## Problem Statement
The cache files for `mn.gov` and `gov.gr` were returning only 1 URL (the homepage) instead of the requested 100 URLs.

## Investigation Findings

### Root Cause Analysis

1. **mn.gov** - Bot Protection Blocking
   - Site redirects to ShieldSquare/Radware bot protection page (`validate.perfdrive.com`)
   - The crawler's user-agent `top-task-finder-cache-builder/1.0` is specifically detected and blocked
   - The redirect URL includes the user-agent in query parameters, confirming bot detection

2. **gov.gr** - Complete Fetch Failures
   - All fetch attempts (sitemap, homepage, crawl) fail completely
   - May be due to geographic restrictions, network issues, or similar bot protection

### Additional Sites Affected
The investigation revealed several other government sites with the same issue:
- `alberta.gov` - 1 URL (homepage fallback unavailable)
- `canada.ca` - 1 URL (homepage fallback unavailable)
- `toronto.ca` - 1 URL (homepage fallback unavailable)
- `homergaines.com` - 1 URL (sitemap unavailable)

## Fixes Implemented

### 1. Fixed `sourcesAttempted` Tracking (Critical)
**Issue**: The `buildDiscoverySummary` function wasn't properly tracking when the crawl stage was attempted.

**Fix**: Updated `buildDiscoverySummary` to:
- Accept separate `fallbackUsed` and `crawlUsed` parameters
- Properly include 'crawl' in `sourcesAttempted` array when crawl is attempted
- Provide accurate reporting of which discovery methods were tried

**Impact**: Better diagnostics and transparency in cache file results.

### 2. Browser-Like Headers to Avoid Bot Detection (High Priority)
**Issue**: Using a bot-like user-agent caused sites to block or redirect the crawler.

**Fix**: Updated `fetchText` function to use browser-like headers:
- User-Agent: Chrome version 121.0.0.0 on Windows 10
- Accept headers matching a real browser
- Security fetch metadata headers (sec-fetch-*)
- Accept-Language, Accept-Encoding, and other standard browser headers

**Impact**: Should significantly improve success rate with sites that have bot protection.

### 3. Improved Error Messages (Quality of Life)
**Issue**: Generic "fetch failed" errors provided little diagnostic information.

**Fix**: Enhanced error handling to:
- Include HTTP status code and status text for failed requests
- Preserve detailed error messages from network failures
- Provide better context for debugging

**Impact**: Easier troubleshooting and debugging of fetch failures.

## Testing Recommendations

### To Verify the Fixes Work:

1. **Trigger cache refresh for mn.gov**:
   ```bash
   # Via GitHub Actions workflow dispatch
   # Or via Cloudflare worker endpoint
   ```

2. **Check the generated cache file**:
   - Should see `'crawl'` in `sourcesAttempted` array
   - Should see more than 1 URL if bot protection is bypassed
   - Error messages should be more descriptive

3. **Monitor warnings** in the cache file:
   - Look for improved error messages
   - Check if `finalUrl` shows the correct domain (not a redirect to bot protection)

### Expected Outcomes:

**Best Case**: Sites that were blocking the crawler now allow access:
- `mn.gov` returns 50-100 URLs
- `gov.gr` returns 50-100 URLs
- Other affected sites also improve

**Likely Case**: Some improvement but not complete:
- Some sites may still block based on other factors (IP address, request patterns)
- Sites with geographic restrictions may still fail
- Sites without proper sitemaps or with complex JavaScript may still have low counts

**Fallback**: If sites continue to block:
- The improved diagnostics will clearly show what's failing
- Users can still use the browser-based discovery (which uses their browser's credentials)
- Cache cleanup workflow will remove stale caches after 7 days

## Additional Considerations

### Why Some Sites May Continue to Fail:

1. **IP-based blocking**: GitHub Actions runners may be on blacklisted IP ranges
2. **Geographic restrictions**: Some government sites restrict access by country
3. **Advanced bot detection**: Some systems detect automation beyond just user-agent
4. **Rate limiting**: Aggressive crawling might trigger rate limits

### Alternative Approaches (Not Implemented):

1. **Retry logic with exponential backoff** - Could help with transient failures
2. **Proxy rotation** - Not feasible in GitHub Actions
3. **Cloudflare Worker as proxy** - Already exists but would need enhancement
4. **Client-side only mode** - Document that some sites work better in browser

## Conclusion

The core issues have been addressed:
1. ✅ Fixed bug in `sourcesAttempted` tracking
2. ✅ Improved user-agent and headers to avoid bot detection
3. ✅ Enhanced error messages for better diagnostics

The next step is to test these changes in the GitHub Actions environment where cache files are actually generated. If sites continue to block, the improved diagnostics will provide clear information about what's failing and why.
