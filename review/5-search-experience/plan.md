# Chapter 5 Plan: Search Experience

## Objective

Confirm that the migrated on-site search remains functional, relevant, and consistent with the production docs workflow.

## Target environment

- Primary: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- Baseline: `https://langfuse.com`

## Representative queries

- Docs: `python decorator tracing`
- Integrations: `goose integration`
- Self Hosting: `docker compose self hosting`
- FAQ & Guides: `missing traces langfuse faq`
- Handbook: `hiring process handbook`

## Verification approach

### Automated checks

Run [`tests/run-search-review.mjs`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/5-search-experience/tests/run-search-review.mjs) against preview to validate:

- the search modal opens from a docs page and the keyboard shortcut works
- preview search requests succeed instead of failing at the provider boundary
- representative queries return canonical `https://langfuse.com/...` results comparable to production
- preview tabs/scopes expose the same content groups production exposes for the same queries
- dark/light theme transitions propagate into the widget
- the mobile viewport can open the search overlay and keep it within the viewport

Artifacts written by the script:

- [`artifacts/preview-search-report.json`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/5-search-experience/artifacts/preview-search-report.json)
- screenshots under `artifacts/`

### Manual review follow-up

Use the saved screenshots plus a browser walkthrough to confirm:

- the modal layout is readable on desktop and mobile
- the Search / Ask AI controls still render correctly
- result scopes appear as expected when results are available
- theme transitions do not leave the widget visually out of sync with the site

## Checklist mapping

| Checklist item | Verification |
| --- | --- |
| Main search UI loads on docs pages | Automated modal-open check + desktop screenshot |
| Keyboard shortcut still works | Automated shortcut open check |
| Search tabs/scopes expose intended groups | Automated preview vs production query comparison |
| Theme synchronization still works | Automated dark/light color comparison + screenshots |
| Representative queries return relevant results | Automated fixed-query regression suite |
| Results avoid staging URLs, duplicates, and non-canonical hosts | Automated canonical-host and duplicate-url assertions |
| Search remains functional on mobile and in theme transitions | Automated mobile viewport pass + theme sync check |
