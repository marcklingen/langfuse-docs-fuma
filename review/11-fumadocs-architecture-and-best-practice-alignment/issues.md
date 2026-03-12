# Chapter 11 Issues

## Confirmed issues

### `[High]` `source.config.ts` is not the only content registry anymore

- Evidence: `review/11-fumadocs-architecture-and-best-practice-alignment/evidence/source-trace.json` and `review/11-fumadocs-architecture-and-best-practice-alignment/evidence/architecture-audit.json`
- Observed behavior: Fumadocs collections are defined in `source.config.ts`, but the repo also maintains a manual docs loader registry in `app/docs/[[...slug]]/doc-loaders.client.ts`, a filesystem crawler in `scripts/generate-section-loaders.js`, a tracked generated registry in `lib/section-loaders.generated.ts`, a route registry in `lib/source.ts`, and a section registry in `lib/sections.ts`. The generated registries currently match the content tree, but they still duplicate the authoritative source graph.
- Why it matters: adding, moving, or renaming content requires updates across multiple code paths, which defeats the main Fumadocs architecture benefit of deriving route and content state from one collection graph.
- Suggested fix: collapse docs-body loading and section routing onto a single Fumadocs-derived source layer, or generate one shared registry from the Fumadocs source instead of maintaining parallel registries.

### `[Medium]` Shared `DocsLayout` configuration is duplicated across docs-style sections

- Evidence: `review/11-fumadocs-architecture-and-best-practice-alignment/evidence/layout-duplication.json` and `review/11-fumadocs-architecture-and-best-practice-alignment/evidence/architecture-audit.json`
- Observed behavior: `app/docs/layout.tsx`, `app/guides/layout.tsx`, `app/self-hosting/layout.tsx`, `app/integrations/layout.tsx`, and `app/library/layout.tsx` all repeat the same `DocsLayout` shell configuration instead of centralizing shared options.
- Why it matters: Fumadocs recommends extracting shared docs-layout options so sidebar, nav, search-toggle, and GitHub-link behavior do not drift by section.
- Suggested fix: move shared `DocsLayout` props into a single helper or wrapper and keep only tree-specific overrides in each route layout.

### `[Medium]` Nextra compatibility shims are still part of the live content and component surface

- Evidence: `review/11-fumadocs-architecture-and-best-practice-alignment/evidence/search-and-shims.json` and `review/11-fumadocs-architecture-and-best-practice-alignment/evidence/architecture-audit.json`
- Observed behavior: `next.config.mjs` and `tsconfig.json` still alias Nextra module IDs, `mdx-components.tsx` still re-exports shimmed Nextra components, and 30 live files under `components/`, `components-mdx/`, and `content/` continue to import from `nextra/components`, `nextra/context`, and `nextra`.
- Why it matters: the migration layer is not isolated to a narrow edge. That keeps upgrade pressure on both Fumadocs and the shim layer, and it makes it harder to reason about which abstractions are still authoritative.
- Suggested fix: replace direct Nextra imports in live content and components with Fumadocs-native or local primitives, then narrow the shim surface until the aliases can be removed.

### `[Medium]` Docs-style page bodies still depend on ad-hoc client loader registries

- Evidence: `review/11-fumadocs-architecture-and-best-practice-alignment/evidence/source-trace.json` and `review/11-fumadocs-architecture-and-best-practice-alignment/evidence/architecture-audit.json`
- Observed behavior: docs-like pages resolve metadata and params from Fumadocs sources, but body rendering goes through `DocBodyClient`, `SectionDocBodyClient`, and `SectionDocBodyClientWithDocsBody`, which dynamically import MDX files from custom registries instead of rendering directly from the Fumadocs page object.
- Why it matters: route reachability and page-body rendering can drift apart, and the route layer no longer follows the documented Fumadocs pattern of rendering `page.data.body` from the loader-backed page.
- Suggested fix: move docs-body rendering back behind the Fumadocs page object, or generate the body loaders from the Fumadocs source so the route and body layers cannot diverge.

### `[Low]` `content/faq/all` is the only large content subtree without a `meta.json`

- Evidence: `review/11-fumadocs-architecture-and-best-practice-alignment/evidence/content-structure.json`
- Observed behavior: the static audit found one missing directory-level metadata file on a navigation-bearing subtree: `content/faq/all`.
- Why it matters: this leaves the FAQ-all section ordered only by raw filesystem traversal instead of an explicit page-tree contract, which is weaker than the rest of the repo's Fumadocs structure.
- Suggested fix: add `content/faq/all/meta.json` and make the intended ordering explicit, even if that ordering remains mostly alphabetical.

### `[Low]` Generated `.source` hygiene is inconsistent

- Evidence: `review/11-fumadocs-architecture-and-best-practice-alignment/evidence/generated-artifacts.json`
- Observed behavior: `.gitignore` ignores `.source/`, but Git still tracks `.source/source.config.mjs`.
- Why it matters: partial tracking of framework-generated output makes it unclear whether `.source` is disposable local state or an intentional checked-in artifact.
- Suggested fix: stop tracking `.source/source.config.mjs`, or explicitly commit the full generated directory and remove the ignore rule. The cleaner path is to treat `.source` as generated-only and untrack it.

### `[Low]` Repository documentation still describes the site as Nextra-based

- Evidence: `review/11-fumadocs-architecture-and-best-practice-alignment/evidence/architecture-audit.json`
- Observed behavior: `README.md` still says the repo is “Based on Nextra” and still describes notebook output as rendering in the old `pages/` directory via Nextra.
- Why it matters: Chapter 11 requires deviations and migration layers to be intentional and documented. The current top-level docs still describe the old architecture.
- Suggested fix: update the README and related migration notes to describe the current Fumadocs + App Router architecture accurately.
