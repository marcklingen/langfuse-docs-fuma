# Chapter 4 Findings

## High

### 1. Preview `/api/mcp` serves production markdown instead of preview markdown

- Evidence:
  - `review/4-ai-and-llm-facing-features/artifacts/preview-endpoint-report.json`
  - The failing check `MCP markdown retrieval matches the preview deployment markdown output`
- What failed:
  - `getLangfuseDocsPage('/docs/observability/data-model')` returned `_meta.url = https://langfuse.com/docs/observability/data-model.md`.
  - The returned markdown did not match the preview deployment's own `.md` endpoint.
  - First observed diff:
    - Preview `.md`: `title: Concepts`
    - MCP tool response: `title: Tracing Data Model in Langfuse`
- Impact:
  - Agents using the preview MCP server do not see the migrated preview content.
  - Chapter 4's contract check `MCP responses that depend on markdown retrieval still match the .md output` fails.
  - This also weakens migration QA because preview MCP verification is effectively pinned to production.
- Likely cause:
  - `lib/mcp-handler.ts` hardcodes `https://langfuse.com` for `getLangfuseDocsPage`.
- Proposed fix:
  - Derive the origin from the incoming request or an explicit environment variable for the current deployment.
  - Use that same-host origin for `getLangfuseDocsPage` and `getLangfuseOverview` so preview and production both resolve their local `llms.txt` and `.md` endpoints.
  - Keep an automated parity check for preview vs. MCP markdown in this chapter script.

### 2. `/api/md-to-pdf` returns `500` for an allowed Langfuse markdown source

- Evidence:
  - `review/4-ai-and-llm-facing-features/artifacts/preview-endpoint-report.json`
  - The failing check `/api/md-to-pdf succeeds for allowed Langfuse markdown inputs`
- What failed:
  - Request:
    - `/api/md-to-pdf?url=https://langfuse.com/security/dpa.md`
  - Expected:
    - `200`
    - `Content-Type: application/pdf`
  - Actual:
    - `500`
    - `{"error":"Internal server error while generating PDF","message":"An unexpected error occurred."}`
- Impact:
  - The PDF export endpoint is not functional on the preview deployment for valid, explicitly allowed inputs.
  - Chapter 4's `md-to-pdf` success path is currently broken.
- Likely cause:
  - The failure is happening after host validation and before a valid PDF response is emitted. The most likely areas are deployed Chromium/Puppeteer startup or the runtime packaging for the PDF route.
- Proposed fix:
  - Inspect the preview function logs for `app/api/md-to-pdf/route.ts`.
  - Verify Chromium resolution and Puppeteer launch in the deployed environment.
  - Add an automated smoke test for one allowed Langfuse markdown URL in CI or preview verification.

## Passed Checks

- `llms.txt` and the section sub-files are reachable.
- Docs `.md` endpoints return markdown with `X-Robots-Tag: noindex`.
- `Accept: text/markdown` negotiation matches the direct `.md` output.
- `/api/mcp` is reachable and exposes the expected three tools.
- `/api/search-docs` preserves its public response shape and wildcard CORS behavior.
- `/api/md-to-pdf` still rejects untrusted hosts with `400`.
- Manual UI checks passed for:
  - Copy/share UI visibility
  - Copy button success state
  - ChatGPT/Claude helper link generation
  - Install Docs MCP link target
  - Ask AI page shell load
