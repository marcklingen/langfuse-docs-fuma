# Chapter 7 Manual Notes

## Manual follow-up still recommended

- No third-party social-preview validators were used in this pass. After metadata fixes land, recheck representative URLs in at least one unfurl debugger or a chat client that shows rich previews.
- The automated audit only validates emitted HTML metadata and asset responses. It does not confirm how Slack, Discord, LinkedIn, or X cache and render those cards.

## Notes

- Automated checks in this chapter target representative pages across docs, guides, blog, changelog, FAQ, and wide marketing content.
- JSON-LD is parsed directly from the server-rendered `<head>` so the audit only reports structured data that crawlers can see without client-side execution.
- The 2026-03-12 audit detected no JSON-LD scripts on any representative page in either production or preview. That means there were no structured-data types to validate for parity in this pass.
