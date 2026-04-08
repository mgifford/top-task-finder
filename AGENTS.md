# AGENTS.md

This file provides guidance for AI coding agents (such as GitHub Copilot, Claude, ChatGPT, and similar tools) working in this repository. It describes the project's purpose, architecture, key files, build and test commands, and coding conventions to follow when contributing changes.

---

## Project Overview

**Top Task Finder** generates a representative list of URLs from a public website to support accessibility audits and top-task reviews. It is a static Jekyll site hosted on GitHub Pages with a Cloudflare Worker backend for server-side URL discovery.

- Live site: <https://mgifford.github.io/top-task-finder/>
- Source repository: <https://github.com/mgifford/top-task-finder>

---

## Repository Layout

```
top-task-finder/
├── _config.yml              # Jekyll site configuration
├── _layouts/
│   └── default.html         # Single HTML shell wrapping all pages
├── assets/
│   ├── css/app.css          # All styles (light/dark theme via CSS custom properties)
│   ├── js/
│   │   ├── app.js           # Main entry point – UI, form handling, copy/LLM prompt
│   │   ├── cache.js         # Browser-cache read/write helpers
│   │   ├── discovery.js     # Client-side URL discovery (sitemap, crawl)
│   │   ├── selection.js     # URL scoring, deduplication, and selection algorithm
│   │   ├── theme.js         # Light/dark mode toggle
│   │   └── local-ai.js      # Local AI integration helpers
│   └── prompts/
│       └── wcag-em-prompt.txt  # WCAG-EM prompt template loaded by the Copy Prompt button
├── cache/                   # Pre-built JSON URL lists committed by CI (gitignored except index.json)
├── cloudflare/
│   ├── src/worker.js        # Cloudflare Worker that triggers GitHub Actions workflows
│   └── wrangler.toml        # Wrangler deployment configuration
├── config/
│   ├── cache-targets.json   # Domains targeted by the nightly cache-refresh workflow
│   ├── limits.json          # Per-request limits (max URLs, max crawl depth, etc.)
│   └── runtime.json         # Runtime config fetched by the browser (Cloudflare endpoint URL)
├── scripts/
│   └── build-cache.mjs      # Node.js script that builds cache JSON artifacts
├── .github/workflows/
│   ├── jekyll-pages.yml     # Builds and deploys the Jekyll site to GitHub Pages
│   ├── cache-refresh.yml    # Nightly (and manual) cache build for configured domains
│   └── cache-cleanup.yml    # Weekly cleanup of cache files older than 7 days
├── index.md                 # Main page content (Jekyll front matter + Markdown)
├── ACCESSIBILITY.md         # Accessibility standards, implementation details, and testing guide
└── README.md                # General project documentation
```

---

## Local Development

### Prerequisites

- Ruby ≥ 3.1 with Bundler (`gem install bundler`)
- Node.js ≥ 18

### Serve the Jekyll site locally

```bash
bundle install
bundle exec jekyll serve
# Open http://localhost:4000
```

### Run the cache-build script locally

```bash
# Build cache for all configured targets
node scripts/build-cache.mjs --targets config/cache-targets.json --out cache

# Build cache for a single domain
node scripts/build-cache.mjs --domain-url https://gsa.gov --requested-count 75 --out cache
```

### Deploy the Cloudflare Worker

```bash
cd cloudflare
npm install -g wrangler   # if not already installed
wrangler login
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

---

## Coding Conventions

- **JavaScript**: ES2020 modules (`type="module"`). No build step; files are served as-is by Jekyll.
- **CSS**: All colors and spacing are defined as CSS custom properties on `:root` (light) and `[data-theme="dark"]` (dark). Do not hard-code color values in component rules.
- **Cache-busting**: Static assets append `?v={{ site.time | date: '%s' }}` in `_layouts/default.html` and `index.md`. Always use this pattern when adding new asset references.
- **Fetch paths**: Use root-relative paths without a base-URL variable (e.g., `'config/limits.json'`, `'assets/prompts/wcag-em-prompt.txt'`).
- **No external runtime dependencies**: The browser bundle has zero npm dependencies. Keep it that way.
- **Sync patterns in `NON_HTML_EXTENSION_PATTERN`**: The regex in `assets/js/discovery.js` and `scripts/build-cache.mjs` must be kept in sync.
- **URL scoring constants**: `SOURCE_BASE_WEIGHTS` in `scripts/build-cache.mjs` drives URL prioritisation. Document any changes to weights.

---

## Accessibility Requirements

**Accessibility is a first-class requirement of this project.** Every change that touches HTML, CSS, or JavaScript must be reviewed against the standards documented in [`ACCESSIBILITY.md`](ACCESSIBILITY.md).

Key obligations for AI agents making changes:

1. **WCAG 2.1 Level AA compliance** — all new UI must meet Perceivable, Operable, Understandable, and Robust criteria.
2. **Color contrast** — normal text ≥ 4.5:1, large text ≥ 3:1, UI components ≥ 3:1. Verify in both light and dark themes. Approved palette values are listed in [`ACCESSIBILITY.md § Color and Contrast`](ACCESSIBILITY.md#color-and-contrast).
3. **Keyboard accessibility** — every interactive element must be reachable and operable via keyboard alone. Do not break the established focus order documented in [`ACCESSIBILITY.md § Keyboard Navigation`](ACCESSIBILITY.md#keyboard-navigation).
4. **ARIA and semantic HTML** — use the existing ARIA patterns (`aria-live="polite"`, `role="status"`, `aria-labelledby`, etc.) described in [`ACCESSIBILITY.md § Screen Reader Support`](ACCESSIBILITY.md#screen-reader-support). Do not introduce `<div>` or `<span>` substitutes for semantic elements.
5. **Focus indicators** — all focusable elements must have a 2 px solid outline with 2 px offset, visible in both themes. Use `:focus-visible`.
6. **Touch targets** — minimum 44 × 44 px for all interactive elements (WCAG 2.5.5).
7. **Theme toggle** — do not alter the theme toggle behaviour without updating the aria-label logic in `assets/js/theme.js`.
8. **Testing** — after making UI changes, run the automated accessibility checks described in [`ACCESSIBILITY.md § Automated Testing`](ACCESSIBILITY.md#automated-testing) (axe DevTools, Lighthouse, WAVE, pa11y).
9. **Update `ACCESSIBILITY.md`** — if you add new UI patterns, colour values, or ARIA usage, update [`ACCESSIBILITY.md`](ACCESSIBILITY.md) to document them.

See [`ACCESSIBILITY.md`](ACCESSIBILITY.md) for the full reference, including known limitations and planned improvements.

---

## GitHub Actions Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `jekyll-pages.yml` | Push to `main`, manual | Build and deploy Jekyll site to GitHub Pages |
| `cache-refresh.yml` | Nightly cron, manual | Build URL-cache JSON for configured domains |
| `cache-cleanup.yml` | Weekly cron (Fridays) | Delete cache files older than 7 days |

When modifying workflows that commit files back to the repository, use `git pull --rebase` before `git push` to handle concurrent runs gracefully.

---

## Testing

```bash
# Run all tests
node --test tests/*.test.mjs

# Run a single test file
node --test tests/discovery.test.mjs
```

---

## Security Notes

- The `GITHUB_TOKEN` used by the Cloudflare Worker is stored as a Wrangler secret; never commit it to source.
- `config/runtime.json` contains the public Cloudflare Worker URL; this is intentionally public.
- The browser application makes no authenticated requests; all data sources are public sitemaps and HTML pages.

---

## Gotchas

- **`canonicalizeHost` is duplicated**: `assets/js/app.js:53-59` duplicates the function from `assets/js/discovery.js`. Prefer importing from discovery.js.
- **`NON_HTML_EXTENSION_PATTERN` mismatch**: Client (`discovery.js:50`) is missing `json` that server (`build-cache.mjs:80`) has. Keep them in sync.
- **DuckDuckGo dependency**: `discovery.js:363` uses DuckDuckGo HTML search which may be blocked/rate-limited. Not critical but may need fallback in production.

---

## Before Opening a Pull Request

1. Verify the Jekyll site builds without errors (`bundle exec jekyll build`).
2. Confirm all accessibility requirements above are met.
3. Update [`ACCESSIBILITY.md`](ACCESSIBILITY.md) if your change adds or modifies accessibility-relevant behaviour.
4. Update [`README.md`](README.md) if your change affects setup, configuration, or user-facing behaviour.
5. **AI disclosure**: If you are an AI agent making changes to this repository, update the `## AI Disclosure` section in [`README.md`](README.md) to record which LLM was used and what it did. Each entry must include the model name, the version or date if known, and a description of the specific task it performed. Do not add entries for AI tools that were not actually used.
