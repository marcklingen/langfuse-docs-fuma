# Chapter 8 Issues

## Findings

### P2: `/api/search-docs` no longer emits the legacy `docs_search:query` PostHog event

Evidence:

- The old implementation tracks `docs_search:query` in [`/Users/marcklingen/repos/github/langfuse/langfuse-docs/pages/api/search-docs.ts`](/Users/marcklingen/repos/github/langfuse/langfuse-docs/pages/api/search-docs.ts).
- The migrated route [`/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/api/search-docs/route.ts`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/api/search-docs/route.ts) no longer instantiates `posthog-node` or calls `capture`.
- The automated Chapter 8 report in [`/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/8-feedback-analytics-and-operational-integrations/artifacts/review-report.json`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/8-feedback-analytics-and-operational-integrations/artifacts/review-report.json) fails both the static parity check and the controlled local runtime probe for this event.

Impact:

- Any dashboards, alerts, or attribution flows that relied on `docs_search:query` lose continuity after the migration.

Proposed fix:

- Reintroduce the old server-side `posthog-node` capture in [`/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/api/search-docs/route.ts`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/api/search-docs/route.ts), preserving the legacy event name and property shape unless there is an approved analytics migration plan.

### P2: The migrated app shell dropped the legacy Google Tag Manager integration

Evidence:

- The legacy app shell includes `<GoogleTagManager gtmId="GTM-NGLK4TZX" />` in [`/Users/marcklingen/repos/github/langfuse/langfuse-docs/pages/_app.tsx`](/Users/marcklingen/repos/github/langfuse/langfuse-docs/pages/_app.tsx).
- The migrated root layout [`/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/layout.tsx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/layout.tsx) keeps HubSpot and CookieYes but has no GTM equivalent.
- This is flagged in the Chapter 8 automated report at [`/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/8-feedback-analytics-and-operational-integrations/artifacts/review-report.json`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/8-feedback-analytics-and-operational-integrations/artifacts/review-report.json).

Impact:

- GTM-based marketing, attribution, or conversion tracking will stop on the migrated site unless it was intentionally retired and replaced.

Proposed fix:

- Either restore the GTM integration in [`/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/layout.tsx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/layout.tsx) or document the planned replacement and confirm downstream stakeholders have migrated off GTM.

### P3: `.env.template` does not document the Inkeep variables required by active search/Ask AI integrations

Evidence:

- The frontend search/chat integration reads `NEXT_PUBLIC_INKEEP_API_KEY` in [`/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/components/inkeep/useInkeepSettings.ts`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/components/inkeep/useInkeepSettings.ts).
- The server-side docs search route depends on `INKEEP_BACKEND_API_KEY` in [`/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/inkeep-search.ts`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/inkeep-search.ts).
- Neither variable is present in [`/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/.env.template`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/.env.template), and the Chapter 8 report flags both as missing.

Impact:

- Fresh deployments or environment recreations can silently lose search and Ask AI functionality even though the integration is still active in code.

Proposed fix:

- Add `NEXT_PUBLIC_INKEEP_API_KEY` and `INKEEP_BACKEND_API_KEY` to [`/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/.env.template`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/.env.template) and to any deployment readiness docs that describe required environment variables.

## Severity scale

- `P1`: launch blocker or major operational regression
- `P2`: significant regression that breaks analytics/feedback parity or deployment readiness
- `P3`: minor operational gap or documentation issue
