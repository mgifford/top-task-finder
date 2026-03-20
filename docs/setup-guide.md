# Setup and Configuration Guide

This guide covers everything you need to fork, self-host, and operate your own instance of **Top Task Finder**. For a user-friendly introduction to what the tool does and how to use it, see [README.md](../README.md). If you just want to use the tool, visit the [live site](https://mgifford.github.io/top-task-finder/) — no setup required.

---

## ⚠️ GitHub Pages Configuration Required (forks)

**If you see a warning about "github-pages gem can't satisfy your Gemfile's dependencies":**

This repository uses a custom Jekyll 4.3+ workflow. To eliminate the warning, you must configure GitHub Pages to use GitHub Actions:

1. Go to **Settings** → **Pages**
2. Under **"Build and deployment"**, change **Source** to **"GitHub Actions"**

See **[GITHUB_PAGES_WARNING_FIX.md](../GITHUB_PAGES_WARNING_FIX.md)** for detailed instructions.

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

> `index.md` uses Jekyll front matter (`layout: default`), so plain static servers may show raw Markdown instead of the final page shell. For a proper local preview, use Jekyll as shown above.

### Jekyll setup files

- [_config.yml](../_config.yml)
- [_layouts/default.html](../_layouts/default.html)
- [Gemfile](../Gemfile)

---

## URL Discovery Strategy

The tool uses a multi-stage approach to discover URLs, ensuring it reaches the requested count:

1. **Sitemap discovery**: Checks `robots.txt` and common sitemap locations (`/sitemap.xml`, `/sitemap_index.xml`, `/sitemap/sitemap.xml`)
2. **Homepage link extraction**: Extracts all links from the homepage if sitemap results are insufficient
3. **Recursive crawling**: If still not enough URLs, the tool crawls linked pages:
   - Prioritizes footer links first (where accessibility statements are typically found)
   - Then crawls main navigation links
   - Continues recursively up to 2 levels deep
   - Fetches up to 10 pages to discover additional URLs
   - Only includes HTML pages within the same canonical domain

This multi-stage approach ensures the tool can reach the minimum requested URL count even for sites with limited sitemaps.

---

## Current Scope

- Works on one canonical host per run.
- Treats `www.example.org` and `example.org` as the same host.
- Subdomain expansion is intentionally out of scope for v1.

---

## GitHub Actions Cache

### Files

- Workflow: [.github/workflows/cache-refresh.yml](../.github/workflows/cache-refresh.yml)
- Generator script: [scripts/build-cache.mjs](../scripts/build-cache.mjs)
- Target config: [config/cache-targets.json](../config/cache-targets.json)
- Output files: [cache/index.json](../cache/index.json) and host/count artifacts like `cache/gsa.gov-75.json`

### How it works

- A nightly workflow (and manual `workflow_dispatch`) builds URL selections server-side.
- Generated JSON artifacts are committed to `main`.
- The browser app first checks `/cache/{canonicalHost}-{requestedCount}.json`; when present, it uses that result before live browser discovery.

### Interactive server crawl

- Enter only a domain/URL and click `Find Popular URLs`.
- The app first checks generated cache, then browser cache.
- If no cache exists, it automatically starts a server crawl through the configured Cloudflare endpoint, waits for completion, and loads results into the page.
- Once results are shown, a `Clear cache and rescan` option appears.

### URL sync and query parameters

Query params (`domainUrl`, `requestedCount`) prefill the form on load. When form values change, the page updates the URL query string in place so links can be shared.

| Parameter | Description |
|---|---|
| `domainUrl` | The domain or URL to scan (e.g., `?domainUrl=gsa.gov`) |
| `requestedCount` | Number of URLs to return (default: 100, max: 200) |

Example: `?domainUrl=gsa.gov&requestedCount=150`

### Manual run options

Run the workflow from the GitHub UI, optionally passing `domain_url` and `requested_count`, or run locally:

```bash
node scripts/build-cache.mjs --targets config/cache-targets.json --out cache
node scripts/build-cache.mjs --domain-url https://gsa.gov --requested-count 75 --out cache
```

---

## Cloudflare Serverless Trigger Setup

### Files

- Worker source: [cloudflare/src/worker.js](../cloudflare/src/worker.js)
- Wrangler config: [cloudflare/wrangler.toml](../cloudflare/wrangler.toml)
- Site runtime config: [config/runtime.json](../config/runtime.json)

### 1) Create a GitHub token for the worker secret

Create a fine-grained personal access token with access to this repository and the following permissions:

- Actions: Read and write
- Contents: Read and write

### 2) Deploy the worker

From the `cloudflare/` directory:

```bash
npm install -g wrangler   # if not already installed
wrangler login
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

### 3) Configure allowed origin and repo vars (if needed)

Defaults are set in [cloudflare/wrangler.toml](../cloudflare/wrangler.toml):

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_WORKFLOW_FILE`
- `GITHUB_WORKFLOW_REF`
- `ALLOWED_ORIGIN`

Adjust these before deployment if your repo or page location differs.

### 4) Point the site to your worker endpoint

Edit [config/runtime.json](../config/runtime.json):

- Set `cloudflareTriggerEndpoint` to your deployed worker URL + `/trigger-crawl`
- Example: `https://top-task-finder-trigger.<your-subdomain>.workers.dev/trigger-crawl`

After this, clicking `Find Popular URLs` will automatically trigger the worker on cache miss.

---

## GitHub Pages Deployment

### Workflow file

- [.github/workflows/jekyll-pages.yml](../.github/workflows/jekyll-pages.yml)

### How it works

- The workflow runs automatically on every push to the `main` branch.
- Can also be triggered manually from the Actions tab.
- Builds the Jekyll site with proper base path configuration.
- Uploads the built site as a Pages artifact and deploys to GitHub Pages.

### Workflow features

- **Bundler caching**: Speeds up builds by caching Ruby dependencies.
- **Proper permissions**: Uses scoped permissions for security.
- **Concurrency control**: Prevents multiple simultaneous deployments.
- **Manual triggers**: Can be run on-demand via `workflow_dispatch`.

### Cache-busting for static assets

All static assets (JavaScript and CSS files) include a version parameter that changes with each build:

- Uses Jekyll's `site.time` variable to generate a Unix timestamp.
- Appended as a query parameter (e.g., `/assets/js/app.js?v=1772307810`).
- Automatically updates on every build without manual intervention.
- Ensures users always receive the latest version of the code after deployment.

This is particularly important for the LLM prompt feature, which loads content from an external text file.

### Troubleshooting deployment issues

If you encounter issues with the Pages deployment:

1. **Check workflow runs**: Go to the Actions tab and check the latest workflow run.
2. **Retry failed workflows**: Click "Re-run failed jobs" if there was a transient error.
3. **Check Pages settings**: Ensure Settings → Pages → Build and deployment source is set to "GitHub Actions".
4. **View detailed logs**: Click into failed jobs to see detailed error messages.

See [PAGES_FIX.md](../PAGES_FIX.md) for details about the artifact upload timeout issue that was resolved by creating the custom workflow.

---

## Troubleshooting

### Console errors about missing JavaScript modules

If you see console errors like:

```
Uncaught SyntaxError: Cannot use import statement outside a module (at content.js:1:1)
Uncaught SyntaxError: Unexpected token 'export' (at all-focusable-elements.js:1:1)
```

These errors are **not from this repository**. They typically come from browser extensions, other tabs injecting scripts, or browser developer tools. This application uses ES6 modules correctly with `type="module"` in the script tag.

**To diagnose**: Open the browser developer console and check which files are being loaded. The only scripts this site loads are:

- `/assets/js/app.js` (as a module)
- Imports from `/assets/js/selection.js`, `/assets/js/cache.js`, and `/assets/js/discovery.js`

### CORS errors when triggering server crawl

If you see CORS errors like:

```
Access to fetch at 'https://...' has been blocked by CORS policy
```

**Cause**: The `cloudflareTriggerEndpoint` URL in `config/runtime.json` must include the `/trigger-crawl` path.

**Fix**: Ensure the endpoint URL ends with `/trigger-crawl`:

```json
{
  "cloudflareTriggerEndpoint": "https://your-worker.workers.dev/trigger-crawl"
}
```

The application includes detailed console logging to help debug these issues. Open the browser console to see runtime configuration, request payloads, response status, and detailed error messages.
