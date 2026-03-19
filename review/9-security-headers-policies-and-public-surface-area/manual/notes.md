# Chapter 9 Manual Notes

## Run metadata

- Date: 2026-03-19
- Primary environment: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- Production comparison: `https://langfuse.com`
- Browser automation: Playwright CLI (`chrome`, headless)

## Pages checked

- `/`
- `/docs/prompt-management/get-started`
- `/guides/videos/introducing-datasets-v2`

## Security-focused results

- No browser console messages mentioned `Content Security Policy`, `CSP`, or mixed-content blocking on the checked preview pages.
- No load-bearing network requests used `http://`; the inspected page traffic stayed on `https://`.
- Remote video/media loaded over approved origins:
  - `https://static.langfuse.com/docs-videos/create-update-prompts.mp4%20MOVED%20TO%20R2.mp4`
  - `https://static.langfuse.com/docs-videos/launch-week-datasets.mp4`
- Preview-only `X-Robots-Tag: noindex` coverage was confirmed by the automated Chapter 9 report.

## Preview runtime observations

- The preview homepage, docs page, and video page all log a CookieYes host-registration error:
  - `Looks like your website URL has changed... update the registered URL on your CookieYes account`
- The same preview pages log a PostHog initialization error:
  - `PostHog was initialized without a token`
- The same preview pages issue cross-origin session requests to:
  - `https://cloud.langfuse.com/api/auth/session`
  - `https://us.cloud.langfuse.com/api/auth/session`
  - `https://hipaa.cloud.langfuse.com/api/auth/session`
- On preview, those requests fail with browser CORS errors because the cloud endpoints allow `https://langfuse.com`, not the preview hostname.
- On production homepage, those same session requests succeed with `200`, and the page showed `0` console errors during the comparison run.

These preview-only errors are noisy and may complicate QA, but they are not CSP violations.

## Out-of-scope regressions noticed during the browser pass

- `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app/images/integrations/openclaw_icon.png` returns `404`.
- The missing asset is referenced by `content/integrations/other/openclaw.mdx` via `logo: /images/integrations/openclaw_icon.png`.
- This is not a Chapter 9 security finding, but it is a real preview regression.

## Screenshots

- `output/playwright/chapter-9/homepage-preview.png`
- `output/playwright/chapter-9/docs-prompt-management-get-started.png`
- `output/playwright/chapter-9/guides-videos-introducing-datasets-v2.png`
