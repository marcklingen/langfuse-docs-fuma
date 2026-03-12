# Chapter 10 Manual Notes

## Run metadata

- Date: 2026-03-11 (America/Los_Angeles)
- Environment: preview deployment
- Reviewer: Codex

## Focus visibility and contrast

- Spot-checked the desktop docs page, the feedback dialog, the mobile site nav, and the mobile TOC popover in a real browser.
- No obvious low-contrast text surfaced in the tested desktop or mobile states.
- Search and feedback dialogs both closed visually as expected, but closing either dialog with `Escape` returned focus to `document.body` instead of the invoking control.

## Mobile sanity checks

- The docs page remained free of page-level horizontal overflow on a `390x844` viewport.
- The sticky mobile TOC control stayed pinned while scrolling and exposed the expected anchors.
- The mobile site nav opened cleanly and preserved the major section links.
- The floating Ask AI pill remained visible above the lower-right corner while overlays were open, but it did not block the controls exercised during this pass.

## Additional observations

- The desktop search trigger rendered and opened correctly in the real browser even though the third-party widget was not stable in headless Puppeteer.
- Opening the search dialog emitted Radix accessibility diagnostics in the browser console: missing `DialogTitle` and missing `aria-describedby`.
- Closing the search dialog with `Escape` also returned focus to `document.body`, matching the feedback-dialog focus-restoration issue.
