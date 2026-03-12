# Chapter 9 Issues

Automated evidence for this issue log is in `review/9-security-headers-policies-and-public-surface-area/evidence/`.

## No Confirmed Regressions

- The Chapter 9 runner completed successfully on `2026-03-12T04:23:22.535Z` with no confirmed security-header, CSP, mixed-content, wildcard-CORS, preview-indexing, SSRF, or client-env exposure regressions across the audited preview and production surfaces.
- `summary.json`, `header-snapshots.json`, `https-redirects.json`, `cors-surface.json`, `pdf-ssrf.json`, `bundle-scan.json`, `browser-security.json`, and `source-contract.json` all passed in the final run.

## Preview-Only Validation Note

- A manual Playwright spot check on `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app/docs/observability/overview` surfaced a CookieYes console error stating that the registered site URL no longer matches the preview hostname. The same check on `https://langfuse.com/docs/observability/overview` did not reproduce. Treat this as a preview-host validation limitation for the consent banner rather than a production-domain Chapter 9 blocker.
