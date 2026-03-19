# Manual QA Notes

## Environment

- Date: 2026-03-19
- Base URL: `http://127.0.0.1:3333`
- Breakpoints:
  - Desktop: `1600x1200`
  - Mobile: `390x844`

## Pages reviewed

- `/docs`
- `/docs/observability/get-started`
- `/docs/api-and-data-platform/features/export-from-ui`

## Checklist

- [x] Announcement banner renders, dismisses, and stays dismissed after reload
- [x] Global top navigation is usable on desktop
- [x] Sidebar menu-switcher links are visible and usable on desktop
- [x] Docs sidebar curated entries and separators render correctly
- [x] Breadcrumbs are accurate on a deep docs page
- [x] TOC links scroll to the expected section
- [ ] Back-to-top behavior is present and reliable
- [x] Edit link points to the correct GitHub source file
- [x] Contributors block appears on contributor-backed page(s)
- [x] Mobile nav toggle opens and closes correctly
- [x] Mobile docs sidebar is reachable and usable
- [x] Sticky page chrome behaves correctly on small screens

## Findings

- Desktop walkthrough on `/docs/observability/get-started` confirmed the expected global nav, sidebar menu-switcher, curated docs IA, breadcrumbs, TOC, edit link, and footer chrome. Banner dismissal persisted after reload within the same browser session.
- TOC interaction worked: clicking `Set up your AI agent` updated the URL hash to `#set-up-your-ai-agent` and scrolled the corresponding heading into view near the top of the viewport.
- Contributor-backed page `/docs/api-and-data-platform/features/export-from-ui` rendered the contributors block in the TOC column with `tomaszantas`.
- Mobile walkthrough on `/docs/observability/get-started` confirmed the global nav hamburger, the sticky mobile page chrome, and the mobile TOC trigger. At `scrollY=700`, the header remained pinned at `top=0` and the mobile TOC trigger remained pinned directly below it (`top=64`).
- No visible `Back to top` control was present on desktop or mobile. Browser query for text matching `Back to top` returned `0`, and repo search found no implementation for that affordance.

## Evidence

- Automated report: [`artifacts/check-results.json`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/3-information-architecture-and-core-docs-ux/artifacts/check-results.json)
- Desktop deep-page screenshot: [`desktop-observability-get-started.png`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/3-information-architecture-and-core-docs-ux/manual/screenshots/desktop-observability-get-started.png)
- Desktop contributors screenshot: [`desktop-contributors-export-from-ui.png`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/3-information-architecture-and-core-docs-ux/manual/screenshots/desktop-contributors-export-from-ui.png)
- Mobile screenshot: [`mobile-observability-get-started.png`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/3-information-architecture-and-core-docs-ux/manual/screenshots/mobile-observability-get-started.png)
