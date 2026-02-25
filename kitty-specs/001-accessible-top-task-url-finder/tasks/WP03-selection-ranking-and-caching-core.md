---
work_package_id: "WP03"
subtasks:
  - "T011"
  - "T012"
  - "T013"
  - "T014"
  - "T015"
  - "T016"
title: "Selection Ranking and Caching Core"
phase: "Phase 3 - Selection Engine"
lane: "planned"
dependencies:
  - "WP02"
assignee: ""
agent: ""
shell_pid: ""
review_status: ""
reviewed_by: ""
history:
  - timestamp: "2026-02-25T20:40:48Z"
    lane: "planned"
    agent: "system"
    shell_pid: ""
    action: "Prompt generated via /spec-kitty.tasks"
---

# Work Package Prompt: WP03 - Selection Ranking and Caching Core

## Start Command

- `spec-kitty implement WP03 --base WP02`

## Objectives & Success Criteria

- Convert candidates into final representative list honoring priority categories and random share.
- Implement multilingual sampling and cache semantics required for repeated scans.

## Context & Constraints

- Must satisfy FR-005, FR-006, FR-007, FR-013, FR-018, FR-019.
- Keep subdomain expansion out of scope (future release only).

## Subtasks & Detailed Guidance

### Subtask T011 - Implement category heuristics
- **Purpose**: Identify high-value pages for accessibility-focused selection.
- **Steps**:
  1. Add heuristics for homepage/search/accessibility/top-task/other.
  2. Use URL patterns and lightweight title/path clues.
  3. Provide category tags per candidate.
- **Files**: `assets/js/selection.js`.
- **Parallel?**: No.
- **Notes**: Keep heuristics configurable and explainable.

### Subtask T012 - Implement multilingual sampling
- **Purpose**: Ensure primary language majority while sampling additional languages.
- **Steps**:
  1. Infer language buckets from path/query/hints.
  2. Select majority from primary/default language.
  3. Include non-primary examples when available.
- **Files**: `assets/js/selection.js`.
- **Parallel?**: Yes.
- **Notes**: Align with SC-005 and FR-007.

### Subtask T013 - Build final selection engine
- **Purpose**: Produce final ordered unique URL output.
- **Steps**:
  1. Allocate slots to priority categories first.
  2. Reserve approximately 20% for randomized selection.
  3. Fill remaining slots without duplicates until requested/effective count.
- **Files**: `assets/js/selection.js`.
- **Parallel?**: No.
- **Notes**: Record random-share count and shortfall count.

### Subtask T014 - Enforce count validation and config cap
- **Purpose**: Guarantee request bounds and maintainability.
- **Steps**:
  1. Validate count input as integer >=1.
  2. Clamp requested count to configured max cap.
  3. Emit user-facing message when cap is applied.
- **Files**: `assets/js/app.js`, `config/limits.json`.
- **Parallel?**: No.
- **Notes**: Preserve default of 100 when input omitted.

### Subtask T015 - Implement cache persistence and retrieval
- **Purpose**: Improve repeat-scan responsiveness.
- **Steps**:
  1. Store discovery/selection artifacts keyed by canonical host + count.
  2. Include timestamp and source metadata in cache record.
  3. Read and validate cache before running discovery.
- **Files**: `assets/js/cache.js`.
- **Parallel?**: Yes.
- **Notes**: Prefer browser storage APIs that are widely supported.

### Subtask T016 - Implement clear-cache and bypass behavior
- **Purpose**: Give explicit control over stale data.
- **Steps**:
  1. Add cache clearing utility by host/scope.
  2. Support bypass-cache execution path for forced fresh scan.
  3. Return cache status flags for UI display.
- **Files**: `assets/js/cache.js`, `assets/js/app.js`.
- **Parallel?**: No.
- **Notes**: Ensure clear-cache action is deterministic and visible.

## Risks & Mitigations

- Risk: unbalanced outputs due to over-randomization.
- Mitigation: deterministic priority-first allocation before random fill.

## Review Guidance

- Validate default 100 and cap 200 behavior.
- Validate multilingual and random-share requirements are both satisfied.

## Activity Log

- 2026-02-25T20:40:48Z – system – lane=planned – Prompt created.
