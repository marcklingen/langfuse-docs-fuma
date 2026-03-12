# Chapter 11: Fumadocs Architecture and Best-Practice Alignment

## Review objective

Verify that the migrated site uses Fumadocs in a way that stays close to the framework's recommended architecture, and that any deviations are intentional, documented, and low-risk.

## Scope

This chapter covers:

- The baseline Fumadocs setup around `source.config.ts`, `next.config.mjs`, `app/layout.tsx`, `lib/source.ts`, and `mdx-components.tsx`.
- Docs-style route wiring across `app/docs`, `app/guides`, `app/integrations`, `app/self-hosting`, `app/library`, and `app/[section]`.
- `content/**` collection structure, `meta.json` coverage, and page-tree generation.
- Shared `DocsLayout` configuration, custom tree rewrites, and route registries layered on top of Fumadocs.
- Search-route wiring, generated-artifact hygiene, and remaining Nextra compatibility shims.

This chapter does not validate search relevance, content rendering fidelity, or build/release behavior beyond the architectural contracts they expose.

## Official baseline references

This review uses the current Fumadocs documentation as the architectural baseline. The audit runner is static and local, but the expectations below were checked against these official docs on 2026-03-11:

- [MDX / Next.js setup](https://fumadocs.dev/docs/mdx/next)
- [Page conventions and `meta.json`](https://fumadocs.dev/docs/page-conventions)
- [Navigation and page tree](https://fumadocs.dev/docs/navigation)
- [Docs layout shared options](https://fumadocs.dev/docs/ui/layouts/docs)
- [Search server route](https://fumadocs.dev/docs/search/server)

## How to run

```bash
node review/11-fumadocs-architecture-and-best-practice-alignment/tests/run-fumadocs-architecture-review.mjs
```

Optional environment variables:

- `OUTPUT_DIR` defaults to `review/11-fumadocs-architecture-and-best-practice-alignment/evidence`

The runner exits non-zero when it finds architecture misalignment that should block Chapter 11 sign-off.

## Evidence produced

The runner writes:

- `summary.md` for the reviewer-facing result summary
- `summary.json` for the machine-readable summary
- `official-baseline.json` for the Fumadocs references used by this chapter
- `architecture-audit.json` for the full checklist audit
- `source-trace.json` for collection, route, and loader tracing
- `content-structure.json` for `meta.json` and collection-structure checks
- `layout-duplication.json` for shared `DocsLayout` drift analysis
- `search-and-shims.json` for search wiring and Nextra shim footprint
- `generated-artifacts.json` for `.source` and generated-file hygiene

## Checklist mapping

| Checklist item | Evidence | Method |
| --- | --- | --- |
| Repository keeps baseline Fumadocs files and wiring | `architecture-audit.json`, `official-baseline.json` | Static checks for the documented baseline files and framework hooks |
| `source.config.ts` is the single source of truth | `source-trace.json`, `architecture-audit.json` | Compare collection definitions to manual registries and loader files |
| Docs-like routes are backed by Fumadocs loaders | `source-trace.json`, `architecture-audit.json` | Trace representative routes from `source.getPage()` / `generateParams()` through body rendering |
| `content/**` trees and `meta.json` files are structured predictably | `content-structure.json` | Audit collection roots and nested content directories for expected `meta.json` coverage |
| Shared `DocsLayout` configuration is centralized | `layout-duplication.json`, `architecture-audit.json` | Compare docs-style layout files for repeated Fumadocs layout configuration |
| Search is either the documented route or an intentional equivalent | `search-and-shims.json`, `architecture-audit.json` | Check for Fumadocs search-route wiring or an explicit replacement path |
| Custom page-tree rewrites and section registries are minimal | `source-trace.json`, `architecture-audit.json` | Inspect custom tree post-processing and manual route registries |
| Generated `.source` output is not partially committed | `generated-artifacts.json` | Compare `.gitignore`, live `.source` contents, and tracked Git state |
| Nextra migration shims are still required and isolated | `search-and-shims.json`, `architecture-audit.json` | Count direct shim imports outside the shim directory and config glue |
| MDX component overrides extend Fumadocs cleanly | `architecture-audit.json` | Validate that `mdx-components.tsx` extends `fumadocs-ui/mdx` instead of replacing it wholesale |

## Files in this chapter

- `review/11-fumadocs-architecture-and-best-practice-alignment/tests/run-fumadocs-architecture-review.mjs`
- `review/11-fumadocs-architecture-and-best-practice-alignment/plan.md`
- `review/11-fumadocs-architecture-and-best-practice-alignment/manual/notes.md`
- `review/11-fumadocs-architecture-and-best-practice-alignment/issues.md`
