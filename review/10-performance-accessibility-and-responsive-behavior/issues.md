# Chapter 10 Findings

## Status

- Chapter result: fail
- Automated evidence:
  `review/10-performance-accessibility-and-responsive-behavior/artifacts/preview-vs-production-report.json`
- Manual evidence:
  `review/10-performance-accessibility-and-responsive-behavior/manual/notes.md`

## High: Unlabeled interactive controls remain in the docs shell

### Evidence

- `axe-core` reported `button-name` and `link-name` failures on all four sampled preview pages.
- Manual keyboard QA reproduced the issue: the third `Tab` stop on `/docs/observability/get-started` lands on an unlabeled home link.
- The unlabeled controls map to:
  - the copy/share split-button chevron trigger in `components/MainContentWrapper.tsx`
  - the empty Fumadocs sidebar title link rendered from `app/docs/SharedDocsLayout.tsx` via `DocsLayout`

### Impact

- Screen-reader users encounter unnamed controls in core docs navigation and copy/share flows.
- Keyboard users can focus elements with no discernible purpose.
- This is a launch blocker for accessibility.

### Proposed fix

- Add a real accessible name to the split-button trigger in `components/MainContentWrapper.tsx`, for example `aria-label="Open copy and share options"`.
- Set an explicit sidebar title/home-link label in `app/docs/SharedDocsLayout.tsx` so the Fumadocs-generated title link is not empty.
- Re-run the Chapter 10 audit after the sidebar title and split-button trigger are fixed.

## High: Tabs with emoji/space labels produce invalid ARIA values

### Evidence

- `axe-core` reported `aria-valid-attr-value` on `/docs/observability/get-started`.
- The failing trigger resolves to the docs tab labelled `✨ Use AI`.
- The current tabs integration re-exports Fumadocs tabs from `components/docs/tabs.tsx`, and Fumadocs generates tab values from raw labels with insufficient escaping. This yields IDs and `aria-controls` values containing emoji and spaces.

### Impact

- A core getting-started page ships invalid ARIA relationships in a primary onboarding flow.
- Any page using similar tab labels can reproduce the same issue.
- This is a launch blocker for accessibility correctness.

### Proposed fix

- Wrap or replace the current tabs integration in `components/docs/tabs.tsx` so tab values are slugified to safe ASCII IDs before they reach Radix.
- As an immediate content-side mitigation, avoid emoji/space-heavy labels such as `✨ Use AI` until the component generates safe IDs.

## High: Representative preview pages are materially slower than production in throttled lab runs

### Evidence

- Throttled Chromium comparison against production showed these preview regressions:
  - `/docs`: LCP `3.736s` vs `1.280s`; script bytes `807.5 KB` vs `591.7 KB`
  - `/docs/observability/get-started`: LCP `3.720s` vs `2.108s`
  - `/guides/videos/introducing-datasets-v2`: FCP `3.568s` vs `1.640s`
  - `/self-hosting/deployment/docker-compose`: LCP `3.644s` vs `1.788s`
- The performance artifact is in `artifacts/preview-vs-production-report.json`.

### Impact

- The migrated site is slower on representative docs/guides pages under the same throttled conditions.
- The docs landing page also ships a materially larger script payload than production.
- This is a release-risk issue and should block sign-off until the regression is explained or reduced.

### Proposed fix

- Run a bundle diff or `pnpm run analyze` on the preview code path and identify which chunks account for the extra docs landing payload.
- Check whether preview-only runtime failures are delaying paint or hydration.
- Re-test after removing unnecessary client-side work from the docs shell and page chrome.

## Medium: Preview deployment has runtime/config errors that pollute UX and likely affect performance

### Evidence

- Every sampled preview page logged the same issues:
  - `PostHog was initialized without a token`
  - `cloud.langfuse.com/api/auth/session` blocked by CORS because it only allows `https://langfuse.com`
  - CookieYes throws `Looks like your website URL has changed`

### Impact

- Preview behavior does not cleanly represent launch behavior.
- Third-party/runtime failures add noise to performance and accessibility validation and may degrade the user experience on non-production hosts.
- This is cross-chapter and overlaps with Chapter 8, but it materially affected Chapter 10 execution.

### Proposed fix

- Either configure preview-safe values for analytics, auth/session, and CookieYes, or disable production-only integrations on preview deployments.
- Re-run the perf/accessibility audit once the preview environment is quiet enough to measure the docs shell itself.
