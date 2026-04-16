# Langfuse Website and Docs Migration Review Plan

## Purpose

This document defines the review plan for the upcoming website and documentation migration. The change is high risk because it can affect user journeys, SEO, docs usability, AI-facing surfaces, operational integrations, and public API-style endpoints at the same time.

The goal of the review is not only to confirm that pages render, but to verify that the new implementation preserves the current public contract of `langfuse.com` and does not introduce hidden regressions in routing, metadata, search, LLM tooling, or deployment behavior.

This plan assumes we can run both manual and programmatic tests for each review area.

## Review Principles

- Treat this migration like a platform change, not a visual refresh.
- Use current production behavior as the baseline unless a change is explicitly intended and approved.
- Require objective evidence for high-risk areas: crawl diffs, header checks, endpoint checks, screenshot comparisons, and targeted end-to-end tests.
- Review both user-visible behavior and machine-facing behavior.
- Do not approve the rollout if critical invariants fail, even if the pages look correct visually.

## Required Review Evidence

Before sign-off, collect and attach the following review evidence:

- A production baseline crawl and a preview/staging crawl diff.
- A redirect validation report for legacy and top-traffic URLs.
- A sitemap, canonical, robots, and indexability validation report.
- A checklist run for Langfuse-specific AI/LLM features.
- A targeted functional test report for key APIs and feedback/search flows.
- Manual QA notes for navigation, mobile behavior, accessibility, and content rendering.
- Performance snapshots for representative page types.
- A deployment readiness check confirming required environment variables and build outputs.

## Non-Negotiable Invariants

The following are launch blockers unless explicitly approved:

- Important existing URLs must keep working through `200` responses or correct `301` redirects.
- No accidental `noindex`, wrong canonical host, or staging URLs may ship to production.
- `llms.txt`, `.md` endpoints, Docs MCP, docs search, and copy-as-markdown flows must remain functional.
- Key docs UX must remain intact: search, navigation, edit links, contributors, TOC behavior, and feedback collection.
- Required security headers and preview-indexing protections must remain in place.
- Core content types must render correctly: docs, changelog, FAQ, guides, integrations, self-hosting, and notebook-derived pages.

## Deployments

Old version

- Filesystem: repos/github/langfuse/langfuse-docs
- Deployment: https://langfuse.com

New version

- Filesystem: this repo
- Local dev (no rate limits or bot protection, server already running, you do not need to start it): http://localhost:3333

## How to work on the following chapters

1. Create a new subfolder in the `review` directory for each chapter, e.g. `review/1-urls-routing-and-redirects`.
2. Create a plan for how to verify each checklist item, including any automated tests, manual checks, or crawl comparisons needed.
3. Implement the tests and checks, collecting evidence such as crawl reports, screenshots, and test results. Scripts go into a `tests` subfolder, while manual notes and screenshots can go into a `manual` subfolder.
4. Document any issues found, their severity, and proposed fixes in an `issues.md` file within the chapter folder.

## Chapter 1: URLs, Routing, and Redirects

### Review objective

Confirm that the migration preserves link stability and route behavior for all important public URLs.

### Checklist

- Verify every important current URL returns `200` or a single-hop `301` to the correct replacement URL.
- Verify no important page now returns `404`, `410`, soft `404`, or an irrelevant redirect to the homepage.
- Verify legacy docs paths, shortlinks, and campaign URLs still resolve correctly.
- Verify trailing slash behavior is consistent and does not create duplicate live URLs.
- Verify route casing and slug handling do not create broken or duplicate URLs.
- Verify deep links to headings still land on the intended content after the page loads.
- Verify there are no redirect loops and no redirect chains longer than one hop.
- Verify internal links point directly to canonical destinations instead of redirecting URLs.
- Verify that all redirects put in place still work.

### Suggested tests

- Crawl a production URL inventory and compare final destinations against preview. You can use the sitemap.
- Replay all pages against the new environment.
- Run explicit redirect-map tests for known legacy URLs and shortlinks.
- Programmatically validate heading anchor targets for a curated set of docs pages.

## Chapter 2: Indexability, Canonicals, Robots, and Sitemaps

### Review objective

Prevent SEO regressions caused by incorrect indexing controls, broken sitemap output, or canonical mistakes.

### Checklist

- Verify `robots.txt` exists, is reachable, and does not block intended public content.
- Verify sitemap generation still runs and includes the correct canonical URLs.
- Verify sitemap files do not include redirects, `404` pages, preview URLs, or non-canonical duplicates.
- Verify canonical URLs point to the correct production host and intended path.
- Verify page-level `noindex` rules are preserved where they are intentionally used.
- Verify preview deployments continue to emit `X-Robots-Tag: noindex`.
- Verify `.md` endpoints remain excluded from indexing.
- Verify titles and meta descriptions are present for important pages and do not become empty or massively duplicated.
- Verify Open Graph and Twitter metadata still point to correct canonical URLs and valid assets.
- Verify any cookbook-specific canonical logic remains correct.

### Suggested tests

- Run a metadata crawl that captures status, final URL, canonical, robots meta, title, description, and H1.
- Diff the set of indexable pages between production and preview.
- Validate every sitemap URL for `200`, self-canonicalization, and indexability.
- Run automated checks for staging hostnames or wrong domains in HTML, metadata, and schema.

## Chapter 3: Information Architecture and Core Docs UX

### Review objective

Confirm that the documentation remains navigable, understandable, and structurally familiar to users.

### Checklist

- Verify the global top navigation still exposes the key Langfuse sections.
- Verify the docs sidebar structure remains complete and correctly ordered.
- Verify section separators, menu-switcher behavior, and curated sidebar entries still work.
- Verify breadcrumbs and in-page table of contents are accurate.
- Verify the TOC includes working anchor links and a reliable back-to-top behavior.
- Verify the "Edit this page on GitHub" link is present and points to the correct source file.
- Verify the contributors block is present where expected and displays correct entries.
- Verify the dismissible announcement banner still works and uses stable dismissal behavior.
- Verify mobile navigation, sidebar toggles, and sticky page chrome behave correctly on small screens.

### Suggested tests

- Manual walkthrough of representative docs pages across desktop and mobile breakpoints. Use playwright for this.
- Automated link validation for header, footer, sidebar, breadcrumbs, and TOC links.
- Snapshot checks for page chrome on docs landing pages and deep docs pages.

## Chapter 4: AI and LLM-Facing Features

### Review objective

Protect the Langfuse-specific AI documentation contract, which is a critical migration risk area.

### Checklist

- Verify `/llms.txt` exists, is current, and references the expected sub-files and MCP information.
- Verify docs `.md` endpoints return markdown with the correct `Content-Type`.
- Verify `.md` endpoints return `X-Robots-Tag: noindex`.
- Verify content negotiation still works when requesting a normal docs URL with `Accept: text/markdown`.
- Verify the "Copy page as Markdown" flow works for representative docs pages.
- Verify the copy UI still appears across the intended sections of the site.
- Verify the "Open in ChatGPT" and "Open in Claude" helpers generate correct markdown-based prompts.
- Verify the "Install Docs MCP server" action still points to the correct destination.
- Verify the Ask AI page exists and loads the embedded chat experience.
- Verify `/api/mcp` is reachable and still exposes the expected tool set.
- Verify MCP responses that depend on markdown retrieval still match the `.md` output.
- Verify `/api/search-docs` still works and preserves expected response shape and CORS behavior.
- Verify `/api/md-to-pdf` still works for allowed inputs and still blocks untrusted hosts in production.

### Suggested tests

- Programmatic endpoint test suite covering `llms.txt`, `.md`, MCP, search, and PDF export.
- Manual validation of copy-to-clipboard behavior and LLM helper links in the browser.
- Response-header assertions for markdown and preview-indexing behavior.

## Chapter 5: Search Experience

### Review objective

Confirm that on-site search remains usable, accurate, and consistent with the current docs workflow.

Test this on the preview deployment.

### Checklist

- Verify the main search UI still loads on docs pages.
- Verify the keyboard shortcut for search still works.
- Verify search tabs or scopes still expose the intended content groups.
- Verify theme synchronization between the site and the search widget still works.
- Verify representative queries return relevant results for docs, integrations, self-hosting, FAQ, and handbook content.
- Verify results do not contain staging URLs, duplicate URLs, or obviously non-canonical content.
- Verify the search experience remains functional on mobile and in dark/light mode transitions.

### Suggested tests

- Fixed-query regression suite with expected top results and canonical hosts.
- Manual query tests for common tasks and product terms.
- Browser-based interaction test covering keyboard shortcut, result selection, and scope switching.

## Chapter 6: Content Rendering and Documentation Fidelity

### Review objective

Confirm that content renders fully and correctly across all major content types and component patterns.

Run this chapter on the preview deployment by default. Do not spin up a separate local dev server just to execute these checks.

### Scope

- Use a fixed sample set that covers docs, changelog, blog, FAQ, guide, cookbook, integration, and self-hosting routes.
- Include at least one notebook-derived cookbook page and one page with mermaid diagrams.
- Validate rendered DOM structure, not just source markdown, because this chapter is about runtime fidelity.

### Checklist

- Verify docs, changelog, blog, FAQ, guides, integrations, and self-hosting pages all render correctly.
- Verify notebook-derived pages render correctly and are not broken by the new markdown or MDX pipeline.
- Verify headings, callouts, tabs, cards, steps, frames, videos, and custom components still render correctly.
- Verify code blocks preserve syntax highlighting and copy behavior.
- Verify tables, lists, admonitions, images, and embedded media still render without layout breakage.
- Verify remote media and hosted docs videos still load from approved origins.
- Verify there are no missing sections, truncated content blocks, or broken MDX component boundaries.
- Verify heading levels remain logical and stable enough for accessibility and deep linking.
- Verify one H1 is used per page and subsection order remains valid.
- Verify repeated or shared content blocks still behave consistently across related pages.

### Representative sample pages

- Docs: `/docs/prompt-management/get-started`, `/docs/observability/data-model`
- Changelog: `/changelog/2025-05-21-custom-dashboards`
- Blog: `/blog/2026-02-26-evaluate-ai-agent-skills`
- FAQ: `/faq/all/unwanted-http-database-spans`
- Guides: `/guides/videos/introducing-datasets-v2`
- Cookbook: `/guides/cookbook/example_simulated_multi_turn_conversations`
- Integrations: `/integrations/no-code/goose`
- Self-hosting: `/self-hosting/deployment/docker-compose`

### Suggested tests

- Run `node review/6-content-rendering-and-documentation-fidelity/tests/run-content-fidelity-review.mjs` against the preview deployment to audit the sample set automatically.
- Use browser-based DOM assertions for H1 counts, heading order, mermaid rendering, code-block copy buttons, tabs, tables, and media embeds.
- Validate remote `video` and `iframe` hosts so docs videos stay on `static.langfuse.com` and YouTube embeds stay on `www.youtube-nocookie.com`.
- Follow up with manual QA for clipboard behavior, tab switching, long-page truncation, and shared `components-mdx` partials.
- Use `review/6-content-rendering-and-documentation-fidelity/README.md` as the Chapter 6 runbook and evidence index.

## Chapter 7: Metadata, Structured Data, and Social Sharing

### Review objective

Ensure that metadata used by search engines, link unfurlers, and rich-result consumers is preserved.

### Checklist

- Verify representative pages still emit correct titles, descriptions, canonical tags, and social metadata.
- Verify dynamic OG image generation still works where expected.
- Verify custom OG image or video overrides still function on pages that define them.
- Verify `og:url` matches the canonical URL.
- Verify OG and Twitter image assets are reachable and render valid previews.
- Verify structured data such as `BreadcrumbList`, `Article`, `FAQ`, or other schema types are preserved where applicable.
- Verify no metadata or structured data points to staging or preview domains.

### Suggested tests

- Automated metadata extraction for representative page types.
- Programmatic validation that OG assets return `200`.
- JSON-LD parsing and shape validation for representative templates.

## Chapter 8: Feedback, Analytics, and Operational Integrations

### Review objective

Confirm that measurement, feedback collection, and related external integrations remain operational.

### Checklist

- Verify the "Was this page helpful?" widget still appears where expected.
- Verify both positive and negative feedback flows still work.
- Verify `/api/feedback` still forwards payloads correctly to the configured webhook.
- Verify analytics scripts still load in the intended environments.
- Verify key analytics events still fire for search, MCP usage, and feedback flows if parity is required.
- Verify UTM parameters survive key user journeys.
- Verify no analytics or feedback requests are accidentally pointed at staging or missing endpoints.
- Verify all required environment variables for kept features are present in the target deployment.

### Suggested tests

- Manual submission of feedback flows using a test webhook sink.
- Network inspection for analytics and webhook requests.
- Deployment configuration review against the required environment variable set.

Detailed chapter implementation: [review/8-feedback-analytics-and-operational-integrations/README.md](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/8-feedback-analytics-and-operational-integrations/README.md)

## Chapter 9: Security Headers, Policies, and Public Surface Area

### Review objective

Ensure the migration does not weaken security posture or unintentionally expose or index sensitive surfaces.

### Checklist

- Verify the production CSP remains effective and compatible with required functionality.
- Verify baseline headers such as `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` remain present.
- Verify HTTPS-only behavior and redirect-to-HTTPS posture remain correct.
- Verify there is no mixed-content loading.
- Verify sensitive secrets are not exposed in client-side bundles or public responses.
- Verify preview deployments remain non-indexable.
- Verify public endpoints with permissive CORS are still intentionally exposed and documented.
- Verify SSRF protections for PDF generation remain in place.

### Suggested tests

- Header snapshot tests for key HTML and API routes.
- Static inspection of built assets for forbidden secrets or hostnames.
- Manual validation of embedded assets and third-party integrations under CSP.

## Chapter 10: Performance, Accessibility, and Responsive Behavior

### Review objective

Confirm that the new implementation does not regress usability under realistic device, network, and assistive technology conditions.

### Checklist

- Verify representative pages do not show major regressions in loading performance.
- Verify large images, fonts, and scripts do not introduce unnecessary page weight.
- Verify docs pages do not ship unusually heavy client bundles.
- Verify layout shift is controlled, especially around navigation, code blocks, and media.
- Verify keyboard navigation works across header, sidebar, search, dialogs, and feedback flows.
- Verify focus visibility and focus order remain correct.
- Verify there are no obvious contrast regressions.
- Verify mobile layouts remain usable across docs navigation and long content pages.
- Verify code blocks remain selectable and usable.
- Verify dialogs and overlays do not trap focus incorrectly.

### Suggested tests

- Lighthouse or equivalent performance runs on representative page types.
- Accessibility scans with axe or an equivalent tool.
- Manual keyboard and screen-size QA across critical journeys.

## Chapter 11: Fumadocs Architecture and Best-Practice Alignment

### Review objective

Verify that the migrated site uses Fumadocs in a way that stays close to the framework's recommended architecture, and that any deviations are intentional, documented, and low-risk.

Before executing this chapter, study the official Fumadocs documentation so the review uses the framework's current recommendations as the baseline rather than assumptions from the migration work.

### Scope

This chapter covers:

- The core Fumadocs wiring expected from the official docs: `source.config.ts`, `next.config.mjs`, `app/layout.tsx`, `lib/source.ts`, `mdx-components.tsx`, docs layouts, docs page routes, and optional search route wiring.
- Content-collection structure under `content/`, use of `meta.json`, and how page trees are generated.
- Shared layout configuration patterns, custom route registries, and page-tree rewriting added on top of Fumadocs.
- Migration-era compatibility layers such as `nextra` shims and custom MDX compatibility code.
- Generated-artifact hygiene for `.source` and other Fumadocs-derived outputs.

This chapter does not own search relevance, rendering fidelity, or release-pipeline correctness. Those remain with the existing search, content fidelity, and build/release chapters.

### Checklist

- Verify the repository keeps the baseline files and wiring recommended by Fumadocs.
- Verify `source.config.ts` is the single source of truth for collections and frontmatter schema.
- Verify docs-like routes are backed by Fumadocs loaders rather than ad-hoc filesystem logic.
- Verify `content/**` trees and `meta.json` files are structured so Fumadocs can generate navigation predictably.
- Verify shared `DocsLayout` configuration is centralized where possible; duplicated layout logic should be justified.
- Verify search is either implemented with the documented Fumadocs search route or intentionally replaced with an equivalent design.
- Verify custom page-tree rewrites and section registries are minimal and do not fight Fumadocs conventions.
- Verify generated `.source` output is not partially committed or manually maintained.
- Verify migration shims from Nextra or previous tooling are still required and isolated.
- Verify MDX component overrides extend Fumadocs cleanly without replacing core behavior unnecessarily.

### Suggested tests

- Static repository audit against the official Fumadocs setup and architecture docs.
- Trace representative sections from `content/*` through `source.config.ts`, `lib/source.ts`, and the corresponding `app/**/layout.tsx` and `page.tsx` files.
- Diff all docs-style layouts to identify duplicated or drifting Fumadocs configuration.
- Inspect tracked/generated state for `.source` and other framework-generated files.

## Chapter 12: Build Pipeline and Release Readiness

### Review objective

Verify that build-time outputs and release-time behaviors required by the current site still exist after the migration.

### Checklist

- Verify prebuild steps that generate runtime-visible outputs still run or have equivalent replacements.
- Verify markdown source copying still exists for `.md` endpoints and MCP consumption.
- Verify contributors generation still runs if that feature is preserved.
- Verify postbuild steps still generate sitemap and `llms.txt` artifacts.
- Verify any static-export-specific redirect and header generation remains correct if still relevant.
- Verify no required runtime feature depends on a removed build step.
- Verify the deployment environment includes the keys needed for search, analytics, and feedback integrations.
- Verify preview, staging, and production environments behave differently where they are supposed to, especially for indexing controls.

### Suggested tests

- Build artifact inspection.
- CI assertions for generated files and headers.
- Deployment configuration review against the expected feature matrix.

## Chapter 13: Final Go/No-Go Gates

### Launch gates

Do not approve launch until all of the following are true:

- No critical URL or redirect regressions remain unresolved.
- No indexing, canonical, sitemap, or staging-domain regressions remain unresolved.
- Langfuse AI/LLM features pass their endpoint and UI checks.
- Core docs UX and navigation pass both desktop and mobile review.
- Content fidelity is confirmed for representative pages across all major content types.
- Fumadocs architecture deviations are documented, intentional, and acceptable for long-term maintenance.
- Feedback, search, and required analytics or webhook integrations are operational.
- Required security headers and preview protections are verified.
- Performance and accessibility checks show no major regression on representative pages.
- Build outputs and deployment configuration match the intended feature set.

## Chapter 14: Post-Deployment Monitoring

### Review objective

Catch issues that are difficult to detect before launch, especially around crawlers, caches, and real traffic.

### Checklist

- Monitor `404` volume and newly broken URLs immediately after launch.
- Monitor redirect behavior for top landing pages and legacy URLs.
- Monitor search-engine-facing signals such as sitemap submission status, canonical correctness, and indexed-page counts.
- Monitor the health of MCP, docs search, and feedback endpoints.
- Monitor performance and JavaScript error rates on representative pages.
- Monitor analytics continuity for key journeys if dashboards rely on these events.
- Review user-reported docs issues quickly during the first post-launch window.

## Recommended Review Sequence

Run the review in this order:

1. Build and deployment readiness.
2. Fumadocs architecture alignment review.
3. URL and redirect validation.
4. Indexability and metadata validation.
5. Langfuse AI/LLM feature validation.
6. Core docs UX and content fidelity review.
7. Search, feedback, and analytics validation.
8. Security, performance, accessibility, and mobile QA.
9. Final go/no-go decision based on unresolved findings.

## Expected Output of the Review

The review should end with:

- A pass/fail status per chapter.
- A list of critical issues that block launch.
- A list of non-blocking issues with owners and follow-up dates.
- Attached evidence for all automated checks and manual sign-off items.
- A final explicit go/no-go recommendation.
