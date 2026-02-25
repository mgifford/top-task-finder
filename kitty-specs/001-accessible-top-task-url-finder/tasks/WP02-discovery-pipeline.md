---
work_package_id: WP02
title: Discovery Pipeline
lane: "doing"
dependencies:
- WP01
base_branch: 001-accessible-top-task-url-finder-WP01
base_commit: b4471152eda1f18702bfa48e828158fc89d45d08
created_at: '2026-02-25T21:08:50.979137+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
phase: Phase 2 - Source Discovery
assignee: ''
agent: ''
shell_pid: "29577"
review_status: ''
reviewed_by: ''
history:
- timestamp: '2026-02-25T20:40:48Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP02 - Discovery Pipeline

## Start Command

- `spec-kitty implement WP02 --base WP01`

## Objectives & Success Criteria

- Implement complete candidate discovery pipeline across sitemap, no-key search, and fallback links.
- Enforce canonical-host scope and produce traceable discovery summaries.

## Context & Constraints

- Must satisfy FR-004, FR-008, FR-009, FR-015, FR-016.
- Keep behavior resilient when one or more sources are sparse.

## Subtasks & Detailed Guidance

### Subtask T006 - Implement sitemap discovery
- **Purpose**: Provide primary source of site URLs.
- **Steps**:
  1. Fetch `/sitemap.xml` and detect sitemap index vs urlset.
  2. Parse nested sitemap files safely.
  3. Extract URL candidates and handoff to normalization stage.
- **Files**: `assets/js/discovery.js`.
- **Parallel?**: Yes.
- **Notes**: Guard against invalid XML and large but low-volume datasets.

### Subtask T007 - Implement no-key search discovery adapter
- **Purpose**: Supplement sitemap coverage using external search results.
- **Steps**:
  1. Define adapter for search result fetch/parsing without API key dependence.
  2. Normalize extracted URLs to canonical format.
  3. Return scored source metadata for diagnostics.
- **Files**: `assets/js/discovery.js`.
- **Parallel?**: Yes.
- **Notes**: Handle sparse/noisy results with warnings instead of hard failure.

### Subtask T008 - Implement homepage internal-link fallback
- **Purpose**: Ensure minimum coverage when sitemap/search are insufficient.
- **Steps**:
  1. Fetch canonical homepage.
  2. Extract anchor URLs and filter navigational duplicates.
  3. Return internal candidates for normalization.
- **Files**: `assets/js/discovery.js`.
- **Parallel?**: No.
- **Notes**: Keep traversal lightweight (homepage-only in v1).

### Subtask T009 - Normalize and deduplicate candidate URLs
- **Purpose**: Enforce canonical host scope and uniqueness.
- **Steps**:
  1. Apply host normalization and in-domain filtering.
  2. Exclude non-HTML-like resources and malformed entries.
  3. Build stable dedupe keys and eliminate duplicates.
- **Files**: `assets/js/discovery.js`.
- **Parallel?**: No.
- **Notes**: Preserve source provenance for summaries.

### Subtask T010 - Build discovery summary outputs
- **Purpose**: Provide user-visible and internal diagnostics.
- **Steps**:
  1. Track `sourcesAttempted`, `fallbackUsed`, and warnings.
  2. Emit normalized summary object for pipeline handoff.
  3. Ensure shortfall context is available to UI layer.
- **Files**: `assets/js/discovery.js`, `assets/js/app.js`.
- **Parallel?**: No.
- **Notes**: Avoid exposing low-level parser errors directly to users.

## Risks & Mitigations

- Risk: false positives from noisy search results.
- Mitigation: strict host/path normalization and warning flags.

## Review Guidance

- Validate fallback triggers only when primary sources are insufficient.
- Validate canonical host scope excludes out-of-scope URLs.

## Activity Log

- 2026-02-25T20:40:48Z – system – lane=planned – Prompt created.
