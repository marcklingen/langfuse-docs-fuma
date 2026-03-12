# Chapter 4 Issues

## High: Preview `md-to-pdf` export fails for an allowlisted Langfuse markdown URL

- Environment: preview deployment
- Evidence: `review/4-ai-and-llm-facing-features/evidence/md-to-pdf.json`
- Observed behavior: `GET /api/md-to-pdf?url=https://langfuse.com/docs/observability/overview.md` returns `500` on preview, while the same request returns `200` with `application/pdf` on production.
- Why it matters: this is an explicit Chapter 4 contract surface and currently prevents reviewers from validating PDF export parity before rollout.
- Suggested fix: determine why the preview runtime cannot complete PDF generation for allowlisted inputs even though production can. The failure is likely in the Chromium/Puppeteer execution path or preview runtime packaging rather than the allowlist logic, because blocked-host validation still returns the expected `400`.

## Medium: Preview MCP markdown retrieval is hardcoded to production and can hide migration regressions

- Environment: preview deployment
- Evidence: `review/4-ai-and-llm-facing-features/evidence/mcp.json`
- Observed behavior: `getLangfuseDocsPage` returns markdown from `https://langfuse.com/...` instead of from the currently deployed host. On preview, the returned markdown does not exactly match the preview `.md` endpoint for the same page.
- Why it matters: Chapter 4 specifically needs preview MCP responses to exercise the migrated markdown surfaces. Hardcoding the production host means preview MCP validation can pass even when the preview markdown output differs from production.
- Suggested fix: derive the markdown base URL from the current request host or from an explicit environment variable for the deployment being tested, then compare the result against the current deployment rather than always calling `https://langfuse.com`.
