# Chapter 9 Issues

## Findings

### P1: Preview `md-to-pdf` is broken for allowlisted Langfuse markdown inputs

- Evidence:
  - Automated report: `review/9-security-headers-policies-and-public-surface-area/artifacts/security-review-report.json`
  - Preview repro:
    - `curl -si 'https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app/api/md-to-pdf?url=https%3A%2F%2Flangfuse.com%2Fsecurity%2Fdpa.md'`
    - Result: `HTTP/2 500` with `{"error":"Internal server error while generating PDF","message":"An unexpected error occurred."}`
  - Production comparison:
    - `curl -si 'https://langfuse.com/api/md-to-pdf?url=https%3A%2F%2Flangfuse.com%2Fsecurity%2Fdpa.md'`
    - Result: `HTTP/2 200` with `Content-Type: application/pdf`
- Impact:
  - The migration preview fails a kept public endpoint that is explicitly covered by the review plan.
  - This blocks confidence in the `md-to-pdf` public surface and prevents validating the route end-to-end on the new stack.
- Likely area to inspect:
  - Preview deployment logs for `app/api/md-to-pdf/route.ts`
  - Chromium/Puppeteer packaging in preview serverless output
  - Any preview-only runtime or memory differences affecting `@sparticuz/chromium` launch
- Proposed fix:
  - Restore `200 application/pdf` behavior on preview for allowlisted Langfuse URLs, then rerun the Chapter 4 and Chapter 9 PDF checks.

## Out-of-scope observations

- Preview browser runs showed CookieYes host-registration errors, PostHog missing-token errors, and preview-origin CORS failures against `cloud.langfuse.com` session endpoints. Production homepage did not reproduce those errors.
- Preview browser runs also surfaced a missing static asset:
  - `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app/images/integrations/openclaw_icon.png`
  - Source reference: `content/integrations/other/openclaw.mdx`

## Severity scale

- `P1`: launch blocker or meaningful security regression
- `P2`: significant hardening gap or unintended public exposure
- `P3`: minor hardening issue or follow-up cleanup
