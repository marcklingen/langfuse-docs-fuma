# Chapter 3 Issues

## Findings

### P2: Missing back-to-top control in docs TOC/mobile chrome

- Severity: `P2`
- Evidence:
  - Manual browser walkthrough on `http://127.0.0.1:3333/docs/observability/get-started`
  - Browser DOM query after render returned `backToTopCount: 0`
  - Repo search for `Back to top|backToTop|back-to-top` returned no implementation hits
- Impact:
  - Chapter 3 explicitly requires a reliable back-to-top behavior.
  - Long docs pages currently provide TOC anchor links, but no visible affordance to return to the page top after navigating deep into the document, especially on mobile where the TOC collapses into a sticky trigger.
- Proposed fix:
  - Add a visible `Back to top` action to the TOC/footer area on desktop and the sticky TOC sheet or page chrome on mobile.
  - Cover it with a browser check that asserts the control exists and scrolls the page back to `window.scrollY === 0`.

## No other issues found

- Automated structure/link checks passed: `9/9`
- Internal docs chrome links checked: `194`
- Redirects observed: only footer `/discord` -> external Discord invite (`307`), which is expected

## Severity scale

- `P1`: launch blocker or major docs UX regression
- `P2`: significant but non-blocking regression
- `P3`: minor regression or polish issue
