# Chapter 5 Manual Notes

## Run metadata

- Date: 2026-03-11 (America/Los_Angeles)
- Environment: preview deployment
- Reviewer: Codex

## Notes

- Preview desktop search trigger rendered on docs pages and opened the modal both by click and by `Ctrl+K`.
- Preview dark/light theme synchronization worked: the Inkeep modal switched from a light surface to a dark surface after the site theme toggle.
- Preview mobile search also opened successfully from the header trigger on a `390x844` viewport.
- Preview search queries did not return real search scopes or result rows in the client widget. The modal stayed on `Docs (0)` and only exposed the fallback `Ask AI` conversation option for tested queries such as `docker compose`.
- The same preview queries emitted `Error in graphqlRequest: Error: (403, 'Not authenticated')` in the browser console, while production returned populated search scopes for the same queries.
- The fixed-query `/api/search-docs` checks still returned relevant canonical `langfuse.com` results on preview, which narrows the regression to the client-side widget path rather than the public REST search endpoint.
