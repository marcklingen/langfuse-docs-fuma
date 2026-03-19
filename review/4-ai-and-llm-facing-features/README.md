# Chapter 4: AI and LLM-Facing Features

## Objective

Verify that the migration preserves Langfuse's AI-facing documentation contract across `llms.txt`, markdown endpoints, docs MCP, search, PDF export, and the copy/share UI.

## Scope

- Programmatic checks run against the preview deployment by default.
- Manual browser checks cover the UI-only behaviors that cannot be validated reliably over HTTP alone.

## Structure

- `tests/run-ai-llm-review.mjs`: automated endpoint and protocol checks.
- `manual/notes.md`: manual browser QA notes for copy/share/Ask AI flows.
- `issues.md`: findings, severity, impact, and proposed fixes.
- `artifacts/`: captured JSON reports and screenshots referenced by this chapter.

## Runbook

Run the automated review against the preview deployment:

```bash
node review/4-ai-and-llm-facing-features/tests/run-ai-llm-review.mjs \
  --base-url https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app \
  --output review/4-ai-and-llm-facing-features/artifacts/preview-endpoint-report.json
```

The script exits non-zero if any checks fail, but it still writes the JSON report first.

## Evidence Index

- Automated endpoint report:
  `review/4-ai-and-llm-facing-features/artifacts/preview-endpoint-report.json`
- Manual UI notes:
  `review/4-ai-and-llm-facing-features/manual/notes.md`
- UI artifacts:
  - `review/4-ai-and-llm-facing-features/artifacts/docs-mcp-copy-ui.png`
  - `review/4-ai-and-llm-facing-features/artifacts/ask-ai-preview.png`
