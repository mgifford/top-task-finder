# Top Task Finder

**Top Task Finder** helps you quickly generate a representative, prioritized list of URLs from any public website — perfect for accessibility audits, top-task reviews, and UX research.

🔗 **[Try it now — no sign-up required](https://mgifford.github.io/top-task-finder/)**

---

## What it does

Enter a website URL, choose how many pages you want, and click **Find Popular URLs**. In seconds you get a clean, editable list of that site's most important pages, ready to paste into your audit workflow.

- **Smart prioritization** — homepage, navigation, accessibility, and task-oriented pages are ranked higher.
- **Pre-built cache** — popular domains are cached nightly so results appear instantly.
- **Ready to copy** — the output is plain text, one URL per line, editable before you copy it.
- **LLM-ready** — a built-in "Copy Prompt for LLM" button formats the list into a structured WCAG-EM accessibility-evaluation prompt for use with any AI tool you like.
- **Next-step integration** — direct links to deep-scan your discovered URLs with specialized tools like **[Open Scans](https://mgifford.github.io/open-scans/)** (HTML) and **[Alt-Text Scan](https://mgifford.github.io/alt-text-scan/)**.
- **Works on any public site** — government portals, NGO sites, corporate pages, and everything in between.

---

## Who it's for

- **Accessibility auditors** building a representative sample for WCAG reviews and WCAG-EM reports.
- **UX researchers** validating top tasks and content coverage.
- **Product teams** doing lightweight, repeatable URL inventory for content-heavy sites.
- **Anyone** who needs a quick representative list of pages from a domain.

---

## How to use it

1. Go to **[mgifford.github.io/top-task-finder](https://mgifford.github.io/top-task-finder/)**.
2. Enter a site URL (e.g., `gsa.gov`) and choose a page count.
3. Click **Find Popular URLs**.
4. Edit the list if needed, then copy it into your workflow.
5. Use the **Scan HTML** or **Scan Alt Text** buttons to immediately start a deep audit of your selected pages.

You can also share a pre-filled link using URL parameters:

```
https://mgifford.github.io/top-task-finder/?domainUrl=gsa.gov&requestedCount=50
```

---

## Fork it and make it yours

Want to run your own instance or pre-cache results for domains you care about?

1. **Fork** this repository.
2. Follow the **[Setup and Configuration Guide](docs/setup-guide.md)** to configure GitHub Pages, the nightly cache workflow, and the optional Cloudflare Worker trigger.
3. Add your target domains to [`config/cache-targets.json`](config/cache-targets.json) and the nightly workflow will keep them fresh.

The whole stack is open source — Jekyll for the front-end, a small Node.js script for URL discovery, GitHub Actions for automation, and an optional Cloudflare Worker for triggering server-side crawls.

---

## If you find this useful

If this tool has helped you, here are a few ways you can support it and help others discover it:

- **Tell a friend** — share it with colleagues, auditors, or anyone involved in accessibility or UX research.
- **Add a star** — starring the [repository on GitHub](https://github.com/mgifford/top-task-finder) helps others find the project.
- **Write an issue** — share how you used it in your design, discovery, or accessibility process. Your story helps us improve the tool and shows others how it can be applied.

This tool was developed thanks to [CivicActions](https://civicactions.com) — who support open source, human-centred design, and accessibility.

---

## Learn more

| Resource | What's in it |
|---|---|
| [docs/setup-guide.md](docs/setup-guide.md) | Forking, local development, Cloudflare Worker setup, GitHub Actions cache, troubleshooting |
| [docs/technical-guide-url-discovery.md](docs/technical-guide-url-discovery.md) | URL discovery pipeline, scoring algorithm, domain size estimation, LLM prompt variations |
| [ACCESSIBILITY.md](ACCESSIBILITY.md) | WCAG compliance standards, colour contrast values, keyboard navigation, ARIA patterns |
| [AGENTS.md](AGENTS.md) | Guidance for AI coding agents contributing to this repository |

---

## AI Disclosure

This section documents how artificial intelligence has been used in this project, covering development, runtime behaviour, and browser-based features.

### AI used to build and maintain this project

| Date | Model | Task |
|------|-------|------|
| 2026-03 | Claude Sonnet (Anthropic) | Added "If you find this useful" community support section and CivicActions attribution to `README.md` |
| 2026-03 | Claude Sonnet (Anthropic) | Added AI disclosure section to `README.md` and AI disclosure instruction to `AGENTS.md` |
| 2026-03 | Claude Sonnet 4.5 (Anthropic) | Wrote `docs/technical-guide-url-discovery.md` — technical guide covering the Cloudflare Worker API, DuckDuckGo HTML search integration, URL discovery pipeline, domain size estimation methodology, and LLM prompt variations |
| 2026-03 | Claude Sonnet 4.5 (Anthropic) | Rewrote `README.md` to be welcoming and user-focused; moved technical setup content to `docs/setup-guide.md` |
| 2026-03 | Claude Sonnet 4.6 (Anthropic) | Created `STYLES.md` documenting CivicActions brand design and content standards; updated `assets/css/app.css` to use CivicActions brand color palette; updated `ACCESSIBILITY.md` color contrast values to reflect new palette |
| 2026-04 | Gemini 3 Flash (Google) | Added "Next Steps" workflow integration with `open-scans` and `alt-text-scan` tools; updated `index.md`, `assets/js/app.js`, and `assets/css/app.css` to support new scanner actions |

AI coding agents are used to build and maintain this project. The [`AGENTS.md`](AGENTS.md) file provides guidance for these agents and lists the specific instructions they follow. Any AI agent that makes changes to this repository is required to add an entry to the table above describing the model and what it did.

### AI used when running the program (browser-based, optional)

The application includes optional **on-device AI** powered by **Chrome's built-in Gemini Nano** model via the [LanguageModel API](https://developer.chrome.com/docs/ai/built-in). This feature requires Chrome with the relevant experimental flags enabled and the Gemini Nano model downloaded. No data is sent to an external server; all inference runs locally in the browser.

When the model is available, two AI-powered buttons appear in the interface:

- **Copy LLM Improved List** — sends the generated WCAG-EM prompt to Gemini Nano to clean, deduplicate, and professionally format the task list, then copies the result to the clipboard.
- **Summarize Site Tasks with AI** — sends the discovered URL list to Gemini Nano and streams back the top 5 identified user tasks.

The application also supports the legacy `window.ai.languageModel` API as a fallback for older browser builds that exposed the Prompt API under a different namespace.

If the browser does not support either API, the AI buttons are not shown and the application works fully without any AI features.

### "Copy Prompt for LLM" feature

The **Copy Prompt for LLM** button generates a structured WCAG-EM accessibility-evaluation prompt and copies it to the clipboard. This prompt is designed to be pasted into any external LLM tool of the user's choice (such as ChatGPT, Claude, Gemini, or similar). The application does not select or connect to any specific external LLM; the choice of tool is entirely up to the user. No URLs or content are sent anywhere by this button — it only writes text to the clipboard.
