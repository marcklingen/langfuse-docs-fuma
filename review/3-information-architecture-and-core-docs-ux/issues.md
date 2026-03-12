# Chapter 3 Issues

## Missing TOC anchor on tabbed docs page

- Severity: Medium
- Affected path: `/docs/prompt-management/get-started`
- New implementation evidence: `review/3-information-architecture-and-core-docs-ux/evidence/docs-shell.json` reports `#get-api-keys-1` in `deepDoc.toc.missingTargets`.
- Production baseline checked on March 12, 2026: the current `https://langfuse.com/docs/prompt-management/get-started` HTML includes `id="get-api-keys-1"`, so this anchor exists on production today.
- Risk: the in-page TOC contains a broken jump target, which degrades wayfinding and makes the deep-page TOC less trustworthy.
- Proposed fix: ensure tab-generated headings either keep stable ids that match TOC entries or are excluded from TOC generation when their target panel is not rendered in the DOM.

## Deep-doc breadcrumb loses the section level

- Severity: Medium
- Affected path: `/docs/prompt-management/get-started`
- New implementation evidence: `review/3-information-architecture-and-core-docs-ux/evidence/docs-shell.json` records the rendered breadcrumb as `Docs > Use Prompt Management`.
- Production baseline checked on March 12, 2026: the current `https://langfuse.com/docs/prompt-management/get-started` HTML renders `Docs > Prompt Management > Get Started`.
- Risk: users lose one level of orientation inside the docs hierarchy, and the breadcrumb no longer reflects the section structure shown in the sidebar.
- Proposed fix: build breadcrumbs from the docs page tree so section folders remain represented between the docs root and the current page.

## Baseline note

- `/docs/prompt-management/get-started` still exposes duplicate TOC labels generated from tabbed content, but the same duplicate labels are also present in the current production HTML checked on March 12, 2026. Treat the duplication itself as baseline UX debt unless preview behavior diverges from production.
