# Manual QA Notes

## Scope

Manual browser checks for chapter 1 focus on:

- Deep-link landing behavior on representative docs pages
- Redirect behavior for representative legacy URLs and shortlinks
- Visible URL normalization when navigating with trailing slashes

## Session Log

- 2026-03-19: preview walkthrough executed with headless Chromium via Puppeteer against `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`

## Observations

- Deep link check passed on `/docs/prompt-management/get-started#get-api-keys`.
- Browser state after load:
  - URL stayed on `/docs/prompt-management/get-started#get-api-keys`
  - `scrollY` was `409`
  - target heading `Get API keys` rendered at `~93px` from the top of the viewport
- Legacy shortlink `/ask-ai` normalized to `/docs/ask-ai` and rendered the expected `Ask AI` H1.
- Trailing-slash navigation `/docs/` normalized to `/docs` and rendered the expected `Langfuse Overview` H1.
- Manual spot checks matched the automated anchor suite in `artifacts/anchor-check.md`, which passed 5 out of 5 representative samples.

## Screenshots

- `manual/screenshots/anchor-get-api-keys.png`
- `manual/screenshots/ask-ai-redirect.png`
- `manual/screenshots/docs-trailing-slash.png`

## Notes

- The manual checks support the automated result that the preview has no observed regression in deep-link landing, shortlink-to-page landing for `/ask-ai`, or trailing-slash normalization on the sampled routes.
- The remaining chapter 1 problems are in redirect hygiene and internal-link hygiene rather than basic route rendering.
