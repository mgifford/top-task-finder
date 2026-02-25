---
work_package_id: "WP04"
subtasks:
  - "T017"
  - "T018"
  - "T019"
  - "T020"
  - "T021"
title: "One Page UI Flow and Clipboard UX"
phase: "Phase 4 - MVP User Flow"
lane: "planned"
dependencies:
  - "WP03"
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

# Work Package Prompt: WP04 - One Page UI Flow and Clipboard UX

## Start Command

- `spec-kitty implement WP04 --base WP03`

## Objectives & Success Criteria

- Deliver the complete one-page user flow from domain input to copyable editable output.
- Ensure cache status and clear-cache interactions are visible and understandable.

## Context & Constraints

- Must satisfy FR-001, FR-002, FR-010, FR-011, FR-014 and relevant quickstart scenarios.
- Keep interface minimal and accessible.

## Subtasks & Detailed Guidance

### Subtask T017 - Build one-page form and controls
- **Purpose**: Provide primary interaction surface.
- **Steps**:
  1. Add domain/URL field.
  2. Add number field with default handling.
  3. Add run action and basic status area.
- **Files**: `index.md`, `assets/css/app.css`.
- **Parallel?**: No.
- **Notes**: Label all controls clearly and keep tab order logical.

### Subtask T018 - Wire orchestration flow to UI events
- **Purpose**: Connect UI with discovery and selection modules.
- **Steps**:
  1. On submit, build validated `ScanRequest`.
  2. Run discovery + selection pipeline with async status updates.
  3. Handle success, shortfall, and failure outcomes.
- **Files**: `assets/js/app.js`.
- **Parallel?**: No.
- **Notes**: Prevent duplicate parallel submissions.

### Subtask T019 - Render editable one-URL-per-line output
- **Purpose**: Meet primary reuse behavior for accessibility workflows.
- **Steps**:
  1. Render final list into textarea one URL per line.
  2. Preserve user edits until next explicit generation run.
  3. Keep line formatting stable.
- **Files**: `index.md`, `assets/js/app.js`.
- **Parallel?**: Yes.
- **Notes**: Avoid automatic reformatting that alters user edits.

### Subtask T020 - Implement copy-to-clipboard action
- **Purpose**: Provide one-action handoff to downstream tools.
- **Steps**:
  1. Add copy button and keyboard-accessible trigger.
  2. Copy current textarea contents.
  3. Surface copy success/failure feedback.
- **Files**: `index.md`, `assets/js/app.js`.
- **Parallel?**: Yes.
- **Notes**: Copy should always use current edited state.

### Subtask T021 - Add cache controls and user feedback
- **Purpose**: Expose caching behavior transparently.
- **Steps**:
  1. Show whether current run used cache.
  2. Add bypass/force-refresh option in UI.
  3. Add clear-cache action and confirmation message.
- **Files**: `index.md`, `assets/js/app.js`, `assets/js/cache.js`.
- **Parallel?**: No.
- **Notes**: Keep cache controls simple and adjacent to run flow.

## Risks & Mitigations

- Risk: ambiguous UI state during async discovery.
- Mitigation: explicit loading, success, warning, and error states.

## Review Guidance

- Verify one-page flow works without page navigation.
- Verify copy uses edited textarea state.
- Verify clear-cache visibly affects next run.

## Activity Log

- 2026-02-25T20:40:48Z – system – lane=planned – Prompt created.
