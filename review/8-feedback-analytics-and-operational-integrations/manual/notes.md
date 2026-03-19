# Manual QA Notes

## Environment

- Date: 2026-03-19
- Controlled local base URL: `http://127.0.0.1:3333`
- Reference preview URL: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- Browser: Playwright-driven Chromium
- Local env overrides:
  - `WEBSITE_FEEDBACK_WEBHOOK=http://127.0.0.1:4010/feedback-webhook`
  - `NEXT_PUBLIC_POSTHOG_HOST=http://127.0.0.1:4010`
  - `NEXT_PUBLIC_POSTHOG_KEY=chapter8-test-key`
  - `NEXT_PUBLIC_PLAIN_APP_ID=chapter8-plain-test`
  - `NEXT_PUBLIC_INKEEP_API_KEY=chapter8-inkeep-public-test`

## Page reviewed

- `/docs/observability/data-model`

## Checklist

- [x] "Was this page helpful?" is visible on the representative docs page
- [x] Positive feedback opens the follow-up dialog
- [x] Positive feedback can be submitted with an optional comment
- [x] Negative feedback opens the follow-up dialog
- [x] Negative feedback requires a comment before submission
- [x] Negative feedback can be submitted successfully
- [x] Browser network shows `/api/feedback` requests during the flow

## Findings

- The widget is present on the representative docs page. See `artifacts/playwright/positive-dialog.yml` and `artifacts/playwright/negative-dialog-disabled.yml`.
- Positive flow:
  - Clicking `Yes` opens the follow-up dialog with the prompt "What was most helpful?"
  - Submitting a comment returns the "Thank you for your feedback!" confirmation state.
  - The sink observed two webhook payloads for the positive path: the initial rating payload and the follow-up payload with the comment. See `manual/feedback-sink-observed.jsonl`.
- Negative flow:
  - Clicking `No` opens the Marc Klingen follow-up dialog.
  - The `Send feedback` button is disabled until text is entered.
  - After entering text, submission succeeds and the same thank-you confirmation appears.
  - The sink observed two webhook payloads for the negative path: the initial rating payload and the follow-up payload with the comment. See `manual/feedback-sink-observed.jsonl`.
- Browser network:
  - `artifacts/playwright/network.log` shows four successful `POST http://127.0.0.1:3333/api/feedback` requests across the positive and negative flows.
  - The log also shows failed requests to the local PostHog stub (`http://127.0.0.1:4010/...`) because the sink intentionally did not emulate PostHog CORS responses. This is expected for the test setup and is not treated as a product issue.
- Additional observation outside Chapter 8 scope:
  - `artifacts/playwright/console.log` shows Radix dialog accessibility warnings about missing `DialogTitle`/description in the feedback modal. This is relevant to Chapter 10 rather than being logged as a Chapter 8 finding.
