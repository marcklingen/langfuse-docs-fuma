# Chapter 11 Plan

## Goal

Produce a reproducible repository audit for Fumadocs architectural alignment, using the official Fumadocs documentation as the review baseline.

## Verification approach

1. Confirm the baseline framework wiring exists:
   - `source.config.ts`
   - `next.config.mjs`
   - `app/layout.tsx`
   - `lib/source.ts`
   - `mdx-components.tsx`
2. Trace representative docs-style routes from content collections through:
   - collection registration in `source.config.ts`
   - loader creation in `lib/source.ts`
   - `DocsLayout` usage in section layouts
   - route rendering in `app/**/page.tsx`
3. Compare Fumadocs-managed sources against custom registries and generated loaders to identify drift risk.
4. Audit `content/**` and `meta.json` coverage for predictable page-tree generation.
5. Diff docs-style layouts for duplicated Fumadocs configuration.
6. Inspect search wiring, `.source` hygiene, and the remaining Nextra shim footprint.
7. Document confirmed issues with severity, impact, and proposed fixes.

## Evidence to collect

- JSON evidence for baseline references and full audit results.
- JSON evidence for route traces, layout duplication, content structure, search/shims, and generated artifacts.
- Reviewer-facing summary in Markdown.
- Issue list tied to concrete files and evidence.

## Exit criteria

- Every Chapter 11 checklist item has explicit evidence.
- Deviations from Fumadocs recommendations are called out as pass, pass-with-deviation, or fail.
- `issues.md` reflects the actual audit output, not assumptions.
