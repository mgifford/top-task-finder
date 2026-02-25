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
