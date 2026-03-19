# Manual QA Notes

## Environment

- Target: preview deployment
- Reviewer: Codex
- Date: 2026-03-19
- Browser automation: Playwright CLI (`chapter4` session)

## Checks

- `/docs/docs-mcp`
  - The `Copy page` control is visible above the H1.
  - Clicking the primary copy button transitions it to the `Copied!` state.
  - The clipboard could not be read back in automation because browser clipboard read permission was denied, but the UI completed the success state rather than surfacing an error.
  - The dropdown exposes all expected actions:
    - `Copy page`
    - `Open in ChatGPT`
    - `Open in Claude`
    - `Install Docs MCP server`
- Helper links on `/docs/docs-mcp`
  - ChatGPT helper points to:
    `https://chatgpt.com/?hints=search&q=Read%20from%20https%3A%2F%2Flangfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app%2Fdocs%2Fdocs-mcp.md%20so%20I%20can%20ask%20questions%20about%20it.`
  - Claude helper points to:
    `https://claude.ai/new?q=Read%20from%20https%3A%2F%2Flangfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app%2Fdocs%2Fdocs-mcp.md%20so%20I%20can%20ask%20questions%20about%20it.`
  - `Install Docs MCP server` points to the docs page on the preview deployment:
    `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app/docs/docs-mcp`
- Copy UI coverage sweep
  - Representative pages across all intended sections contained the `Copy page` UI in the rendered HTML:
    - `/docs/docs-mcp`
    - `/self-hosting/deployment/docker-compose`
    - `/guides/videos/introducing-datasets-v2`
    - `/faq/all/unwanted-http-database-spans`
    - `/integrations/no-code/goose`
    - `/handbook`
    - `/security/dpa`
    - `/library`
- `/docs/ask-ai`
  - The page loads successfully with H1 `Ask AI`.
  - The embedded chat shell renders with:
    - Intro assistant message
    - Example question buttons
    - Input textbox and disabled send button
    - `Powered by inkeep` footer treatment

## Evidence

- Automated endpoint report:
  - `review/4-ai-and-llm-facing-features/artifacts/preview-endpoint-report.json`
- Screenshots:
  - `review/4-ai-and-llm-facing-features/artifacts/docs-mcp-copy-ui.png`
  - `review/4-ai-and-llm-facing-features/artifacts/ask-ai-preview.png`

## Observations

- Preview console noise was present on the docs pages during browser automation:
  - CookieYes reported a registered-site URL mismatch.
  - PostHog reported initialization without a token.
  - Requests to `cloud.langfuse.com`, `us.cloud.langfuse.com`, and `hipaa.cloud.langfuse.com` hit CORS errors from the preview origin.
- These console errors did not prevent the copy/share UI from rendering or the Ask AI page shell from loading, so they were not recorded as Chapter 4 blockers.
