---
description: "Work package task list for Accessible Top Task URL Finder"
---

# Work Packages: Accessible Top Task URL Finder

**Inputs**: Design documents from `/kitty-specs/001-accessible-top-task-url-finder/`  
**Prerequisites**: `plan.md` (required), `spec.md`, `research.md`, `data-model.md`, `contracts/url-selection.openapi.yaml`, `quickstart.md`

**Tests**: No dedicated automated test framework is mandated in the specification; include manual validation and contract conformance checks in each WP.

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently reviewable and uses a matching prompt file in `/tasks/`.

## Subtask Format: `[Txxx] [P?] Description`
- **[P]** indicates the subtask can proceed in parallel (different files/components).

## Path Conventions
- Static app shell: `index.md`
- Frontend assets: `assets/css/`, `assets/js/`
- Configurable limits: `config/limits.json`
- Optional automation: `.github/workflows/`

---

## Work Package WP01: Foundation & Project Scaffolding (Priority: P0)

**Goal**: Establish the one-page app scaffold, config, and baseline utility contracts used by all downstream work.  
**Independent Test**: Static page loads with placeholder controls, shared JS modules import correctly, and configurable max count is available to runtime code.  
**Prompt**: `/tasks/WP01-foundation-and-project-scaffolding.md`  
**Estimated Prompt Size**: ~320 lines

### Included Subtasks
- [ ] T001 Create static project structure and baseline files (`index.md`, `assets/css/app.css`, `assets/js/*.js`, `config/limits.json`)
- [ ] T002 Implement shared app constants and limit loading logic (default=100, max from config with fallback=200)
- [ ] T003 Implement request/state model objects (`ScanRequest`, `DiscoverySummary`, `UrlSelectionResult`)
- [ ] T004 Add URL/domain input normalization utility with canonical `www`/non-`www` host handling
- [ ] T005 Add baseline error rendering and status messaging utility used by later modules

### Implementation Notes
- Keep structure Jekyll/GitHub Pages friendly.
- Keep global state minimal and module boundaries explicit.

### Parallel Opportunities
- T002 and T003 can proceed in parallel after T001.

### Dependencies
- None.

### Risks & Mitigations
- Risk: malformed normalization rules causing host drift.  
  Mitigation: centralize host normalization in one utility and reuse everywhere.

---

## Work Package WP02: Discovery Pipeline (Priority: P1)

**Goal**: Build candidate URL discovery from sitemap/search sources with homepage fallback and in-domain filtering.  
**Independent Test**: Given a domain, discovery returns deduplicated candidate URLs and indicates when fallback is used.  
**Prompt**: `/tasks/WP02-discovery-pipeline.md`  
**Estimated Prompt Size**: ~360 lines

### Included Subtasks
- [ ] T006 Implement sitemap discovery parser (XML sitemap and sitemap index support)
- [ ] T007 Implement no-key search discovery adapter and result normalization
- [ ] T008 Implement homepage fetch and lightweight internal-link fallback extraction
- [ ] T009 Implement candidate URL normalization, dedupe keying, and canonical host scope filtering
- [ ] T010 Implement discovery summary assembly (`sourcesAttempted`, `fallbackUsed`, warnings)

### Implementation Notes
- Treat non-HTML and out-of-scope URLs as filtered candidates with warning counts.
- Ensure v1 host scope enforces canonical host only.

### Parallel Opportunities
- T006 and T007 are parallel-safe after shared utilities from WP01.

### Dependencies
- Depends on WP01.

### Risks & Mitigations
- Risk: discovery failure due to partial sources.  
  Mitigation: deterministic fallback path and explicit shortfall messaging.

---

## Work Package WP03: Selection, Ranking, and Caching Core (Priority: P1)

**Goal**: Turn candidates into final representative URL lists with category priorities, multilingual sampling, random share, and cache controls.  
**Independent Test**: Candidate sets produce stable final lists honoring requested count, 20% random allocation target, and cache bypass/clear behavior.  
**Prompt**: `/tasks/WP03-selection-ranking-and-caching-core.md`  
**Estimated Prompt Size**: ~390 lines

### Included Subtasks
- [ ] T011 Implement page categorization heuristics (homepage/search/accessibility/top-task/other)
- [ ] T012 Implement multilingual sampling strategy (primary-language majority + non-primary sampling)
- [ ] T013 Implement final selection engine with dedupe and ~20% random share allocation
- [ ] T014 Implement requested count validation (default 100, configurable max cap enforcement)
- [ ] T015 Implement browser cache store/load semantics and stale handling metadata
- [ ] T016 Implement explicit cache clear and bypass-cache flows

### Implementation Notes
- Selection engine should preserve deterministic behavior for non-random portion.
- Random allocation may vary slightly when candidate pool is constrained.

### Parallel Opportunities
- T011 and T015 can run in parallel before being integrated by T013.

### Dependencies
- Depends on WP02.

### Risks & Mitigations
- Risk: random allocation overwhelms priority pages on small pools.  
  Mitigation: fill priority buckets first, then random allocation from remaining candidates.

---

## Work Package WP04: One-Page UI Flow and Clipboard UX (Priority: P1) 🎯 MVP

**Goal**: Implement complete one-page user journey from input to editable URL list with copy action and clear user feedback.  
**Independent Test**: User can submit domain/count, observe progress/errors, edit one-URL-per-line output, and copy results successfully.  
**Prompt**: `/tasks/WP04-one-page-ui-flow-and-clipboard-ux.md`  
**Estimated Prompt Size**: ~350 lines

### Included Subtasks
- [ ] T017 Build accessible one-page form UI with required domain/count fields and submit action
- [ ] T018 Wire orchestration flow (`ScanRequest` -> discovery -> selection -> render)
- [ ] T019 Implement editable one-URL-per-line textarea rendering and persistence during session
- [ ] T020 Implement copy-to-clipboard control and success/failure feedback states
- [ ] T021 Implement cache-state UX (show cache use, bypass option, clear-cache control)

### Implementation Notes
- Keep UI minimal and keyboard-friendly.
- Error messages must be user-facing and actionable.

### Parallel Opportunities
- T019 and T020 can proceed in parallel once base page structure is in place.

### Dependencies
- Depends on WP03.

### Risks & Mitigations
- Risk: poor UX around stale cache confusion.  
  Mitigation: expose cache status and explicit clear-cache action in primary flow.

---

## Work Package WP05: Optional Exports and Contract Alignment (Priority: P2)

**Goal**: Add optional CSV/JSON export support and align implementation behavior with contract and quickstart checks.  
**Independent Test**: Current textarea contents can be exported to CSV/JSON files and outputs match generated/edit state.  
**Prompt**: `/tasks/WP05-optional-exports-and-contract-alignment.md`  
**Estimated Prompt Size**: ~280 lines

### Included Subtasks
- [ ] T022 Implement JSON export from current editable list state
- [ ] T023 Implement CSV export from current editable list state
- [ ] T024 Validate runtime payload and response objects against `contracts/url-selection.openapi.yaml`
- [ ] T025 Add manual conformance checks for all `quickstart.md` scenarios

### Implementation Notes
- Exports should reflect current textarea (post-edit) rather than initial raw generation only.

### Parallel Opportunities
- T022 and T023 are parallel-safe.

### Dependencies
- Depends on WP04.

### Risks & Mitigations
- Risk: divergence between displayed list and downloaded list.  
  Mitigation: single source of truth from editable textarea state.

---

## Work Package WP06: GitHub Pages Delivery, Automation, and Docs (Priority: P2)

**Goal**: Finalize deployment hardening for GitHub Pages and add optional GitHub Actions refresh workflow with maintainer guidance.  
**Independent Test**: Site builds on GitHub Pages, optional workflow runs without breaking default UX, and docs explain config/caching operations.  
**Prompt**: `/tasks/WP06-github-pages-delivery-automation-and-docs.md`  
**Estimated Prompt Size**: ~300 lines

### Included Subtasks
- [ ] T026 Finalize Jekyll/GitHub Pages compatibility for static one-page deployment
- [ ] T027 Add optional `.github/workflows/refresh-sources.yml` for scheduled/manual resource refresh
- [ ] T028 Add maintainer documentation for configurable URL cap and cache behavior
- [ ] T029 Add release notes section for deferred subdomain checkbox future work

### Implementation Notes
- Keep Actions workflow optional and non-blocking for local development.

### Parallel Opportunities
- T027 and T028 can proceed in parallel.

### Dependencies
- Depends on WP05.

### Risks & Mitigations
- Risk: over-automation for a simple app.  
  Mitigation: isolate workflow as optional helper; keep runtime fully static.

---

## Dependency & Execution Summary

- **Sequence**: WP01 -> WP02 -> WP03 -> WP04 -> WP05 -> WP06
- **Parallelization**:
  - Intra-WP: multiple [P] subtasks in WP02/WP03/WP05/WP06
  - Inter-WP: sequential due to logical pipeline dependencies
- **MVP Scope**: WP01 through WP04 (foundational + discovery + selection/caching + core one-page UX)

---

## Subtask Index (Reference)

| Subtask ID | Summary | Work Package | Priority | Parallel? |
|------------|---------|--------------|----------|-----------|
| T001 | Create static project scaffold | WP01 | P0 | No |
| T006 | Build sitemap discovery parser | WP02 | P1 | Yes |
| T011 | Implement category heuristics | WP03 | P1 | No |
| T017 | Build one-page form UI | WP04 | P1 | No |
| T022 | Add JSON export | WP05 | P2 | Yes |
| T027 | Add optional refresh workflow | WP06 | P2 | Yes |
