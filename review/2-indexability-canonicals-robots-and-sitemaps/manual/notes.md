# Manual Notes

These notes summarize the live checks performed for chapter 2. Raw outputs are stored in `../evidence/`.

## Scope

- Production baseline: `https://langfuse.com`
- Migration target: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`

## Spot checks performed before the full audit

- Confirmed `robots.txt` is reachable on both production and preview.
- Confirmed preview responses include `X-Robots-Tag: noindex` for `robots.txt`, `sitemap.xml`, and representative HTML pages.
- Confirmed representative `.md` endpoints return `Content-Type: text/markdown` and `X-Robots-Tag: noindex`.
- Confirmed at least one cookbook duplicate route shows a canonical regression on preview:
  - Production `/guides/cookbook/integration_langserve` canonicals to `/integrations/frameworks/langserve`
  - Preview `/guides/cookbook/integration_langserve` self-canonicalizes instead

## Follow-up

- Use `node review/2-indexability-canonicals-robots-and-sitemaps/tests/run_audit.js` to regenerate the structured evidence and the markdown summary after content or metadata changes.
- Current evidence highlights two migration issues to resolve before sign-off:
  - 7 live cookbook duplicate pages self-canonicalize on preview instead of pointing at their docs/integrations canonical target.
  - 11 dynamic FAQ tag landing pages still resolve on preview but no longer appear in the sitemap.
- See `../issues.md` for the reviewer-facing write-up and `../evidence/summary.md` for the raw chapter summary.
