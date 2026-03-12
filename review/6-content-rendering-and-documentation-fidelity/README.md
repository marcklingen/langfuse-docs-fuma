# Chapter 6: Content Rendering and Documentation Fidelity

## Review objective

Confirm that content renders fully and correctly across all major content types and component patterns.

## Scope

This chapter covers:

- Preview deployment checks for representative docs, changelog, blog, FAQ, guides, cookbook, integration, and self-hosting pages.
- DOM-level rendering checks for headings, code blocks, copy buttons, tabs, tables, mermaid diagrams, images, videos, and embeds.
- Remote media host-policy checks for hosted docs videos and YouTube embeds.
- Notebook-derived cookbook pages under `content/guides/cookbook`.

This chapter does not own docs shell chrome, search relevance, metadata/canonical behavior, or performance budgets. Those belong to Chapters 3, 5, 7, and 10.

## Sample set

| Content type | Path | Source file | Primary coverage |
| --- | --- | --- | --- |
| Docs | `/docs/prompt-management/get-started` | `content/docs/prompt-management/get-started.mdx` | Tabs, code blocks, copy buttons, heading order |
| Docs | `/docs/observability/data-model` | `content/docs/observability/data-model.mdx` | Mermaid diagrams, tables, heading order |
| Changelog | `/changelog/2025-05-21-custom-dashboards` | `content/changelog/2025-05-21-custom-dashboards.mdx` | Tabs, embedded media host policy |
| Blog | `/blog/2026-02-26-evaluate-ai-agent-skills` | `content/blog/2026-02-26-evaluate-ai-agent-skills.mdx` | File tree custom component, code blocks, tables |
| FAQ | `/faq/all/unwanted-http-database-spans` | `content/faq/all/unwanted-http-database-spans.mdx` | Tabs, code blocks, rich content markers |
| Guides | `/guides/videos/introducing-datasets-v2` | `content/guides/videos/introducing-datasets-v2.mdx` | Hosted docs video rendering |
| Cookbook | `/guides/cookbook/example_simulated_multi_turn_conversations` | `content/guides/cookbook/example_simulated_multi_turn_conversations.mdx` | Notebook-derived content, code blocks, embed host policy |
| Integrations | `/integrations/no-code/goose` | `content/integrations/no-code/goose.mdx` | Hosted docs video, nocookie YouTube embed, code blocks |
| Self-hosting | `/self-hosting/deployment/docker-compose` | `content/self-hosting/deployment/docker-compose.mdx` | Tabs, code blocks, nocookie YouTube embed |

## How to run

```bash
node review/6-content-rendering-and-documentation-fidelity/tests/run-content-fidelity-review.mjs
```

Optional environment variables:

- `BASE_URL` defaults to `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- `OUTPUT_DIR` defaults to `review/6-content-rendering-and-documentation-fidelity/evidence`
- `HEADLESS` defaults to `true`

The runner exits non-zero when rendering regressions are detected in the sampled pages.

## Evidence produced

The runner writes:

- `summary.md` for the reviewer-facing result summary
- `summary.json` for the machine-readable summary
- `page-rendering.json` for per-page DOM assertions, heading analysis, media inventory, and request failures

## Checklist mapping

| Checklist item | Evidence | Method |
| --- | --- | --- |
| Docs, changelog, blog, FAQ, guides, integrations, and self-hosting pages render correctly | `page-rendering.json` | Visit the representative sample set on preview and assert `200` responses plus non-404 content |
| Notebook-derived pages render correctly | `page-rendering.json` cookbook sample | Audit a generated cookbook page with rich prose, code blocks, and embedded media |
| Headings, tabs, cards, steps, frames, videos, and custom components still render | `page-rendering.json`, `manual/notes.md` | Automate tabs, mermaid, videos, embeds, and custom-component text markers; keep manual spot checks for steps, cards, and frames |
| Code blocks preserve syntax highlighting and copy behavior | `page-rendering.json`, `manual/notes.md` | Assert code-block and copy-button presence automatically; verify clipboard behavior manually |
| Tables, lists, images, and embedded media render without obvious breakage | `page-rendering.json` | Assert table/media presence on pages that should have them and check that images report successful loads |
| Remote media and hosted docs videos load from approved origins | `page-rendering.json`, `issues.md` | Inventory remote `video` and `iframe` URLs and compare them with the allowed host set |
| No sections are missing, truncated, or split by broken MDX boundaries | `page-rendering.json`, `manual/notes.md` | Assert sample-specific text markers survive rendering; manually inspect the richest pages for truncation |
| Heading levels remain logical and stable enough for accessibility and deep linking | `page-rendering.json`, `issues.md` | Compute heading-level jumps inside article content and flag skipped levels |
| One H1 is used per page and subsection order remains valid | `page-rendering.json` | Count H1 elements and record heading sequences for the sampled pages |
| Repeated or shared content blocks behave consistently across related pages | `manual/notes.md` | Compare pages that reuse shared `components-mdx` partials during manual QA |

## Files in this chapter

- `review/6-content-rendering-and-documentation-fidelity/tests/run-content-fidelity-review.mjs`
- `review/6-content-rendering-and-documentation-fidelity/manual/notes.md`
- `review/6-content-rendering-and-documentation-fidelity/issues.md`
