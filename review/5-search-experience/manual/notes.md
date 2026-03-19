# Manual QA Notes

## Environment

- Target: preview deployment
- Baseline: production
- Reviewer: Codex
- Date: 2026-03-19

## Checks

- Desktop preview: `Cmd/Ctrl+K` opens the search modal on `/docs/observability/get-started`.
- Desktop preview: the widget theme follows the site theme correctly. The dialog background changes from `rgb(25, 25, 25)` in dark mode to `rgb(255, 255, 255)` in light mode.
- Desktop preview: representative queries do not return search results. The UI stays at `Docs (0)` and only shows the Ask AI prompt row.
- Production baseline: the same docs query (`python decorator tracing`) returns populated scopes and canonical results, including `Docs (5)`, `Integrations (21)`, `FAQ & Guides (5)`, `Blog (2)`, `All (57)`, and `GitHub (18)`.
- Production baseline: representative queries return relevant canonical matches for integrations (`/integrations/no-code/goose`), self-hosting (`/self-hosting/deployment/docker-compose`), FAQ (`/faq/all/missing-traces`), and handbook (`/handbook/how-we-hire/hiring-process`).
- Network evidence: preview and production both send an `Authorization` header to `https://api.inkeep.com/graphql`, but preview receives `"(403, 'Not authenticated')"` while production returns hits. The only observed request difference is the `Referer`, which points to the preview Vercel domain on preview and `https://langfuse.com/` on production.
- Mobile preview: the search overlay fits the full `390x844` viewport, but it still shows `Docs (0)` because the same provider error blocks result retrieval.

## Conclusion

- Search UI presence and theme synchronization pass on preview.
- Search relevance, scopes, canonical result validation, and mobile result retrieval fail on preview because the provider rejects preview-origin search requests.

## Evidence

- Automated report: `review/5-search-experience/artifacts/preview-search-report.json`
- Preview desktop dark screenshot: `review/5-search-experience/artifacts/preview-search-dark.png`
- Preview desktop light screenshot: `review/5-search-experience/artifacts/preview-search-light.png`
- Preview mobile screenshot: `review/5-search-experience/artifacts/preview-search-mobile.png`
- Production desktop baseline screenshot: `review/5-search-experience/artifacts/production-search-dark.png`
