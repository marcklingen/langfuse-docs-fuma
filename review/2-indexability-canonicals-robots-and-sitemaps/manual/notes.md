# Chapter 2 Manual Notes

## Spot Checks Performed

Date: 2026-03-11 PST

### Preview noindex header guard

- `curl -I https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app/docs`
- Result: `X-Robots-Tag: noindex` is present on preview HTML responses.

### Page-level noindex regression on `/find-us`

- Production: `curl -s https://langfuse.com/find-us`
- Result: production includes `<meta name="robots" content="noindex">`.
- Preview local render: `curl -s http://localhost:3333/find-us`
- Result: the local render does not include a robots meta tag even though `content/marketing/find-us.mdx` declares `noindex: true`.

### Canonical regression on canonicalized changelog pages

- Production: `curl -s https://langfuse.com/changelog/2025-01-22-track-changes-between-prompt-versions`
- Result: production includes `<link rel="canonical" href="https://langfuse.com/docs/prompt-management/features/prompt-version-control">`.
- Preview local render: `curl -s http://localhost:3333/changelog/2025-01-22-track-changes-between-prompt-versions`
- Result: the local render has no canonical tag.

### Markdown endpoint spot check

- Production: `/find-us.md` returns `200` with `Content-Type: text/markdown` and `X-Robots-Tag: noindex`.
- Preview: `/find-us.md` returns `404` with HTML content instead of markdown.

### Sitemap 404 confirmation

- Local spot checks:
- `curl -I http://localhost:3333/docs/v4`
- `curl -I http://localhost:3333/changelog/2026-03-10-simplify-for-scale`
- `curl -I http://localhost:3333/blog/2026-03-10-simplify-langfuse-for-scale`
- Result: all three representative sitemap URLs return `404` locally, which confirms the preview 404s are not only a deployment-environment artifact.
