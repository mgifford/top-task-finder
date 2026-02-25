# Data Model: Accessible Top Task URL Finder

## Entity: ScanRequest

- **Description**: User-initiated request to generate representative URLs for a target domain.
- **Attributes**:
  - `request_id` (string) – unique identifier for the scan session.
  - `submitted_at` (datetime) – request timestamp.
  - `raw_input_url` (string) – exact user-provided domain/URL.
  - `canonical_host` (string) – normalized host used for discovery scope.
  - `requested_count` (integer) – user requested count (default 100).
  - `effective_count_limit` (integer) – active configurable cap (v1 default 200).
  - `include_subdomains` (boolean) – reserved for future release; false in v1.
  - `cache_mode` (enum) – `use-cache` | `bypass-cache`.

## Entity: CandidateUrl

- **Description**: Discovered URL candidate before final selection.
- **Attributes**:
  - `url` (string) – absolute canonicalized URL.
  - `normalized_key` (string) – dedupe key after normalization.
  - `host` (string) – resolved host for host-scope filtering.
  - `path` (string) – URL path component.
  - `source_type` (enum) – `sitemap` | `search` | `internal-link`.
  - `language_hint` (string) – inferred language tag or unknown.
  - `category_hint` (enum) – `homepage` | `search` | `accessibility` | `top-task` | `other`.
  - `discovered_at` (datetime) – timestamp discovered.

## Entity: UrlSelectionResult

- **Description**: Final selected URL list for user output.
- **Attributes**:
  - `request_id` (string) – source request link.
  - `selected_urls` (array<string>) – one URL per line ordered output.
  - `returned_count` (integer) – number of selected URLs.
  - `random_share_count` (integer) – count from random allocation.
  - `priority_coverage` (object) – counts by category.
  - `language_distribution` (object) – counts by language bucket.
  - `shortfall_count` (integer) – requested minus returned when insufficient.

## Entity: DiscoverySummary

- **Description**: User-visible summary of discovery process and cache state.
- **Attributes**:
  - `request_id` (string) – source request link.
  - `sources_attempted` (array<enum>) – discovery source attempts.
  - `fallback_used` (boolean) – whether internal-link fallback executed.
  - `cache_hit` (boolean) – whether cache was used.
  - `cache_cleared` (boolean) – whether user cleared cache for this run.
  - `warnings` (array<string>) – non-fatal discovery messages.

## Relationships

- `ScanRequest` 1→N `CandidateUrl`
- `ScanRequest` 1→1 `UrlSelectionResult`
- `ScanRequest` 1→1 `DiscoverySummary`

## Validation Rules

- `requested_count` must be integer within 1..`effective_count_limit`.
- `effective_count_limit` must default to 200 in v1 and be configurable.
- `url` entries must be unique by `normalized_key` in final output.
- `host` must match canonical host scope in v1, allowing normalized `www` equivalence.