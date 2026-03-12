# Chapter 9 Manual Notes

## Pending checks

- Recheck the final custom-domain production deployment after cutover, because edge-level HSTS behavior can differ from the preview hostname even when the application headers match.
- Inspect the deployment platform configuration directly to confirm no new public environment variables were added outside source control. The automated chapter can only audit source references and downloaded bundles.
- Run one headed browser pass with a normal profile and consent state to confirm HubSpot, CookieYes, and embedded media still behave under the deployed CSP outside headless automation.
- If Chapter 4 still reports the allowlisted `/api/md-to-pdf` preview failure, verify that the eventual fix preserves the blocked-host behavior captured by this chapter.

## Notes

- The automated browser review filters for security-specific console output so known non-security console noise, such as unrelated cross-origin session checks, does not fail the chapter.
- The bundle scan only flags explicit server-side environment-variable names and a preview-host leak in production bundles. It does not treat user-facing documentation examples as secret exposure.
- A Playwright spot check on the preview docs overview page produced a CookieYes error about the registered site URL not matching the preview hostname. The same page on `https://langfuse.com` showed the consent banner normally and emitted no console errors.
