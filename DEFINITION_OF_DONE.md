# Definition of Done — Top Task Finder

This document defines what "done" means for the **Top Task Finder** project. Every deliverable listed below must be met before a feature, sprint, or release is considered complete. It is written to be testable by reviewers at CivicActions and by contributors without deep technical knowledge of the codebase.

Related tools that consume the output of Top Task Finder:

- **[Open Scans](https://mgifford.github.io/open-scans/)** — runs full HTML accessibility scans on the discovered URL list.
- **[Alt-Text Scan](https://mgifford.github.io/alt-text-scan/)** — checks image alt-text quality across the discovered URL list.

Criteria are grouped by category. Where relevant, a **How to test** note describes the concrete steps a CivicActions reviewer can follow without command-line access.

---

## 1. Core URL Discovery

### 1.1 URL generation works end-to-end

- [ ] Entering a valid domain in the **Website address** field and clicking **Find Popular URLs** returns a list of in-domain URLs, one per line, in the textarea.
- [ ] The default requested count is 100. The URL parameter `?requestedCount=N` pre-fills the form; counts outside the 1–200 range are clamped.
- [ ] The list includes at minimum: the homepage, at least one navigation page, and any discoverable accessibility-related pages when they exist on the target site.
- [ ] Results appear within **8 seconds** for the first URL, and the full list is complete within **45 seconds** for a 100-URL request under normal conditions.

**How to test:** Open <https://mgifford.github.io/top-task-finder/> → enter `gsa.gov` → click **Find Popular URLs** → verify the textarea fills with URLs, the homepage (`https://gsa.gov/` or equivalent) is present, and the status region says "Done" or similar within 45 seconds.

### 1.2 Fallback discovery is used when sitemaps are sparse

- [ ] When a domain has no sitemap or an incomplete one, the tool falls back to homepage link extraction, then to a lightweight recursive crawl.
- [ ] When fewer URLs than requested are found, the status message clearly reports the shortfall (e.g., "Found 42 of 100 requested URLs").

**How to test:** Enter a small site (e.g., `civicactions.com` with count 200) and verify a shortfall message appears if fewer than 200 URLs exist and the tool still returns every URL it found.

### 1.3 Pre-built cache is used for configured domains

- [ ] Domains listed in `config/cache-targets.json` return results immediately from the cached JSON file (`cache/<host>-<count>.json`) without triggering a live crawl.
- [ ] The status region indicates whether results came from cache or live discovery.

**How to test:** Enter `gsa.gov` and observe that results appear nearly instantly with a cache-sourced status message.

### 1.4 URL uniqueness and scope

- [ ] No duplicate URLs appear in the output (case-insensitively, after normalization).
- [ ] All URLs in the output belong to the canonical target domain. `www.example.org` and `example.org` are treated as the same host; neither subdomain links to other domains nor off-domain URLs appear.

---

## 2. Copy and Export

### 2.1 Copy URLs button

- [ ] Clicking **Copy URLs** copies the full textarea content (one URL per line) to the clipboard.
- [ ] A visible success or failure notification appears after the copy attempt.

**How to test:** Generate a list for any domain → click **Copy URLs** → paste into a text editor and verify the URLs match the textarea.

### 2.2 Copy Prompt for LLM button

- [ ] Clicking **Copy Prompt for LLM** copies a structured WCAG-EM accessibility-evaluation prompt that includes the current URL list.
- [ ] The prompt is suitable for pasting directly into an AI tool such as ChatGPT, Claude, or Gemini.
- [ ] No URLs or data are sent to any server; only the clipboard is written.

**How to test:** Generate a list → click **Copy Prompt for LLM** → paste into a text editor and confirm the WCAG-EM instructions and all discovered URLs are present.

### 2.3 Editable textarea

- [ ] The URL list textarea is fully editable; the user can add, remove, or change lines before copying.
- [ ] Edits persist in the textarea until the next scan is triggered.

---

## 3. Downstream Tool Integration

### 3.1 Scan HTML button (Open Scans)

- [ ] After URL discovery, the **Scan HTML** button is visible and enabled.
- [ ] Clicking it opens **Open Scans** (<https://mgifford.github.io/open-scans/>) with the discovered URLs pre-loaded for an HTML accessibility scan.

**How to test:** Generate a list → click **Scan HTML** → confirm the Open Scans page opens and the URL field is pre-populated.

### 3.2 Scan Alt Text button (Alt-Text Scan)

- [ ] After URL discovery, the **Scan Alt Text** button is visible and enabled.
- [ ] Clicking it opens **Alt-Text Scan** (<https://mgifford.github.io/alt-text-scan/>) with the discovered URLs pre-loaded for an image alt-text scan.

**How to test:** Generate a list → click **Scan Alt Text** → confirm the Alt-Text Scan page opens and the URL field is pre-populated.

---

## 4. Accessibility

### 4.1 WCAG 2.1 Level AA compliance

- [ ] The live page at <https://mgifford.github.io/top-task-finder/> reports **zero critical or serious violations** when scanned with axe DevTools or the Lighthouse Accessibility audit (target: 100).
- [ ] The automated CI accessibility scan (`.github/workflows/a11y-scan.yml`) passes with no new issues filed against the current build.

**How to test (axe):** Install the [axe DevTools browser extension](https://www.deque.com/axe/devtools/) → open the live site → run the axe scan → confirm zero violations.

**How to test (Lighthouse):** Open Chrome DevTools → Lighthouse → run Accessibility audit → confirm score is 100.

### 4.2 Keyboard-only navigation

- [ ] Every interactive element is reachable and operable by keyboard alone (Tab, Shift+Tab, Enter, Space).
- [ ] The documented focus order is followed: theme toggle → domain input → Find Popular URLs → URL textarea → Copy URLs → Copy Prompt for LLM → Scan HTML → Scan Alt Text → Clear cache and rescan (when shown) → footer link.
- [ ] All focused elements display a visible 2 px solid outline with 2 px offset.

**How to test:** Open the live site → use only the keyboard (no mouse) to complete a full scan and copy the results. Every button and input must be reachable and activatable.

### 4.3 Screen reader compatibility

- [ ] Status updates (discovery progress, cache state, server crawl status) are announced by screen readers via `aria-live="polite"`.
- [ ] All form labels are programmatically associated with their inputs.
- [ ] Button names are descriptive for all states (e.g., the theme toggle announces "Switch to dark mode" or "Switch to light mode").

**How to test:** Enable macOS VoiceOver (`Cmd + F5`) or NVDA on Windows → navigate the page and run a scan → confirm progress announcements are heard without moving focus.

### 4.4 Color contrast — both themes

- [ ] All text and interactive element borders meet WCAG AA contrast requirements in both light and dark themes:
  - Normal text ≥ 4.5:1
  - Large text (18pt+) ≥ 3:1
  - UI components (borders, focus rings) ≥ 3:1
- [ ] Switching between light and dark mode (theme toggle, top-right corner) produces no flash of the wrong theme and all elements remain fully readable.

**How to test:** Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) with primary color pairs from `ACCESSIBILITY.md § Color and Contrast` — verify all pass in both themes.

### 4.5 Touch targets

- [ ] All interactive elements are at minimum **44 × 44 px** (WCAG 2.5.5).

---

## 5. Cache and Automation

### 5.1 Nightly cache refresh workflow

- [ ] The `cache-refresh.yml` GitHub Actions workflow runs on schedule without error and commits updated `cache/*.json` files to the `main` branch.
- [ ] The cache index (`cache/index.json`) is updated to reflect all available cache files.

**How to test:** Navigate to [GitHub Actions](https://github.com/mgifford/top-task-finder/actions/workflows/cache-refresh.yml) → trigger the workflow manually with `gsa.gov` / 100 → confirm it completes successfully and a `cache/gsa.gov-100.json` file is committed.

### 5.2 Cache bypass and rescan

- [ ] After results are shown from cache, a **Clear cache and rescan** button appears.
- [ ] Clicking it forces a fresh live discovery run and replaces the previous results.

### 5.3 Weekly cache cleanup workflow

- [ ] The `cache-cleanup.yml` workflow runs weekly and removes cache files older than 7 days without deleting `cache/index.json`.

---

## 6. Performance

| Condition | Target |
|---|---|
| First URL displayed (100-URL request, no cache) | ≤ 8 seconds |
| Full list generated (100-URL request, normal site) | ≤ 45 seconds |
| Results from pre-built cache | ≤ 2 seconds |
| Page initial load (Lighthouse Performance) | Score ≥ 90 |

---

## 7. Site Build and Deployment

### 7.1 Jekyll build passes

- [ ] `bundle exec jekyll build` completes without errors or warnings.

### 7.2 GitHub Pages deployment succeeds

- [ ] Every push to `main` triggers `jekyll-pages.yml` and the live site at <https://mgifford.github.io/top-task-finder/> is updated within a few minutes.
- [ ] No broken asset URLs — all JavaScript and CSS load correctly (check browser console for errors).

### 7.3 Cache-busting is active

- [ ] Every `<script>` and `<link>` for static assets includes a `?v=<timestamp>` query parameter that changes on each build, ensuring users always receive the latest version.

---

## 8. Automated Tests

- [ ] `npm test` runs the full test suite (`tests/*.test.mjs`) with **zero failures**.
- [ ] No existing tests have been removed or weakened to make the suite pass.

**How to test:** A CivicActions developer with Node.js ≥ 18 installed can run `npm test` in the repository root and confirm all tests pass.

---

## 9. Documentation

- [ ] `README.md` accurately describes the current feature set, usage instructions, and "Learn more" table of resources.
- [ ] `ACCESSIBILITY.md` is updated whenever new UI patterns, color values, or ARIA usage are introduced.
- [ ] `docs/setup-guide.md` reflects the current setup steps for forks, the Cloudflare Worker, and the GitHub Actions cache.
- [ ] The **AI Disclosure** section in `README.md` has an entry for every AI model that made changes in this release cycle.

---

## 10. Security

- [ ] No secrets, API keys, or tokens are committed to the repository.
- [ ] The `GITHUB_TOKEN` used by the Cloudflare Worker is stored only as a Wrangler secret.
- [ ] CodeQL scans (or equivalent) report no new high/critical vulnerabilities in changed code.

---

## Acceptance Checklist (CivicActions Review)

The following checklist is suitable for a CivicActions reviewer without local development access to sign off on a release. All items must be checked before the release is considered done.

- [ ] **URL generation** — Scanned `gsa.gov` with default count; received a valid list within 45 seconds with the homepage included.
- [ ] **Copy URLs** — Copied the list and pasted it into a text editor; contents matched the textarea.
- [ ] **Copy Prompt for LLM** — Pasted the prompt into an AI tool; it included the WCAG-EM instructions and the URL list.
- [ ] **Scan HTML** — Clicked Scan HTML; Open Scans opened with the URLs pre-loaded.
- [ ] **Scan Alt Text** — Clicked Scan Alt Text; Alt-Text Scan opened with the URLs pre-loaded.
- [ ] **Keyboard navigation** — Completed a full scan using keyboard only; all interactive elements were reachable.
- [ ] **Screen reader** — VoiceOver or NVDA announced progress updates during discovery.
- [ ] **Accessibility audit** — axe DevTools reported zero violations on the live page.
- [ ] **Light/dark mode** — Both themes are readable; the toggle is keyboard-operable.
- [ ] **CI green** — GitHub Actions shows all workflows passing on the latest `main` commit.
- [ ] **Documentation current** — README, ACCESSIBILITY.md, and AI Disclosure are up to date.
