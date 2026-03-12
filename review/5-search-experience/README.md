# Chapter 5: Search Experience

## Review objective

Confirm that on-site search remains usable, accurate, and consistent with the current docs workflow.

Run this chapter on the preview deployment.

## Scope

This chapter covers:

- Preview search-trigger and keyboard-shortcut behavior on a representative docs page.
- Preview desktop and mobile search-modal behavior for representative queries.
- Preview search theme synchronization between the site shell and the Inkeep modal.
- Fixed-query relevance checks against `/api/search-docs` for docs, integrations, self-hosting, FAQ, and handbook content.
- Production-baseline comparison for key UI search queries so preview regressions can be separated from pre-existing search quirks.

This chapter does not own MCP/search API protocol correctness, accessibility focus-restoration issues, or analytics events. Those remain covered by Chapters 4, 10, and 8 respectively.

## How to run

```bash
node review/5-search-experience/tests/run-search-review.mjs
```

Optional environment variables:

- `PREVIEW_BASE_URL` defaults to `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- `PROD_BASE_URL` defaults to `https://langfuse.com`
- `OUTPUT_DIR` defaults to `review/5-search-experience/evidence`
- `HEADLESS` defaults to `true`

The runner exits non-zero when preview search regressions are detected.

## Evidence produced

The runner writes:

- `summary.md` for the reviewer-facing result summary
- `summary.json` for the machine-readable summary
- `search-ui.json` for desktop/mobile modal behavior, scope/tab inventories, console warnings, and theme-sync checks
- `search-api-relevance.json` for fixed-query API relevance and canonical-host validation
- `screenshots/preview-desktop-search-light.png` for the preview desktop search modal in light mode
- `screenshots/preview-desktop-search-dark.png` for the preview desktop search modal in dark mode
- `screenshots/preview-mobile-search.png` for the preview mobile search modal
- `screenshots/production-desktop-search-light.png` for the production baseline search modal

## Checklist mapping

| Checklist item | Evidence | Method |
| --- | --- | --- |
| Main search UI still loads on docs pages | `search-ui.json.previewDesktop` | Assert a visible search trigger exists on a representative docs page and that the modal opens |
| Keyboard shortcut for search still works | `search-ui.json.previewDesktop.keyboardShortcut` | Open the preview modal with `Ctrl+K` and confirm the dialog renders |
| Search tabs or scopes still expose intended content groups | `search-ui.json.previewDesktop.queries`, `search-ui.json.productionDesktop.queries` | Compare preview and production tab inventories for representative multi-scope queries |
| Theme synchronization between site and search widget still works | `search-ui.json.previewThemeSync`, screenshots | Toggle the site theme and assert the modal color palette changes with it |
| Representative queries return relevant results for docs, integrations, self-hosting, FAQ, and handbook content | `search-api-relevance.json` | Run a fixed-query suite against `/api/search-docs` and assert the top canonical URL matches the expected content family |
| Results do not contain staging URLs, duplicate URLs, or obviously non-canonical content | `search-api-relevance.json` | Inspect returned hosts, duplicate counts, and preview-vs-production duplicate deltas |
| Search remains functional on mobile and during dark/light mode transitions | `search-ui.json.previewMobile`, `search-ui.json.previewThemeSync`, screenshots | Open the modal on a mobile viewport and repeat the preview query flow after a theme change |

## Files in this chapter

- [tests/run-search-review.mjs](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/5-search-experience/tests/run-search-review.mjs)
- [manual/notes.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/5-search-experience/manual/notes.md)
- [issues.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/5-search-experience/issues.md)
