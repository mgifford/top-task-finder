# STYLES.md: Design and content standards

This file defines how Top Task Finder is designed, written, and published.
It is the authoritative reference for both humans and AI coding agents contributing
to this repository.

This project uses [CivicActions](https://civicactions.com/) brand identity and adheres
to the [CivicActions Style Guide](https://civicactions-style-guide.readthedocs.io/en/latest/).
Designers should refer to that guide as the canonical source for brand assets, full color
palettes, typography specimens, and Figma resources.

---

## Scope: documentation files vs. the website

This project has two surfaces that share the same standards:

| Surface | Files | Audience |
| :--- | :--- | :--- |
| **GitHub Pages site** | `index.md`, `_layouts/default.html`, `assets/` | Public visitors using the URL finder |
| **Repository documentation** | `README.md`, `AGENTS.md`, `STYLES.md`, `ACCESSIBILITY.md` | Contributors, adopters, and AI agents reading files directly on GitHub |

**What applies to both surfaces:**
- Section 2 — Content and voice standards (plain language, active voice, sentence-case headings, American English, abbreviations, content structure)
- Section 4 — Accessibility and semantic logic (heading hierarchy, alt text, link text)
- Section 5 — AI agent instructions
- Section 6 — Content governance

**What applies to the website only:**
- Section 3 — Design foundations (color tokens, typography, breakpoints, page layout)

Even though documentation files are rendered as plain Markdown rather than styled HTML,
they share the same voice, tone, and heading conventions as the site.

---

## 1. Core philosophy

We design for the reader, not the institution. The goal is to reduce cognitive load
through consistency, clarity, and radical accessibility.

CivicActions advances the greater good through technology built for humans. Top Task
Finder reflects these core brand values:

- **Confidence**: we have the experience and drive to solve hard problems.
- **Curiosity**: we are agile, innovative, and inquisitive.
- **Humanity**: we put people first and share our work openly.

Design and writing principles derived from those values:

1. **Reader-first.** Start with the reader's need, not the organization's structure.
2. **Plain language.** If a 12-year-old cannot understand it, it is a barrier.
3. **Inclusive by default.** See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for all interaction and visual standards.
4. **Consistency is trust.** AI agents and humans must use the same tokens, patterns, and vocabulary.
5. **Radically open.** Work transparently; share methods, data, and findings openly.

---

## 2. Content and voice standards

Derived from UK GDS and Digital.gov plain language standards, and aligned with the
[CivicActions Style Guide](https://civicactions-style-guide.readthedocs.io/en/latest/).

### 2.1 Voice and tone

We use an **authoritative peer** tone: professional and knowledgeable, but accessible
and supportive. This reflects CivicActions' brand personality: modern, clean,
professional, friendly, and optimistic.

| Context | Tone | Strategy |
| :--- | :--- | :--- |
| **Onboarding** | Encouraging | Focus on the benefit to the reader |
| **Technical / legal** | Precise | Be unambiguous; explain "why" if a rule is complex |
| **Error states** | Calm / helpful | Do not blame the reader; provide a clear path forward |
| **Data / impact** | Confident and grounded | Let numbers speak; contextualize without overstating |

### 2.2 Plain language and word choice

AI agents must prioritize these substitutions:

| Avoid | Use instead |
| :--- | :--- |
| Utilize / leverage | Use |
| Facilitate / implement | Help / carry out |
| At this point in time | Now |
| In order to | To |
| Notwithstanding | Despite / even though |
| Requirements | Rules / what you need |

### 2.3 Grammar and mechanics

- **Active voice:** "The scanner checks the link" — not "The link is checked by the scanner."
- **Sentence case:** Use sentence case for all headings and buttons. "Save and continue" — not "Save and Continue."
- **Lists:** Use bullets for unordered items. Use numbered lists only for sequential steps.
- **Oxford comma:** Always use the serial comma in lists of three or more.

### 2.4 Spelling convention

This project uses **American English** as its default spelling standard.

| Variant | Example spellings | When to use |
| :--- | :--- | :--- |
| **American English** (default) | color, center, optimize, behavior | All documentation in this project |

> **AI agents:** Always apply American English spelling rules throughout all documents.

### 2.5 Abbreviations, numbers, and dates

#### Abbreviations

- Spell out an abbreviation on first use, then use the short form: "Web Content Accessibility
  Guidelines (WCAG)."
- Do not use periods in acronyms: "HTML," "CSS," "AI" — not "H.T.M.L."
- Avoid jargon-only abbreviations without explanation unless writing for a specialist audience.

#### Numbers

| Context | Rule | Example |
| :--- | :--- | :--- |
| **In body text** | Spell out one through nine; use numerals for 10 and above | "three pillars," "12 tokens" |
| **Starts a sentence** | Always spell out | "Twelve steps are required." |
| **Percentages** | Use numerals and the % symbol | "4.5% contrast ratio" |
| **Versions and technical values** | Always use numerals | "WCAG 2.1," "font-size: 1rem" |

#### Dates

- Use **ISO 8601** for machine-readable dates: `2025-06-01`.
- Use **spelled-out months** for human-readable dates: "June 1, 2025."
- Do not use all-numeric dates that could be ambiguous across locales (01/06/2025).

### 2.6 Attribution and citation

When quoting, adapting, or referencing external work in documentation:

- **Quote directly** only when the original wording matters and cannot be improved.
  Block-quote passages over three lines.
- **Paraphrase** when the idea is what matters. Paraphrasing does not remove the need
  to credit the source.
- **Credit the source** inline or in a references section.
- **Link to the source** rather than reproducing large portions of external content.
- **Do not reproduce** entire copyrighted works, style guides, or specifications.
  Reference them and link to the canonical source.

> **AI agents:** Do not reproduce large passages from external style guides or
> specifications verbatim. Summarize, paraphrase, and link to the canonical source.

### 2.7 Content structure and document types

Different document types follow different patterns. Use the appropriate structure
rather than treating all Markdown files the same.

| Document type | Purpose | Structure pattern |
| :--- | :--- | :--- |
| **Reference** (STYLES.md, ACCESSIBILITY.md) | Authoritative rules; consulted, not read cover-to-cover | Numbered sections, tables, bullet rules |
| **Guide or how-to** (docs/, README.md) | Step-by-step walkthrough for a specific audience | Numbered steps, "you" voice, outcome-focused |
| **Feature catalog** (AGENTS.md) | Comprehensive technical inventory | Categorized sections, file paths, option tables |

Rules that apply to all document types:

- Use heading levels in order (`#` then `##` then `###`). Do not skip levels.
- Open each document with a one-sentence purpose statement.
- Keep paragraphs short: three to five sentences is a good maximum.
- Prefer short sentences over long, complex ones.

---

## 3. Design foundations (site surface only)

These rules apply to the Jekyll site (`index.md`, `_layouts/default.html`, `assets/`).
They do not govern plain Markdown documentation files.

### 3.0 Brand profile

**Active brand:** CivicActions

- **Brand site:** [civicactions.com](https://civicactions.com/)
- **Full style guide:** [civicactions-style-guide.readthedocs.io](https://civicactions-style-guide.readthedocs.io/en/latest/)
- **Writing style guide:** [guidebook.civicactions.com](https://guidebook.civicactions.com/en/latest/about-this-guidebook/writing-style-guide/)

**Brand personality:** Modern, clean, professional, friendly, optimistic.

**Brand values expressed in design:**
- Use clear hierarchy and ample white space (clean, professional).
- Use accessible color contrast and generous touch targets (humanity, inclusive).
- Keep layouts simple and scannable (friendly, optimistic).

### 3.1 Design tokens

The canonical values live in `assets/css/app.css` as CSS custom properties.
This table documents the design intent aligned with the CivicActions brand palette.

For the full CivicActions palette including CMYK, RGB, and USWDS equivalents, see the
[Colors page in the CivicActions Style Guide](https://civicactions-style-guide.readthedocs.io/en/latest/brand/colors/).

#### Brand color tokens

These are defined once in `:root` and never redefined in dark mode — they are
absolute brand values, not theme-swappable tokens.

| Token | Hex | Role |
| :--- | :--- | :--- |
| `--ca-red` | `#d83933` | Primary brand red; calls to action |
| `--ca-red-secondary` | `#8b0a03` | Hover state on red elements |
| `--ca-blue-dark` | `#162e51` | Primary brand blue; headings, strong text |
| `--ca-blue-secondary` | `#1a4480` | Links, interactive elements |
| `--ca-blue-light` | `#73b3e7` | Supporting accents, dark-mode interactive |
| `--ca-gold` | `#fa9441` | Warm accent; warnings, secondary highlights |

#### System tokens — light mode

| Token | Value | Requirement |
| :--- | :--- | :--- |
| `--color-bg` | `#ffffff` | Base page background |
| `--color-bg-panel` | `#ffffff` | Card / panel backgrounds |
| `--color-secondary-bg` | `#f0f0f0` | Section backgrounds, subtle areas |
| `--color-text` | `#171717` | 4.5:1 contrast on `--color-bg` required |
| `--color-text-secondary` | `#454545` | Supporting copy; 4.5:1 minimum |
| `--color-border` | `#d6d7d9` | Card and section separators |
| `--color-border-input` | `#71767a` | Form input borders |
| `--color-primary` | `#1a4480` | Button backgrounds, primary interactive |
| `--color-primary-text` | `#ffffff` | Text on `--color-primary` |
| `--color-accent` | `#d83933` | CTA highlights, brand accent |
| `--color-link` | `#1a4480` | Link text |
| `--color-link-hover` | `#162e51` | Link text hover |
| `--color-heading` | `#162e51` | Heading text color (maps to `--ca-blue-dark`) |
| `--color-success-border` | `#28a745` | Notification success border |

#### System tokens — dark mode

Dark mode is toggled via `[data-theme="dark"]`. CSS custom properties are overridden
using the same token names, so no component-level rules need to change.

| Token | Value | Notes |
| :--- | :--- | :--- |
| `--color-bg` | `#1b1b1b` | Dark page background |
| `--color-bg-panel` | `#2d2d2d` | Dark card / panel |
| `--color-text` | `#e9e9e9` | High-contrast light text |
| `--color-primary` | `#73b3e7` | Light blue for interactive elements |
| `--color-primary-text` | `#1b1b1b` | Dark text on light-blue buttons |
| `--color-link` | `#73b3e7` | Light blue links |
| `--color-heading` | `#e9e9e9` | Heading text color in dark mode |
| `--color-success-border` | `#a3d9a5` | Notification success border in dark mode |

### 3.2 Typography

For this project's site, apply these implementation rules:

- **Font stack:** `'Public Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
  (Public Sans is the USWDS default and aligns with government digital service conventions.
  It is loaded via Google Fonts in `_layouts/default.html`.)
- **Font scaling:** Use `rem` units. Never use `px` for font sizes.
- **Line length:** 45–75 characters per line (`max-width: 48rem` for the main container).
- **Line height:** Minimum `1.6` for body text.
- **Text alignment:** Use left-aligned text for body content. Avoid `text-align: justify`.
- **Capitalization:** Use CSS `text-transform` for decorative uppercase styling. Do not write uppercase text directly in HTML source.
- **Heading color:** `var(--ca-blue-dark)` in light mode; `var(--color-text)` in dark mode.

### 3.3 Responsive design (mobile-first)

Write base CSS for the smallest screen first, then enhance with `min-width` queries.

| Layer | Breakpoint | Intent |
| :--- | :--- | :--- |
| **Mobile** | `0`–`599px` (base, no query) | Single-column, touch targets ≥ 44 × 44 px |
| **Tablet** | `min-width: 600px` | Wider padding, multi-column action rows |
| **Desktop** | `min-width: 900px` | Multi-column grids, wider prose, side panels |

- **Never block zoom.** The viewport meta tag must not include `maximum-scale=1`
  or `user-scalable=no`. Users must be able to scale the page freely.

### 3.4 User-preference media queries

| Query | Status | Implementation |
| :--- | :--- | :--- |
| `prefers-color-scheme` | Required | Dark/light token swap via CSS custom properties |
| `prefers-reduced-motion` | Required | Remove or reduce transitions and animations |
| `prefers-contrast` | Planned | Not yet implemented |
| `forced-colors` | Planned | Not yet implemented |
| `print` | Recommended | Hide navigation and decorative elements |

### 3.5 Component standards

#### Buttons

- Default buttons use `--color-primary` background and `--color-primary-text` text.
- Secondary buttons use `--color-secondary-bg` background with `--color-border-input` border.
- Minimum height `2.6rem` (≥ 44 px equivalent) for all interactive buttons.
- Hover state darkens background to `--color-link-hover` for primary; `--color-border` for secondary.
- Focus uses a `2px solid var(--color-primary)` outline with `2px` offset.

#### Panels / cards

- Border: `1px solid var(--color-border)`
- Border radius: `10px`
- Background: `var(--color-bg-panel)`
- Padding: `1rem`

#### Status messages

| Variant | Background token | Text token |
| :--- | :--- | :--- |
| `info` | `--color-info-bg` | `--color-info-text` |
| `success` | `--color-success-bg` | `--color-success-text` |
| `warning` | `--color-warning-bg` | `--color-warning-text` |
| `error` | `--color-error-bg` | `--color-error-text` |

All variants must maintain ≥ 4.5:1 contrast between text and background tokens
in both light and dark modes.

---

## 4. Accessibility and semantic logic

These rules apply to **both surfaces**. This project exists to support accessibility
auditors; our own outputs must meet or exceed the same standards we help others measure.

- Use heading levels in order: `h1` then `h2` then `h3`. Do not skip levels.
- Write descriptive link text. "Learn more about top tasks" — not "click here."
- Every image needs meaningful alt text. Decorative images use `alt=""`.
- Use `aria-label` on landmark elements when the role is ambiguous.
- Minimum color contrast: 4.5:1 for body text, 3:1 for large text and UI components.
- Do not convey information by color alone. Always pair color with a secondary indicator.
- Ensure touch and click targets are at least 44 × 44 pixels for all interactive elements.
- Use underlines only for links, not for decorative or non-link text.
- Provide a `<main>` element with `aria-labelledby` so screen-reader users can navigate
  directly to the main content.

See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for the full accessibility commitment and
conformance target (WCAG 2.1 AA).

---

## 5. AI agent instructions

These rules apply to both surfaces. Agents editing documentation and agents
generating site content must follow all of them.

- Read [AGENTS.md](./AGENTS.md) before making any change to this repository.
- Identify which surface is being edited (site or documentation) and apply the correct rule set.
- Never override [ACCESSIBILITY.md](./ACCESSIBILITY.md) constraints.
- Use American English throughout.
- Keep changes scoped to the minimum necessary to fulfill the user's request.
- Verify all cross-file references resolve before committing.
- Use UTF-8 encoding only. Do not use smart quotes, em dashes substituted with
  hyphens, or Windows-1252 characters.
- Use absolute or project-relative paths (e.g., `assets/js/app.js`), never bare filenames.
- Update the `## AI Disclosure` section in `README.md` with your LLM name, version,
  and contribution summary.
- When modifying `assets/css/app.css`, use the CSS custom property tokens defined in
  this document. Do not hard-code hex values outside the `:root` and `[data-theme="dark"]`
  blocks.
- Keep `NON_HTML_EXTENSION_PATTERN` identical between `assets/js/discovery.js` and
  `scripts/build-cache.mjs`.
- Cache-busting: always append `?v={{ site.time | date: '%s' }}` when referencing static
  assets in `_layouts/default.html` or `index.md`.

---

## 6. Content governance

### 6.1 When to update this file

Update STYLES.md when you:

- Add a new CSS token or change an existing token's value.
- Add a new UI component pattern (new color usage, new focus style, new layout pattern).
- Change the font stack or typographic scale.
- Add a new document type to the repository.
- Revise voice, tone, or word-choice guidance.

### 6.2 Cross-file consistency

| This file governs | Must stay in sync with |
| :--- | :--- |
| CSS token values | `assets/css/app.css` `:root` and `[data-theme="dark"]` blocks |
| Color contrast ratios | `ACCESSIBILITY.md § Color and Contrast` |
| Focus outline rules | `ACCESSIBILITY.md § Focus Management` |
| Font stack | `assets/css/app.css` `body` rule |

### 6.3 Versioning

This file does not carry its own version number. Its effective version is the git
commit SHA of the most recent change. To find the history of this file, run:

```bash
git log --follow STYLES.md
```
