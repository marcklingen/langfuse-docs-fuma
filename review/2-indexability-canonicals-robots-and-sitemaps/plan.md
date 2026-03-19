# Chapter 2 Plan

## Objective

Verify that the migration preserves correct indexability controls, canonical behavior, robots output, and sitemap quality without leaking preview URLs or breaking SEO-critical metadata.

## Verification approach

1. Run an automated crawl of the production and preview sitemap inventories.
2. Capture status, final URL, canonical, robots directives, title, description, and core social metadata from the HTML head.
3. Verify preview-only protections separately from production indexability expectations:
   - Preview HTML and sitemap responses must emit `X-Robots-Tag: noindex`.
   - Production pages listed in the sitemap must remain indexable unless intentionally excluded.
4. Audit explicit exception sets from the repo:
   - frontmatter `canonical` overrides
   - frontmatter `noindex` pages
   - cookbook duplicate routes derived from `cookbook/_routes.json`
5. Save raw evidence as JSON plus a reviewer-friendly markdown summary.

## Automated checks

- `robots.txt` reachability and content on production and preview
- `sitemap.xml` and child sitemap reachability on production and preview
- Production vs preview sitemap URL-set diff
- Full sitemap page-head crawl on production and preview
- Canonical override route audit against local frontmatter
- Noindex route audit against local frontmatter
- Cookbook duplicate canonical audit against `cookbook/_routes.json`
- Markdown endpoint header audit for representative `.md` URLs
- Representative sample-page audit including H1 and OG asset reachability

## Manual review notes

- Review the sitemap diff to confirm which changes are intended improvements versus regressions.
- Review duplicate-title and duplicate-description clusters for pages that matter to search traffic.
- Review any cookbook canonical failures carefully because those pages are intentionally duplicated and easy to mishandle in a framework migration.
