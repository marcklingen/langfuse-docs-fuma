# Chapter 10 Plan

## Objective

Confirm that the preview deployment remains usable under realistic desktop and mobile conditions and does not introduce major performance or accessibility regressions.

## Verification strategy

1. Compare representative preview and production pages for load metrics and transferred resource weight.
2. Audit preview docs pages for keyboard reachability, dialog focus handling, mobile overflow, and code-block usability.
3. Run a preview-only accessibility smoke audit for visible unlabeled controls, unlabeled form fields, and untitled iframes.
4. Capture screenshots and manual notes for focus visibility, contrast, and mobile docs chrome.

## Sample routes

- `/docs/observability/overview`
- `/docs/prompt-management/get-started`
- `/pricing`
- `/guides/videos/run-langfuse-locally`
- `/integrations/no-code/goose`

## Evidence outputs

- `evidence/performance.json`
- `evidence/accessibility-smoke.json`
- `evidence/responsive-and-keyboard.json`
- `evidence/summary.json`
- `evidence/summary.md`
- `evidence/screenshots/*`

## Pass criteria

- Preview CLS stays under `0.1` on representative pages.
- Preview JS transfer on representative pages does not materially exceed the current production baseline.
- No visible unlabeled buttons or unlabeled form fields remain on sampled preview pages.
- Search and feedback dialogs keep focus inside the open modal and restore focus on close.
- Mobile docs pages stay free of page-level horizontal overflow and keep long code blocks usable via selection and horizontal scrolling.
