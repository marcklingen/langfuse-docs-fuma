# Chapter 6 Issues

## Confirmed issues

### [P1] Embedded YouTube iframes still use the cookie-setting host

Affected preview pages:

- `/changelog/2025-05-21-custom-dashboards`
- `/guides/cookbook/example_simulated_multi_turn_conversations`

Why this matters:

- The repo guidance requires `https://www.youtube-nocookie.com` for YouTube embeds.
- `www.youtube.com/embed/...` introduces unnecessary tracking cookies and breaks the intended media-origin policy for this chapter.

Evidence:

- `review/6-content-rendering-and-documentation-fidelity/evidence/page-rendering.json`
- `review/6-content-rendering-and-documentation-fidelity/evidence/summary.md`

Proposed fix:

- Update the changelog MDX file to use `https://www.youtube-nocookie.com/embed/z6g9xmciaBE`.
- Update the cookbook notebook source that generates `example_simulated_multi_turn_conversations` so the embed uses `https://www.youtube-nocookie.com/embed/3ODizwXu-uk`.
- Regenerate cookbook output instead of hand-editing the generated guide page.

### [P2] Heading hierarchy skips from H2 to H4 on the Prompt Management getting-started page

Affected preview page:

- `/docs/prompt-management/get-started`

Why this matters:

- The rendered article jumps from `## Use the prompt in your code` to `#### Not seeing what you expected?`.
- That breaks the chapter's heading-order accessibility check and makes deep-link structure less predictable.

Evidence:

- `review/6-content-rendering-and-documentation-fidelity/evidence/page-rendering.json`
- `review/6-content-rendering-and-documentation-fidelity/evidence/summary.md`

Proposed fix:

- Change `Not seeing what you expected?` to `###` or insert a real `###` parent section above it.
