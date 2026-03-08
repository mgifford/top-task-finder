# Use On-Device AI Agent to Semantically Score Discovered URLs by User-Task Relevance

**Labels:** `enhancement`, `ai-agent`, `url-discovery`

## Summary

The [GitHub Accessibility — Getting Started with Agents](https://accessibility.github.com/documentation/guide/getting-started-with-agents/) guide highlights how AI agents can augment existing workflows by taking on analysis tasks that are tedious or error-prone for rule-based systems. Top Task Finder already includes an on-device AI integration (`assets/js/local-ai.js`) that uses the Chrome 2026 `LanguageModel` API to process URL lists. This issue proposes extending that agent capability to a new stage: **semantic URL scoring** — letting the AI agent read fetched page titles and meta descriptions and classify each URL by its user-task relevance, producing a richer and more accurate WCAG-EM sample.

## Problem

The current URL scoring pipeline (`build-cache.mjs` server-side, `discovery.js` client-side) uses **keyword pattern matching** on the URL path to assign priority signals. For example:

```js
// From build-cache.mjs
const PRIORITY_SIGNALS = {
  accessibility: /accessibility|a11y|barrier/i,
  search: /search|find|lookup/i,
  task: /task|service|apply|register|request/i,
  // …
};
```

This approach works well for English government sites with predictable URL structures, but has notable blind spots:

- **Opaque URL slugs** — many CMSs generate numeric or UUID-based slugs (`/page/12345`) where the URL gives no hint of content.
- **Multilingual sites** — a French "Accessibilité" page at `/fr/accessibilite` is caught, but an equivalent in a less-common language or a non-ASCII slug may not be.
- **Misleading paths** — a URL like `/services/annual-report-2024` could be either a form-heavy services hub or a static PDF index; keyword matching alone can't distinguish them.
- **Under-scored task pages** — important transactional pages (e.g. benefit applications) often live under generic paths that trigger no priority boost.

The result is that the produced URL sample may include structurally similar pages while missing high-value task pages that matter most for a WCAG-EM audit.

## Proposed Solution

Extend the existing `local-ai.js` on-device AI integration to include an optional **semantic scoring pass** that runs after the initial URL list is generated:

1. **Fetch page titles & meta descriptions** — for each URL in the output list, issue a lightweight `fetch()` request and extract `<title>` and `<meta name="description">` content using a small DOM parser. These are typically a few hundred bytes each, far smaller than full page loads.

2. **AI agent classification prompt** — pass the batch of `{url, title, description}` tuples to the on-device `LanguageModel` agent with a structured prompt:
   ```
   For each page below, rate its likely importance for a WCAG-EM accessibility audit
   on a scale from 1–5, where 5 = key user task (forms, search, applications)
   and 1 = low-priority archive content. Return a JSON array [{url, score, reason}].
   ```

3. **Re-sort the output list** — use the AI scores to reorder or flag URLs in the textarea, surfacing the highest-value task pages at the top.

4. **Graceful degradation** — the feature is only available when the on-device `LanguageModel` API is `'readily'` available. When unavailable, the current keyword-based order is preserved with no change to behaviour.

5. **Streaming progress** — use `promptStreaming()` (already used in the `injectStreamingAnalysisSection` function) to show live scoring progress in the `ai-summary-output` div.

### Why on-device?

Using the local `LanguageModel` API (Gemini Nano) instead of an external LLM means:
- No user data (URLs, page titles) leaves the browser.
- No API key required.
- Works offline after the initial model download.
- Consistent with the existing privacy-preserving design of the tool.

## Acceptance Criteria

- [ ] A new button **"Re-score by Task Relevance (AI)"** is injected by `local-ai.js` alongside the existing AI buttons, visible only when `LanguageModel` availability is `'readily'`.
- [ ] Clicking the button fetches titles/meta from each URL in the output textarea (with a reasonable timeout and error handling per URL).
- [ ] The AI agent scores each URL 1–5 and the list is reordered accordingly (highest scores first), preserving the raw URL-per-line format.
- [ ] A brief explanation of the top 3 highest-scored URLs is shown in the `ai-summary-output` area.
- [ ] If a `fetch()` fails for a URL (CORS, timeout, bot-protection), that URL retains its original keyword-based score and is not excluded.
- [ ] The feature degrades gracefully in browsers without the `LanguageModel` API (no new buttons injected, no errors thrown).
- [ ] Keyboard accessible: the new button participates in the existing tab order and can be activated with Enter/Space.

## References

- [GitHub Accessibility — Getting Started with Agents](https://accessibility.github.com/documentation/guide/getting-started-with-agents/)
- [`assets/js/local-ai.js`](../../assets/js/local-ai.js) — existing on-device AI with `LanguageModel` API
- [`scripts/build-cache.mjs`](../../scripts/build-cache.mjs) — `PRIORITY_SIGNALS` object (lines ~94–97)
- [`assets/js/discovery.js`](../../assets/js/discovery.js) — client-side `prioritySignals` pattern
