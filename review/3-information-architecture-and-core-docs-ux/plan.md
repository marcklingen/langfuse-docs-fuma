# Chapter 3 Plan: Information Architecture and Core Docs UX

## Objective

Confirm that the migrated docs remain navigable, structurally familiar, and usable across desktop and mobile.

## Target environment

- Primary: `http://127.0.0.1:3333`
- Fallback/reference: preview deployment from [main.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/main.md)

## Representative pages

- Docs landing page: `/docs`
- Deep docs page: `/docs/observability/get-started`
- Contributor sample page: `/docs/api-and-data-platform/features/export-from-ui`

## Verification approach

### Automated checks

Run [`check_docs_ux.py`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/3-information-architecture-and-core-docs-ux/tests/check_docs_ux.py) against the local dev server to validate:

- global docs chrome is reachable
- sidebar menu-switcher entries are present
- curated docs sidebar entries and separators are present in the expected order
- breadcrumbs are present on a deep docs page
- TOC entries map to real heading IDs
- edit link resolves to the expected source file
- contributor block appears on a known contributor-backed page
- header, footer, sidebar, breadcrumb, and TOC internal links do not fail

Artifacts written by the script:

- [`artifacts/check-results.json`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/3-information-architecture-and-core-docs-ux/artifacts/check-results.json)

### Manual browser walkthrough

Use Playwright against desktop and mobile breakpoints to verify:

- announcement banner renders, dismisses, and stays dismissed after reload
- top navigation remains usable
- sidebar toggle and menu-switcher behavior
- breadcrumbs and TOC behavior in the rendered UI
- back-to-top behavior
- mobile sidebar toggle, sticky page chrome, and small-screen layout

Artifacts:

- [`manual/notes.md`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/3-information-architecture-and-core-docs-ux/manual/notes.md)
- screenshots under `manual/screenshots/`

## Checklist mapping

| Checklist item | Verification |
| --- | --- |
| Global top navigation exposes key sections | Manual desktop walkthrough + automated link checks |
| Docs sidebar remains complete and ordered | Automated sidebar structure check |
| Separators, menu-switcher, curated entries work | Automated presence/order check + manual click-through |
| Breadcrumbs and TOC are accurate | Automated parsing + manual click validation |
| TOC anchors and back-to-top work | Automated anchor existence + manual interaction |
| Edit link is present and correct | Automated exact-href check |
| Contributors block is present where expected | Automated contributor sample page check |
| Dismissible announcement banner works | Manual browser walkthrough |
| Mobile navigation and sticky chrome behave correctly | Manual mobile walkthrough |
