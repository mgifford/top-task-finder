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

- Enter a domain and requested URL count.
- Add a GitHub token in the `GitHub token` field (stored only in browser `localStorage`).
- Click `Run server crawl`.
- The page dispatches the workflow, waits for completion, and loads generated results directly into the results area.

URL sync behavior:

- Query params (`domainUrl`, `requestedCount`, `bypassCache`) prefill the form on load.
- When form values change, the page updates the URL query string in place so links can be shared.

Manual run options:

- Run workflow from GitHub UI and optionally pass `domain_url` + `requested_count`.
- Or run locally:
	- `node scripts/build-cache.mjs --targets config/cache-targets.json --out cache`
	- `node scripts/build-cache.mjs --domain-url https://gsa.gov --requested-count 75 --out cache`
