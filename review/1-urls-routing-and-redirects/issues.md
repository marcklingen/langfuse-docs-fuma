# Chapter 1 Issues

Automated evidence for this issue log is in `review/1-urls-routing-and-redirects/evidence/`.

## Critical

### 1. Nine production sitemap URLs return `404` on preview

These URLs return `200` on production but `404` on the preview deployment:

- `/blog/2026-03-10-simplify-langfuse-for-scale`
- `/changelog/2026-03-10-simplify-for-scale`
- `/docs/observability/sdk/upgrade-path/js-v3-to-v4`
- `/docs/observability/sdk/upgrade-path/js-v4-to-v5`
- `/docs/observability/sdk/upgrade-path/python-v2-to-v3`
- `/docs/observability/sdk/upgrade-path/python-v3-to-v4`
- `/docs/v4`
- `/faq/all/explore-observations-in-v4`
- `/faq/all/observation-eval-not-executing`

Impact:

- Existing public URLs disappear after migration.
- Sitemap replay fails for currently live content.
- Users and crawlers hit hard `404`s instead of preserved content or explicit replacements.

Recommended fix:

- Migrate the missing pages into this repo or add explicit single-hop redirects to their correct replacements before launch.

## High

### 2. 109 configured redirects add extra internal hops

The redirect inventory contains 109 rules where the configured destination is not the final canonical URL on preview. Representative examples:

- `/docs/sso` -> `/self-hosting/authentication-and-sso` -> `/self-hosting/security/authentication-and-sso`
- `/docs/analytics` -> `/docs/analytics/overview` -> `/docs/metrics/overview`
- `/public-metrics-dashboard` -> `/why` -> `/handbook/chapters/why`
- `/docs/integrations` -> `/docs/integrations/overview` -> `/integrations`
- `/docs/datasets` -> `/docs/datasets/overview` -> `/docs/evaluation/experiments/datasets`

Impact:

- Redirect chains violate the Chapter 1 single-hop requirement.
- Legacy links still resolve, but they do so inefficiently and with avoidable SEO/user-experience degradation.

Recommended fix:

- Update redirect destinations in [lib/redirects.js](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js) so each source points directly at the final canonical destination in the new site.

### 3. The `/customers` redirect family downgrades from permanent to temporary

Seven exact production URLs in the `/customers` family return `308` on production but `307` on preview, including:

- `/customers`
- `/customers/canva`
- `/customers/sumup`
- `/customers/khan-academy`
- `/customers/magic-patterns-ai-design-tools`
- `/customers/merckgroup`

Impact:

- The migration weakens an existing permanent redirect contract.
- Search engines and caches may treat the new behavior differently from production.

Recommended fix:

- Move the `/customers` redirects into the permanent redirect set if the intent is to preserve the current production contract.

## Medium

### 4. Preview serves a mixed-case duplicate docs URL

`/Docs` returns `200` on preview while production returns `404`. `/Docs` and `/docs` render the same page title (`Overview - Langfuse`), which means the preview currently exposes a duplicate live URL by case.

Impact:

- Mixed-case duplicates can create inconsistent linking and indexing behavior.
- This is a route normalization regression relative to production.

Recommended fix:

- Enforce lowercase routing for docs entry points, ideally with a redirect to `/docs` or a `404` for `/Docs`.

### 5. Sampled internal links still point at redirecting URLs

In a 250-link sample from 10 representative pages, 15 links still target redirecting URLs. Examples:

- `/why` -> `/handbook/chapters/why`
- `/docs/evaluation/features/prompt-experiments` -> `/docs/evaluation/experiments/experiments-via-ui`
- `/docs/evaluation/features/datasets` -> `/docs/evaluation/experiments/datasets`
- `/docs/prompts` -> `/docs/prompt-management/get-started`
- `/ask-ai` -> `/docs/ask-ai`

Impact:

- Internal navigation relies on legacy URLs instead of canonical destinations.
- This creates unnecessary hops and makes future redirect cleanup harder.

Recommended fix:

- Update source links in navigation, MDX content, and shared components to point directly at canonical paths.

## Low

### 6. Nine redirect rules with fragment-based sources need manual review

Nine configured redirect rules failed first-hop validation. Most use source URLs with `#fragment` suffixes, for example:

- `/guides/cookbook/python_decorators#interoperability-with-other-integrations`
- `/docs/sdk/python/sdk-v3#multi-project-setup-experimental`
- `/docs/evaluation/evaluation-methods/annotation#annotation-queues`

Impact:

- Fragment identifiers are not sent to the server, so these rules cannot be relied on as normal HTTP redirects.
- Some of the expected destinations also appear stale relative to the current canonical page structure.

Recommended fix:

- Treat these as manual deep-link migration items rather than server redirects, and update in-page links or content anchors directly.
