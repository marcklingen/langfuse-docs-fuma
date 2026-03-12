# Chapter 4 Summary

Generated: 2026-03-12T03:46:50.528Z

Preview base: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
Production base: `https://langfuse.com`

## Findings

- HIGH: Preview md-to-pdf export fails for an allowlisted Langfuse markdown URL (md-to-pdf.json)
  Preview returned 500 while production returned 200 for the same allowlisted markdown input.
- MEDIUM: Preview MCP markdown retrieval does not match the preview markdown endpoint (mcp.json)
  Preview MCP returned _meta.url=https://langfuse.com/docs/observability/overview.md and the tool output differs from https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app/docs/observability/overview.md.

## Check Summary

| Check | Preview | Production |
| --- | --- | --- |
| llms.txt | PASS | PASS |
| markdown-endpoints | PASS | PASS |
| ask-ai-http | PASS | PASS |
| mcp | FAIL | PASS |
| search-docs | PASS | PASS |
| md-to-pdf | FAIL | PASS |
