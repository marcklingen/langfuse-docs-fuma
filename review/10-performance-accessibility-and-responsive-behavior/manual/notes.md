# Chapter 10 Manual Notes

## Target environment

- Preview deployment: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- Browser: Playwright-driven Chromium
- Date: 2026-03-19

## Automated baseline

- Report: `review/10-performance-accessibility-and-responsive-behavior/artifacts/preview-vs-production-report.json`
- Result: fail
- Sampled pages:
  - `/docs`
  - `/docs/observability/get-started`
  - `/guides/videos/introducing-datasets-v2`
  - `/self-hosting/deployment/docker-compose`

## Manual checks and observations

### Keyboard navigation and focus order

- On `/docs/observability/get-started`, the first ten `Tab` stops moved through the announcement CTA, banner close button, an unlabeled home link, careers link, `Product`, `Resources`, `Docs`, `Changelog`, `Pricing`, and then a focusable empty `div` from the search widget wrapper.
- Visible focus treatment was generally present on banner and header controls through either browser outlines or Tailwind ring shadows.
- The unlabeled home link reproduced the automated `link-name` accessibility failure and is not screen-reader safe.

### Search dialog and focus trap

- Triggering the header search control opened a dialog and moved focus directly into the search input.
- Repeated `Tab` presses stayed inside the dialog, alternating between the search field and the `ESC` button.
- `Escape` closed the dialog successfully.
- Screenshot: `manual/screenshots/search-dialog.png`

### Mobile docs navigation

- At `390x844`, the docs sidebar opened successfully from the mobile `Open Sidebar` control.
- The opened drawer showed the expected docs navigation sections (`Overview`, `Example Project`, `Ask AI`, `Get Started`, `Products`, `Platform`, `More`).
- No horizontal overflow was observed on the sampled docs page.
- Screenshot: `manual/screenshots/mobile-sidebar.png`

### Code blocks

- On `/self-hosting/deployment/docker-compose`, the sampled code block remained selectable (`selectedLength: 62`) with `user-select: auto`.
- Sampled `pre` blocks did not require horizontal scrolling on desktop; they wrapped normally and remained readable.
- Screenshot: `manual/screenshots/code-block.png`

## Manual summary

- Passed:
  - Search dialog opened, trapped focus, and closed correctly.
  - Mobile docs sidebar remained usable on the sampled page.
  - Sampled code blocks were selectable.
- Failed:
  - Header/side navigation still exposes unlabeled interactive elements in the keyboard sequence.
  - The search widget wrapper can receive focus as an empty `div`, which is a poor keyboard affordance even though the search dialog itself works.
