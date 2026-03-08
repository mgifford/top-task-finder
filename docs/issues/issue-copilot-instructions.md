# Add `.github/copilot-instructions.md` to Prepare the Codebase for Copilot Coding Agent Use

**Labels:** `enhancement`, `ai-agent`, `documentation`

## Summary

As described in the [GitHub Accessibility — Getting Started with Agents](https://accessibility.github.com/documentation/guide/getting-started-with-agents/) guide, one of the most impactful first steps for teams adopting GitHub Copilot agents is to add a `.github/copilot-instructions.md` file. This file acts as a persistent context document that the Copilot coding agent reads before making any change — so it understands project conventions, architecture decisions, and code patterns without needing them repeated in every issue.

Top Task Finder has a non-trivial architecture (multi-stage URL discovery, three-tier caching, Cloudflare worker trigger, Jekyll + vanilla JS) and several conventions that are easy to miss (keeping `NON_HTML_EXTENSION_PATTERN` in sync between `discovery.js` and `build-cache.mjs`, using cache-busting query params on static assets, the `sourcesAttempted` tracking pattern, etc.). Without a copilot-instructions file, any agent assigned an issue is likely to miss these details and introduce regressions.

## Problem

Currently there is no `.github/copilot-instructions.md` in this repository. As a result:

- A Copilot coding agent assigned an issue about URL scoring would have no context about the three-tier cache or the `SOURCE_BASE_WEIGHTS` constants.
- An agent fixing a CSS accessibility issue would not know about the WCAG AA contrast targets already established in the codebase.
- An agent updating the discovery logic might break the sync requirement between `discovery.js` (client) and `build-cache.mjs` (server).
- Agents will not know about the Jekyll cache-busting pattern (`?v={{ site.time | date: '%s' }}`) and might reference assets without it.

## Proposed Solution

Create `.github/copilot-instructions.md` covering the topics that matter most for agent-driven changes:

1. **Architecture overview** — describe the three tiers: Cloudflare worker trigger → GitHub Actions `build-cache.mjs` → cached JSON → browser polling.
2. **Key invariants to preserve** — e.g. `NON_HTML_EXTENSION_PATTERN` must match in both `discovery.js` and `build-cache.mjs`; all static asset `<script>` and `<link>` tags must include the Jekyll cache-bust param.
3. **Accessibility requirements** — WCAG 2.1 AA target; minimum 44×44 px touch targets; `aria-live="polite"` on all status regions; never remove existing ARIA attributes without a documented reason.
4. **Scoring algorithm context** — explain `SOURCE_BASE_WEIGHTS`, `PRIORITY_SIGNAL_BOOSTS`, `MAX_INDIVIDUAL_SEGMENT`, and the year-deduplication logic so agents don't accidentally flatten or remove them.
5. **Test and preview instructions** — `bundle exec jekyll serve` for local preview; `node scripts/build-cache.mjs --domain-url example.com --requested-count 50` for local cache testing.
6. **Branch / PR conventions** — describe preferred commit message style and where to place new config keys.

## Acceptance Criteria

- [ ] `.github/copilot-instructions.md` exists and is ≤ 400 lines.
- [ ] File covers architecture, key invariants, accessibility targets, scoring constants, and local-dev commands.
- [ ] A Copilot agent assigned a simple accessibility issue (e.g. "add `aria-describedby` to the domain input") can complete the task without introducing a regression, guided solely by the instructions file plus the issue description.
- [ ] The file is kept in sync whenever architectural decisions change (added as a note in the PR template).

## References

- [GitHub Accessibility — Getting Started with Agents](https://accessibility.github.com/documentation/guide/getting-started-with-agents/)
- [`assets/js/local-ai.js`](../../assets/js/local-ai.js) — existing on-device AI integration
- [`scripts/build-cache.mjs`](../../scripts/build-cache.mjs) — URL discovery engine with constants to document
- [`ACCESSIBILITY.md`](../../ACCESSIBILITY.md) — existing accessibility requirements to reference
