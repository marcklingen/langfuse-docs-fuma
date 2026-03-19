# Chapter 10: Performance, Accessibility, and Responsive Behavior

## Objective

Confirm that the migrated site does not introduce material regressions in loading performance, accessibility, keyboard usability, or mobile responsiveness.

## Scope

- Automated checks compare the preview deployment against production for representative page types.
- Accessibility scans run on the preview deployment with `axe-core` inside Chromium.
- Responsive checks include a mobile DOM audit plus manual browser QA for navigation, dialogs, overlays, and code blocks.

## Representative pages

- Docs landing: `/docs`
- Deep docs page: `/docs/observability/get-started`
- Video guide: `/guides/videos/introducing-datasets-v2`
- Self-hosting long-form page: `/self-hosting/deployment/docker-compose`

## Structure

- `tests/run-performance-accessibility-review.mjs`: automated Chromium audit for performance, page weight, accessibility, and mobile overflow.
- `manual/notes.md`: manual keyboard, focus, dialog, and responsive QA notes.
- `issues.md`: findings, severity, impact, and proposed fixes.
- `artifacts/`: JSON reports and screenshots referenced by this chapter.

## Runbook

Run the automated audit against preview and production:

```bash
node review/10-performance-accessibility-and-responsive-behavior/tests/run-performance-accessibility-review.mjs \
  --preview-url https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app \
  --production-url https://langfuse.com \
  --output review/10-performance-accessibility-and-responsive-behavior/artifacts/preview-vs-production-report.json
```

The script uses throttled Chromium to compare render metrics and resource weight, then runs `axe-core` and mobile overflow checks on the preview deployment. It exits non-zero if any blocking findings are detected.

## Evidence Index

- Automated comparison report:
  `review/10-performance-accessibility-and-responsive-behavior/artifacts/preview-vs-production-report.json`
- Manual QA notes:
  `review/10-performance-accessibility-and-responsive-behavior/manual/notes.md`
- Manual screenshots:
  `review/10-performance-accessibility-and-responsive-behavior/manual/screenshots/`
