# Technical Guide: URL Discovery, Domain Size Estimation, and LLM Prompts

This guide explains the technical mechanisms that Top Task Finder uses to
estimate the number of pages on a domain, identify the top pages, and present
the results to AI/LLM tools. It covers:

1. [How the Cloudflare Worker triggers server-side discovery](#1-cloudflare-worker-api)
2. [How DuckDuckGo is used for client-side discovery](#2-duckduckgo-html-search-integration)
3. [The full URL discovery pipeline and scoring algorithm](#3-url-discovery-pipeline)
4. [How domain size is estimated from discovered URLs](#4-domain-size-estimation)
5. [The LLM prompts and how to vary them for different results](#5-llm-prompts-and-variations)

---

## 1. Cloudflare Worker API

### Role

The Cloudflare Worker acts as a lightweight **webhook gateway**. It does not
crawl sites directly. Instead, it validates an incoming browser request and
forwards it as a [GitHub Actions `workflow_dispatch`
event](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#workflow_dispatch)
so the heavier server-side crawl can run inside a GitHub Actions runner.

```
Browser → POST /trigger-crawl → Cloudflare Worker → GitHub Actions API
                                                           ↓
                                          cache-refresh.yml workflow
                                                           ↓
                                          scripts/build-cache.mjs
                                                           ↓
                                          cache/<domain>-<count>.json
```

### Endpoint

```
POST https://top-task-crawler.mike-gifford.workers.dev/trigger-crawl
Content-Type: application/json
```

The endpoint URL is configured in `config/runtime.json` as
`cloudflareTriggerEndpoint`.

### Request parameters (JSON body)

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `domainUrl` | string | **Yes** | — | The domain to crawl. Accepts with or without `https://`. Hash fragments and paths are stripped. The Worker returns `parsed.origin`, preserving any `www.` prefix present in the input — for example `https://www.gsa.gov/about` → `https://www.gsa.gov` and `gsa.gov` → `https://gsa.gov`. The downstream `build-cache.mjs` script normalises both forms by stripping `www.` during host canonicalization, so both inputs produce identical discovery results. |
| `requestedCount` | integer | No | `100` | Target number of URLs to return. Clamped to 1–200. Non-integer values fall back to the default. |

### Response

| Outcome | HTTP status | Body |
|---|---|---|
| Workflow dispatched | `202 Accepted` | `{ "accepted": true, "message": "Workflow dispatched." }` |
| `domainUrl` missing | `500` | `{ "error": "domainUrl is required." }` |
| GitHub dispatch failed | `500` | `{ "error": "GitHub dispatch failed (422): ..." }` |
| Wrong path or method | `404` | `{ "error": "Not found." }` |
| CORS preflight | `204 No Content` | *(empty)* |

### Input normalisation (`normalizeDomainUrl`)

Before forwarding to GitHub, the Worker applies the following transforms so
the downstream script always receives a clean origin URL:

1. Prepend `https://` when no protocol is given.
2. Parse with the WHATWG `URL` constructor.
3. Remove any hash fragment.
4. Return `parsed.origin` (scheme + host, no path or query).

### Count clamping (`clampRequestedCount`)

```
parsed = Number(requestedCount)
if not an integer → return 100
return Math.min(200, Math.max(1, parsed))
```

This matches the identical clamping logic in `scripts/build-cache.mjs`.

### Configuration

The Worker reads all secrets and variables from the Cloudflare environment:

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | Personal Access Token with `workflow` scope used to dispatch workflows |
| `GITHUB_OWNER` | Repository owner (e.g. `mgifford`) |
| `GITHUB_REPO` | Repository name (e.g. `top-task-finder`) |
| `GITHUB_WORKFLOW_FILE` | Workflow file to dispatch (default: `cache-refresh.yml`) |
| `GITHUB_WORKFLOW_REF` | Git ref to run on (default: `main`) |
| `ALLOWED_ORIGIN` | CORS allowed origin (e.g. `https://mgifford.github.io`) |

### CORS

All responses include `Access-Control-Allow-Origin`. If `ALLOWED_ORIGIN` is
set to a specific value, only requests from that origin are reflected back;
otherwise the header is set to `*`. The `Vary: Origin` header is always
included so caches do not conflate credentialed and open responses.

---

## 2. DuckDuckGo HTML Search Integration

### Where it runs

DuckDuckGo is queried **in the browser** (client-side) from
`assets/js/discovery.js`. It is **not** used by the server-side
`scripts/build-cache.mjs` script. It operates in parallel with the client-side
sitemap discovery, before any server-side result is returned.

### Endpoint and query

```js
const query = encodeURIComponent(`site:${canonicalHost}`);
const endpoint = `https://duckduckgo.com/html/?q=${query}`;
```

The `site:` operator instructs DuckDuckGo to return only results from the
specified domain. `canonicalHost` is the `www`-stripped hostname, e.g.
`gsa.gov` (not `www.gsa.gov`).

### Result extraction

The HTML response is parsed with the browser's built-in `DOMParser`. All
`<a href>` nodes are read, resolved into absolute URLs against the base domain,
and the first **40** unique results are kept. Each URL is tagged with
`source: 'search'`.

```js
const urls = Array.from(html.querySelectorAll('a[href]'))
  .map(node => node.getAttribute('href'))
  .filter(Boolean)
  .map(href => new URL(href, normalizedBaseUrl.origin).href)
  .filter(Boolean)
  .slice(0, 40);
return urls.map(url => ({ url, source: 'search' }));
```

### Scoring weight

Search-sourced URLs receive a base score of **28 points** in the client-side
scoring table (`SOURCE_BASE_WEIGHTS` in `assets/js/discovery.js`):

| Source | Base weight |
|---|---|
| `sitemap` | 40 |
| `search` (DuckDuckGo) | 28 |
| `homepage-fallback` | 20 |
| `unknown` | 10 |

### Limitations and fallback

DuckDuckGo's HTML endpoint has no official API contract. In practice:

- It may be blocked by the browser's CORS policy when fetching cross-origin
  from certain hosting environments.
- It returns at most ~30 organic results per query.
- If the fetch fails for any reason, the function returns an empty array and
  adds a warning: *"No-key search source unavailable in the current browser
  context."*

When the search source returns few or no results the client-side pipeline
automatically falls back to **homepage link extraction** (see §3.2).

---

## 3. URL Discovery Pipeline

### 3.1 Server-side pipeline (`scripts/build-cache.mjs`)

The GitHub Actions job calls `build-cache.mjs` with `--domain-url` and
`--requested-count`. Discovery runs in three ordered stages; each stage is
triggered only when the previous stage produced insufficient results.

#### Stage 1 — Sitemap discovery

1. Fetch `/robots.txt` and extract the `Sitemap:` directive.
2. If not found, try `/sitemap.xml`, `/sitemap_index.xml`,
   `/sitemap/sitemap.xml` in order.
3. Parse the XML; follow nested `<sitemapindex>` references up to **24**
   sitemap documents.
4. Collect every `<loc>` value.
5. Filter out non-HTML URLs, RSS feeds, tracking parameters, and URLs
   outside the canonical domain scope (see §3.6).

#### Stage 2 — Homepage link extraction (first fallback)

Triggered when:
- The sitemap yielded fewer than `requestedCount` URLs, **or**
- The sitemap results are missing at least one critical priority page
  (homepage, search results page, accessibility statement).

Fetches the homepage HTML and extracts every `<a href>` anchor that points
within the domain.

#### Stage 3 — Recursive crawl (second fallback)

Triggered when Stage 1 + Stage 2 combined still fall short of `requestedCount`.

- Starts from the homepage.
- Crawls up to **10 pages** total.
- Goes up to **2 levels deep**.
- Prioritises links by section: footer links first (where accessibility
  statements typically appear), then navigation links, then all other links.
- Stops as soon as `requestedCount` is reached.

### 3.2 Client-side pipeline (`assets/js/discovery.js`)

Runs in the user's browser while the server-side job is executing (or when no
cache exists yet). Sources run concurrently:

1. **Sitemap discovery** — same robots.txt / sitemap.xml walk as above, but
   limited to the browser's fetch capabilities.
2. **DuckDuckGo search** — as described in §2.
3. **Homepage fallback** — triggered when primary sources return fewer URLs
   than requested.

### 3.3 Scoring algorithm

Every candidate URL is assigned a composite score:

```
score = sourceBaseWeight + depthWeight + prioritySignalBoosts
```

**Source base weight** (from the table in §2 above)

**Depth weight** — shorter paths rank higher:
```
depthWeight = Math.max(0, 15 − pathSegments × 2)
```
A root-level URL (`/`) scores 15; a URL with 8+ segments scores 0.

**Priority signal boosts** (checked against the URL pathname):

| Signal | Boost | Detection pattern |
|---|---|---|
| Homepage (`/`) | +35 | `pathname === '/' or ''` |
| Search results | +18 | `/search`, `/find` |
| Accessibility statement | +22 | 24-language regex (see §3.4) |
| Top task / service | +14 | `services`, `apply`, `pay`, `register`, `renew`, `book`, `report`, `request`, `top-tasks` |
| Contact | +12 | `contact` |
| About | +10 | `about` |
| Help / support / FAQ | +10 | `help`, `support`, `faq` |
| Resources | +8 | `resources` |

Pages whose score exceeds `CRITICAL_PAGE_SCORE` (1 000) are always included
regardless of diversity limits.

### 3.4 Multilingual accessibility detection

The accessibility signal boost is applied when the pathname matches a regex
covering **24 official EU languages**. Several languages have multiple
accepted URL spellings (accented and ASCII-normalised), all of which are
matched:

| Language | Pathname token(s) matched |
|---|---|
| English | `accessibility`, `a11y` |
| Spanish | `accesibilidad` |
| French | `accessibilité`, `accessibilite` |
| German | `barrierefreiheit`, `zugänglichkeit`, `zuganglichkeit` |
| Italian | `accessibilità`, `accessibilita` |
| Portuguese | `acessibilidade` |
| Dutch | `toegankelijkheid` |
| Polish | `dostępność`, `dostepnosc` |
| Romanian | `accesibilitate` |
| Greek | `προσβασιμότητα` |
| Czech | `přístupnost`, `pristupnost` |
| Hungarian | `akadálymentesség`, `akadalymentesseg`, `hozzáférhetőség`, `hozzaferhetoseg` |
| Swedish | `tillgänglighet`, `tillganglighet` |
| Bulgarian | `достъпност` |
| Danish | `tilgængelighed`, `tilgangelighed` |
| Finnish | `saavutettavuus` |
| Slovak | `prístupnosť`, `pristupnost` |
| Irish | `inrochtaineacht` |
| Croatian | `pristupačnost`, `pristupacnost` |
| Lithuanian | `prieinamumas` |
| Slovenian | `dostopnost` |
| Latvian | `pieejamība`, `pieejamiba` |
| Estonian | `ligipääsetavus`, `ligipaasetavus` |
| Maltese | `aċċessibbiltà`, `accessibbilta` |

The pattern is identical in `assets/js/discovery.js` (client-side) and
`scripts/build-cache.mjs` (server-side) and **must be kept in sync** whenever
either copy is updated.

### 3.5 Post-scoring deduplication and diversity limits

After scoring, two passes reduce redundancy before the final list is cut to
`requestedCount`:

**Year-based deduplication** — groups URLs that differ only by a year token
(e.g. `/annual-report-2022`, `/annual-report-2023`, `/annual-report-2024`).
Only the **3 most recent** items in each group are kept.

**Diversity limits** — applied in score order to prevent a single section of
a site from dominating:

| Rule | Limit |
|---|---|
| URLs per first-level path segment (e.g. `/services/...`) | 15 |
| URLs per 3-segment path prefix | 3 |
| URLs containing any single repeating segment | 10 (`MAX_INDIVIDUAL_SEGMENT`) |
| Homepage and search pages | Always included (exempt) |

If the diversity filter removes too many URLs and the result falls below
`requestedCount`, the shortfall is filled randomly from the skipped set.

### 3.6 URL filtering: non-HTML extensions and feeds

Before any URL is scored or counted, two patterns are tested against the
pathname:

**`NON_HTML_EXTENSION_PATTERN`** — rejects URLs whose path ends with a
non-HTML file extension:

| Category | Extensions excluded |
|---|---|
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.ico` |
| Documents | `.pdf`, `.doc`, `.docx`, `.xlsx`, `.xls`, `.pptx`, `.ppt` |
| Data / markup | `.xml`, `.json`, `.csv` |
| Archives | `.zip`, `.gz` |
| Media | `.mp4`, `.mp3` |
| Fonts | `.woff`, `.woff2`, `.ttf`, `.eot` |

This pattern is defined in both `assets/js/discovery.js` and
`scripts/build-cache.mjs` and **must be kept identical** in both files.

**`RSS_FEED_PATTERN`** — rejects URLs whose path contains `/feed/`, `/rss/`,
or `/atom/` as a segment. This prevents aggregated feed pages from inflating
the discovered count.

**Tracking parameter stripping** — before deduplication, URL query parameters
matching `TRACKING_PARAM_PATTERN` are removed. Stripped parameters include
`utm_*`, `fbclid`, `gclid`, `msclkid`, `dclid`, `_hsenc`, `_hsmi`,
`hsa_*`, `mc_eid`, `mkt_tok`, `__s`, `igshid`, `twclid`, `epik`, `s_cid`.
This ensures that the same page reached via different marketing campaigns
counts as a single URL.

---

## 4. Domain Size Estimation

The `totalDiscoveredPages` field in the JSON result holds the count of all
**unique, in-scope, valid HTML URLs found during the run**, after deduplication
and filtering but before the final `requestedCount` cut. It is exposed in the
UI as *"Estimated site size"*.

```json
{
  "totalDiscoveredPages": 1847,
  "returnedCount": 100,
  ...
}
```

This is **not** an independent statistical estimate of total site size. It
reflects what the discovery pipeline actually observed. Practical implications:

- A site with a comprehensive XML sitemap produces a high, reliable
  `totalDiscoveredPages` count.
- A site with no sitemap and limited link depth may return a low count even if
  the real site is large.
- Sites that block automated fetches (bot detection, IP rate limits) will
  return lower counts.

The browser UI rounds and formats this count for readability:

| Raw count | Displayed estimate |
|---|---|
| 1–999 | Exact number (e.g. "312 pages") |
| 1 000–9 999 | Rounded to nearest 100 (e.g. "1,800 pages") |
| 10 000+ | Rounded to nearest 1 000 (e.g. "24,000 pages") |

---

## 5. LLM Prompts and Variations

Top Task Finder exposes two types of LLM prompt: a **static system prompt**
for accessibility audit sampling (used with any external AI), and **dynamic
prompts** for the browser's built-in on-device AI.

### 5.1 WCAG-EM accessibility evaluation prompt

**File**: `assets/prompts/wcag-em-prompt.txt`

**How it is used**: When the user clicks *"Copy Prompt for LLM"*, the browser
fetches this file, appends the list of discovered URLs, and copies the combined
text to the clipboard. The user then pastes it into any AI assistant (ChatGPT,
Claude, Copilot, Gemini, Ollama, etc.).

**What the prompt asks the AI to do**:

1. **Evaluate** the provided URL list against 12 content-type categories
   (user journeys, forms, dynamic pages, accessibility statements, etc.).
2. **Expand** the list by following only links that the AI can directly observe
   on the pages — no URL invention, no inference, no external domains.
3. **Remove** structurally duplicate URLs.
4. **Produce** a minimal WCAG-EM Manual Sample of at least 25 URLs optimised
   for deep accessibility evaluation.

**Output structure**:

| Section | Content |
|---|---|
| Section 1 — Original List Evaluation | Analytical summary only (no URLs) describing task coverage, templates, and functionality |
| Section 2 — Additional Verified Pages | Discovery trace log (source URL → anchor text → destination) followed by verified new URLs |
| Section 3 — Redundant Pages | URLs from the original list that are structural duplicates |
| Section 4 — Minimal WCAG-EM Manual Sample | ≥25 curated URLs for manual testing |

**Key validation constraints baked into the prompt**:

- Only URLs extracted from `<a>` tags on pages the AI actually visits.
- Each page must return HTTP 200 and render as HTML.
- No invented, inferred, or modified URLs.
- No external domains.
- `www` and non-`www` versions are treated as the same URL.

#### Varying the prompt for different results

The static prompt is a starting point. You can adapt it by editing
`assets/prompts/wcag-em-prompt.txt` or by appending instructions before
pasting into an AI tool:

| Goal | Suggested addition |
|---|---|
| Focus on a single user journey (e.g. "apply for a benefit") | Append: *"Focus Section 2 exclusively on pages related to applying for or renewing benefits."* |
| Include only mobile-first pages | Append: *"In Section 4, prefer pages with responsive or mobile-specific layouts."* |
| Reduce the manual sample size | Change *"At least 25 URLs"* to *"Exactly 15 URLs"* in Section 4. |
| Add a language scope | Append: *"Only include URLs under the `/fr/` or `/en/` path prefixes."* |
| Request a structured CSV output | Append: *"Output Section 4 as a CSV with columns: URL, template type, rationale."* |
| Raise the expansion target | Change *"Aim for 20-40% more URLs than provided"* to *"Aim for 60-80% more URLs than provided"* in Section 2. |
| Restrict to a subdomain | Append: *"Only include URLs from `subdomain.example.gov`; ignore all other subdomains."* |
| Remove the discovery trace requirement | Delete the "DISCOVERY TRACE REQUIREMENT" section entirely. Be aware this reduces auditability. |

### 5.2 On-device AI prompts (browser built-in Gemini Nano)

When Chrome's built-in [LanguageModel
API](https://developer.chrome.com/docs/ai/built-in) (or the legacy
`window.ai.languageModel`) is available, two additional buttons appear. Both
send prompts to the on-device model; no data leaves the browser.

#### "Copy LLM Improved List" button

**System prompt sent to the model**:

> *You are a UX researcher specializing in Gerry McGovern's Top Tasks
> methodology. Clean, deduplicate, and professionally format the following task
> list.*

**User content**: the raw text typed into the LLM prompt textarea.

**Output**: a cleaned, de-duplicated, professionally formatted task list,
copied to the clipboard.

**Variations**:

The system prompt is hard-coded in `assets/js/local-ai.js` but can be changed
to shift the model's framing:

| Variation | Modified system prompt |
|---|---|
| Accessibility audit framing | *"You are an accessibility consultant. Clean and deduplicate the following list of pages for a WCAG 2.1 AA audit sample."* |
| Content strategist framing | *"You are a content strategist. Group the following URLs by content type and remove near-duplicates."* |
| Plain English summary | *"You are a plain-language editor. Summarise what types of tasks users can complete on this site, based on the following URL list."* |

#### "Summarize Site Tasks with AI" button

**System prompt**: The same Top Tasks methodology prompt above (applied via the
session default).

**User prompt sent at inference time**:

```
Based on these URLs from a government site, identify the top 5 user tasks:
<URL list>
```

**Output**: Streamed list of the top 5 inferred user tasks, displayed directly
in the page.

**Variations**: The user-prompt phrasing can be changed in
`assets/js/local-ai.js` to produce different analyses:

| Goal | Modified user prompt |
|---|---|
| More tasks | *"Based on these URLs, identify the top 10 user tasks and group them by theme."* |
| Accessibility focus | *"Based on these URLs, identify which pages are most relevant for an accessibility audit and explain why."* |
| Persona-based | *"Based on these URLs, describe the three most common visitor personas and their primary goals."* |
| Content gap analysis | *"Based on these URLs, identify any significant content gaps — topics or tasks that appear to be missing."* |
| Technical complexity | *"Based on these URLs, classify each page type (form, listing, article, etc.) and flag any that are likely to have complex interactive components."* |

---

## 6. End-to-End Request Flow Summary

```
User enters domain URL + URL count
         │
         ▼
app.js: normalizes URL, clamps count
         │
         ├─ Checks browser cache (cache.js)
         │   └─ Cache hit? → render results immediately
         │
         └─ No cache → two parallel tracks:
             │
             ├─ CLIENT-SIDE (discovery.js)
             │   ├─ Sitemap fetch + parse
             │   ├─ DuckDuckGo site: search (up to 40 results)
             │   └─ Homepage fallback (if needed)
             │       → Scored, deduplicated, diversity-filtered
             │       → Rendered as interim result
             │
             └─ SERVER-SIDE (via Cloudflare → GitHub Actions)
                 POST /trigger-crawl
                 → Cloudflare Worker validates + normalizes
                 → Dispatches cache-refresh.yml workflow
                 → build-cache.mjs runs on GitHub Actions runner:
                     Stage 1: Sitemap (XML walk, up to 24 docs)
                     Stage 2: Homepage fallback (if needed)
                     Stage 3: Recursive crawl (if needed, max 10 pages, depth 2)
                     → Scoring → Year dedup → Diversity limits
                     → Written to cache/<domain>-<count>.json
                 → Browser polls cache index every 20 s (up to 15 min)
                 → Cache file found? → render final result + update estimate
```

---

## 7. Configuration Reference

| File | Key fields |
|---|---|
| `config/runtime.json` | `cloudflareTriggerEndpoint`, `pollIntervalMs` (20 000 ms), `pollTimeoutMs` (900 000 ms) |
| `config/limits.json` | `defaultUrlCount` (100), `maxRequestedUrls` (200) |
| `config/cache-targets.json` | Array of `{ domainUrl, requestedCount }` objects pre-cached by the nightly workflow |
| `cloudflare/wrangler.toml` | Cloudflare Worker deployment settings (Worker name, compatibility date, env variable names) |
| `scripts/build-cache.mjs` | `MAX_CRAWL_DEPTH` (2), `MAX_PAGES_TO_CRAWL` (10), `MAX_SITEMAP_DOCS` (24), `DEFAULT_REQUESTED_COUNT` (100), `MAX_REQUESTED_COUNT` (200) |
