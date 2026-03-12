# Chapter 6 Manual Notes

## Manual QA still required

- Verify code-copy buttons write the expected snippet to the clipboard on at least one docs page, one FAQ page, and one cookbook page.
- Switch tabs on the docs, changelog, FAQ, and self-hosting samples to confirm hidden panels render correctly after interaction.
- Play at least one hosted MP4 and one YouTube embed to confirm media controls and aspect ratios behave correctly.
- Inspect long pages for truncated sections, collapsed prose blocks, or broken MDX boundaries around frames and file-tree components.
- Compare one shared partial across multiple pages, especially `components-mdx/prompt-use.mdx`, `components-mdx/prompt-create.mdx`, and `components-mdx/integration-learn-more*.mdx`, to confirm consistent rendering.
- Spot-check the sample set in a narrow mobile viewport for overflow in tables, frames, and embedded media.

## Preview-first runbook

- Use the preview deployment as the primary target for this chapter.
- Start with the automated runner to identify obvious regressions before doing visual QA.
- When the runner flags a media-host or heading-structure issue, confirm it directly in the rendered page before recording it in `issues.md`.

## Status

Automated audit implemented. Manual QA notes still need to be filled in after the preview walkthrough.
