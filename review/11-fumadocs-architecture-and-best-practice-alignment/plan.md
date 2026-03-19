# Chapter 11 Plan: Fumadocs Architecture and Best-Practice Alignment

## Objective

Review the repository against current Fumadocs guidance for Next.js wiring, content collections, page-tree generation, layout sharing, and migration-shim hygiene.

## Target environment

- Primary: repository source tree in this workspace
- Baseline references:
  - `https://www.fumadocs.dev/docs/manual-installation/next`
  - `https://www.fumadocs.dev/docs/mdx/collections`
  - `https://www.fumadocs.dev/docs/headless/source-api`
  - `https://www.fumadocs.dev/docs/headless/page-tree`

## Verification approach

### Automated repository audit

Run [`tests/run-fumadocs-architecture-review.mjs`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/11-fumadocs-architecture-and-best-practice-alignment/tests/run-fumadocs-architecture-review.mjs) to validate:

- baseline Fumadocs files and wiring are present
- `source.config.ts` defines the collection set consumed by `lib/source.ts`
- docs-style routes use Fumadocs loaders rather than filesystem reads
- `content/` collection roots and navigation-heavy subtrees have `meta.json`
- docs layout configuration is mostly centralized, with duplicated wrappers/config called out
- search is intentionally implemented outside the default Fumadocs search route
- custom page-tree rewrite layers are enumerated
- `.source` exists locally but is not tracked by git
- migration-era `nextra` shim references are either real and isolated or stale
- MDX component overrides extend `fumadocs-ui/mdx` instead of replacing it

Artifacts written by the script:

- [`artifacts/repo-audit.json`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/11-fumadocs-architecture-and-best-practice-alignment/artifacts/repo-audit.json)

### Manual review notes

Document the official-doc baseline and explain any repo-specific interpretation in:

- [`manual/notes.md`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/11-fumadocs-architecture-and-best-practice-alignment/manual/notes.md)

## Checklist mapping

| Checklist item | Verification |
| --- | --- |
| Baseline files and recommended wiring exist | Automated file and wiring audit |
| `source.config.ts` is the schema source of truth | Automated collection/schema vs runtime-field comparison |
| Docs-style routes use Fumadocs loaders | Automated route inspection |
| `content/**` and `meta.json` structure is predictable | Automated content-tree audit |
| Shared `DocsLayout` config is centralized | Automated layout/wrapper comparison plus manual notes |
| Search is documented or intentionally replaced | Automated route/component inspection |
| Custom page-tree rewrites are minimal | Automated helper/registry inventory plus manual assessment |
| `.source` is generated, not maintained manually | Automated git/tracked-state audit |
| Nextra shims are still required and isolated | Automated alias/import/path audit |
| MDX overrides extend Fumadocs cleanly | Automated `mdx-components.tsx` audit |
