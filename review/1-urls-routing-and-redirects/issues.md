# Chapter 1 Issues

Issues found while executing the chapter 1 review are documented below with severity, evidence, and proposed fixes.

## Findings

### High: 107 legacy redirects still take more than one hop before reaching the canonical page

Evidence:

- `artifacts/route-audit.json` recorded `107` non-fragment redirect-chain failures and `0` production-vs-preview regressions, so the problem is concentrated in the configured redirect map rather than missing pages.
- Representative failures:
  - `/docs/analytics` -> `/docs/analytics/overview` -> `/docs/metrics/overview`
  - `/docs/langchain` -> `/docs/integrations/langchain/tracing` -> `/integrations/frameworks/langchain`
  - `/docs/datasets` -> `/docs/datasets/overview` -> `/docs/evaluation/experiments/datasets`

Where:

- Legacy redirects still point at intermediate destinations in [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js#L47), [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js#L58), [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js#L71), and [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js#L617).
- Those intermediate destinations are themselves redirected again later in the file, especially in [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js#L368) and [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js#L607).

Impact:

- This violates the chapter 1 single-hop invariant for legacy URLs.
- It adds unnecessary latency and weakens redirect quality for crawlers and external backlinks.

Proposed fix:

- Collapse each legacy source directly to the final canonical destination instead of redirecting to another redirect source.
- Add a CI check that fails if any configured redirect destination also appears as a redirect source.

### High: 10 anchor-oriented legacy redirects resolve to the wrong page or do not redirect at all

Evidence:

- `artifacts/route-audit.json` recorded `10` redirect failures whose sources include URL fragments, including:
  - `/guides/cookbook/python_decorators#interoperability-with-other-integrations` -> `404`
  - `/docs/sdk/python/sdk-v3#multi-project-setup-experimental` -> `/docs/observability/sdk/overview` instead of the advanced-features anchor
  - `/docs/evaluation/evaluation-methods/annotation#annotation-queues` -> `/docs/evaluation/evaluation-methods/scores-via-ui`

Where:

- Fragment-bearing redirect sources are configured in [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js#L878), [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js#L979), [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js#L1014), and across the SDK reference block starting at [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js#L1040).

Impact:

- HTTP redirect matching never sees the `#fragment`, so these rules are either dead config or route users to the wrong page via the base-path redirect.
- Deep links from old docs can land on a related page instead of the intended section, or fail outright.

Proposed fix:

- Remove fragment-bearing sources from the redirect map and redirect the base path to the correct destination page.
- Preserve the fragment only on the destination side, and only when the target section actually exists.

### Medium: one configured redirect and one in-product docs link are hard-broken

Evidence:

- `artifacts/route-audit.json` shows `/superagent` redirecting to `/docs/integrations/superagent`, which returns `404`.
- The internal-link audit found `/docs/integrations/livekit` returning `404` with a soft-404 signature; it is linked from the voice agent UI.

Where:

- Broken redirect target: [`lib/redirects.js`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/redirects.js#L358)
- Broken in-product links: [`components/voiceAgent/index.tsx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/components/voiceAgent/index.tsx#L214) and [`components/voiceAgent/index.tsx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/components/voiceAgent/index.tsx#L304)

Impact:

- The shortlink is a dead user journey.
- The live voice demo points users to a missing docs page instead of the existing `/integrations/frameworks/livekit` page.

Proposed fix:

- Point `/superagent` at a real destination or remove the shortlink.
- Update the voice agent component links to `/integrations/frameworks/livekit` or add a redirect from `/docs/integrations/livekit`.

### Medium: 117 current internal links still point at redirecting legacy URLs

Evidence:

- `artifacts/route-audit.json` recorded `119` internal-link issues, of which `117` are redirect-only and therefore self-inflicted.
- Representative examples:
  - [`content/marketing/cn.mdx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/content/marketing/cn.mdx#L50) links to `/docs/tracing`
  - [`content/docs/index.mdx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/content/docs/index.mdx#L147) links to `/discord`
  - [`content/changelog/2024-05-16-prompts-version-insights.mdx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/content/changelog/2024-05-16-prompts-version-insights.mdx#L12) links to `/docs/prompts`

Impact:

- The site is sending users and crawlers through avoidable redirects from its own pages.
- This makes route behavior look stable in manual browsing while still failing the chapter 1 "link directly to canonical destinations" requirement.

Proposed fix:

- Batch-rewrite internal links to their final canonical paths.
- Re-run the chapter 1 audit after the rewrite and keep the internal-link redirect check in CI so the count does not grow again.
