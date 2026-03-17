# Copilot Coding Agent Instructions

## Primary Reference

**Read [`AGENTS.md`](../AGENTS.md) first.** It is the canonical guide for this repository and covers:

- Project overview and live site URL
- Full repository layout with file-by-file descriptions
- Local development setup (Jekyll + Node.js)
- Coding conventions (ES2020 modules, CSS custom properties, cache-busting pattern, fetch paths, no external runtime dependencies)
- GitHub Actions workflows and their triggers
- Testing approach (no unit-test suite; Jekyll build + accessibility audits + manual walkthroughs)
- Security notes

## Accessibility Reference

**Read [`ACCESSIBILITY.md`](../ACCESSIBILITY.md) before touching any HTML, CSS, or JavaScript.** Accessibility is a first-class requirement. Key obligations:

- WCAG 2.1 Level AA compliance in all new UI
- Color contrast: normal text ≥ 4.5:1, large text ≥ 3:1, UI components ≥ 3:1 — verified in both light and dark themes
- Every interactive element must be keyboard-accessible; do not break the documented focus order
- Use existing ARIA patterns (`aria-live="polite"`, `role="status"`, `aria-labelledby`) — do not replace semantic HTML with `<div>`/`<span>`
- All focusable elements must have a visible 2 px solid outline with 2 px offset (`:focus-visible`)
- Minimum 44 × 44 px touch targets (WCAG 2.5.5)
- Update `ACCESSIBILITY.md` if you add new UI patterns, color values, or ARIA usage

## Critical Invariants

The following rules **must** be preserved across every change:

| Invariant | Files involved |
|---|---|
| `NON_HTML_EXTENSION_PATTERN` regex must be identical | `assets/js/discovery.js` and `scripts/build-cache.mjs` |
| Every `<script>` and `<link>` tag for static assets must include `?v={{ site.time | date: '%s' }}` | `_layouts/default.html`, `index.md` |
| Fetch calls use root-relative paths, no base-URL variable | `assets/js/app.js` and other JS modules |
| `sourcesAttempted` must list all discovery methods tried, not just successful ones | `scripts/build-cache.mjs` — `buildDiscoverySummary` |

## Architecture in Brief

```
User browser
  └─ assets/js/app.js          ← UI, form handling, Copy Prompt
       ├─ assets/js/discovery.js   ← client-side sitemap/crawl discovery
       ├─ assets/js/selection.js   ← URL scoring, deduplication, selection
       ├─ assets/js/cache.js       ← browser cache read/write
       └─ assets/js/local-ai.js   ← on-device AI helpers

Cloudflare Worker (cloudflare/src/worker.js)
  └─ triggers GitHub Actions workflow via GITHUB_TOKEN secret

GitHub Actions: cache-refresh.yml
  └─ scripts/build-cache.mjs      ← Node.js URL discovery engine
       └─ writes JSON to cache/   ← fetched by browser as pre-built lists
```

## Scoring Constants (do not remove or flatten)

- `SOURCE_BASE_WEIGHTS` in `scripts/build-cache.mjs`: sitemap = 40, homepage-fallback = 20, crawl = 15, unknown = 10
- `PRIORITY_SIGNAL_BOOSTS`: boosts applied to accessibility, nav, homepage URLs
- `MAX_INDIVIDUAL_SEGMENT` = 10: caps repetition of any single path segment in the selected set
- Year-deduplication logic prevents the same content appearing under multiple year-based URL variants

## Local Development Commands

```bash
# Serve the Jekyll site (http://localhost:4000)
bundle exec jekyll serve

# Build the Jekyll site (confirms no template errors)
bundle exec jekyll build

# Build cache for a single domain
node scripts/build-cache.mjs --domain-url https://example.com --requested-count 50 --out cache

# Build cache for all configured targets
node scripts/build-cache.mjs --targets config/cache-targets.json --out cache
```

## Commit and PR Conventions

- Keep changes minimal and surgical; do not refactor unrelated code
- New config keys belong in the appropriate file under `config/`
- Workflows that commit files back to the repository must use `git pull --rebase` before `git push`
- Update `ACCESSIBILITY.md` and/or `README.md` when your change affects accessibility behaviour or user-facing setup
