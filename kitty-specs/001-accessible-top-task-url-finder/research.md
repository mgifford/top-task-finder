# Research Notes: Accessible Top Task URL Finder

## Decision 1: Delivery architecture

- **Decision**: Use a static GitHub Pages one-page app with vanilla JavaScript and browser-side discovery.
- **Rationale**: Matches user preference for simplicity, low hosting overhead, and straightforward maintenance.
- **Alternatives considered**:
  - Frontend + serverless proxy: improves CORS resilience but adds operational surface.
  - Full backend crawler: stronger control but over-scoped for low-volume v1.

## Decision 2: Discovery source strategy

- **Decision**: Prioritize sitemap and no-key search discovery, then fallback to lightweight homepage link traversal.
- **Rationale**: Preserves broad coverage while keeping behavior robust when one source is sparse.
- **Alternatives considered**:
  - Sitemap-only: too brittle on incomplete sites.
  - Search-only: quality can be stale/noisy and may miss key internal sections.

## Decision 3: Host normalization and scope

- **Decision**: Normalize `www` and non-`www` to one canonical host per scan and keep v1 discovery on that host.
- **Rationale**: Avoids duplicate/fragmented results and keeps semantics predictable for accessibility review.
- **Alternatives considered**:
  - Include all subdomains by default: broad but noisy; not desired for v1.
  - Strict raw-host matching with no normalization: can split equivalent content unnecessarily.

## Decision 4: URL count constraints

- **Decision**: Default requested count is 100; hard cap is 200 in v1 via configurable setting.
- **Rationale**: Balances usefulness with GitHub Pages resource limits and low-volume intent.
- **Alternatives considered**:
  - No cap: risk of long-running scans and poor UX.
  - Lower hard cap (e.g., 100): may under-serve larger accessibility audits.

## Decision 5: Caching and invalidation behavior

- **Decision**: Cache discovery artifacts in browser storage with explicit “Clear cache” control and forced refresh path.
- **Rationale**: Improves repeat-run responsiveness while preserving user control when data becomes stale.
- **Alternatives considered**:
  - No caching: predictable freshness but slower repeated scans.
  - Opaque cache only: faster but harder to troubleshoot stale results.

## Decision 6: GitHub Actions role

- **Decision**: Support optional GitHub Actions workflow to prefetch or refresh static discovery support files.
- **Rationale**: Allows lightweight periodic refresh without introducing runtime backend complexity.
- **Alternatives considered**:
  - No automation: simplest but requires manual refresh for any static source updates.
  - Full remote crawling pipeline: too heavy for MVP scope.

## Open items intentionally deferred

- Subdomain inclusion checkbox behavior and rollout policy (future release).
- Optional CSV/JSON export polish beyond baseline compatibility.