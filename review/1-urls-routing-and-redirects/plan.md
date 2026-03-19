# Chapter 1 Plan

## Objective

Confirm that the migration preserves link stability and route behavior for important public URLs on `langfuse.com`.

## Environments

- Production baseline: `https://langfuse.com`
- Preview under review: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- Local route sources: [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js), [`next.config.mjs`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/next.config.mjs), and [`/.sitemap-all-pages.json`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/.sitemap-all-pages.json)

## Checklist Coverage

| Checklist item | Verification approach | Evidence |
| --- | --- | --- |
| Important current URLs return `200` or a single-hop redirect to the right replacement | Crawl the production sitemap, replay those paths against preview, and compare final destinations against production | `artifacts/route-audit.json`, `artifacts/route-audit.md` |
| No important page becomes `404`, `410`, soft `404`, or irrelevant homepage redirect | Record final status, title, H1, redirect chain, and soft-404 signals for every replayed URL | `artifacts/route-audit.json`, `issues.md` |
| Legacy docs paths, shortlinks, and campaign URLs still resolve correctly | Probe every literal redirect source in `lib/redirects.js` plus representative wildcard samples, then compare final URLs against configured destinations | `artifacts/route-audit.json`, `artifacts/route-audit.md` |
| Trailing slash behavior is consistent | Replay slash and no-slash variants for production sitemap paths and flag duplicate live variants | `artifacts/route-audit.json` |
| Route casing and slug handling do not create broken or duplicate URLs | Run a representative mixed-case probe set across docs, guides, FAQ, integrations, self-hosting, blog, and changelog paths | `artifacts/route-audit.json` |
| Deep links to headings land on the intended content | Browser-based anchor check on representative pages; choose live heading IDs from the rendered DOM and validate scroll/target behavior | `artifacts/anchor-check.json`, `artifacts/anchor-check.md`, `manual/screenshots/` |
| No redirect loops or chains longer than one hop | Track redirect depth and hop sequence for every replayed URL | `artifacts/route-audit.json`, `issues.md` |
| Internal links point directly to canonical destinations | Crawl preview HTML, extract same-host page links, and probe unique targets for redirects or broken outcomes | `artifacts/route-audit.json`, `issues.md` |
| All configured redirects still work | Validate every configured literal redirect and representative wildcard samples in preview | `artifacts/route-audit.json`, `artifacts/route-audit.md` |

## Execution

Run the full chapter with:

```bash
node review/1-urls-routing-and-redirects/tests/run-chapter-1.mjs
```

The runner writes all structured evidence into `review/1-urls-routing-and-redirects/artifacts/`.
