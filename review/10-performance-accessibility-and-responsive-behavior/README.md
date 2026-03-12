# Chapter 10: Performance, Accessibility, and Responsive Behavior

## Review objective

Confirm that the migrated site remains fast enough, keyboard-usable, and mobile-safe on representative page types.

## Scope

This chapter covers:

- Preview-versus-production comparisons for representative docs, marketing, and guide pages.
- Same-origin transfer-weight checks for scripts, fonts, images, and total page bytes.
- Preview-only keyboard, dialog, code-block, and mobile-overflow checks on docs pages.
- Preview-only accessibility smoke checks for visible unlabeled controls, unlabeled form fields, and untitled iframes.

This chapter does not own search relevance, content fidelity, or metadata correctness. Those remain covered by Chapters 5, 6, and 7.

## How to run

```bash
node review/10-performance-accessibility-and-responsive-behavior/tests/run-performance-accessibility-review.mjs
```

Optional environment variables:

- `PREVIEW_BASE_URL` defaults to `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- `PROD_BASE_URL` defaults to `https://langfuse.com`
- `OUTPUT_DIR` defaults to `review/10-performance-accessibility-and-responsive-behavior/evidence`
- `HEADLESS` defaults to `true`

The runner exits non-zero when it detects a launch-blocking Chapter 10 regression.

## Evidence produced

The runner writes:

- `summary.md` for the reviewer-facing chapter result
- `summary.json` for the machine-readable chapter result
- `performance.json` for preview-versus-production load metrics and transfer-weight comparisons
- `accessibility-smoke.json` for preview accessibility smoke findings on representative pages
- `responsive-and-keyboard.json` for preview keyboard, dialog, code-block, and mobile-docs checks
- `screenshots/*` for representative search, feedback, and mobile docs states

## Checklist mapping

| Checklist item | Evidence | Method |
| --- | --- | --- |
| Representative pages do not show major loading regressions | `performance.json` | Compare preview and production timings plus transferred bytes on a fixed route set |
| Large images, fonts, and scripts do not introduce unnecessary page weight | `performance.json` | Inventory the largest transferred resources and flag oversized preview JS chunks or large preview deltas |
| Docs pages do not ship unusually heavy client bundles | `performance.json`, `issues.md` | Compare preview same-origin `_next/static` script transfer on docs routes against production |
| Layout shift is controlled | `performance.json` | Capture CLS via `PerformanceObserver` on representative preview and production pages |
| Keyboard navigation works across header, sidebar, search, dialogs, and feedback flows | `responsive-and-keyboard.json`, `manual/notes.md` | Automate header/sidebar/feedback keyboard flows, then validate the lazy-loaded search dialog in a real browser pass |
| Focus visibility and focus order remain correct | `responsive-and-keyboard.json`, `manual/notes.md` | Record focused elements reached in tab order and manually verify visible focus states |
| No obvious contrast regressions | `manual/notes.md` | Manual spot check on desktop and mobile docs chrome |
| Mobile layouts remain usable across docs navigation and long content pages | `responsive-and-keyboard.json`, `manual/notes.md` | Assert no page-level horizontal overflow, sticky docs controls remain usable, and site nav opens on mobile |
| Code blocks remain selectable and usable | `responsive-and-keyboard.json` | Programmatically select sample code-block text and verify horizontal scrolling stays inside the code container |
| Dialogs and overlays do not trap focus incorrectly | `responsive-and-keyboard.json` | Keep focus inside search and feedback dialogs while open and assert focus restoration after close |

## Files in this chapter

- `review/10-performance-accessibility-and-responsive-behavior/plan.md`
- `review/10-performance-accessibility-and-responsive-behavior/tests/run-performance-accessibility-review.mjs`
- `review/10-performance-accessibility-and-responsive-behavior/manual/notes.md`
- `review/10-performance-accessibility-and-responsive-behavior/issues.md`
