# Langfuse Documentation Site Feature Inventory and Migration Parity Checklist

## Scope, sources, and what “parity” means here

This report inventories **publicly observable** and **code-implemented** features of the Langfuse documentation/website (built from `langfuse/langfuse-docs`) that are likely to regress during a documentation framework migration. The intent is a **final-review checklist** you can use to validate an agency’s implementation before go-live.

Primary sources used:

- Public pages on `langfuse.com` (Docs, Changelog, and LLM artifacts such as `llms.txt`). citeturn18view0turn26view0turn38view0turn44view1
- The `langfuse/langfuse-docs` codebase configuration and runtime endpoints (Next.js + Nextra). fileciteturn32file0L5-L6 fileciteturn40file0L35-L43

“Parity” in this context includes both:

- **User-visible UX** (navigation, search, contributor widgets, “Was this page helpful?”, etc.). citeturn18view0turn26view0 fileciteturn39file0L80-L94
- **Machine-/tool-facing behaviors** (redirects, `.md` endpoints, `llms.txt`, MCP server and search APIs, OG image generation, indexing controls). fileciteturn40file0L109-L176 citeturn38view0 fileciteturn34file0L47-L239

## Core documentation UX features to preserve

### Information architecture and navigation model

The repo is the “website + docs” source for `langfuse.com`, built on **Nextra**. fileciteturn32file0L5-L6

Key IA/UI behaviors to check end-to-end:

- **Global top navigation** linking across Docs/Self Hosting/Guides/Integrations/FAQ/Handbook/Changelog/Library/Security & Compliance. This is visible on docs pages (e.g., `/docs`, `/docs/docs-mcp`). citeturn18view0turn26view0
- **Sidebar navigation** with collapsible sections and a toggle button (Nextra theme config). fileciteturn39file0L80-L83
- **Docs left-nav structure is explicitly curated** (not purely filesystem-derived): `pages/docs/_meta.tsx` defines separators (“Get Started”, “Products”, “Platform”, “More”) and links like “Ask AI” and “Docs MCP Server”. fileciteturn39file0L16-L69
- **“Menu switcher” presence** at the top of the Docs sidebar (implemented as a separator entry rendering `<MenuSwitcher />`). fileciteturn39file0L1-L7

### Search and “Ask AI” as first-class docs UX

The Nextra search widget is replaced with an **Inkeep-powered search bar** as the configured `search.component`. fileciteturn39file0L32-L35

Important sub-features to keep:

- **Keyboard shortcut**: the search modal uses `shortcutKey: "k"` in the search bar props. fileciteturn46file0L41-L44
- **Scoped search tabs** across site sections (Docs, Integrations, Self Hosting, FAQ & Guides, Security, Handbook, Blog) plus “All” and “GitHub”, with the current section forced visible. fileciteturn47file0L29-L101
- **Dark mode sync** between site theme and Inkeep widget (`forcedColorMode: resolvedTheme`). fileciteturn47file0L63-L66

“Ask AI” exists as a dedicated docs page and embeds an **Inkeep Embedded Chat** component. fileciteturn50file0L6-L16  
That Ask AI page claims its assistant is trained on **documentation, GitHub discussions/issues, and API**. fileciteturn50file0L8-L9

### Page chrome and per-page utilities

From the theme config, the following per-page features are part of the expected docs experience:

- **Edit link**: visible label is “Edit this page on GitHub” and `docsRepositoryBase` points to the repo tree. fileciteturn39file0L84-L93
- **Table of contents** includes “Back to top” and an extra content area that injects the contributors widget. fileciteturn39file0L87-L90
- **Dismissible announcement banner** with a stable `key` and content linking to a specific changelog post (currently the “Langfuse just got faster…” banner pointing at the March 10, 2026 changelog entry). fileciteturn39file0L224-L237 citeturn48view0

### Contributors display

A “Contributors” block appears on documentation pages (observable on `/docs` and `/docs/docs-mcp`). citeturn18view0turn26view0

Implementation details you’ll want to keep parity with:

- Contributors are resolved from a generated JSON map keyed by URL path, with fallback variants for `/index`. fileciteturn44file0L8-L21
- The widget shows up to 3 contributors, then allows expanding “… and N more”. fileciteturn44file0L124-L149
- For internal team members, the UI can show richer hovercards (it checks against an author registry and wraps with a `HoverCard`). fileciteturn44file0L68-L77 fileciteturn44file0L84-L99

Contributor data generation is part of the build pipeline and uses git history + optional GitHub API calls (via `GITHUB_ACCESS_TOKEN`) to resolve usernames. fileciteturn45file0L13-L24 fileciteturn45file0L96-L101 fileciteturn45file0L223-L229

## LLM-facing and AI agent features

This is the most migration-sensitive area because it ties together: build-time markdown copying, runtime routing/headers, UI buttons, and server endpoints.

### llms.txt and sub-files

Langfuse publishes a top-level `llms.txt` intended to help AI tools consume the site. citeturn19view0turn38view0  
The changelog entry describes `llms.txt` as intended for use in Cursor and other LLM editors and cites the `llmstxt.org` proposal. citeturn38view0

The `llms.txt` generator script:

- Reads a sitemap XML (`public/sitemap-0.xml`) and groups URLs into sections. fileciteturn33file0L5-L15 fileciteturn33file0L52-L65
- Produces sub-files: `llms-docs.txt`, `llms-integrations.txt`, and `llms-self-hosting.txt`. fileciteturn33file0L16-L21 fileciteturn33file0L69-L82
- Writes a concise `llms.txt` that includes a **Docs MCP Server** section with endpoint and documentation link. fileciteturn33file0L84-L105

Public evidence: `llms-docs.txt` exists and contains a large list of `.md` endpoints for docs pages. citeturn20view0

Migration parity checks:

- `https://<new-site>/llms.txt` returns the expected structure and is updated by the build (not a stale hand-edited file). citeturn38view0turn19view0
- The section sub-files are present at the same paths as the generator expects (`/llms-docs.txt`, `/llms-integrations.txt`, `/llms-self-hosting.txt`). fileciteturn33file0L16-L21
- The docs MCP server section in `llms.txt` still points to the correct MCP endpoint and docs page. fileciteturn33file0L88-L95

### Markdown endpoints and content negotiation

Langfuse added **“.md endpoints”** for docs pages (build-time, fast/reliable) as a documented feature. citeturn44view1  
The changelog explicitly says “Append `.md` to any docs URL… Built at compile time” and that it powers “Copy as Markdown” and the Docs MCP server. citeturn44view1

In `next.config.mjs`, this is implemented with:

- **A rewrite mapping any `/:path*.md`** to `/md-src/:path*.md` (static files). fileciteturn40file0L169-L175
- **Content negotiation**: if `Accept: text/markdown` is set, non-API/non-static routes are served from `/md-src/:path.md`. fileciteturn40file0L160-L166
- **Headers** forcing `.md` endpoints to be `noindex` and `Content-Type: text/markdown; charset=utf-8`. fileciteturn40file0L109-L116

This content-negotiation behavior is also relied on by the Docs MCP tool `getLangfuseDocsPage` which fetches `<pathname>.md` with `Accept: text/markdown`. fileciteturn34file0L125-L139

Migration parity checks:

- `GET /some/page.md` returns the markdown (status 200) and the correct content-type header. fileciteturn40file0L109-L116
- `GET /some/page` with `Accept: text/markdown` returns markdown via negotiation (not HTML). fileciteturn40file0L160-L166
- `.md` responses remain `noindex` to avoid SEO duplication. fileciteturn40file0L109-L116

### Copy as Markdown UI and “open in LLM” helpers

The public changelog introduced “Copy Docs as Markdown” (April 17, 2025). citeturn44view0  
Later, the `.md` endpoints changelog states the new endpoints make “Copy as Markdown” faster and more reliable. citeturn44view1

In the code, the “Copy page” UI:

- Computes a `/<route>.md` URL and fetches it with `Accept: text/markdown`, then copies to clipboard. fileciteturn34file0L72-L104 fileciteturn34file0L117-L124
- Is shown on multiple parts of the site (Docs, Self Hosting, FAQ, Integrations, Handbook, Security). fileciteturn34file0L42-L50 fileciteturn34file0L316-L331
- Includes a dropdown with actions:
  - Copy page as Markdown
  - Open in ChatGPT (builds a prompt referencing the markdown URL)
  - Open in Claude
  - Install Docs MCP server fileciteturn34file0L217-L301

Migration parity checks:

- Button still appears where expected and successfully copies markdown (clipboard permissions handled; clear error UI instead of silent failure). fileciteturn34file0L100-L140
- The “Open in ChatGPT/Claude” links still generate correct prompts pointing at the `.md` URL. fileciteturn34file0L143-L153
- The dropdown link to the Docs MCP install page is intact. fileciteturn34file0L277-L299

### Docs MCP server and public search API

A **public Docs MCP server** is documented under `/docs/docs-mcp` and is positioned as a way to expose docs to AI agents. citeturn26view0 fileciteturn51file0L1-L28  
The June 28, 2025 changelog positions this as part of “Agentic Onboarding”, allowing agents like Cursor, Claude Code, Copilot, Windsurf to integrate Langfuse into an existing codebase. citeturn44view2

The Docs MCP server details:

- Endpoint: `https://langfuse.com/api/mcp`
- Transport: `streamableHttp`
- Authentication: none
- Tools: `searchLangfuseDocs`, `getLangfuseDocsPage`, `getLangfuseOverview` fileciteturn51file0L21-L28

Server implementation (`pages/api/mcp.ts`) shows:

- `searchLangfuseDocs` calls Inkeep RAG and returns synthesized text plus `_meta` (raw provider payload). fileciteturn34file0L51-L77
- `getLangfuseDocsPage` appends `.md` and fetches from production with `Accept: text/markdown`. fileciteturn34file0L125-L139
- `getLangfuseOverview` fetches `https://langfuse.com/llms.txt`. fileciteturn34file0L176-L207

There is also a **public unauthenticated REST endpoint** `/api/search-docs?query=...` with permissive CORS (`Access-Control-Allow-Origin: *`). fileciteturn35file0L14-L21 fileciteturn35file0L23-L76  
That endpoint delegates to the same Inkeep RAG function. fileciteturn35file0L2-L3 fileciteturn36file0L9-L38

Migration parity checks:

- `/api/mcp` still works with the same transport and tool names (agents depend on stability). fileciteturn51file0L21-L28
- `getLangfuseDocsPage` returns markdown that matches the `.md` endpoint output after migration. fileciteturn34file0L125-L154
- `/api/search-docs` still returns `{ query, answer, metadata }` and keeps CORS enabled if you rely on cross-origin consumption. fileciteturn35file0L14-L21 fileciteturn35file0L68-L75

### Export as PDF for markdown sources

The docs include an API endpoint `/api/md-to-pdf` that:

- Accepts a `url` query parameter for a markdown source.
- Restricts allowed hostnames to `langfuse.com`, `raw.githubusercontent.com`, `github.com` (SSRF mitigation outside development). fileciteturn37file0L4-L9 fileciteturn37file0L60-L70
- Strips frontmatter and converts markdown to HTML, with special handling for MDX `<Callout type="...">…</Callout>`. fileciteturn37file0L83-L97 fileciteturn37file0L20-L34
- Generates the PDF via Puppeteer (local dev) or `puppeteer-core` + `@sparticuz/chromium` (production). fileciteturn37file0L241-L262
- Sets caching headers (`s-maxage=60` and `stale-while-revalidate=86400`). fileciteturn37file0L293-L297

Migration parity checks:

- Endpoint exists and returns valid PDFs for legal pages and other intended targets (and still blocks untrusted hosts in production). fileciteturn37file0L60-L70
- Callout rendering remains readable (this is often missed if the new markdown pipeline differs). fileciteturn37file0L20-L34

## SEO, metadata, security headers, and discoverability

### Canonical URLs, noindex controls, and social previews

The site head generation in `theme.config.tsx` sets:

- Dynamic `og:image` and `twitter:image` via `/api/og` unless a page defines a custom `ogImage`. fileciteturn39file0L116-L123
- Optional `og:video` for pages with `ogVideo`. fileciteturn39file0L124-L126
- Canonical URLs sourced from front matter (`canonical`) or cookbook canonical route mapping. fileciteturn39file0L128-L137
- `noindex` for pages with `frontMatter.noindex === true`. fileciteturn39file0L139-L199
- Title templating by section (blog, guides, handbook) and default. fileciteturn39file0L141-L150

OpenGraph image generation is implemented at `/api/og` using `@vercel/og` on the edge runtime. fileciteturn38file0L1-L7 fileciteturn38file0L19-L39

Migration parity checks:

- `og:image` and Twitter cards still resolve correctly (many doc systems lose dynamic OG generation). fileciteturn39file0L116-L170 fileciteturn38file0L19-L39
- Canonical logic is preserved (especially cookbook canonicalization). fileciteturn39file0L128-L137
- Page-level `noindex` flags remain honored. fileciteturn39file0L139-L199

### Sitemap and robots behavior

Sitemaps and robots are generated via `next-sitemap`. fileciteturn43file0L14-L16 fileciteturn42file0L4-L7  
The config:

- Sets `generateRobotsTxt: true`. fileciteturn42file0L5-L7
- Excludes non-canonical cookbook pages (those also embedded in docs), `_meta` files, and `/events/*`; and can exclude `/api/*` for static export builds. fileciteturn42file0L14-L23

Migration parity checks:

- Robots and sitemap generation still run, with the same exclusions (or consciously updated). fileciteturn42file0L14-L23
- `llms.txt` generation still parses the sitemap your new framework emits (or you update the generator accordingly). citeturn38view0 fileciteturn33file0L38-L42

### Redirects and link stability

Redirects are treated as a first-class feature. `lib/redirects.js` explicitly says it contains redirects for **both Next.js and Cloudflare Pages**, with tuples `[source, destination]`. fileciteturn41file0L1-L8  
The file includes both non-permanent redirects and carefully managed “permanent” sets (with warnings that permanent redirects can only be added). fileciteturn41file0L216-L222

In `next.config.mjs`, redirects are wired into Next.js by mapping these lists into permanent/non-permanent redirects. fileciteturn40file0L134-L145

Migration parity checks:

- The new framework preserves the entire redirect surface area (especially old docs paths and shortlinks like `/discord`, `/demo`, `/ask-ai`). fileciteturn41file0L18-L35
- Cloudflare/static export redirect generation stays consistent with Next redirects (see build scripts below). fileciteturn41file0L1-L8 fileciteturn43file0L10-L12

### Security headers and indexing controls

`next.config.mjs` sets:

- A production CSP (Content Security Policy) and other baseline headers (nosniff, referrer policy, permissions policy). fileciteturn40file0L11-L33 fileciteturn40file0L77-L108
- Forces `.md` endpoints to be `noindex` and sets their content type. fileciteturn40file0L109-L116
- Adds `X-Robots-Tag: noindex` to all pages during Vercel preview deployments. fileciteturn40file0L119-L130

Migration parity checks:

- Equivalent header posture exists after the agency migration (especially CSP and `.md` content type + noindex). fileciteturn40file0L77-L116

## Analytics, feedback collection, and operational dependencies

### Product analytics hooks (PostHog)

Docs MCP server tool usage is tracked server-side via PostHog (`posthog-node`). fileciteturn34file0L5-L16 fileciteturn34file0L18-L44  
The public docs search endpoint also captures PostHog events for queries. fileciteturn35file0L49-L66

The Inkeep widget emits custom analytics events to PostHog on user interaction. fileciteturn47file0L14-L27 fileciteturn47file0L66-L67

Migration parity checks:

- If analytics parity matters, ensure these PostHog events still fire (or that you intentionally change them and update dashboards/alerts). fileciteturn35file0L49-L76 fileciteturn34file0L18-L44

### Docs feedback widget and backend webhook

Docs pages display “Was this page helpful?” (visible on Docs MCP page, self-hosting pages, changelog pages, etc.). citeturn26view0turn30view0turn44view1turn48view0

In the site code, the feedback UI posts to `/api/feedback`. fileciteturn34file0L388-L416  
The `/api/feedback` endpoint:

- Runs on the edge runtime.
- Requires `WEBSITE_FEEDBACK_WEBHOOK`.
- Forwards the payload with `type: "docs-feedback"` to that webhook. fileciteturn37file0L3-L31

Migration parity checks:

- The feedback widget still appears on the intended paths and the webhook still receives events. fileciteturn34file0L339-L350 fileciteturn37file0L17-L35
- The UX includes the follow-up dialog (positive+negative flows), since this is a meaningful part of how docs quality feedback is gathered. fileciteturn34file0L378-L516 fileciteturn34file0L517-L564

### Environment variables and “hidden” operational dependencies

The `.env.template` indicates multiple integrations that can silently break in a migration if not wired:

- PostHog: `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY`. fileciteturn38file0L4-L6
- Feedback webhooks: `WEBSITE_FEEDBACK_WEBHOOK`, plus a Slack webhook variable `SLACK_WEBHOOK_URL`. fileciteturn38file0L1-L2 fileciteturn38file0L12-L13
- In the codebase: Inkeep requires both `NEXT_PUBLIC_INKEEP_API_KEY` (frontend widget) and `INKEEP_BACKEND_API_KEY` (server-side RAG calls). fileciteturn47file0L58-L66 fileciteturn36file0L12-L21
- “QA chatbot” related secrets (OpenAI + Supabase + Langfuse projects) are present in env template, implying there are additional AI/QA features beyond Inkeep in the repo history/implementation. fileciteturn38file0L17-L31

Migration parity checks:

- Agency deployment environment includes all required env vars for the features you want to keep functioning (particularly: feedback webhook, Inkeep keys, PostHog keys). fileciteturn38file0L4-L13 fileciteturn36file0L12-L21

### Build pipeline expectations that affect runtime features

From `package.json`, key scripts that produce runtime-visible functionality:

- `prebuild` runs:
  - a GitHub stars updater
  - contributors generation
  - markdown source copying (`copy_md_sources.js`) fileciteturn43file0L6-L8
- `postbuild` runs:
  - sitemap generation
  - a cleanup step removing `.next/cache` (documented as a Nextra caching bug workaround)
  - `llms.txt` generation fileciteturn43file0L9-L16
- Static export build (`build:static`) runs postbuild and then generates Cloudflare redirects and copies `lib/_headers` into the `out/` directory. fileciteturn43file0L10-L12

Migration parity checks:

- The new build pipeline still produces:
  - sitemaps/robots files compatible with your existing tooling
  - `llms.txt` + subfiles
  - the static markdown copies used by `.md` endpoints / MCP / copy button fileciteturn43file0L6-L16 fileciteturn32file0L56-L71
- If moving off Nextra, you either keep the `.next/cache` workaround (if still relevant) or confirm it’s no longer needed. fileciteturn43file0L15-L16

## Content pipeline, media, and component-level compatibility

### Notebooks and cookbook conversion pipeline

The repo supports a “cookbook” workflow where Jupyter notebooks are converted to markdown and placed into `pages/` for rendering. fileciteturn32file0L19-L31  
There’s an explicit warning: generated `.md/.mdx` with `source: ⚠️ Jupyter Notebook` in `pages/` must not be edited manually. fileciteturn32file0L31-L31

Migration parity checks:

- The new docs system can still render the converted notebook output (markdown/MDX features used by nbconvert output, code blocks, tables, images). fileciteturn32file0L21-L29
- Your sitemap/canonical strategy still avoids duplicate indexing for cookbook pages embedded elsewhere (current `next-sitemap` exclusion). fileciteturn42file0L14-L19

### Media storage and embedding conventions

Conventions called out in the repo:

- Images live under `public/images/` and are referenced by absolute path `/images/...`. fileciteturn32file0L35-L38
- Videos/GIFs are stored on Cloudflare R2 (`https://static.langfuse.com/docs-videos`) and embedded through a Video component (including a `gifMode` that renders “GIF-like” videos). fileciteturn32file0L39-L46
- Next.js image remote patterns explicitly allow `static.langfuse.com` and `github.com`. fileciteturn40file0L59-L76

Migration parity checks:

- Video embeds still work and maintain performance optimizations (video-as-gif). fileciteturn32file0L39-L46
- External images continue to load (remote patterns/allowlists often change when switching frameworks). fileciteturn40file0L59-L76

### Supported MDX components and rendering affordances

The theme config exposes a curated component set used across docs:

- Nextra components: `Cards`, `Steps`, `Tabs`, `Callout`. fileciteturn39file0L4-L5 fileciteturn39file0L203-L223
- Custom components: `Frame`, `LangTabs` (stateful tabs), `AvailabilityBanner`, and `Video`. fileciteturn39file0L203-L223

Additionally, the Next config enables:

- GitHub Flavored Markdown via `remark-gfm`. fileciteturn40file0L1-L3 fileciteturn40file0L35-L43
- Default code-block copy buttons via `defaultShowCopyCode: true`. fileciteturn40file0L35-L43

Migration parity checks:

- All frequently used MDX components still render correctly (especially Tabs/Steps/Cards/Callouts and any custom wrappers). fileciteturn39file0L203-L223
- Code blocks still have copy affordances and syntax highlighting behavior remains acceptable. fileciteturn40file0L35-L43

### Multi-language / locale considerations

The site includes locale-like entry pages such as `cn.mdx`, `jp.mdx`, `kr.mdx` in the `pages/` tree (observed in the repository’s `pages/` listing). citeturn33view0

Additionally, the head config includes locale-sensitive URL construction based on `defaultLocale`/`locale`. fileciteturn39file0L96-L101

Migration parity checks:

- Locale routing (if still used) still produces correct canonical/og URLs and doesn’t break navigation. fileciteturn39file0L96-L101

## Master parity checklist for agency sign-off

Use this as a final “go/no-go” verification list. Each item maps to concrete implementation in the current system.

### Non-negotiable AI/LLM parity

Confirm all of the following still work in production:

- `GET /llms.txt` (exists, up to date, references MCP + subfiles). citeturn19view0turn38view0
- `GET /llms-docs.txt` (and ideally the other generated subfiles) exist and contain `.md` links. citeturn20view0 fileciteturn33file0L16-L21
- `.md` endpoints:
  - `GET /docs.md` (or any doc page `.md`) returns markdown.
  - Content-type `text/markdown; charset=utf-8` and `X-Robots-Tag: noindex` are preserved. fileciteturn40file0L109-L116
- Content negotiation:
  - `GET /docs` with `Accept: text/markdown` routes to markdown source. fileciteturn40file0L160-L166
- Copy-as-Markdown UI:
  - Button visible on docs sections and successfully copies markdown for the current route. fileciteturn34file0L42-L50 fileciteturn34file0L100-L124
  - Dropdown contains “Open in ChatGPT”, “Open in Claude”, and “Install Docs MCP server”. fileciteturn34file0L217-L301
- Docs MCP server:
  - `/api/mcp` responds and supports `searchLangfuseDocs`, `getLangfuseDocsPage`, `getLangfuseOverview`. fileciteturn51file0L21-L28 fileciteturn34file0L51-L229
- Public docs semantic search:
  - `/api/search-docs?query=...` works cross-origin (CORS `*`). fileciteturn35file0L14-L21
- PDF export:
  - `/api/md-to-pdf?url=<...>` still functions and blocks non-allowlisted hosts in production. fileciteturn37file0L4-L9 fileciteturn37file0L60-L70

### Docs UX and feedback parity

- Inkeep search bar present as the main search UI (with shortcut “k”). fileciteturn39file0L32-L35 fileciteturn46file0L41-L44
- Ask AI page exists and loads embedded chat. fileciteturn50file0L6-L16
- “Edit this page on GitHub” is present and links correctly. fileciteturn39file0L84-L93
- Contributors widget appears on pages and lists correct people. fileciteturn39file0L87-L90 fileciteturn44file0L121-L149
- “Was this page helpful?” widget renders and submits feedback. fileciteturn34file0L428-L450 fileciteturn37file0L17-L35
- Announcement banner remains functional and dismissible (key stability). fileciteturn39file0L224-L237

### SEO and link stability parity

- Canonical URLs preserved (especially cookbook canonical mapping + front matter overrides). fileciteturn39file0L128-L137
- `noindex` behavior for flagged pages preserved. fileciteturn39file0L139-L199
- OG images still render via `/api/og` and the head tags reference them. fileciteturn39file0L116-L170 fileciteturn38file0L19-L39
- Redirects are fully preserved (including shortlinks and legacy docs paths). fileciteturn41file0L18-L35 fileciteturn40file0L134-L145
- Sitemap/robots generation still runs with the same exclusions. fileciteturn42file0L14-L23

### Build/deploy parity items agencies often miss

- `prebuild` tasks that generate contributors and copy markdown sources still run (or equivalent new pipeline exists). fileciteturn43file0L6-L8
- `postbuild` tasks generate sitemap and `llms.txt`. fileciteturn43file0L9-L16
- Static export path (if still used) replicates Cloudflare redirect + headers behavior. fileciteturn43file0L10-L12
- Required env vars are present in production for the features you keep (PostHog, Inkeep keys, feedback webhook). fileciteturn38file0L4-L13 fileciteturn36file0L12-L21

## Notes on what the Langfuse changelog says about docs-related features

The Langfuse changelog includes multiple entries that explicitly describe these documentation/AI features and can be used as “feature intent” references for parity testing:

- “Copy Docs as Markdown” (Apr 17, 2025). citeturn44view0
- “Docs now available as Markdown (.md) endpoints” (Aug 7, 2025), explicitly stating `.md` powers copy + Docs MCP page tool. citeturn44view1
- “Agentic Onboarding & Docs MCP Server” (Jun 28, 2025). citeturn44view2
- “llms.txt” (Nov 17, 2024), describing generation from sitemap and pointing to `generate_llms_txt.js`. citeturn38view0

These pages are particularly useful as acceptance-test references because they represent the team’s public contract about what the docs site should do. citeturn38view0turn44view1turn44view2
