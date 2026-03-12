# Chapter 7: Metadata, Structured Data, and Social Sharing

## Review objective

Ensure that metadata used by search engines, link unfurlers, and rich-result consumers is preserved.

## Scope

This chapter covers:

- Representative page metadata checks for docs, guides, blog, changelog, FAQ, and wide marketing pages.
- Production-versus-preview comparisons for titles, descriptions, canonical tags, `og:url`, and social-card fields.
- Source-backed validation for pages that explicitly declare `canonical`, `ogImage`, or `ogVideo` in frontmatter.
- Reachability checks for emitted OG and Twitter assets.
- JSON-LD extraction and type-parity checks for representative templates.

This chapter does not own broader sitemap, robots, or page-level indexing rules. Those remain in Chapter 2.

## How to run

```bash
node review/7-metadata-structured-data-and-social-sharing/tests/run-metadata-review.mjs
```

Optional environment variables:

- `PROD_BASE_URL` defaults to `https://langfuse.com`
- `PREVIEW_BASE_URL` defaults to `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- `OUTPUT_DIR` defaults to `review/7-metadata-structured-data-and-social-sharing/evidence`

The runner exits non-zero when metadata regressions or carried-forward metadata failures are detected on the audited surface.

## Evidence produced

The runner writes:

- `summary.md` for the reviewer-facing result summary
- `summary.json` for the machine-readable summary
- `page-metadata.json` for extracted head metadata on production and preview
- `asset-checks.json` for OG, Twitter, and video-asset reachability checks
- `structured-data.json` for JSON-LD presence and parsed types
- `comparisons.json` for source-backed and production-baseline comparisons

## Checklist mapping

| Checklist item | Evidence | Method |
| --- | --- | --- |
| Representative pages still emit correct titles, descriptions, canonical tags, and social metadata | `page-metadata.json`, `comparisons.json` | Fetch representative pages on production and preview, then compare the extracted head metadata |
| Dynamic OG image generation still works where expected | `asset-checks.json`, `page-metadata.json` | Validate emitted `/api/og` URLs or equivalent image URLs return `200` with an image content type |
| Custom OG image or video overrides still function on pages that define them | `comparisons.json`, `page-metadata.json` | Compare preview metadata against source frontmatter for pages with `ogImage` or `ogVideo` |
| `og:url` matches the intended public URL and does not leak preview domains | `comparisons.json`, `page-metadata.json` | Compare preview `og:url` to the production baseline and check for preview-host leakage |
| OG and Twitter image assets are reachable and valid | `asset-checks.json` | HEAD/GET the emitted asset URLs and assert image or video content types |
| Structured data is preserved where applicable | `structured-data.json`, `comparisons.json` | Parse JSON-LD from representative pages and compare detected types between production and preview |
| No metadata or structured data points to preview domains | `comparisons.json`, `page-metadata.json` | Scan extracted metadata URLs for the preview hostname |

## Files in this chapter

- `review/7-metadata-structured-data-and-social-sharing/tests/run-metadata-review.mjs`
- `review/7-metadata-structured-data-and-social-sharing/manual/notes.md`
- `review/7-metadata-structured-data-and-social-sharing/issues.md`
