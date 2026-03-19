# Chapter 8: Feedback, Analytics, and Operational Integrations

## Objective

Confirm that feedback collection, measurement, and related third-party integrations remain operational after the migration.

## Scope

- Static parity checks compare the old implementation in `/Users/marcklingen/repos/github/langfuse/langfuse-docs` against this repo.
- Live HTTP checks compare the current production site with the preview deployment.
- Controlled local checks run a local dev server with a test webhook sink so feedback forwarding and analytics emissions can be inspected safely.
- Manual browser QA covers the docs feedback widget flows and client-side network activity.

## Structure

- `plan.md`: checklist-to-test mapping for Chapter 8.
- `tests/run-feedback-analytics-review.mjs`: automated static, live, and controlled local checks.
- `manual/notes.md`: browser QA notes and checklist outcomes.
- `issues.md`: confirmed findings, severity, and proposed fixes.
- `artifacts/`: JSON reports produced by the automated runner.

## Runbook

Run the automated review from the repo root:

```bash
node review/8-feedback-analytics-and-operational-integrations/tests/run-feedback-analytics-review.mjs \
  --output review/8-feedback-analytics-and-operational-integrations/artifacts/review-report.json
```

The runner:

1. compares legacy and migrated source files for analytics/feedback parity
2. fetches representative production and preview pages to inspect loaded analytics scripts
3. starts a local webhook sink plus `pnpm dev`
4. exercises `/api/feedback`, `/api/search-docs`, and `/api/mcp`
5. writes a JSON report before exiting non-zero on failures

## Evidence Index

- Automated report:
  `review/8-feedback-analytics-and-operational-integrations/artifacts/review-report.json`
- Manual browser QA:
  `review/8-feedback-analytics-and-operational-integrations/manual/notes.md`
- Manual browser artifacts:
  `review/8-feedback-analytics-and-operational-integrations/artifacts/playwright/`
- Observed webhook payloads from the controlled feedback run:
  `review/8-feedback-analytics-and-operational-integrations/manual/feedback-sink-observed.jsonl`
