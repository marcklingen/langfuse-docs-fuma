# Chapter 4 Manual Notes

## Preview deployment checked

- Base URL: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`
- Browser method: Playwright CLI session
- Checked on: 2026-03-11 Pacific time

## Docs page copy flow

Representative page: `/docs/observability/overview`

- The copy-as-markdown control rendered next to the page chrome.
- The dropdown exposed the expected entries:
  - `Copy page`
  - `Open in ChatGPT`
  - `Open in Claude`
  - `Install Docs MCP server`
- Clicking `Copy page` transitioned the button state to `Copied!`, which is sufficient evidence that the markdown fetch and clipboard write path completed in the browser session.

## Ask AI page

Representative page: `/docs/ask-ai`

- The page rendered with the expected `Ask AI` H1.
- The embedded Inkeep chat shell loaded successfully.
- The loaded chat UI included:
  - The initial assistant greeting
  - Example question buttons
  - The main message textbox
  - The disabled send button before typing
  - The `Powered by inkeep` footer and `Contact Support` link

## Console observations

The preview deployment logged several console errors that did not prevent the chapter 4 UI from rendering:

- CookieYes reported that the registered site URL does not match the preview hostname.
- PostHog logged a missing token configuration error.
- Requests to `cloud.langfuse.com`, `us.cloud.langfuse.com`, and `hipaa.cloud.langfuse.com` session endpoints failed CORS checks because those endpoints currently allow `https://langfuse.com`, not the preview host.

These console errors are worth tracking separately, but they did not block the copy flow or the Ask AI embedded chat shell during this chapter 4 review.
