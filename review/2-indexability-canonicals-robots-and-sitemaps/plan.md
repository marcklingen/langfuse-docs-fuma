# Chapter 2 Plan: Indexability, Canonicals, Robots, and Sitemaps

## Scope

- Production baseline: `https://langfuse.com`
- Migration candidate: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- Local spot checks: `http://localhost:3333`

## Deliverables

- `tests/audit-seo-surface.mjs`: environment audit for robots, sitemaps, metadata, canonical behavior, and `.md` endpoints.
- `tests/compare-audits.mjs`: production-vs-preview diff focused on chapter 2 regressions.
- `artifacts/*.json`: raw audit outputs for production and preview.
- `artifacts/prod-vs-preview.md`: human-readable regression report.
- `issues.md`: confirmed issues, severity, and next actions.

## Checklist Mapping

| Checklist item | Automated checks | Manual checks | Evidence |
| --- | --- | --- | --- |
| `robots.txt` exists, is reachable, and does not block intended public content | Fetch `/robots.txt`, assert `200`, parse `Sitemap:` lines, scan for blocking rules on `/docs`, `/integrations`, `/self-hosting`, `/guides`, `/faq`, `/blog`, `/changelog` | Read the returned file once to confirm host and sitemap references are sane | `artifacts/*-audit.json` robots section |
| Sitemap generation still runs and includes correct canonical URLs | Fetch `/sitemap.xml`, recurse through sitemap index files, collect all `<loc>` entries, validate `200` responses for each sitemap file | Spot-check one docs page, one guide, one changelog page, and one marketing page from the sitemap | `artifacts/*-audit.json` sitemap section |
| Sitemap files do not include redirects, `404` pages, preview URLs, or non-canonical duplicates | For every sitemap URL, request the candidate environment page, record status, final URL, and canonical metadata; compare sitemap URLs against source frontmatter expectations for `noindex` and `canonical` | Spot-check representative URLs that are expected duplicates, especially changelog pages with `canonical:` frontmatter | `artifacts/*-audit.json`, `artifacts/prod-vs-preview.md` |
| Canonical URLs point to the correct production host and intended path | Extract `<link rel="canonical">` for every sitemap URL; compare against explicit frontmatter canonicals when present; otherwise verify host stability and self-canonical behavior | Open a small sample in the browser if runtime output looks suspicious | `artifacts/*-audit.json`, `artifacts/prod-vs-preview.md` |
| Page-level `noindex` rules are preserved where intentionally used | Scan repo frontmatter for `noindex: true`, then verify matching runtime pages emit page-level noindex metadata or headers outside preview-only guards | Confirm intended non-indexable pages are absent from the sitemap | `artifacts/*-audit.json`, `issues.md` |
| Preview deployments continue to emit `X-Robots-Tag: noindex` | For preview audit runs, assert HTML pages carry `X-Robots-Tag: noindex` | Spot-check `/docs`, `/`, and one deep docs page with `curl -I` | `artifacts/preview-audit.json` |
| `.md` endpoints remain excluded from indexing | Request representative `.md` endpoints, assert `200`, `Content-Type: text/markdown`, and `X-Robots-Tag: noindex` | Spot-check `Accept: text/markdown` on the corresponding HTML route | `artifacts/*-audit.json` md checks |
| Titles and meta descriptions are present for important pages and do not become empty or massively duplicated | Capture `title` and `description` for every sitemap URL; compare production vs preview for removed values | Spot-check top-level docs landing pages and one marketing page | `artifacts/*-audit.json`, `artifacts/prod-vs-preview.md` |
| Open Graph and Twitter metadata still point to correct canonical URLs and valid assets | Capture `og:url`, `og:image`, `twitter:image`, `twitter:card`; compare production vs preview for missing or host-leaking values | Spot-check one shared card in the browser if needed | `artifacts/*-audit.json`, `artifacts/prod-vs-preview.md` |
| Cookbook-specific canonical logic remains correct | Load `cookbook/_routes.json`, derive cookbook pages that should be excluded from the sitemap, and assert they stay excluded | Spot-check one docs-backed cookbook route and its guide twin if any appear in reports | `artifacts/*-audit.json` cookbook checks |

## Runbook

```bash
node review/2-indexability-canonicals-robots-and-sitemaps/tests/audit-seo-surface.mjs \
  --target-base-url https://langfuse.com \
  --out review/2-indexability-canonicals-robots-and-sitemaps/artifacts/production-audit.json

node review/2-indexability-canonicals-robots-and-sitemaps/tests/audit-seo-surface.mjs \
  --target-base-url https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app \
  --expect-preview-noindex \
  --out review/2-indexability-canonicals-robots-and-sitemaps/artifacts/preview-audit.json

node review/2-indexability-canonicals-robots-and-sitemaps/tests/compare-audits.mjs \
  --baseline review/2-indexability-canonicals-robots-and-sitemaps/artifacts/production-audit.json \
  --candidate review/2-indexability-canonicals-robots-and-sitemaps/artifacts/preview-audit.json \
  --out review/2-indexability-canonicals-robots-and-sitemaps/artifacts/prod-vs-preview.md
```

## Exit Criteria

- Preview keeps the environment-wide `X-Robots-Tag: noindex` guard.
- Explicit page-level `canonical` and `noindex` behavior matches production or is intentionally improved.
- Sitemap output is crawlable, stable, and free of clearly non-canonical or intentionally non-indexable URLs.
- `.md` endpoints keep the expected markdown content type and noindex behavior.
