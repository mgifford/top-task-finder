# Top Task Finder

Top Task Finder generates a representative list of URLs from a public website to support accessibility and top-task review.

## What it does

- Accepts a site URL and target number of pages.
- Produces an editable, one-URL-per-line list you can copy into other workflows.
- Prioritizes high-value pages (for example: homepage, search, accessibility, and task-oriented pages) while keeping a random share for broader coverage.
- Normalizes `www` and non-`www` versions of the same host so each run stays in a single canonical site scope.
- Reuses cached results for faster repeat runs and lets you clear cached entries.

## Intended use

- Accessibility sampling and audit preparation.
- Top-task validation and UX content review.
- Lightweight, repeatable URL list generation for public-sector and content-heavy sites.

## Output

- Primary output is plain text: one URL per line.
- The list is editable before copying.
- If fewer in-scope URLs are found than requested, the tool reports the shortfall.

## Current scope

- Works on one canonical host per run.
- Treats `www.example.org` and `example.org` as the same host.
- Subdomain expansion is intentionally out of scope for v1.

## Local preview note

- `index.md` uses Jekyll front matter (`layout: default`), so plain static servers may show raw Markdown instead of the final page shell.
- For a GitHub Pages-like local preview, run via Jekyll (for example: `bundle exec jekyll serve`) and open the served site URL.
- Jekyll setup files in this repo:
	- [_config.yml](_config.yml)
	- [_layouts/default.html](_layouts/default.html)
	- [Gemfile](Gemfile)

## GitHub Action generated cache

- Workflow: [.github/workflows/cache-refresh.yml](.github/workflows/cache-refresh.yml)
- Generator script: [scripts/build-cache.mjs](scripts/build-cache.mjs)
- Target config: [config/cache-targets.json](config/cache-targets.json)
- Output files: [cache/index.json](cache/index.json) and host/count artifacts like `cache/gsa.gov-75.json`

How it works:

- A nightly workflow (and manual `workflow_dispatch`) builds URL selections server-side.
- Generated JSON artifacts are committed to `main`.
- The browser app first checks `/cache/{canonicalHost}-{requestedCount}.json`; when present, it uses that result before live browser discovery.

Interactive server crawl from the page:

- Enter only a domain/URL and click `Find Popular URLs`.
- The app first checks generated cache, then browser cache.
- If no cache exists, it automatically starts a server crawl through the configured Cloudflare endpoint, waits for completion, and loads results into the page.
- Once results are shown, a `Clear cache and rescan` option appears.

URL sync behavior:

- Query params (`domainUrl`, `requestedCount`) prefill the form on load.
- When form values change, the page updates the URL query string in place so links can be shared.

Manual run options:

- Run workflow from GitHub UI and optionally pass `domain_url` + `requested_count`.
- Or run locally:
	- `node scripts/build-cache.mjs --targets config/cache-targets.json --out cache`
	- `node scripts/build-cache.mjs --domain-url https://gsa.gov --requested-count 75 --out cache`

## Cloudflare serverless trigger setup

Files included:

- Worker source: [cloudflare/src/worker.js](cloudflare/src/worker.js)
- Wrangler config: [cloudflare/wrangler.toml](cloudflare/wrangler.toml)
- Site runtime config: [config/runtime.json](config/runtime.json)

### 1) Create GitHub token for worker secret

Create a fine-grained personal access token with access to this repository and permissions:

- Actions: Read and write
- Contents: Read and write

### 2) Deploy worker

From the `cloudflare/` directory:

- `npm install -g wrangler` (if not already installed)
- `wrangler login`
- `wrangler secret put GITHUB_TOKEN`
- `wrangler deploy`

### 3) Configure allowed origin and repo vars (if needed)

Defaults are set in [cloudflare/wrangler.toml](cloudflare/wrangler.toml):

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_WORKFLOW_FILE`
- `GITHUB_WORKFLOW_REF`
- `ALLOWED_ORIGIN`

Adjust these before deploy if your repo/page location differs.

### 4) Point the site to your worker endpoint

Edit [config/runtime.json](config/runtime.json):

- Set `cloudflareTriggerEndpoint` to your deployed worker URL + `/trigger-crawl`
- Example: `https://top-task-finder-trigger.<your-subdomain>.workers.dev/trigger-crawl`

After this, clicking `Find Popular URLs` will automatically trigger the worker on cache miss.
