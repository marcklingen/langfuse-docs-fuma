# Chapter 7 Issues

## Confirmed Regressions

### `[High]` Preview drops canonical tags and `og:url` across the audited metadata surface

- Evidence: `review/7-metadata-structured-data-and-social-sharing/evidence/page-metadata.json` and `review/7-metadata-structured-data-and-social-sharing/evidence/comparisons.json` show missing `og:url` on all 10 representative routes in preview. The canonicalized changelog sample `/changelog/2024-08-20-comments` also loses its explicit canonical tag in preview.
- Likely cause: the app-router metadata builders do not emit `alternates.canonical`, `openGraph.url`, or `metadataBase`. This is visible in `app/layout.tsx`, `app/(wide)/WideSectionPage.tsx`, `app/docs/[[...slug]]/page.tsx`, `app/guides/[[...slug]]/page.tsx`, `app/integrations/[[...slug]]/page.tsx`, `app/self-hosting/[[...slug]]/page.tsx`, and `app/[section]/[[...slug]]/page.tsx`.
- Impact: crawlers and social preview consumers lose URL-level metadata parity with production, and canonicalized changelog pages stop advertising their intended docs destination.
- Proposed fix: centralize metadata generation so every route type emits a resolved canonical URL and matching `openGraph.url`.
- Status: open

### `[High]` Preview loses page-specific social cards on guides and wide marketing pages

- Evidence: `review/7-metadata-structured-data-and-social-sharing/evidence/comparisons.json` shows `/guides/videos/run-langfuse-locally` no longer emits its source-defined `ogImage` (`/images/videos/local-langfuse-v3.jpg`) and `/pricing` falls back to the global `https://langfuse.com/og.png` card instead of the production per-page OG image.
- Likely cause: `app/guides/[[...slug]]/page.tsx` ignores `page.data.ogImage`, and `app/(wide)/WideSectionPage.tsx` only returns `title` and `description`, which leaves the root layout defaults in place.
- Impact: shared links no longer preserve the current thumbnails and card copy for guides video pages and wide marketing pages.
- Proposed fix: route guides and wide sections through the same metadata helper used by the section pages so explicit `ogImage` overrides and generated per-page cards both work.
- Status: open

### `[Medium]` Changelog `og:video` overrides disappear in preview

- Evidence: `content/changelog/2024-08-20-comments.mdx` still declares `ogVideo: https://static.langfuse.com/docs-videos/comments.mp4`, but the preview emits no `og:video` metadata in `review/7-metadata-structured-data-and-social-sharing/evidence/page-metadata.json`.
- Likely cause: `source.config.ts` extends the changelog frontmatter schema with `ogImage` but not `ogVideo`, so the field is dropped before `app/[section]/[[...slug]]/page.tsx` can use it.
- Impact: changelog posts that previously produced video-rich social previews regress to static previews.
- Proposed fix: extend the changelog frontmatter schema to include `ogVideo`, then preserve it in the shared metadata builder.
- Status: open

### `[Medium]` Representative docs overview pages regress to generic `Overview - Langfuse` titles

- Evidence: `review/7-metadata-structured-data-and-social-sharing/evidence/comparisons.json` records title regressions on `/docs/observability/overview`, `/docs/prompt-management/overview`, `/docs/evaluation/overview`, and `/docs/api-and-data-platform/overview`. Production emits descriptive titles such as `Open Source Prompt Management - Langfuse`; preview collapses each of these to `Overview - Langfuse`.
- Likely cause: the new metadata layer now uses the content navigation title directly and no longer preserves the descriptive SEO copy used in production.
- Impact: search snippets and social headlines become less specific on important docs landing pages.
- Proposed fix: add an explicit SEO title field or a route-level title mapping for overview pages rather than relying on the sidebar title alone.
- Status: open

## Carried-Forward Issues

### `[Low]` Current production `og:video` URLs are malformed for absolute frontmatter values

- Evidence: `review/7-metadata-structured-data-and-social-sharing/evidence/asset-checks.json` shows the emitted production `og:video` URL for `/changelog/2024-08-20-comments` is invalid, and `review/7-metadata-structured-data-and-social-sharing/evidence/comparisons.json` records the malformed value as `https://langfuse.comhttps//static.langfuse.com/docs-videos/comments.mp4`.
- Likely cause: `app/[section]/[[...slug]]/page.tsx` prefixes `https://langfuse.com` onto `pageData.ogVideo` unconditionally instead of resolving relative and absolute URLs separately.
- Impact: even the current production baseline does not supply a valid video URL to social platforms when `ogVideo` is already absolute.
- Proposed fix: resolve `ogVideo` via `new URL(pageData.ogVideo, "https://langfuse.com")` or equivalent rather than raw string concatenation.
- Status: open
