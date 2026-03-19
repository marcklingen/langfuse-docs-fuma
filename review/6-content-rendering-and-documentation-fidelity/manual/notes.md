# Manual QA Notes

## Environment

- Date: 2026-03-19
- Base URL: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- Browser: Puppeteer headless Chromium
- Viewports:
  - Desktop: `1440x1200`
  - Mobile: `390x844`

## Pages reviewed

- `/docs/prompt-management/get-started`
- `/docs/observability/data-model`
- `/changelog/2025-05-21-custom-dashboards`
- `/blog/2026-02-26-evaluate-ai-agent-skills`
- `/faq/all/unwanted-http-database-spans`
- `/guides/videos/introducing-datasets-v2`
- `/guides/cookbook/example_simulated_multi_turn_conversations`
- `/integrations/no-code/goose`
- `/self-hosting/deployment/docker-compose`

## Checklist

- [x] Representative docs, changelog, blog, FAQ, guides, integrations, and self-hosting pages render correctly, except the specific issues listed below
- [x] Notebook-derived cookbook page renders correctly in the browser
- [x] Mermaid diagrams render as SVG on the docs sample page
- [x] Tabs switch correctly on pages that use the shared tabs component
- [x] Code block copy buttons appear and copy non-empty content on representative pages
- [x] Tables, callouts, frames, videos, and embedded media render without layout breakage in the sampled pages
- [ ] Remote video and iframe hosts use approved origins
- [x] No obvious truncation, missing sections, or broken MDX component boundaries in the sample set
- [ ] Each sampled page uses one H1 and valid heading progression inside the article body
- [x] Shared component behavior is consistent across related pages

## Findings

- The automated audit passed 6 of 9 representative sample pages. The JSON report is at `review/6-content-rendering-and-documentation-fidelity/artifacts/preview-content-fidelity-report.json`.
- Mermaid rendered correctly on `/docs/observability/data-model`, with 5 SVG diagrams detected after hydration.
- Shared tabs behaved correctly when exercised with real browser clicks on `/docs/prompt-management/get-started`, `/changelog/2025-05-21-custom-dashboards`, `/faq/all/unwanted-http-database-spans`, and `/self-hosting/deployment/docker-compose`.
- Code-copy behavior worked on the representative code-heavy pages. The browser audit captured non-empty copied text on prompt management, blog, FAQ, cookbook, integration, and self-hosting pages.
- Long-page rendering looked stable on the sampled desktop and mobile checks. At `390x844`, the sampled pages kept `documentElement.scrollWidth === clientWidth`; wide code blocks stayed inside horizontally scrollable containers instead of forcing page-level overflow.
- Two sampled pages still embed YouTube from `www.youtube.com` instead of `www.youtube-nocookie.com`: `/changelog/2025-05-21-custom-dashboards` and `/guides/cookbook/example_simulated_multi_turn_conversations`.
- `/guides/videos/introducing-datasets-v2` skips from the H1 directly to `### Learn more`, so the article heading order is invalid even though the page otherwise renders correctly.
