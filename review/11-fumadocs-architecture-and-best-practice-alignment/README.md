# Chapter 11: Fumadocs Architecture and Best-Practice Alignment

## Objective

Verify that the migrated site stays close to Fumadocs' recommended architecture, and that migration-era deviations are intentional, isolated, and low-risk.

## Scope

- Static repository audit only. This chapter does not require a local dev server.
- Official Fumadocs documentation is used as the baseline for expected wiring and conventions.

## Official baseline

- Next.js manual installation:
  `https://www.fumadocs.dev/docs/manual-installation/next`
- Fumadocs MDX collections:
  `https://www.fumadocs.dev/docs/mdx/collections`
- Loader API:
  `https://www.fumadocs.dev/docs/headless/source-api`
- Page tree:
  `https://www.fumadocs.dev/docs/headless/page-tree`

## Structure

- `plan.md`: checklist-to-test mapping for this chapter.
- `tests/run-fumadocs-architecture-review.mjs`: automated static audit.
- `artifacts/repo-audit.json`: machine-readable audit output.
- `manual/notes.md`: review notes and baseline interpretation.
- `issues.md`: findings and severity.

## Runbook

```bash
node review/11-fumadocs-architecture-and-best-practice-alignment/tests/run-fumadocs-architecture-review.mjs \
  --output review/11-fumadocs-architecture-and-best-practice-alignment/artifacts/repo-audit.json
```

The script exits non-zero if any high-confidence architecture failures are detected, but it still writes the JSON artifact first.

## Evidence Index

- Automated audit:
  `review/11-fumadocs-architecture-and-best-practice-alignment/artifacts/repo-audit.json`
- Manual notes:
  `review/11-fumadocs-architecture-and-best-practice-alignment/manual/notes.md`
- Findings:
  `review/11-fumadocs-architecture-and-best-practice-alignment/issues.md`
