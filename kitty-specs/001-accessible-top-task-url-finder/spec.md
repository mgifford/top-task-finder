# Feature Specification: Accessible Top Task URL Finder

**Feature Branch**: `001-accessible-top-task-url-finder`  
**Created**: 2026-02-25  
**Status**: Draft  
**Input**: User description: "I want a GitHub pages site that allows me to put in a domain name (url) and get a list of URLs that reflect this. I've described it here: https://github.com/mgifford/o-hat-scanner/issues/1 But I want a stand-alone tool. I want pages that should be focused on accessibility. So they should contain popular pages, the home page, search pages, accessibility related content, and pages that are going to be top-tasks for whatever the site is for. This may be hard to determine without AI, but there are some things we can assume and check for. If there are multiple languages, there should be a sample of different urls with different content. I would like to have 20% of the total pages to be random pages that reflect actual pages, but hopefully are pulling from different areas of the site. This could be pulled from a sitemap.xml file. I want the form to default to 100 URLs but be able to pull in more or less. So there are two fields: Domain name/URL and Number of URLs. Using Duck Duck Go or some other service that doesn't require an API key for low volume crawls. This is for a fairly low volume site hosted on GitHub Pages."

## Clarifications

### Session 2026-02-25

- Q: Should URL discovery stay on exact host or include subdomains? → A: Current release stays on one canonical host and treats `www` and non-`www` as equivalent; optional subdomain exploration via checkbox is deferred to a future release.
- Q: What maximum URL count should be allowed in the current release? → A: Cap requested URL count at 200 for now, with a configurable maximum that can be adjusted later as hosting resources allow.
- Q: What user-facing performance target should v1 commit to for default requests? → A: For the default 100-URL request, show first results within 8 seconds and complete generation within 45 seconds under normal conditions.
- Q: How should anti-bot/interstitial responses be handled in v1? → A: Apply escalating waits and retries (`5s -> 10s -> 20s -> 40s -> 80s -> 120s max`) while continuing to other candidate URLs/sources; if still blocked after capped retry policy, return partial results with warnings.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a representative URL list (Priority: P1)

As a site reviewer, I can enter a domain and requested URL count, then generate a one-URL-per-line list that represents key user journeys and content areas on that site.

**Why this priority**: This is the core purpose of the tool and must work before any secondary export or refinement behavior provides value.

**Independent Test**: Can be fully tested by entering a valid domain and count, generating the list, and verifying the output contains the requested number of valid in-domain URLs in editable text format.

**Acceptance Scenarios**:

1. **Given** a valid domain and a requested count, **When** the user starts generation, **Then** the system returns a one-URL-per-line editable list from that domain.
2. **Given** no count is entered by the user, **When** the form loads or runs, **Then** the default requested count is 100.
3. **Given** the system can identify key pages (home, search/discovery, accessibility-related, and high-value task pages), **When** generation completes, **Then** these page types are represented in the returned list.

---

### User Story 2 - Produce robust results with limited discovery sources (Priority: P2)

As a user scanning small or inconsistent sites, I still receive useful URL coverage even when sitemap or search index data is incomplete.

**Why this priority**: Many low-volume sites have partial indexing or incomplete sitemaps, and the tool must remain usable in those common conditions.

**Independent Test**: Can be tested by using a domain with sparse or missing sitemap/search results and confirming fallback discovery produces additional valid in-domain URLs from internal links.

**Acceptance Scenarios**:

1. **Given** sitemap or external search discovery yields insufficient URLs, **When** generation continues, **Then** the system performs lightweight internal link discovery from the homepage and adds eligible URLs.
2. **Given** discovery still cannot reach the requested count, **When** output is returned, **Then** the system returns as many valid URLs as found and clearly reports that full count was not available.

---

### User Story 3 - Reuse results in accessibility workflows (Priority: P3)

As an accessibility reviewer, I can edit and copy the generated URL list directly for downstream checks and audits.

**Why this priority**: Practical reuse is necessary for real workflows, but it depends on generation being correct first.

**Independent Test**: Can be tested by generating a list, editing lines in place, and copying the full list with one action.

**Acceptance Scenarios**:

1. **Given** a generated URL list is shown, **When** the user edits entries in the text area, **Then** those edits are preserved until the next generation action.
2. **Given** a generated or edited list is present, **When** the user activates copy, **Then** the full one-URL-per-line content is copied.
3. **Given** optional downloads are available, **When** the user chooses CSV or JSON export, **Then** downloaded content matches the current list.

### Edge Cases

- Input domain is malformed, unreachable, or does not resolve.
- Input includes URL paths, query strings, trailing slashes, or protocol variants that need normalization to a single target domain.
- Requested URL count is zero, negative, non-numeric, or excessively large.
- Domain blocks automated requests or returns anti-bot/interstitial pages.
- For anti-bot/interstitial responses, system follows capped backoff (`5s -> 10s -> 20s -> 40s -> 80s -> 120s`) and then continues with partial results plus warning if still blocked.
- Sitemap exists but includes out-of-domain, duplicate, redirected, or non-HTML resources.
- Search discovery returns stale, low-quality, or unrelated results.
- A site has multilingual variants with uneven page counts across languages.
- Random-sample target (20%) is not possible because candidate pool is too small.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide two user inputs: (1) domain/URL and (2) requested number of URLs.
- **FR-002**: System MUST default the requested number of URLs to 100 when the user does not provide a value.
- **FR-003**: System MUST validate and normalize the domain/URL input before discovery begins.
- **FR-004**: System MUST discover candidate URLs from the target domain using sources that do not require an API key for low-volume use.
- **FR-005**: System MUST prioritize inclusion of pages that represent the homepage, search/discovery experiences, accessibility-related content, and high-value top-task content when those pages are discoverable.
- **FR-006**: System MUST allocate approximately 20% of the final output to randomly selected valid URLs from the discovered candidate pool, while attempting to diversify site-area coverage.
- **FR-007**: System MUST prioritize primary/default language pages while still including a sample from additional detected language variants when available.
- **FR-008**: System MUST use lightweight internal link discovery from the homepage when sitemap/search discovery is insufficient.
- **FR-009**: System MUST return up to the requested number of unique, in-domain, valid page URLs; when fewer are available, it MUST return the maximum found and communicate the shortfall.
- **FR-010**: System MUST present results as one URL per line in an editable text area.
- **FR-011**: System MUST provide a one-action copy control that copies the current text area content.
- **FR-012**: System SHOULD support optional export of the current URL list as CSV and JSON.
- **FR-013**: System MUST avoid duplicate URLs in output after normalization.
- **FR-014**: System MUST provide clear, user-friendly error states for invalid input and discovery failures.
- **FR-015**: System MUST normalize input host variants so `example.org` and `www.example.org` resolve to a single canonical host for a scan.
- **FR-016**: System MUST keep discovery scoped to that canonical host in the current release.
- **FR-017**: System SHOULD provide an optional "include subdomains" user control in a future release.
- **FR-018**: System MUST enforce a maximum requested URL count of 200 in the current release.
- **FR-019**: System MUST define the maximum requested URL count as a configurable setting so maintainers can raise or lower the cap without changing feature behavior.
- **FR-020**: For default 100-URL requests under normal operating conditions, system MUST show first results within 8 seconds and complete generation within 45 seconds.
- **FR-020**: For default 100-URL requests under normal operating conditions, system MUST show first results within 8 seconds and complete generation within 45 seconds, except when anti-bot backoff policy is invoked.
- **FR-021**: When discovery encounters anti-bot/interstitial responses, system MUST retry with escalating waits (`5s -> 10s -> 20s -> 40s -> 80s -> 120s` max), continue processing other URLs/sources, and return partial results with explicit warnings when blocked resources remain inaccessible.

### Key Entities *(include if feature involves data)*

- **Scan Request**: User-submitted request containing target domain/URL, desired count, and generation timestamp.
- **Candidate URL**: Discovered URL with attributes such as normalized path, source type (sitemap/search/internal), language hint, and category hint.
- **Generated URL List**: Final ordered set of selected URLs with metadata about requested count, returned count, and random-allocation share.
- **Discovery Summary**: User-visible status describing discovery sources used, fallback usage, and any shortfall from requested count.

### Assumptions

- Primary users are accessibility reviewers performing low-volume scans of public websites.
- Most target sites expose enough internal links to provide fallback coverage when indexing sources are sparse.
- "Approximately 20%" random allocation allows minor variance when strict rounding would reduce list quality.
- Subdomain discovery is intentionally out of scope for this release except for canonical `www`/non-`www` host normalization.

### Dependencies

- Target sites permit basic read access to public pages and linked resources.
- At least one no-key discovery source is available for low-volume lookups.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In at least 90% of valid scan attempts, users receive a generated list without needing to retry input.
- **SC-002**: For domains with sufficient discoverable pages, at least 95% of scans return the full requested count.
- **SC-003**: In successful scans, 100% of outputs are unique, in-domain URLs presented one per line.
- **SC-004**: At least 85% of successful scans include at least one URL from each available priority category (homepage, search/discovery, accessibility-related, top-task) when those categories are discoverable on the target site.
- **SC-005**: In multilingual sites where two or more language variants are detected, at least 80% of scans include non-primary-language URLs while still keeping a majority from the primary/default language.
- **SC-006**: At least 95% of users can copy the generated list to clipboard on first attempt.
- **SC-007**: For default 100-URL scans under normal conditions, first results are shown within 8 seconds and full generation completes within 45 seconds.
- **SC-007**: For default 100-URL scans under normal conditions, first results are shown within 8 seconds and full generation completes within 45 seconds (excluding runs where anti-bot backoff policy is triggered).
- **SC-008**: In scans where anti-bot/interstitial blocking occurs, 100% of runs apply the defined backoff policy and return a user-visible warning when partial results are returned.
