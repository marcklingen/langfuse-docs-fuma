# Chapter 5 Issues

## Confirmed issues

### [High] Preview client-side docs search is effectively broken because the Inkeep widget cannot fetch authenticated search results

- Environment: preview deployment
- Evidence: `review/5-search-experience/evidence/search-ui.json`, `review/5-search-experience/manual/notes.md`, `review/5-search-experience/evidence/screenshots/preview-desktop-search-light.png`, `review/5-search-experience/evidence/screenshots/production-desktop-search-light.png`
- Observed behavior: on preview, representative queries such as `docker compose` and `open source handbook` leave the client widget stuck on `Docs (0)` and only show the fallback `Ask AI` option. The browser console records `Error in graphqlRequest: Error: (403, 'Not authenticated')` during the same flow.
- Baseline comparison: current production returns populated scope tabs for the same UI queries, including non-doc scopes such as `Integrations`, `Self Hosting`, `FAQ & Guides`, `All`, `GitHub`, and `Handbook` when relevant.
- Why it matters: Chapter 5 is specifically about the on-site search experience. Users on preview cannot validate search relevance, scope switching, or result selection in the actual widget even though the REST search endpoint still answers.
- Suggested fix: audit the preview Inkeep client configuration and deployment registration so the widget is allowed to query from the preview hostname. The `403` plus the preview-only empty scopes strongly suggest an environment or site-registration mismatch rather than a rendering bug in the modal itself.
