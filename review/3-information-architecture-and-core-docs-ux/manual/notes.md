# Chapter 3 Manual Notes

## Pending checks

- Compare the docs landing page and one deep docs page side-by-side between production and preview to confirm overall familiarity, not just DOM parity.
- Verify the announcement banner close state on a normal browser profile across fresh tabs and a second browser session.
- Exercise the mobile site nav, docs sidebar drawer, and TOC popover on an actual touch device or device emulator to confirm there are no gesture or scroll-lock regressions. The automated runner currently covers the site nav and TOC popover reliably, but the drawer interaction itself remains a manual check.
- Check contributor hovercards and outbound GitHub profile links in a real browser interaction flow.
- Verify keyboard-only navigation through the desktop top nav, docs sidebar, and TOC links.

## Notes

- Use the automated artifacts in `review/3-information-architecture-and-core-docs-ux/evidence/` as the source of truth for the current rendered structure.
- Local runs may emit missing-environment warnings from search, analytics, or auth-related integrations. Treat those separately unless they block the page chrome or navigation itself.
