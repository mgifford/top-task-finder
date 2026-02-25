# Quickstart Validation: Accessible Top Task URL Finder

## Prerequisites

- GitHub Pages deployment is available.
- Tool page is reachable in a modern browser.

## Scenario 1: Baseline generation

1. Open the tool page.
2. Enter `https://example.org` in Domain/URL.
3. Leave Number of URLs empty.
4. Run generation.

Expected:
- Requested count defaults to 100.
- Output appears in editable textarea as one URL per line.
- Copy action copies full textarea contents.

## Scenario 2: Host normalization (`www` / non-`www`)

1. Run scan for `https://example.org`.
2. Run scan for `https://www.example.org`.

Expected:
- Both runs normalize to same canonical host scope.
- No duplicate host-variant artifacts in final list.

## Scenario 3: Count cap enforcement

1. Enter a count greater than 200 (for example 500).
2. Run generation.

Expected:
- Request is constrained to configured maximum.
- User receives clear message about applied cap.

## Scenario 4: Sparse source fallback

1. Use a domain with missing or sparse sitemap/search results.
2. Run generation.

Expected:
- Internal-link fallback from homepage is invoked.
- Output returns best available unique in-domain URLs.
- Shortfall is explicitly reported if requested count cannot be met.

## Scenario 5: Caching and clear-cache behavior

1. Run scan for a domain and note output speed.
2. Run same scan again.
3. Use clear-cache action.
4. Run scan once more.

Expected:
- Repeat run can leverage cached artifacts.
- Clear-cache action invalidates stored artifacts.
- Post-clear run performs fresh discovery.

## Scenario 6: Multilingual sampling behavior

1. Run scan on a multilingual site.

Expected:
- Majority of selected URLs are from primary/default language.
- Additional language URLs are still included when detected.