# Chapter 7 Summary

Generated: 2026-03-12T03:57:32.337Z

Preview base: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
Production base: `https://langfuse.com`

## Findings

- HIGH: Preview omits canonical tags and/or `og:url` on representative pages (comparisons.json, page-metadata.json)
  Affected routes: `/docs/observability/overview`, `/docs/prompt-management/overview`, `/docs/evaluation/overview`, `/docs/api-and-data-platform/overview`, `/guides/videos/run-langfuse-locally`, `/blog/2025-03-19-ai-agent-comparison`, `/changelog/2024-08-20-comments`, `/changelog/2025-06-04-open-sourcing-langfuse`, `/pricing`, `/faq/all/langfuse-support`
- MEDIUM: Representative docs overview pages regress to generic `Overview - Langfuse` titles (comparisons.json, page-metadata.json)
  Affected routes: `/docs/observability/overview`, `/docs/prompt-management/overview`, `/docs/evaluation/overview`, `/docs/api-and-data-platform/overview`
- HIGH: Preview loses page-specific social cards on guides and wide marketing pages (comparisons.json, page-metadata.json)
  Affected routes: `/guides/videos/run-langfuse-locally`, `/pricing`
- MEDIUM: Preview drops changelog `og:video` overrides (comparisons.json, page-metadata.json)
  Affected routes: `/changelog/2024-08-20-comments`
- LOW: Current production `og:video` URLs are malformed for absolute frontmatter values (asset-checks.json, comparisons.json)
  Affected routes: `/changelog/2024-08-20-comments`

## Check Summary

| Check | Preview | Production |
| --- | --- | --- |
| Representative head metadata parity | FAIL | PASS |
| Canonical and `og:url` coverage | FAIL | PASS |
| Custom OG image overrides | FAIL | PASS |
| Custom `og:video` overrides | FAIL | FAIL |
| Emitted OG/Twitter assets reachable | PASS | FAIL |
| JSON-LD structured-data parity | PASS | PASS |

## Structured Data Observations

- Preview JSON-LD types: none detected
- Production JSON-LD types: none detected
- Preview JSON-LD script count across audited pages: 0
- Production JSON-LD script count across audited pages: 0
