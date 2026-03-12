# Chapter 1 Manual Notes

## Pending checks

- Open representative deep links on the preview deployment and confirm the browser lands on the intended section after hydration:
  - `/docs/prompt-management/get-started#create-update-prompt`
  - `/faq/all/existing-otel-setup#how-langfuse-uses-otel`
  - `/self-hosting/security/authentication-and-sso#auth-email-password`
- Open representative shortlinks and confirm the redirect destination is relevant, not the homepage:
  - `/demo`
  - `/ask-ai`
  - `/docs/integrations`
- Manually verify there is no visible redirect flash or broken scroll restoration on the preview deployment for one docs page and one self-hosting page.

## Notes

- Use the automated artifacts in `review/1-urls-routing-and-redirects/evidence/` as the source of truth for what needs manual confirmation.
- Chapter 2 should separately track the preview sitemap and robots host mismatch if it remains unresolved.
