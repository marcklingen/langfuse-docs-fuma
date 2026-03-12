# Chapter 8 Manual Notes

## Pending checks

- Point `WEBSITE_FEEDBACK_WEBHOOK` at a request bin or Slack test channel, then rerun the chapter with `ENABLE_FEEDBACK_API_POST=true` to confirm `/api/feedback` forwards the payload and prepends `type: "docs-feedback"`.
- Open PostHog live events while exercising the preview deployment and confirm the migration still emits the expected event families: `$pageview`, `copy_page`, `inkeep:*`, and `docs_mcp:execute_tool`.
- Verify the deployed Inkeep search widget still emits analytics during a real query flow. The automated runner only checks the general analytics surface and the docs copy interaction.
- Verify HubSpot and CookieYes behavior in a normal browser profile, especially consent-state handling and whether any scripts are intentionally suppressed on preview.
- Compare the deployment environment-variable set against `env-contract.json` in the target Vercel project or hosting platform. The automated runner can only generate the required contract from source, not inspect secret values in the deployment.
- Exercise one real acquisition journey with UTMs beyond `/cloud`, such as signup, demo booking, or contact-sales flows, if those paths are expected to preserve campaign attribution.

## Notes

- The browser runner stubs `/api/feedback` during UI-flow checks to avoid sending real messages to production or preview webhooks.
- If you run the chapter against `http://localhost:3333`, expect `EXPECT_PRODUCTION_SCRIPTS=false` and `EXPECT_ANALYTICS_EVENTS=false` unless your local environment is fully configured for production-style analytics.
