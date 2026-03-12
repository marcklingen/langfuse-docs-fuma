# Chapter 8 Issues

Automated evidence for this issue log is in `review/8-feedback-analytics-and-operational-integrations/evidence/`.

## Confirmed Regressions

### `[High]` FAQ pages lose the docs feedback footer in preview

- Evidence: `review/8-feedback-analytics-and-operational-integrations/evidence/docs-feedback.json` records a failing surface check for `/faq/all/langfuse-support`: the preview page keeps the copy-as-markdown button but does not render the `#docs-feedback` footer or the "Was this page helpful?" prompt. A production HTML fetch for the same URL still includes that footer.
- Likely cause: [`app/[section]/[[...slug]]/page.tsx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/[section]/[[...slug]]/page.tsx) renders FAQ pages through [`SectionDocBodyClient.tsx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/[section]/SectionDocBodyClient.tsx), which only injects the copy button. The feedback footer exists in [`components/MainContentWrapper.tsx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/components/MainContentWrapper.tsx) and [`components/SectionDocBodyClientWithDocsBody.tsx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/components/SectionDocBodyClientWithDocsBody.tsx), but FAQ routes do not use either path.
- Impact: the migration drops a live docs-quality feedback collection surface on FAQ pages, which breaks parity with production and weakens one of the explicit Chapter 8 launch checks.
- Proposed fix: route FAQ pages through the same body wrapper that renders `DocsFeedback` and `DocsSupport`, or add the footer to [`SectionDocBodyClient.tsx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/[section]/SectionDocBodyClient.tsx) when `withProse` is enabled.
- Status: open

### `[Medium]` The environment template is missing the Inkeep keys required by the deployed search and Ask AI surface

- Evidence: `review/8-feedback-analytics-and-operational-integrations/evidence/env-contract.json` shows `NEXT_PUBLIC_INKEEP_API_KEY` is referenced in [`components/inkeep/useInkeepSettings.ts`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/components/inkeep/useInkeepSettings.ts) and `INKEEP_BACKEND_API_KEY` is referenced in [`lib/inkeep-search.ts`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/inkeep-search.ts), but neither variable is documented in [`.env.template`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/.env.template).
- Likely cause: the migration-era env checklist was updated for PostHog, Plain, and QA-bot secrets, but not for the newer Inkeep-backed search stack.
- Impact: deployment readiness review is incomplete. A new environment can ship without the keys needed for search, Ask AI, or MCP-backed Inkeep retrieval, and that failure would not be obvious from the template alone.
- Proposed fix: add `NEXT_PUBLIC_INKEEP_API_KEY` and `INKEEP_BACKEND_API_KEY` to [`.env.template`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/.env.template) and to any deployment runbook used for the migration.
- Status: open

## Manual Follow-Up

- Live `/api/feedback` forwarding was not executed automatically because the runner keeps that check opt-in to avoid sending messages to a real webhook. Run the chapter with `ENABLE_FEEDBACK_API_POST=true` only after pointing the target deployment at a test sink.
- PostHog event parity for search and MCP remains a manual validation item. The automated run captured HubSpot and CookieYes successfully, but the PostHog event surface was left non-blocking by default because the same headless capture did not reliably observe those requests on the current production site either.
