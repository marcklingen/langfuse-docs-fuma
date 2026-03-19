# Chapter 7 Plan: Metadata, Structured Data, and Social Sharing

## Objective

Ensure that preview pages preserve correct titles, descriptions, canonical tags, social metadata, OG assets, and any structured data emitted for representative page types.

## Environments

- Preview under review: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- Production baseline: `https://langfuse.com`

## Representative pages

- Docs with `seoTitle`: `/docs/observability/overview`
- FAQ detail page: `/faq/all/unwanted-http-database-spans`
- Blog post with static `ogImage`: `/blog/2026-02-26-evaluate-ai-agent-skills`
- Guide video page with static `ogImage`: `/guides/videos/introducing-datasets-v2`
- Changelog page with canonical override and `og:video`: `/changelog/2025-01-22-track-changes-between-prompt-versions`
- Changelog page with canonical override and static `ogImage`: `/changelog/2025-05-21-custom-dashboards`

## Checklist coverage

| Checklist item | Verification approach | Evidence |
| --- | --- | --- |
| Representative pages emit correct titles, descriptions, canonical tags, and social metadata | Fetch preview HTML, parse `<head>`, and compare against expected source-backed values | `artifacts/preview-metadata-report.json` |
| Dynamic OG image generation still works where expected | Validate `/api/og` URL shape and fetch each unique OG asset | `artifacts/preview-metadata-report.json` |
| Custom OG image or video overrides still function | Assert exact expected `og:image` / `og:video` values for sample pages with overrides and fetch the assets | `artifacts/preview-metadata-report.json` |
| `og:url` matches the canonical URL | Compare parsed `og:url` and canonical values per page | `artifacts/preview-metadata-report.json` |
| OG and Twitter image assets are reachable and valid | Fetch unique `og:image`/`twitter:image` targets and assert `200` plus image content types | `artifacts/preview-metadata-report.json` |
| Structured data is preserved where applicable | Parse JSON-LD on preview and production samples, compare emitted schema types, and flag parse failures or host leaks | `artifacts/preview-metadata-report.json` |
| No metadata or structured data points to staging or preview domains | Scan metadata values and JSON-LD string fields for preview, `vercel.app`, `localhost`, or `127.0.0.1` references | `artifacts/preview-metadata-report.json`, `issues.md` |

## Execution

Run the chapter with:

```bash
node review/7-metadata-structured-data-and-social-sharing/tests/run-metadata-review.mjs
```

The runner writes structured evidence into `review/7-metadata-structured-data-and-social-sharing/artifacts/`.
