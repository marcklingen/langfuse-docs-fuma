# Chapter 6: Content Rendering and Documentation Fidelity

## Objective

Verify that representative docs, changelog, blog, FAQ, guides, cookbook, integrations, and self-hosting pages render correctly on the preview deployment, including the runtime behavior of MDX components.

## Scope

- Run the automated audit against the preview deployment by default.
- Validate rendered browser DOM, not only source markdown.
- Cover a fixed sample set spanning docs, changelog, blog, FAQ, guide, cookbook, integration, and self-hosting content.
- Include notebook-derived content and mermaid rendering in the automated checks.

## Structure

- `tests/run-content-fidelity-review.mjs`: browser-driven automated audit for the chapter 6 sample set.
- `manual/notes.md`: manual QA notes for browser-only checks and visual observations.
- `issues.md`: findings, severity, impact, and proposed fixes.
- `artifacts/`: generated JSON reports and failure screenshots.

## Runbook

Run the automated review against the preview deployment:

```bash
node review/6-content-rendering-and-documentation-fidelity/tests/run-content-fidelity-review.mjs \
  --base-url https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app \
  --output review/6-content-rendering-and-documentation-fidelity/artifacts/preview-content-fidelity-report.json
```

The script exits non-zero if any page-level checks fail, but it writes the JSON report and any failure screenshots first.

## Evidence Index

- Automated fidelity report:
  `review/6-content-rendering-and-documentation-fidelity/artifacts/preview-content-fidelity-report.json`
- Automated failure screenshots:
  `review/6-content-rendering-and-documentation-fidelity/artifacts/screenshots/`
- Manual QA notes:
  `review/6-content-rendering-and-documentation-fidelity/manual/notes.md`
