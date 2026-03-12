# Chapter 5 Search Review Summary

- Generated: 2026-03-12T05:10:52.051Z
- Preview: https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app
- Production baseline: https://langfuse.com
- Status: FAIL

## Findings

- **High:** Preview search query "docker compose" does not expose the expected search scopes (search-ui.json)
  Preview scopes Docs do not match production scopes Docs, Integrations, Self Hosting, FAQ & Guides, All, GitHub for "docker compose". Missing on preview: Integrations, Self Hosting, FAQ & Guides, All, GitHub.
- **High:** Preview search query "docker compose" returns no real client-side results (search-ui.json)
  Preview only surfaced 1 option(s) and emitted GraphQL warnings, while production surfaced 3 option(s) for the same query.
- **High:** Preview search query "open source handbook" does not expose the expected search scopes (search-ui.json)
  Preview scopes Docs do not match production scopes Docs, Integrations, FAQ & Guides, Handbook, Blog, All, GitHub for "open source handbook". Missing on preview: Integrations, FAQ & Guides, Handbook, Blog, All, GitHub.
- **High:** Preview search query "open source handbook" returns no real client-side results (search-ui.json)
  Preview only surfaced 1 option(s) and emitted GraphQL warnings, while production surfaced 2 option(s) for the same query.

## Preview UI

- Visible search triggers on preview docs page: 1
- Keyboard shortcut opened preview search: yes
- Preview query `docker compose`: scopes Docs; options 1; warnings 1
- Preview query `open source handbook`: scopes Docs; options 1; warnings 1

## Production Baseline

- Production query `docker compose`: scopes Docs, Integrations, Self Hosting, FAQ & Guides, All, GitHub; options 3
- Production query `open source handbook`: scopes Docs, Integrations, FAQ & Guides, Handbook, Blog, All, GitHub; options 2

## API Relevance

- Docs: preview top URL https://langfuse.com/docs/prompt-management/overview; production top URL https://langfuse.com/docs/prompt-management/overview
- Integrations: preview top URL https://langfuse.com/integrations/no-code/goose; production top URL https://langfuse.com/integrations/no-code/goose
- Self-hosting: preview top URL https://langfuse.com/self-hosting/deployment/docker-compose; production top URL https://langfuse.com/self-hosting/deployment/docker-compose
- FAQ: preview top URL https://langfuse.com/faq/all/unwanted-http-database-spans; production top URL https://langfuse.com/faq/all/unwanted-http-database-spans
- Handbook: preview top URL https://langfuse.com/handbook/chapters/open-source; production top URL https://langfuse.com/handbook/chapters/open-source

## Artifacts

- `search-ui.json`
- `search-api-relevance.json`
- `screenshots/preview-desktop-search-light.png`
- `screenshots/preview-desktop-search-dark.png`
- `screenshots/preview-mobile-search.png`
- `screenshots/production-desktop-search-light.png`