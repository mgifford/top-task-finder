---
work_package_id: "WP05"
subtasks:
  - "T022"
  - "T023"
  - "T024"
  - "T025"
title: "Optional Exports and Contract Alignment"
phase: "Phase 5 - Extended Output"
lane: "planned"
dependencies:
  - "WP04"
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

# Work Package Prompt: WP05 - Optional Exports and Contract Alignment

## Start Command

- `spec-kitty implement WP05 --base WP04`

## Objectives & Success Criteria

- Add optional JSON/CSV exports from current editable results.
- Validate implementation behavior against contract and quickstart acceptance scenarios.

## Context & Constraints

- Exports are optional (SHOULD), not blockers for MVP flow.
- Exported files must reflect current textarea content.

## Subtasks & Detailed Guidance

### Subtask T022 - Add JSON export
- **Purpose**: Provide structured data handoff format.
- **Steps**:
  1. Add export control in UI.
  2. Serialize current textarea lines into JSON array/object format.
  3. Trigger browser download with stable filename convention.
- **Files**: `index.md`, `assets/js/app.js`.
- **Parallel?**: Yes.

### Subtask T023 - Add CSV export
- **Purpose**: Provide spreadsheet-friendly handoff format.
- **Steps**:
  1. Add export control in UI.
  2. Convert current textarea lines into single-column CSV.
  3. Trigger browser download with stable filename convention.
- **Files**: `index.md`, `assets/js/app.js`.
- **Parallel?**: Yes.

### Subtask T024 - Align runtime payloads with contract
- **Purpose**: Keep implementation schema-consistent with `url-selection.openapi.yaml`.
- **Steps**:
  1. Map request/response object fields to contract keys.
  2. Verify required keys and field types in generated outputs.
  3. Record any justified deviations and reconcile if needed.
- **Files**: `assets/js/app.js`, `contracts/url-selection.openapi.yaml`.
- **Parallel?**: No.

### Subtask T025 - Run quickstart conformance checks
- **Purpose**: Validate planned scenarios as pre-handoff quality gate.
- **Steps**:
  1. Execute all `quickstart.md` scenarios manually.
  2. Capture pass/fail notes and remediate gaps.
  3. Confirm shortfall, cap, cache, and host normalization flows.
- **Files**: `quickstart.md` (verification), implementation files as needed.
- **Parallel?**: No.

## Risks & Mitigations

- Risk: export data diverges from visible textarea edits.
- Mitigation: export directly from textarea state at click time.

## Review Guidance

- Confirm both export formats and file content correctness.
- Confirm quickstart scenarios are reproducible.

## Activity Log

- 2026-02-25T20:40:48Z – system – lane=planned – Prompt created.
