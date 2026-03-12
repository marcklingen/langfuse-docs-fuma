# Chapter 1: URLs, Routing, and Redirects

## Review objective

Confirm that the migration preserves link stability and route behavior for important public URLs.

## Scope

This chapter covers:

- Sitemap-backed parity checks between `https://langfuse.com` and the current preview deployment.
- Explicit redirect validation for every redirect defined in [lib/redirects.js](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js).
- Deep-link anchor validation for representative docs and self-hosting pages.
- Sampled internal-link canonicalization checks on high-traffic section entry points.
- Representative trailing-slash and casing probes.

This chapter does not own canonical, robots, or sitemap-host correctness. Those belong to Chapter 2, even though the same evidence run may surface them.

## How to run

```bash
node review/1-urls-routing-and-redirects/tests/run-routing-review.mjs
```

Optional environment variables:

- `PROD_BASE_URL` defaults to `https://langfuse.com`
- `PREVIEW_BASE_URL` defaults to `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- `REQUEST_CONCURRENCY` defaults to `16`
- `OUTPUT_DIR` defaults to `review/1-urls-routing-and-redirects/evidence`

## Evidence produced

The runner writes:

- `summary.md` for the reviewer-facing result summary
- `sitemap-parity.json` for the production sitemap replay against preview
- `redirect-config.json` for redirect-map checks
- `anchor-targets.json` for deep-link checks
- `internal-link-sample.json` for sampled internal-link canonicalization
- `trailing-slash-and-casing.json` for representative normalization probes

## Checklist mapping

| Checklist item | Evidence | Method |
| --- | --- | --- |
| Important current URLs resolve correctly | `sitemap-parity.json` | Replay all production sitemap URLs against production and preview, then compare final paths and statuses |
| No important pages become `404`, `410`, soft `404`, or homepage redirects | `sitemap-parity.json`, `summary.md` | Flag preview non-200 finals, homepage landings, and path mismatches |
| Legacy docs paths, shortlinks, and campaign URLs still resolve | `redirect-config.json` | Materialize and validate every configured redirect rule |
| Trailing-slash behavior is consistent | `trailing-slash-and-casing.json` | Probe representative slash and non-slash variants |
| Route casing and slug handling are safe | `trailing-slash-and-casing.json` | Probe representative mixed-case variants |
| Deep links to headings still land on intended content | `anchor-targets.json` | Verify target anchor IDs exist in rendered preview HTML |
| No redirect loops or chains longer than one hop | `sitemap-parity.json`, `redirect-config.json` | Record redirect depth and repeated locations |
| Internal links point directly to canonical destinations | `internal-link-sample.json` | Sample internal links from representative pages and trace them on preview |
| Redirects put in place still work | `redirect-config.json` | Compare preview redirect outcomes to the configured mapping and production behavior |

## Files in this chapter

- [tests/run-routing-review.mjs](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/1-urls-routing-and-redirects/tests/run-routing-review.mjs)
- [manual/notes.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/1-urls-routing-and-redirects/manual/notes.md)
- [issues.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/1-urls-routing-and-redirects/issues.md)
