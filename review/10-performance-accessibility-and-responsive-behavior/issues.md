# Chapter 10 Issues

## Confirmed issues

### [P1] Preview deployment ships a much heavier client bundle than production

Affected preview pages:

- `/docs/observability/overview`
- `/docs/prompt-management/get-started`
- `/pricing`
- `/guides/videos/run-langfuse-locally`

Why this matters:

- The Chapter 10 performance audit found roughly `5.7 MB` of same-origin `_next/static` script transfer on every sampled preview page, versus roughly `0.83-0.88 MB` on current production.
- The preview deployment consistently ships two individual script chunks around `1.91 MB` each: `f5b171131868de0a.js` and `73eb5f9cd66c61c3.js`.
- This is a launch-blocking page-weight regression even though the synthetic LCP and CLS samples remained acceptable.

Evidence:

- `review/10-performance-accessibility-and-responsive-behavior/evidence/performance.json`
- `review/10-performance-accessibility-and-responsive-behavior/evidence/summary.md`

Proposed fix:

- Inspect the preview chunk graph and compare the contents of `f5b171131868de0a.js` and `73eb5f9cd66c61c3.js` against production to determine why the new deployment is shipping multi-megabyte shared chunks on every route.
- Check whether the preview build is duplicating large client bundles, including debug-only code, or inlining libraries that production currently splits out more effectively.

### [P2] The docs page-actions chevron button is visible but has no accessible name

Affected preview pages:

- `/docs/observability/overview`
- `/docs/prompt-management/get-started`
- `/integrations/no-code/goose`

Why this matters:

- The visible chevron-only trigger next to `Copy page` is keyboard-focusable but exposes no text, `aria-label`, or `title`.
- This creates a silent control for screen-reader users and showed up consistently in the Chapter 10 accessibility smoke audit.

Evidence:

- `review/10-performance-accessibility-and-responsive-behavior/evidence/accessibility-smoke.json`
- `components/MainContentWrapper.tsx`

Proposed fix:

- Add an explicit accessible name such as `aria-label="Open page actions"` to the dropdown trigger button in `components/MainContentWrapper.tsx`.

### [P2] The feedback follow-up dialog closes back to `body` instead of restoring focus to the triggering button

Affected preview pages:

- Docs pages that render the `Was this page helpful?` widget

Why this matters:

- The automated keyboard test and the manual browser pass both showed that pressing `Escape` closes the feedback dialog but leaves focus on `document.body`.
- The same dialog implementation also renders `DialogContent` without a `DialogTitle` or `DialogDescription`, which triggered accessibility diagnostics in the browser console.

Evidence:

- `review/10-performance-accessibility-and-responsive-behavior/evidence/responsive-and-keyboard.json`
- `review/10-performance-accessibility-and-responsive-behavior/manual/notes.md`
- `components/MainContentWrapper.tsx`

Proposed fix:

- Add proper `DialogHeader`, `DialogTitle`, and `DialogDescription` content to the feedback modal.
- Capture the invoking feedback button and restore focus to it when the dialog closes.

### [P2] The search dialog also returns focus to `body` on close and emits missing-dialog-label warnings

Affected preview pages:

- Docs pages with the desktop search trigger

Why this matters:

- In the real browser pass, the desktop search dialog opened successfully but closing it with `Escape` returned focus to `document.body` instead of the search trigger.
- Opening the dialog emitted Radix accessibility diagnostics for missing `DialogTitle` and missing `aria-describedby`, which means assistive-technology users do not get a complete dialog label/description contract.

Evidence:

- `review/10-performance-accessibility-and-responsive-behavior/manual/notes.md`
- `components/inkeep/InkeepSearchBar.tsx`

Proposed fix:

- Check whether the Inkeep modal can be configured with an accessible title, description, and focus-restoration behavior through the existing `modalSettings`.
- If the third-party component does not expose the required hooks, track this as an upstream integration gap and wrap it with a local trigger/focus-restoration shim.
