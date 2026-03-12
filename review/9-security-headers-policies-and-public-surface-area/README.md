# Chapter 9: Security Headers, Policies, and Public Surface Area

## Review objective

Ensure the migration does not weaken the deployed security posture or expose unintended public surfaces.

## Scope

This chapter covers:

- Representative HTML routes on both preview and current production for baseline headers, CSP presence, HTTPS redirects, and preview `noindex` behavior.
- The public `/api/search-docs` contract because it intentionally exposes wildcard CORS and is documented as a cross-origin REST surface.
- The `/api/md-to-pdf` route because it fetches remote markdown and therefore needs a stable SSRF allowlist.
- A source audit for wildcard-CORS routes, preview `noindex` configuration, CSP tokens, and client-side environment-variable usage.
- Browser-based page loads on representative routes to catch CSP and mixed-content failures that do not show up in raw header snapshots.

This chapter does not verify the functional correctness of search answers, MCP tool behavior, or allowed PDF generation for real Langfuse markdown inputs. Those remain covered by Chapters 4 and 5.

## How to run

```bash
node review/9-security-headers-policies-and-public-surface-area/tests/run-security-review.mjs
```

Optional environment variables:

- `PREVIEW_BASE_URL` defaults to `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- `PROD_BASE_URL` defaults to `https://langfuse.com`
- `OUTPUT_DIR` defaults to `review/9-security-headers-policies-and-public-surface-area/evidence`
- `HEADLESS` defaults to `true`

## Evidence produced

The runner writes:

- `summary.md` for the reviewer-facing result summary
- `summary.json` for the machine-readable chapter result
- `source-contract.json` for source-derived header, CORS, SSRF, and client-env expectations
- `header-snapshots.json` for live headers across representative preview and production routes
- `https-redirects.json` for explicit HTTP-to-HTTPS redirect checks
- `cors-surface.json` for the live `/api/search-docs` CORS contract plus source documentation references
- `pdf-ssrf.json` for the blocked-host `/api/md-to-pdf` checks and allowlist snapshot
- `bundle-scan.json` for downloaded client-bundle scans for forbidden server-side tokens or preview hosts
- `browser-security.json` for CSP and mixed-content observations from real browser page loads

## Checklist mapping

| Checklist item | Evidence | Method |
| --- | --- | --- |
| Production CSP remains effective and compatible with required functionality | `header-snapshots.json`, `browser-security.json` | Compare live CSP headers on representative HTML routes and load those routes in a headless browser to catch CSP violations |
| Baseline security headers remain present | `header-snapshots.json` | Assert `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `X-Frame-Options` on representative routes |
| HTTPS-only behavior and redirect posture remain correct | `https-redirects.json`, `header-snapshots.json` | Issue explicit HTTP requests and confirm redirect-to-HTTPS plus HSTS on the HTTPS responses |
| No mixed-content loading | `browser-security.json` | Inspect browser console, failed insecure requests, and DOM resource URLs on representative pages |
| Sensitive secrets are not exposed in client bundles or public responses | `source-contract.json`, `bundle-scan.json` | Audit `use client` modules for server-only env usage and scan downloaded same-origin JS bundles for private env tokens |
| Preview deployments remain non-indexable | `header-snapshots.json` | Assert `X-Robots-Tag: noindex` on representative preview HTML and API responses while keeping production HTML indexable |
| Wildcard-CORS public endpoints are still intentional and documented | `source-contract.json`, `cors-surface.json` | Discover wildcard-CORS routes from source, verify the live `/api/search-docs` behavior, and confirm doc references exist |
| SSRF protections for PDF generation remain in place | `source-contract.json`, `pdf-ssrf.json` | Read the allowlist from source and request a blocked host from `/api/md-to-pdf` in both environments |

## Files in this chapter

- [tests/run-security-review.mjs](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/9-security-headers-policies-and-public-surface-area/tests/run-security-review.mjs)
- [manual/notes.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/9-security-headers-policies-and-public-surface-area/manual/notes.md)
- [issues.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/9-security-headers-policies-and-public-surface-area/issues.md)
