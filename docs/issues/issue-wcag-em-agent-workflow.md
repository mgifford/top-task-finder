# Add a GitHub Actions Workflow for Agent-Powered WCAG-EM Evaluation Project Setup

**Labels:** `enhancement`, `ai-agent`, `wcag-em`, `github-actions`

## Summary

The [GitHub Accessibility — Getting Started with Agents](https://accessibility.github.com/documentation/guide/getting-started-with-agents/) guide explains how agents are most powerful when they **automate multi-step workflows** that would otherwise require significant manual coordination. Top Task Finder already generates an excellent WCAG-EM page sample and even produces a structured LLM prompt (`assets/prompts/wcag-em-prompt.txt`) for refining that sample. However, once a user has their URL list, the next step — **setting up a structured WCAG-EM evaluation project** — is entirely manual: opening a spreadsheet, creating tracking issues, assigning pages to evaluators, and mapping pages to WCAG success criteria.

This issue proposes a new GitHub Actions workflow (`wcag-em-project-setup.yml`) that accepts a URL list as input and uses a Copilot coding agent to automatically scaffold a complete, ready-to-use WCAG-EM evaluation project as a set of linked GitHub Issues.

## Problem

After generating a representative URL sample with Top Task Finder, accessibility evaluators must manually:

1. Distribute pages across team members.
2. Create tracking issues or spreadsheet rows for each WCAG criterion × page combination.
3. Write up the evaluation scope, procedures, and conformance target.
4. Set up a results aggregation structure.

This overhead is high enough that many teams skip the structured WCAG-EM process entirely and fall back to informal per-page reviews, which are harder to defend and less reproducible. The gap between "I have a URL list" and "my team has an organised evaluation project" is the biggest friction point in adopting WCAG-EM.

## Proposed Solution

### Workflow: `wcag-em-project-setup.yml`

Add a new manually-triggered (`workflow_dispatch`) GitHub Actions workflow:

```yaml
name: WCAG-EM Evaluation Project Setup

on:
  workflow_dispatch:
    inputs:
      url_list:
        description: 'Newline-separated list of URLs to evaluate (paste from Top Task Finder output)'
        required: true
        type: string
      site_name:
        description: 'Human-readable site name (e.g. "GSA.gov")'
        required: true
        type: string
      conformance_target:
        description: 'Target conformance level'
        required: true
        default: 'WCAG 2.1 Level AA'
        type: choice
        options:
          - 'WCAG 2.1 Level A'
          - 'WCAG 2.1 Level AA'
          - 'WCAG 2.1 Level AAA'
          - 'WCAG 2.2 Level AA'
```

### What the Agent Does

Once triggered, a Copilot coding agent (or equivalent GitHub Actions step using the GitHub REST API) performs the following steps:

**Step 1 — Create the Evaluation Scope Issue**

Opens a parent issue titled `[WCAG-EM] {site_name} — Evaluation Scope` with:
- Conformance target
- Evaluation scope (domain, in-scope/out-of-scope pages)
- Structured URL sample (pasted from input)
- Links to the WCAG-EM methodology and this tool

**Step 2 — Create Page-Type Sub-Issues**

Groups the provided URLs by inferred page type (homepage, forms, search, policy, news, contact, etc.) and creates one sub-issue per group titled `[WCAG-EM] {site_name} — {Page Type} Pages`. Each sub-issue contains:
- The list of URLs for that page type
- A pre-filled testing checklist of the most relevant WCAG 2.x criteria for that page type (e.g. form pages get 1.3.1, 1.3.5, 2.4.6, 3.3.1, 3.3.2; media pages get 1.2.x criteria)
- Space to record findings per criterion

**Step 3 — Create an Aggregated Results Issue**

Opens a summary issue titled `[WCAG-EM] {site_name} — Conformance Results` with:
- A results table template (criterion | pages tested | result | notes)
- Links back to each page-type sub-issue
- Instructions for completing the WCAG-EM conformance report

**Step 4 — Apply Labels**

Creates (if not present) and applies `wcag-em`, `accessibility-audit`, and `{conformance_target}` labels to all created issues.

### Why This Is Uniquely Suited to an Agent

- The task involves **structured, repetitive content generation** (one issue per page type, consistent format) — ideal for AI agents.
- The agent can **infer page types from URLs** using the same patterns already in `discovery.js` (`PRIORITY_SIGNALS`), avoiding hallucination.
- The output is **GitHub Issues** — a medium that supports collaboration, assignment, commenting, and progress tracking without requiring external tools.
- The workflow reuses the **existing `wcag-em-prompt.txt`** concepts but operationalizes them as tracked work items rather than a one-shot clipboard prompt.

## Acceptance Criteria

- [ ] New workflow file `.github/workflows/wcag-em-project-setup.yml` is created.
- [ ] Workflow is `workflow_dispatch`-only with inputs for URL list, site name, and conformance target.
- [ ] Triggering the workflow with a sample URL list creates at least: (a) a scope issue, (b) one or more page-type sub-issues, and (c) a results aggregation issue.
- [ ] Each sub-issue includes a criterion checklist relevant to the page type (not a generic dump of all WCAG criteria).
- [ ] Labels `wcag-em` and `accessibility-audit` are created automatically if absent and applied to all created issues.
- [ ] The workflow uses the GitHub REST API via `${{ secrets.GITHUB_TOKEN }}` — no additional secrets required.
- [ ] A brief `docs/wcag-em-agent-workflow.md` explains how to trigger the workflow and what to expect.
- [ ] The existing `Copy Prompt for LLM` button in the UI includes a note pointing to this workflow as an alternative for GitHub-based teams.

## Out of Scope

- Automated WCAG testing (axe, pa11y) — this workflow is for **manual** WCAG-EM evaluation project setup.
- Generating the URL sample — Top Task Finder already does this; the workflow accepts the output as input.
- Multi-repo or cross-organisation setups.

## References

- [GitHub Accessibility — Getting Started with Agents](https://accessibility.github.com/documentation/guide/getting-started-with-agents/)
- [WCAG-EM Overview (W3C)](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/)
- [`assets/prompts/wcag-em-prompt.txt`](../../assets/prompts/wcag-em-prompt.txt) — existing WCAG-EM LLM prompt
- [`assets/js/local-ai.js`](../../assets/js/local-ai.js) — existing on-device AI integration
- [`assets/js/discovery.js`](../../assets/js/discovery.js) — `PRIORITY_SIGNALS` pattern for page-type inference
- [`config/cache-targets.json`](../../config/cache-targets.json) — example of structured input config pattern
