---
work_package_id: "WP01"
subtasks:
  - "T001"
  - "T002"
  - "T003"
  - "T004"
  - "T005"
title: "Foundation and Project Scaffolding"
phase: "Phase 1 - Foundation"
lane: "planned"
dependencies: []
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

# Work Package Prompt: WP01 - Foundation and Project Scaffolding

## Start Command

- `spec-kitty implement WP01`

## Objectives & Success Criteria

- Establish the static app skeleton described in plan artifacts.
- Provide shared constants/utilities for later work packages.
- Ensure max URL count handling is configurable and defaults correctly.

## Context & Constraints

- Reference: `kitty-specs/001-accessible-top-task-url-finder/spec.md` and `plan.md`.
- Keep architecture framework-free and GitHub Pages/Jekyll compatible.
- Host normalization utility must support canonical `www` and non-`www` equivalence.

## Subtasks & Detailed Guidance

### Subtask T001 - Create static scaffold and baseline files
- **Purpose**: Establish predictable file layout for downstream implementation.
- **Steps**:
  1. Create `index.md` as single-page shell.
  2. Create `assets/css/app.css` and `assets/js/{app.js,discovery.js,selection.js,cache.js}`.
  3. Create `config/limits.json` with configurable cap default.
- **Files**: `index.md`, `assets/css/app.css`, `assets/js/*.js`, `config/limits.json`.
- **Parallel?**: No.
- **Notes**: Keep markup minimal and accessible-ready.

### Subtask T002 - Implement shared constants and limit loader
- **Purpose**: Provide default and max count logic from config with safe fallback.
- **Steps**:
  1. Add constants for default count (100) and fallback max (200).
  2. Implement loader that reads cap from `config/limits.json` when available.
  3. Ensure failure to read config still applies fallback max.
- **Files**: `assets/js/app.js`, `config/limits.json`.
- **Parallel?**: Yes, after T001.
- **Notes**: Avoid hard-coding multiple conflicting values.

### Subtask T003 - Define request and result state models
- **Purpose**: Standardize in-memory structures for pipeline handoff.
- **Steps**:
  1. Implement objects matching `ScanRequest`, `DiscoverySummary`, and `UrlSelectionResult`.
  2. Ensure keys align with `data-model.md` and contract naming.
  3. Add simple validation helpers for required fields.
- **Files**: `assets/js/app.js`, `assets/js/selection.js`.
- **Parallel?**: Yes, after T001.
- **Notes**: Keep shapes serializable for cache storage.

### Subtask T004 - Implement input normalization utilities
- **Purpose**: Canonicalize domain input and scope to one host per run.
- **Steps**:
  1. Parse/normalize user input to absolute URL.
  2. Normalize `www`/non-`www` variants to canonical host.
  3. Expose helper that later modules use for in-domain checks.
- **Files**: `assets/js/discovery.js`, `assets/js/app.js`.
- **Parallel?**: No.
- **Notes**: Reject malformed URLs with user-friendly error payloads.

### Subtask T005 - Build baseline status and error messaging
- **Purpose**: Ensure every later module can surface actionable feedback.
- **Steps**:
  1. Add status banner/message region in `index.md`.
  2. Implement helper to render info/warning/error states.
  3. Ensure invalid input and discovery failures map to clear messages.
- **Files**: `index.md`, `assets/js/app.js`, `assets/css/app.css`.
- **Parallel?**: No.
- **Notes**: Use plain-language error copy.

## Risks & Mitigations

- Risk: inconsistent constants across modules.
- Mitigation: single config and shared accessor.

## Review Guidance

- Confirm file structure matches plan.
- Verify count defaults/cap behavior from config.
- Verify canonical host normalization exists and is reused.

## Activity Log

- 2026-02-25T20:40:48Z – system – lane=planned – Prompt created.
