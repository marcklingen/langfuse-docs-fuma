# Chapter 8 Plan: Feedback, Analytics, and Operational Integrations

## Objective

Confirm that measurement, feedback collection, and related external integrations remain operational after the migration.

## Target environments

- Controlled local run: `http://127.0.0.1:3333`
- Preview deployment: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- Production baseline: `https://langfuse.com`
- Legacy code baseline: `/Users/marcklingen/repos/github/langfuse/langfuse-docs`

## Representative surfaces

- Docs feedback widget: `/docs/observability/data-model`
- Public docs search API: `/api/search-docs`
- Docs MCP API: `/api/mcp`
- Root layout analytics shell: homepage/docs HTML in production and preview
- Cloud redirect journey for UTM preservation: `/cloud/...`

## Verification approach

### Automated checks

Run [`tests/run-feedback-analytics-review.mjs`](./tests/run-feedback-analytics-review.mjs) to validate:

- feedback webhook forwarding from `/api/feedback` using a controlled local sink
- presence of both positive and negative feedback payloads
- server-side analytics parity for `/api/search-docs` and `/api/mcp`
- live production vs preview analytics script loading
- absence of preview/staging domains in the inspected HTML/script URLs
- environment-variable coverage for active analytics/search integrations
- source parity for legacy-vs-migrated analytics hooks

Artifacts written by the script:

- [`artifacts/review-report.json`](./artifacts/review-report.json)

### Manual browser walkthrough

Use Playwright against the controlled local run to verify:

- the "Was this page helpful?" widget is visible on a representative docs page
- the positive flow opens the follow-up dialog and allows optional submission
- the negative flow opens the follow-up dialog and requires a comment before submission
- the browser emits client-side feedback requests as expected

Record results in:

- [`manual/notes.md`](./manual/notes.md)

## Checklist mapping

| Checklist item | Verification |
| --- | --- |
| Widget still appears where expected | Live docs page HTML check + manual browser walkthrough |
| Positive and negative feedback flows still work | Controlled local API probe + manual browser walkthrough |
| `/api/feedback` forwards payloads correctly | Controlled local webhook sink |
| Analytics scripts still load in intended environments | Production vs preview HTML/script inspection |
| Key analytics events still fire for search/MCP/feedback if required | Static parity check + controlled local event probe |
| UTM parameters survive key journeys | Code-path audit of `/cloud/...` redirect handling |
| No analytics/feedback requests target staging/missing endpoints | HTML/script inspection + local sink capture |
| Required env vars are present for kept features | `.env.template` audit against code references |
