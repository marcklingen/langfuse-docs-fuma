# Chapter 3: Information Architecture and Core Docs UX

## Review objective

Confirm that the documentation remains navigable, understandable, and structurally familiar to users.

## Scope

This chapter covers:

- Desktop docs-shell checks for the global top navigation, docs sidebar, menu-switcher, breadcrumbs, TOC, edit link, and contributor block.
- Mobile docs-shell checks for the site navigation drawer, docs sidebar toggle presence, sticky page chrome, and TOC popover.
- Dismissible announcement-banner behavior and stable persistence through reloads.
- Screenshot capture for representative docs landing and deep docs pages.

This chapter does not own search relevance, feedback submission, analytics, or markdown fidelity. Those belong to Chapters 5, 8, and 6 respectively.

## How to run

```bash
node review/3-information-architecture-and-core-docs-ux/tests/run-docs-ux-review.mjs
```

Optional environment variables:

- `BASE_URL` defaults to `http://localhost:3333`
- `OUTPUT_DIR` defaults to `review/3-information-architecture-and-core-docs-ux/evidence`
- `HEADLESS` defaults to `true`

## Evidence produced

The runner writes:

- `summary.md` for the reviewer-facing result summary
- `docs-shell.json` for the structured desktop and mobile assertions
- `screenshots/desktop-docs-root.png` for the docs landing page chrome
- `screenshots/desktop-docs-deep-page.png` for a representative deep docs page
- `screenshots/mobile-site-nav.png` for the mobile site navigation drawer
- `screenshots/mobile-docs-chrome.png` for the mobile docs page chrome and sidebar toggle state
- `screenshots/mobile-toc-popover.png` for the mobile TOC popover

## Checklist mapping

| Checklist item | Evidence | Method |
| --- | --- | --- |
| Global top navigation still exposes key Langfuse sections | `docs-shell.json.desktopRoot.topNav` | Validate desktop header links plus Product and Resources dropdown contents |
| Docs sidebar structure remains complete and correctly ordered | `docs-shell.json.desktopRoot.sidebar`, `docs-shell.json.deepDoc.sidebar` | Compare rendered sidebar order to the expected curated docs structure |
| Section separators, menu-switcher behavior, and curated sidebar entries still work | `docs-shell.json.desktopRoot.menuSwitcher`, `docs-shell.json.menuSwitcherRoutes`, `docs-shell.json.desktopRoot.sidebar` | Validate menu-switcher labels and active-state routing across representative sections |
| Breadcrumbs and in-page table of contents are accurate | `docs-shell.json.deepDoc.breadcrumbs`, `docs-shell.json.deepDoc.toc` | Validate breadcrumb labels, TOC labels, and TOC target existence on a deep docs page |
| TOC anchor links and back-to-top behavior are reliable | `docs-shell.json.deepDoc.toc`, `docs-shell.json.deepDoc.backToTop` | Confirm TOC anchors resolve and that the first TOC entry returns the viewport to the document top |
| "Edit this page on GitHub" points to the correct source file | `docs-shell.json.deepDoc.editLink` | Assert the rendered GitHub edit URL matches the expected MDX source path |
| Contributors block appears where expected and shows correct entries | `docs-shell.json.deepDoc.contributors` | Compare rendered contributor profile links with `data/generated/contributors.json` |
| Dismissible announcement banner still works and persists | `docs-shell.json.bannerDismissal` | Dismiss the banner, verify localStorage state, and confirm it stays hidden after reload |
| Mobile navigation, sidebar toggles, and sticky page chrome behave on small screens | `docs-shell.json.mobileDeepDoc`, screenshots | Validate the mobile site nav, confirm the docs sidebar toggle is present, and verify sticky TOC/page chrome behavior |

## Files in this chapter

- [tests/run-docs-ux-review.mjs](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/3-information-architecture-and-core-docs-ux/tests/run-docs-ux-review.mjs)
- [manual/notes.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/3-information-architecture-and-core-docs-ux/manual/notes.md)
- [issues.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/3-information-architecture-and-core-docs-ux/issues.md)
