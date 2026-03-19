# Chapter 5 Findings

## Severity scale

- `P1`: launch blocker or broken core search workflow
- `P2`: significant but non-blocking search regression
- `P3`: minor regression or polish issue

## Findings

### `P1` Preview docs search is non-functional because the provider rejects preview-origin requests

Search opens on the preview docs pages, but representative queries never return results. The preview modal stays at `Docs (0)` on desktop and mobile while the underlying `https://api.inkeep.com/graphql` call returns `"(403, 'Not authenticated')"` for every tested query. Production returns populated scopes and relevant canonical results for the same queries, and both environments send an `Authorization` header. The observed request difference is the `Referer`, which strongly suggests the preview Vercel domain is not authorized in the Inkeep search configuration or allowlist. This is a launch blocker because docs search is a core UX invariant called out in the migration plan.

Evidence:

- `review/5-search-experience/artifacts/preview-search-report.json`
- `review/5-search-experience/artifacts/preview-search-dark.png`
- `review/5-search-experience/artifacts/preview-search-mobile.png`
- `review/5-search-experience/artifacts/production-search-dark.png`

Proposed fix:

- Authorize the preview deployment origin in the Inkeep search configuration, or update the preview search credentials/config so the preview `Referer` is accepted by `api.inkeep.com`.
- Re-run Chapter 5 after the config change to confirm populated scopes and canonical results return on preview.
