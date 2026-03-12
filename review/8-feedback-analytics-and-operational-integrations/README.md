# Chapter 8: Feedback, Analytics, and Operational Integrations

## Review objective

Confirm that measurement, feedback collection, and related external integrations remain operational after the migration.

## Scope

This chapter covers:

- Docs feedback widget presence across representative docs, guides, FAQ, changelog, and wide marketing pages, plus a negative-control page where the widget should not render.
- Positive and negative feedback-dialog flows, with intercepted `/api/feedback` requests so the UI can be validated safely without mutating a live webhook.
- Production-build analytics surfaces that should remain present on the deployed site: HubSpot, CookieYes, and PostHog client events emitted from pageview and copy-as-markdown interactions.
- A representative UTM-retention journey through the cloud region selector, which explicitly preserves query parameters and hash fragments in client-side navigation.
- A repository-backed environment-variable contract for feedback, PostHog, Inkeep, and optional support-chat integrations.

This chapter does not own search relevance, MCP protocol correctness, or the broader Ask AI/search UX. Those remain in Chapters 4 and 5. It only verifies the analytics and operational wiring around those features when parity is required.

## How to run

```bash
node review/8-feedback-analytics-and-operational-integrations/tests/run-feedback-ops-review.mjs
```

Optional environment variables:

- `BASE_URL` defaults to `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- `OUTPUT_DIR` defaults to `review/8-feedback-analytics-and-operational-integrations/evidence`
- `HEADLESS` defaults to `true`
- `EXPECT_PRODUCTION_SCRIPTS` defaults to `true` for non-local `BASE_URL` values, otherwise `false`
- `EXPECT_ANALYTICS_EVENTS` defaults to `false`
- `ENABLE_FEEDBACK_API_POST` defaults to `false`
- `FEEDBACK_EXPECT_SUCCESS` defaults to `true`

The browser flow stubs `/api/feedback` responses so the feedback UX can be exercised safely on preview or production-like environments. Enable the live API POST only when the target environment points at a test webhook sink.

## Evidence produced

The runner writes:

- `summary.md` for the reviewer-facing result summary
- `summary.json` for the machine-readable summary
- `docs-feedback.json` for widget-surface checks and positive/negative dialog-flow assertions
- `analytics-surface.json` for HubSpot, CookieYes, and PostHog request capture
- `feedback-api.json` for the opt-in live `/api/feedback` check
- `utm-retention.json` for the cloud-region redirect query/hash preservation test
- `env-contract.json` for the required and optional environment-variable manifest
- `screenshots/positive-feedback-dialog.png` for the positive follow-up dialog
- `screenshots/negative-feedback-dialog.png` for the negative follow-up dialog

## Checklist mapping

| Checklist item | Evidence | Method |
| --- | --- | --- |
| "Was this page helpful?" still appears where expected | `docs-feedback.json` | Load representative routes and assert the feedback footer renders on intended page types while staying absent on a blog negative-control page |
| Positive and negative feedback flows still work | `docs-feedback.json`, screenshots | Intercept `/api/feedback`, drive both dialog flows in the browser, and validate payload shape plus thank-you state |
| `/api/feedback` still forwards payloads correctly to the configured webhook | `feedback-api.json`, `manual/notes.md` | Optional live POST against an environment wired to a test sink; browser automation only validates request shape safely |
| Analytics scripts still load in intended environments | `analytics-surface.json` | Capture network requests for HubSpot and CookieYes on a production-style deployment |
| Key analytics events still fire if parity is required | `analytics-surface.json`, `manual/notes.md` | Record the observed third-party request surface automatically, then validate PostHog, Inkeep search, and MCP events manually or by rerunning with `EXPECT_ANALYTICS_EVENTS=true` in an environment where those requests are observable |
| UTM parameters survive key user journeys | `utm-retention.json` | Drive the cloud region selector and assert the redirected URL preserves query parameters and hash |
| No analytics or feedback requests point at staging or missing endpoints | `analytics-surface.json`, `feedback-api.json` | Record observed request hosts and optional live API status for reviewer inspection |
| Required environment variables are present for kept features | `env-contract.json`, `manual/notes.md` | Generate the code-backed env contract and compare it against the target deployment configuration |

## Files in this chapter

- [tests/run-feedback-ops-review.mjs](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/8-feedback-analytics-and-operational-integrations/tests/run-feedback-ops-review.mjs)
- [manual/notes.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/8-feedback-analytics-and-operational-integrations/manual/notes.md)
- [issues.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/8-feedback-analytics-and-operational-integrations/issues.md)
