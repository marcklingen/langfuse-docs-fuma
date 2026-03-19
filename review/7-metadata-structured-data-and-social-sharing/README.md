# Chapter 7: Metadata, Structured Data, and Social Sharing

## Objective

Verify that representative preview pages still emit correct metadata for search engines, social unfurlers, and schema consumers.

## Scope

- Automated checks run against the preview deployment by default.
- Production is fetched as a comparison baseline for the same sample routes.
- The review covers docs, FAQ, blog, guides, and changelog page types, including dynamic OG generation, static OG overrides, canonical overrides, and `og:video`.

## Structure

- `tests/run-metadata-review.mjs`: automated metadata, OG asset, and JSON-LD audit runner.
- `plan.md`: Chapter 7 verification plan and checklist mapping.
- `manual/notes.md`: residual manual validation notes for external unfurlers.
- `issues.md`: findings discovered during execution.
- `artifacts/`: generated JSON and Markdown evidence.

## Runbook

Run the automated review against the preview deployment:

```bash
node review/7-metadata-structured-data-and-social-sharing/tests/run-metadata-review.mjs \
  --base-url https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app \
  --output review/7-metadata-structured-data-and-social-sharing/artifacts/preview-metadata-report.json
```

The runner also writes a Markdown summary to:

- [`artifacts/preview-metadata-summary.md`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/7-metadata-structured-data-and-social-sharing/artifacts/preview-metadata-summary.md)

## Evidence Index

- Automated report:
  [`artifacts/preview-metadata-report.json`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/7-metadata-structured-data-and-social-sharing/artifacts/preview-metadata-report.json)
- Automated summary:
  [`artifacts/preview-metadata-summary.md`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/7-metadata-structured-data-and-social-sharing/artifacts/preview-metadata-summary.md)
- Manual notes:
  [`manual/notes.md`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/7-metadata-structured-data-and-social-sharing/manual/notes.md)
