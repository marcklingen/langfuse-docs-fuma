# Chapter 5: Search Experience

## Objective

Confirm that on-site search remains usable, accurate, and aligned with the current docs workflow during the migration.

## Scope

- Run this chapter against the preview deployment by default.
- Use the current production site as the live baseline for expected search scopes and result groups.
- Cover desktop shortcut/search-modal behavior, representative queries, canonical result URLs, theme sync, and a mobile viewport pass.

## Structure

- `tests/run-search-review.mjs`: automated browser regression suite for preview vs production.
- `manual/notes.md`: manual QA notes and artifact index.
- `issues.md`: findings, severity, impact, and proposed fixes.
- `artifacts/`: JSON reports and screenshots captured during execution.

## Runbook

Run the Chapter 5 review:

```bash
node review/5-search-experience/tests/run-search-review.mjs \
  --base-url https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app \
  --production-url https://langfuse.com \
  --output review/5-search-experience/artifacts/preview-search-report.json
```

The script writes the JSON report before exiting non-zero if any checks fail.

## Evidence Index

- Automated search report:
  `review/5-search-experience/artifacts/preview-search-report.json`
- Desktop preview screenshot:
  `review/5-search-experience/artifacts/preview-search-dark.png`
- Desktop production baseline screenshot:
  `review/5-search-experience/artifacts/production-search-dark.png`
- Preview light-theme screenshot:
  `review/5-search-experience/artifacts/preview-search-light.png`
- Preview mobile screenshot:
  `review/5-search-experience/artifacts/preview-search-mobile.png`
- Manual QA notes:
  `review/5-search-experience/manual/notes.md`
