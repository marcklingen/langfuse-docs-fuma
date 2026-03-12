# Chapter 4: AI and LLM-Facing Features

## Review objective

Protect the Langfuse-specific AI documentation contract, which is a critical migration risk area.

## Scope

This chapter covers:

- `llms.txt` and its section sub-files.
- Static markdown endpoints and `Accept: text/markdown` negotiation.
- The docs copy-as-markdown surface, including the LLM helper dropdown.
- The public Docs MCP server at `/api/mcp`.
- The public docs search endpoint at `/api/search-docs`.
- Markdown-to-PDF export at `/api/md-to-pdf`.
- The Ask AI docs page and its embedded chat shell.

This chapter does not own broader SEO/indexability checks, even when markdown endpoint headers overlap with Chapter 2.

## How to run

```bash
node review/4-ai-and-llm-facing-features/tests/run-llm-surface-review.mjs
```

Optional environment variables:

- `PROD_BASE_URL` defaults to `https://langfuse.com`
- `PREVIEW_BASE_URL` defaults to `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- `OUTPUT_DIR` defaults to `review/4-ai-and-llm-facing-features/evidence`

The runner exits non-zero when review failures are detected in the checked surfaces.

## Evidence produced

The runner writes:

- `summary.md` for the reviewer-facing result summary
- `summary.json` for the machine-readable summary
- `llms.json` for `llms.txt` and sub-file checks
- `markdown-endpoints.json` for `.md` and negotiated markdown checks
- `ask-ai-http.json` for Ask AI route reachability checks
- `mcp.json` for MCP initialization, tool listing, and tool-call parity
- `search-docs.json` for REST search and CORS checks
- `md-to-pdf.json` for PDF export and allowlist checks

## Checklist mapping

| Checklist item | Evidence | Method |
| --- | --- | --- |
| `/llms.txt` exists, is current, and references expected sub-files and MCP info | `llms.json` | Fetch `llms.txt`, assert required MCP/sub-file references, and compare preview output to `public/llms.txt` |
| Docs `.md` endpoints return markdown with correct `Content-Type` | `markdown-endpoints.json` | Request representative `.md` URLs and assert `text/markdown; charset=utf-8` |
| Docs `.md` endpoints return `X-Robots-Tag: noindex` | `markdown-endpoints.json` | Assert `X-Robots-Tag` on representative `.md` responses |
| Content negotiation works with `Accept: text/markdown` | `markdown-endpoints.json` | Compare negotiated docs responses against direct `.md` bodies |
| Copy-as-Markdown flow works on representative docs pages | `manual/notes.md` | Browser validation on a representative docs page |
| Copy UI appears across intended docs sections | `manual/notes.md` | Browser validation on docs and Ask AI pages |
| ChatGPT/Claude helpers and Docs MCP action remain present | `manual/notes.md` | Browser validation of the live dropdown entries |
| Ask AI page exists and loads the embedded chat experience | `manual/notes.md`, `ask-ai-http.json` | HTTP reachability plus browser validation of the embedded chat shell |
| `/api/mcp` is reachable and exposes the expected tool set | `mcp.json` | Initialize MCP, list tools, and assert the expected tool names |
| MCP markdown retrieval matches `.md` output | `mcp.json` | Call `getLangfuseDocsPage` and compare the returned markdown with the matching endpoint |
| `/api/search-docs` works and preserves expected response shape and CORS behavior | `search-docs.json` | Check GET, invalid-query handling, and OPTIONS CORS behavior |
| `/api/md-to-pdf` works for allowed inputs and blocks untrusted hosts | `md-to-pdf.json` | Request a PDF for an allowlisted markdown URL and a blocked host |

## Files in this chapter

- `review/4-ai-and-llm-facing-features/tests/run-llm-surface-review.mjs`
- `review/4-ai-and-llm-facing-features/manual/notes.md`
- `review/4-ai-and-llm-facing-features/issues.md`
