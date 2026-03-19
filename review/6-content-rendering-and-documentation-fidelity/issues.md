# Chapter 6 Issues

## Findings

### `P2` YouTube embeds still use the tracking host instead of `youtube-nocookie`

- Evidence:
  - `/changelog/2025-05-21-custom-dashboards` failed the chapter 6 audit because its iframe host is `www.youtube.com`.
    Source: [`content/changelog/2025-05-21-custom-dashboards.mdx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/content/changelog/2025-05-21-custom-dashboards.mdx)
  - `/guides/cookbook/example_simulated_multi_turn_conversations` failed the same host check.
    Source: [`content/guides/cookbook/example_simulated_multi_turn_conversations.mdx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/content/guides/cookbook/example_simulated_multi_turn_conversations.mdx)
  - Broader repo search found two more `www.youtube.com/embed` URLs in [`content/changelog/2025-05-20-save-table-views.mdx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/content/changelog/2025-05-20-save-table-views.mdx) and [`content/guides/cookbook/example_evaluating_multi_turn_conversations.mdx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/content/guides/cookbook/example_evaluating_multi_turn_conversations.mdx).
- Impact:
  - This violates the repo review rule to use `https://www.youtube-nocookie.com` for embeds.
  - It changes the privacy behavior of the rendered docs and changelog pages by reintroducing the standard YouTube embed host.
- Proposed fix:
  - Replace each `https://www.youtube.com/embed/...` source with the equivalent `https://www.youtube-nocookie.com/embed/...` URL, preserving any existing query parameters that are still needed.

### `P3` Video guide pages skip from H1 straight to H3

- Evidence:
  - `/guides/videos/introducing-datasets-v2` failed the chapter 6 heading-order check because the next heading after the H1 is `### Learn more`.
    Source: [`content/guides/videos/introducing-datasets-v2.mdx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/content/guides/videos/introducing-datasets-v2.mdx)
  - The same pattern exists in [`content/guides/videos/external-evaluation-pipelines.mdx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/content/guides/videos/external-evaluation-pipelines.mdx) and [`content/guides/videos/introducing-python-decorator.mdx`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/content/guides/videos/introducing-python-decorator.mdx).
- Impact:
  - The affected video guides ship invalid heading progression, which weakens accessibility semantics and makes the page structure less predictable for TOC generation and deep-link consumers.
- Proposed fix:
  - Change `### Learn more` to `## Learn more` in the affected video-guide files, or introduce a real H2 section before the H3 content.

## Severity scale

- `P1`: launch blocker or content fidelity regression that breaks key user journeys
- `P2`: significant rendering, accessibility, or media regression
- `P3`: minor rendering or polish issue
