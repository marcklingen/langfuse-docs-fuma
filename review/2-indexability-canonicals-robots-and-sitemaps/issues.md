# Chapter 2 Issues

## Confirmed Regressions

### `[High]` Explicit canonical frontmatter is not emitted in the new metadata layer

- Evidence: `review/2-indexability-canonicals-robots-and-sitemaps/artifacts/prod-vs-preview.md` shows 126 canonical regressions. Production emits canonical tags for changelog pages such as `/changelog/2025-01-22-track-changes-between-prompt-versions`, but the preview emits none. The content frontmatter still declares canonicals, for example `content/changelog/2025-01-22-track-changes-between-prompt-versions.mdx:1-7`.
- Likely cause: the app-router metadata builders only return `title`, `description`, `openGraph.images`, and `twitter.images`, and do not project `canonical` or `noindex` frontmatter into Next metadata. This is visible in `app/[section]/[[...slug]]/page.tsx:84-124`, `app/docs/[[...slug]]/page.tsx:33-52`, and `app/guides/[[...slug]]/page.tsx:38-57`.
- Impact: pages that were intentionally canonicalized to docs or integrations URLs now look like standalone URLs to crawlers, while the sitemap still publishes them. This creates duplicate-content risk and breaks the chapter 2 invariant that sitemap URLs should reflect canonical destinations.
- Proposed fix: centralize page metadata assembly and map frontmatter `canonical` to `alternates.canonical` for every route type, not just section pages.
- Status: open

### `[High]` Page-level `noindex` behavior is lost for source-marked pages

- Evidence: `content/marketing/find-us.mdx:1-4` still declares `noindex: true`. Production returns a page-level `<meta name="robots" content="noindex">`, while the preview only has the environment-wide preview header. The audit recorded 1 page-level noindex regression and 1 sitemap URL that is explicitly marked `noindex` in source: `https://langfuse.com/find-us`.
- Likely cause: the same metadata builders noted above do not map frontmatter `noindex` into Next metadata, so only preview-wide `X-Robots-Tag: noindex` is masking the regression.
- Impact: if the current implementation ships to production, `/find-us` would become indexable at the page level, and it is already being advertised in the sitemap.
- Proposed fix: emit page-level robots metadata from frontmatter and exclude `noindex` routes from sitemap generation.
- Status: open

### `[High]` The sitemap contains 9 URLs that return `404` in preview and local

- Evidence: `review/2-indexability-canonicals-robots-and-sitemaps/artifacts/preview-audit.json` records 9 non-200 sitemap URLs, and the same routes return `404` on `http://localhost:3333`. The affected URLs are:
- `/blog/2026-03-10-simplify-langfuse-for-scale`
- `/changelog/2026-03-10-simplify-for-scale`
- `/docs/observability/sdk/upgrade-path/js-v3-to-v4`
- `/docs/observability/sdk/upgrade-path/js-v4-to-v5`
- `/docs/observability/sdk/upgrade-path/python-v2-to-v3`
- `/docs/observability/sdk/upgrade-path/python-v3-to-v4`
- `/docs/v4`
- `/faq/all/explore-observations-in-v4`
- `/faq/all/observation-eval-not-executing`
- Likely cause: sitemap generation is picking up routes that are not actually backed by content or runtime pages in this repo. The root cause is still unresolved.
- Impact: search engines and users receive broken URLs directly from the sitemap, which is a launch blocker for chapter 2.
- Proposed fix: trace the route inventory that `next-sitemap` consumes, remove stale entries, and add an automated sitemap-to-HTTP validation gate before release.
- Status: open

### `[Medium]` The new app-router pages drop `og:url` across the audited surface

- Evidence: the production-vs-preview diff reports 785 missing `og:url` regressions, covering every audited sitemap URL. Production emits `og:url`; the preview does not.
- Likely cause: the root metadata does not set `metadataBase`, and route-level metadata builders do not set `openGraph.url` or canonical alternates. See `app/layout.tsx:12-24` and the route-level `generateMetadata` functions listed above.
- Impact: social preview metadata is weaker, and crawlers lose one more signal tying each page to its canonical public URL.
- Proposed fix: set `metadataBase` in the root layout and populate `openGraph.url` from the resolved canonical URL in the shared metadata helper.
- Status: open

## Carried-Forward Issues

### `[Medium]` The sitemap already includes non-canonical and non-indexable URLs in production, and the migration keeps that behavior

- Evidence: the production audit recorded 126 sitemap URLs whose source frontmatter canonicalizes them elsewhere and 1 sitemap URL whose source frontmatter marks it `noindex`. The preview preserves the same sitemap set.
- Impact: this is not a migration-only regression, but it means the chapter 2 checklist is not currently satisfied even before rollout.
- Proposed fix: extend `next-sitemap.config.js` to exclude routes whose frontmatter declares `canonical` or `noindex`, similar to the existing cookbook duplicate exclusions in `next-sitemap.config.js:14-24`.
- Status: open

## Follow-Up

- Investigate why `/find-us.md` returns `404` in preview while production serves it successfully. This is a lower-priority chapter 2 symptom and a likely chapter 4 item as well.
