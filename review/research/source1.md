Absolutely — for a big website + docs relaunch PR, the safest way to review is to treat it like a migration even if the domain stays the same: build a baseline inventory from prod, then diff the preview build against it, and have a short list of “must not break” invariants.

Below is a long, structured checklist with both what to verify and ideas for automating it.

⸻

0. Set yourself up to review safely (baseline + diff mindset)

Capture a “golden baseline” from current production

This makes almost every check easy and objective.

Baseline crawl exports (prod):
• All URLs discovered (include blog/docs subdomains if applicable)
• HTTP status code for each URL
• Final URL after redirects
• <title>, meta description, canonical, robots meta
• H1, indexability flags, word count (rough content parity)
• Internal links (outgoing + incoming counts)
• Structured data presence (JSON-LD blocks)
• Open Graph / Twitter tags
• hreflang tags (if any)
• Sitemap URLs (from sitemap.xml)

Automation idea: run a crawler in CI against:
• prod → baseline JSON/CSV committed to repo (or stored in artifacts)
• preview (the PR build) → new JSON/CSV
• produce a diff report: “added/removed/changed” with severity buckets

Decide what “allowed to change” means

For example:
• Titles/descriptions can change for a subset (marketing pages) but not docs API reference
• URLs must not change without explicit redirect mapping
• No new noindex anywhere except staging-only domains
• Core Web Vitals must not regress beyond X%

Having explicit rules turns review from “vibes” into “gates”.

⸻

1. URLs, routing, and redirects (the #1 launch risk)

URL invariants to check
• Every important existing URL still returns 200 OR 301 to a relevant new URL
• No 404/410 regressions for pages that used to exist (unless intentionally removed)
• Trailing slash policy consistent (no duplicates like /docs and /docs/ both 200)
• Case sensitivity handled (especially for docs paths)
• Query parameters don’t break important pages (e.g. ?ref=, ?utm\_)
• Old “deep links” still work:
• docs headings with anchors (#some-section)
• versioned docs (/docs/v1/...)
• API reference anchors / tabs

Redirect correctness
• Use 301 (permanent) for URL migrations (not 302)
• No redirect chains (A → B → C); keep it one hop
• No redirect loops
• Redirects preserve:
• query strings when appropriate
• hash fragments (browser keeps fragment, but ensure destination supports it)
• Redirects don’t send users to generic pages (home) when a specific replacement exists
• Canonical points to the final destination, not the pre-redirect URL

Automation ideas
• Maintain an explicit redirect map test file:
old_url → expected_final_url → expected_status
• Crawl and compute “max redirect depth” + flag any depth > 1
• Sample production access logs (top landing pages) → replay requests in preview and validate outcomes

⸻

2. Indexability: robots, noindex, canonical, headers

This is where accidental SEO disasters happen.

Check robots + indexing controls
• robots.txt:
• still reachable (/robots.txt returns 200)
• doesn’t accidentally disallow large sections (especially /docs)
• includes sitemap references (common best practice)
• Meta robots tags:
• no accidental noindex, nofollow on production pages
• HTTP headers:
• no accidental X-Robots-Tag: noindex on HTML pages
• Canonicals:
• present where needed
• absolute vs relative consistency
• not pointing to staging domain
• not all pointing to homepage (classic templating bug)
• Pagination / faceted pages:
• if you have parameterized pages, confirm canonical strategy is consistent

Automation ideas
• For every 200 HTML page, assert:
• it is indexable unless explicitly whitelisted as non-indexable
• canonical host matches production host
• Diff the set of pages that have noindex before vs after

⸻

3. Sitemaps: coverage, freshness, and correctness

Sitemap checks
• sitemap.xml exists and is valid XML
• If you have multiple sitemaps, index file references them correctly
• Sitemap includes:
• all important canonical URLs
• correct lastmod (if you provide it)
• Sitemap does not include:
• redirect URLs
• 404s
• non-canonical duplicates
• staging URLs
• If docs/blog are on subdomains, ensure each property has the right sitemap(s)

Automation ideas
• Fetch sitemap → validate every listed URL:
• returns 200
• is canonical to itself
• is indexable
• Compare count of sitemap URLs pre vs post

⸻

4. Titles, descriptions, headings, and content parity

Metadata + content checks
• <title>:
• unchanged where stability matters (docs reference pages often should stay stable)
• not accidentally duplicated site-wide (templating regression)
• Meta descriptions:
• not empty across large sets
• not duplicated across large sets
• H1 presence:
• exactly one H1 per page (common accessibility/SEO heuristic)
• Content regressions:
• missing sections
• missing code blocks
• broken tables / diagrams / callouts
• Docs-specific:
• “Edit this page” links still point to correct repo/path
• “Last updated” / version badges still correct
• API reference pages still have the full endpoint list

Automation ideas
• Snapshot key fields for each URL: title, description, H1, canonical, word count
• Flag:
• empty titles/descriptions
• duplicates above a threshold
• word count drop by >X% (often indicates missing content rendering)

⸻

5. Internal linking: nav, breadcrumbs, and deep links

A relaunch often breaks internal links because paths change.

What to verify
• Navigation links (header, footer, sidebar) all resolve (no 404s)
• Breadcrumbs are correct and reflect canonical structure
• In-page TOC links work (anchors exist)
• Cross-linking between:
• blog → docs
• docs → examples
• docs → pricing / signup
• Canonical internal linking:
• internal links should point to the canonical URL (avoid linking to redirecting URLs)

Automation ideas
• Run a link checker that:
• verifies internal links return 200
• verifies internal links don’t hit redirects (or flags them)
• Verify “top N internal link targets” still exist (these are your structural spine)

⸻

6. Structured data (Schema.org) and rich results

If you had structured data before, losing it can reduce rich snippets.

Check for:
• Organization / Website schema (if used)
• BreadcrumbList
• Article/BlogPosting
• FAQ schema (if you have FAQ sections)
• SoftwareApplication / Product schema (if relevant)
• Correct URLs in schema fields (no staging links)

Automation ideas
• Extract JSON-LD blocks and diff:
• presence per page type
• key fields (@type, url, name, etc.)
• Validate JSON parse + basic schema shape checks

⸻

7. Social sharing metadata (OG/Twitter) and previews

This is easy to break in a redesign because templates change.

Verify
• og:title, og:description, og:url, og:image
• twitter:card, twitter:image
• og:image dimensions reasonable; image is publicly reachable (200)
• The og:url matches the canonical URL
• No staging hostnames in tags

Automation ideas
• Fetch a set of representative URLs → assert OG tags exist and images return 200
• Diff for missing tags across the site

⸻

8. Performance and Core Web Vitals regressions

A relaunch often adds heavier JS, bigger images, new fonts, and layout shift.

Check
• LCP, CLS, INP (or at least Lighthouse performance + layout shift indicators)
• Image optimization:
• correct sizing + responsive images
• modern formats if used (WebP/AVIF)
• lazy loading where appropriate
• Fonts:
• no FOIT issues
• preloading done carefully
• JS bundle:
• large increases flagged
• docs pages should not ship massive app bundles unnecessarily
• Caching:
• static assets have immutable caching + hashed filenames
• HTML caching strategy makes sense (especially for docs)
• Compression:
• Brotli/gzip enabled for text assets

Automation ideas
• Lighthouse CI on a curated set:
• homepage
• pricing
• a docs landing page
• a deep docs page with code blocks
• blog post
• Track bundle size diffs in CI (Next.js build output, webpack stats, etc.)

⸻

9. Accessibility (a11y) and usability traps

Relaunches love to introduce subtle a11y regressions.

Check
• Keyboard navigation works:
• skip-to-content link
• focus visible
• no focus traps in nav/modals
• Heading structure logical (H1 → H2 → H3)
• Color contrast acceptable
• Form fields have labels and error messages are accessible
• Code blocks are selectable/copyable and don’t break screen readers too badly

Automation ideas
• Run axe-core / pa11y on representative pages
• Track number of violations and fail CI on regression

⸻

10. Analytics, tracking, attribution, and conversion flows

Relaunches often break measurement silently.

Verify tracking still works
• Analytics script present and correct (GA, Plausible, Segment, etc.)
• Consent banner behavior (GDPR/CCPA):
• tags blocked until consent if required
• consent state persists correctly
• UTM parameters preserved through:
• navigation
• sign-up flow
• doc → product transitions
• Key events still fire:
• signup CTA click
• “contact sales”
• docs search
• copy code snippet
• install command copy

Verify conversion flows
• Sign up / login links correct
• Forms submit to correct endpoints (no staging URLs)
• Email links and confirmation flows still work
• Pricing CTAs route correctly and don’t 404
• If you have calendaring embeds, ensure they still load and aren’t blocked by CSP

Automation ideas
• Playwright end-to-end scripts for:
• signup path
• contact form submission (to a test endpoint)
• docs search usage
• Ensure network requests go to prod analytics properties on prod builds only

⸻

11. Security headers and deployment config changes

A redesign can unintentionally change your edge/server config.

Verify
• HTTPS enforced
• HSTS policy correct (be careful if you’re changing subdomains)
• CSP not overly permissive, but also not breaking functionality (docs search, embeds, images)
• No mixed content (HTTP assets on HTTPS pages)
• Cookies:
• SameSite settings for auth (if relevant)
• secure flags
• Sensitive endpoints not exposed in client bundle (API keys, tokens)

Automation ideas
• Header snapshot tests for key pages (curl → assert headers)
• Search built JS bundles for forbidden strings / keys patterns

⸻

12. Docs-specific gotchas (these bite all the time)

Anchor stability and deep links
• Heading ID generation algorithm hasn’t changed unexpectedly
• This is huge: old links to #installation must still resolve
• Sidebar slugs/IDs stable
• Versioned docs:
• “latest” points to correct version
• old versions still accessible or redirected
• Code blocks:
• language highlighting preserved
• copy button works
• shell prompts not messing up copyable text
• API reference generation:
• OpenAPI rendering stable
• endpoint paths unchanged in display
• auth instructions correct

Automation ideas
• Sample a set of common external deep links (from GitHub issues, blog posts, StackOverflow references, README links) and validate status/anchors.
• Parse HTML and verify that for every TOC link, an element with that id exists.

⸻

13. Search (on-site) and index quality

If you have on-site search (Algolia/Meilisearch/etc.), relaunches can break indexing.

Verify
• Search UI loads
• Indexing job still runs (if build-time)
• Results are not polluted with:
• duplicates (trailing slash dupes)
• staging URLs
• non-canonical URLs
• “noindex” pages
• Filters/facets (version, product area) still behave

Automation ideas
• Run a fixed set of queries and snapshot top results (URLs + titles)
• Validate that results only contain canonical host

⸻

14. Media, downloads, and “unsexy” assets

These are often forgotten but heavily linked.

Verify
• Images formerly used in blog/docs still resolve (or redirect)
• Favicons, app icons, manifest:
• correct sizes
• correct paths
• RSS feeds (blog, changelog) still exist if you had them
• PDF links still work (whitepapers, security docs, etc.)
• /.well-known/\* endpoints if you use them (security.txt, etc.)
• Any special files:
• ads.txt (if relevant)
• security.txt
• humans.txt (less important)
• verification files for Google Search Console, etc.

Automation ideas
• Crawl for non-HTML assets referenced by pages and verify 200
• Explicit tests for known “special paths”

⸻

15. Error handling and edge-case pages

Verify
• Custom 404 page returns 404 (not 200)
• 500 page behavior (at least not leaking stack traces)
• If you intentionally remove content:
• return 410 or 404 (and maybe provide replacement suggestions)
• Redirecting old docs pages shouldn’t mask real 404s by returning 200 homepage (bad for users and SEO)

Automation ideas
• Assert status codes for known missing URLs
• Ensure 404 page contains helpful navigation/search and is not indexable if appropriate

⸻

16. Multi-domain/subdomain migrations (if applicable)

If docs move between subdomain/path (e.g. example.com/docs → docs.example.com), add:

Verify
• Cross-domain canonical + hreflang correct
• Cookies/auth flows if shared between domains
• Search Console properties updated (post-launch)
• Redirects across hosts are correct (and still 301)

Automation ideas
• Old host URL list → ensure 301 to new host with correct path
• Validate canonical host consistently matches chosen host per section

⸻

17. Code review “hotspots” in the PR (things to scrutinize)

When scanning the PR itself, pay extra attention to changes in:
• Routing config (Next.js routes, rewrites, redirects, basePath)
• Trailing slash settings
• Link generation helpers
• Docs slug generation / heading ID generation
• Markdown/MDX pipeline changes (remark/rehype plugins)
• Layout templates that inject meta tags
• robots/sitemap generation code
• Build/deploy config (CDN rules, caching headers, redirects at edge)
• public/ asset paths (favicons, og images)
• Any change touching canonical/og URL computation (very easy to get wrong)

⸻

18. A practical “must-pass gates” list (if you want a tight checklist)

If you only had time for 20 checks, I’d gate launch on these: 1. Crawl top X URLs from prod → preview: no new 404s 2. All URL changes have explicit 301 redirects 3. No redirect chains > 1 hop 4. robots.txt and sitemap(s) valid + production indexable 5. No accidental noindex / X-Robots-Tag on prod pages 6. Canonicals all point to the right production host 7. Titles/descriptions not blank and not massively duplicated 8. OG/Twitter tags intact for main templates 9. Docs anchors/TOC links work on representative pages 10. Lighthouse CI doesn’t show major regressions on key pages 11. Core conversion flows pass (signup/contact/pricing CTA) 12. Analytics events still fire (at least pageview + key CTA click) 13. No mixed content 14. Correct caching headers for static assets (hashed, immutable) 15. 404 returns actual 404 16. Search works (if you have it) 17. No staging URLs appear anywhere in HTML/meta/schema 18. Structured data still present where it used to be 19. Mobile layout sanity check (nav + docs sidebar especially) 20. Accessibility smoke test (keyboard nav + axe regression)

⸻

19. Post-merge / pre-launch and post-launch monitoring (don’t skip)

Even with perfect PR checks, the real world includes crawlers and edge caches.

Immediately after deployment
• Submit sitemaps in Search Console (if needed)
• Watch:
• Crawl errors (404/soft-404)
• Indexed pages count changes
• Redirect and canonical reports
• Monitor server logs for spikes in 404s
• Track organic landing pages: top 50 landing URLs still healthy
• Set up alerting on:
• 404 count
• redirect chain count
• performance regressions
• JS error rate (Sentry, etc.)

⸻

If you want, I can turn this into a review template you can paste into the PR

For example:
• A checklist section for the agency to fill out (“redirect map attached”, “crawl diff attached”)
• A CI plan (crawler diff + Lighthouse + link checker + metadata snapshots)
• A “top 200 URLs” file driven by prod analytics/logs so you test what matters most

If you tell me (a) what framework you’re using (Next.js/Docusaurus/etc.) and (b) whether docs are on the same domain or a subdomain, I can tailor the highest-risk items and suggest concrete automated checks that fit your stack.
