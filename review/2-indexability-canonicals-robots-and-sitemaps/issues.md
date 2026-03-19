# Issues

## P1: Live cookbook duplicate pages no longer canonicalize to their docs/integrations target

The preview keeps 7 duplicate cookbook guide pages live at `200`, but each of them self-canonicalizes to its `/guides/cookbook/*` URL instead of pointing at the intended docs or integrations page. The audit found this on:

- `/guides/cookbook/integration_langserve`
- `/guides/cookbook/integration_openai_assistants`
- `/guides/cookbook/integration_llamaindex_workflows`
- `/guides/cookbook/integration_llama_index`
- `/guides/cookbook/integration_amazon_bedrock`
- `/guides/cookbook/integration_anthropic`
- `/guides/cookbook/js_integration_anthropic`

This is a migration regression: the same 7 live routes canonicalize correctly on production. It creates duplicate-indexing signals for pages that the sitemap is already trying to treat as non-canonical duplicates.

Likely cause: the canonical target exists in [`lib/cookbook_route_mapping.ts`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/cookbook_route_mapping.ts#L3) but the guide metadata path still falls back to `buildPageUrl(pagePath)` in [`app/guides/[[...slug]]/page.tsx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/guides/[[...slug]]/page.tsx#L38) instead of consulting that mapping.

Proposed fix: resolve the guide page’s canonical URL from `COOKBOOK_ROUTE_MAPPING` before falling back to `pageData.canonical` or the guide path, then rerun the chapter 2 audit to confirm all 7 routes point at their intended canonical target.

## P2: Dynamic FAQ tag pages drop out of the preview sitemap even though they still resolve

The preview sitemap is missing 11 public FAQ tag landing pages that are present in production. All 11 still return `200` on preview:

- `/faq/tag/administration`
- `/faq/tag/article`
- `/faq/tag/auth`
- `/faq/tag/comparison`
- `/faq/tag/evaluation`
- `/faq/tag/integration`
- `/faq/tag/migration`
- `/faq/tag/observability`
- `/faq/tag/observability-get-started`
- `/faq/tag/platform`
- `/faq/tag/prompt-management-get-started`

This looks like a sitemap-generation gap, not an intentional exclusion. The pages are generated dynamically in [`app/[section]/[[...slug]]/page.tsx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/[section]/[[...slug]]/page.tsx#L202), but the sitemap inventory is built by scanning only `content/` files in [`scripts/generate-sitemap-excludes.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/scripts/generate-sitemap-excludes.js#L1) and then fed into `additionalPaths` in [`next-sitemap.config.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/next-sitemap.config.js#L10). Those dynamic tag routes never get added, so they disappear from the preview sitemap.

Proposed fix: append the generated FAQ tag routes to `.sitemap-all-pages.json` or add them directly in `next-sitemap.config.js`, then rerun the sitemap diff to make sure the 11 tag pages reappear.

## Observations

- Preview indexing protections are intact: `robots.txt`, `sitemap.xml`, HTML pages, and sampled `.md` endpoints all emit `X-Robots-Tag: noindex`.
- Explicit frontmatter-based canonical overrides and the one explicit `noindex` route behaved correctly on preview.
- 74 preview sitemap URLs still have empty meta descriptions, but production currently has 121. That is still worth cleaning up, but it did not look like the primary migration regression in this chapter.
