# Chapter 9: Security Headers, Policies, and Public Surface Area

## Objective

Confirm that the migration does not weaken the site security posture, expose unintended public surfaces, or leak deployment-sensitive data.

## Scope

- Automated checks run against the preview deployment by default and compare representative HTML routes to current production.
- Static inspection covers the documented public CORS surface and scans public HTML and JS assets for forbidden deployment tokens.
- Manual browser validation focuses on CSP compatibility, mixed-content behavior, and third-party embeds/scripts on representative pages.

## Structure

- `tests/run-security-review.mjs`: automated Chapter 9 review script.
- `artifacts/security-review-report.json`: machine-readable result report from the automated run.
- `manual/notes.md`: browser-based validation notes and screenshot index.
- `issues.md`: chapter findings, severity, impact, and proposed fixes.

## Runbook

Run the automated review against preview and production:

```bash
node review/9-security-headers-policies-and-public-surface-area/tests/run-security-review.mjs \
  --preview-url https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app \
  --production-url https://langfuse.com \
  --output review/9-security-headers-policies-and-public-surface-area/artifacts/security-review-report.json
```

The script exits non-zero if any checks fail, but it still writes the JSON report first.

## Manual validation targets

- `/`
- `/docs/prompt-management/get-started`
- `/guides/videos/introducing-datasets-v2`

During the browser pass, verify:

- no CSP violations in the console
- no insecure `http://` resource requests
- third-party scripts and embeds load without being blocked by CSP
- preview pages still emit `X-Robots-Tag: noindex`

Capture screenshots under `output/playwright/chapter-9/` and summarize the results in `manual/notes.md`.

## Evidence Index

- Automated security report:
  `review/9-security-headers-policies-and-public-surface-area/artifacts/security-review-report.json`
- Manual browser notes:
  `review/9-security-headers-policies-and-public-surface-area/manual/notes.md`
