# Chapter 11 Findings

## Audit result

- Date: 2026-03-19
- Automated audit: [`artifacts/repo-audit.json`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/11-fumadocs-architecture-and-best-practice-alignment/artifacts/repo-audit.json)
- Summary: 5 pass, 3 warn, 2 fail

## Findings

### `P2` Runtime sidebar-title support is outside the declared Fumadocs schema

- Evidence:
  - [`lib/source.ts:48`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/source.ts#L48)
  - [`lib/source.ts:113`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/source.ts#L113)
  - [`source.config.ts:69`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/source.config.ts#L69)
  - [`source.config.ts:100`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/source.config.ts#L100)
  - [`source.config.ts:139`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/source.config.ts#L139)
  - [`app/docs/layout.tsx:1`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/docs/layout.tsx#L1)
  - [`app/guides/layout.tsx:1`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/guides/layout.tsx#L1)
  - [`app/library/layout.tsx:1`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/library/layout.tsx#L1)
- `lib/source.ts` advertises `shortTitle ?? sidebarTitle` page-tree rewriting, but `source.config.ts` never declares `shortTitle` in any collection schema, and the docs/guides/library schemas do not declare `sidebarTitle` either.
- That means the runtime helper is a second, implicit frontmatter contract outside `source.config.ts`, which contradicts the chapter requirement that `source.config.ts` remain the schema source of truth.
- Concrete risk: a maintainer can add `shortTitle` or `sidebarTitle` expecting sidebar labels to shorten, but Fumadocs will strip undeclared fields and the override will silently do nothing.
- Proposed fix: either add the supported frontmatter fields to the relevant schemas, or remove `getPageTreeWithShortTitles(...)` from sections that do not officially support those fields.

### `P3` Stale `nextra` aliases remain in build and TypeScript config after the shim files were removed

- Evidence:
  - [`next.config.mjs:68`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/next.config.mjs#L68)
  - [`tsconfig.json:29`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/tsconfig.json#L29)
- Both Next.js and TypeScript still alias `nextra/*` imports to `lib/nextra-shim/*`, but the `lib/nextra-shim` directory is no longer present in this checkout and the audit found no remaining live imports that need it.
- This is migration residue rather than active compatibility code. It makes the repo look more Nextra-dependent than it is, and any future accidental `nextra/*` import will fail against paths that no longer exist.
- Proposed fix: remove the stale aliases, or restore the shim files if there is a real remaining compatibility dependency that should stay documented and isolated.

## Observations

- `content/faq/all` is a large navigation subtree without a local `meta.json`, so ordering there depends on implicit filesystem/default behavior rather than explicit Fumadocs metadata.
- Docs layout behavior is mostly centralized, but core `DocsLayout` props are still duplicated between [`app/docs/SharedDocsLayout.tsx:23`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/docs/SharedDocsLayout.tsx#L23) and [`app/[section]/layout.tsx:58`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/app/[section]/layout.tsx#L58).
- The custom registry surface in [`lib/source.ts:214`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/lib/source.ts#L214) is materially larger than the minimal Fumadocs baseline, so new section additions still carry more coordination risk than a plain loader-and-route setup.

## Severity scale

- `P1`: launch blocker or architecture defect likely to break core docs routing/content
- `P2`: meaningful architecture drift with concrete regression risk
- `P3`: low-risk drift, stale migration residue, or maintainability issue
