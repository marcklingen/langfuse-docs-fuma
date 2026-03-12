# Chapter 1 Summary

## Environments

- Production: `https://langfuse.com`
- Preview: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`

## Results

- Production sitemap URLs replayed: 785
- Sitemap parity failures: 9
- Redirect rules checked: 489
- Redirect rules with extra internal hops: 109
- Redirect status regressions vs production: 7
- Redirect first-hop mismatches: 9
- Total redirect rule failures: 124
- Anchor fixtures checked: 6
- Missing anchor targets: 0
- Sampled internal links traced: 250
- Sampled internal links with redirects or non-200 finals: 15
- Trailing-slash duplicate live URLs: 0
- Mixed-case URLs returning 200: 1

## Notable findings

- 9 production sitemap URLs return non-200 responses on preview. Examples: `/blog/2026-03-10-simplify-langfuse-for-scale`, `/changelog/2026-03-10-simplify-for-scale`, `/docs/observability/sdk/upgrade-path/js-v3-to-v4`, `/docs/observability/sdk/upgrade-path/js-v4-to-v5`, `/docs/observability/sdk/upgrade-path/python-v2-to-v3`
- 109 configured internal redirects add extra hops because the configured destination redirects again. Examples: `/docs/sso` -> `/self-hosting/security/authentication-and-sso`, `/docs/analytics` -> `/docs/metrics/overview`, `/public-metrics-dashboard` -> `/handbook/chapters/why`, `/docs/integrations` -> `/integrations`, `/docs/scores` -> `/docs/evaluation/overview`
- 7 exact redirect sources changed status code versus production, led by the `/customers` family returning `307` on preview instead of production's `308`.
- 9 redirect rules failed first-hop validation. Most are hash-fragment rules that cannot be exercised at the HTTP layer and should be reviewed manually.
- Mixed-case path `/Docs` returns `200` on preview even though production returns `404`, creating a duplicate live docs URL.
- 15 sampled internal links still point to redirecting URLs. Examples: `/discord`, `/why`, `/docs/evaluation/features/prompt-experiments`, `/docs/evaluation/features/datasets`, `/open-source`

## Manual follow-up

- Verify browser scroll/landing behavior for the deep-link fixtures listed in `manual/notes.md`.
- Confirm whether any sampled internal-link redirects are acceptable legacy behavior or should be normalized in source links.
