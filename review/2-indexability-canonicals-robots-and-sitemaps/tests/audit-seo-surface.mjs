#!/usr/bin/env node

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "../../..");
const DEFAULT_EXPECTED_HOST = "langfuse.com";
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_MD_PATHS = [
  "/docs",
  "/find-us",
  "/changelog/2025-01-22-track-changes-between-prompt-versions",
];
const CONTENT_ROUTE_PREFIXES = {
  blog: "/blog",
  changelog: "/changelog",
  customers: "/users",
  docs: "/docs",
  faq: "/faq",
  guides: "/guides",
  handbook: "/handbook",
  integrations: "/integrations",
  library: "/library",
  marketing: "",
  security: "/security",
  "self-hosting": "/self-hosting",
};
const APPROVED_ASSET_HOSTS = new Set(["langfuse.com", "static.langfuse.com"]);

function usage() {
  console.error(`Usage:
  node review/2-indexability-canonicals-robots-and-sitemaps/tests/audit-seo-surface.mjs \\
    --target-base-url <url> \\
    [--sitemap-url <url>] \\
    [--expected-canonical-host langfuse.com] \\
    [--expect-preview-noindex] \\
    [--md-paths /docs,/find-us] \\
    [--concurrency 8] \\
    [--limit 25] \\
    [--out path/to/report.json]`);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/$/, "");
  }
  return url.toString().replace(/\/$/, "");
}

function normalizeRoutePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function normalizeComparableUrl(value) {
  const url = new URL(value);
  url.hash = "";
  url.pathname = normalizeRoutePath(url.pathname);
  return url.toString();
}

function decodeEntities(value) {
  if (!value) return value;
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function extractHead(html) {
  const match = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return match?.[1] ?? "";
}

function extractMetadata(head) {
  const metaTags = Array.from(head.matchAll(/<meta\b[^>]*>/gi), (match) => parseAttributes(match[0]));
  const linkTags = Array.from(head.matchAll(/<link\b[^>]*>/gi), (match) => parseAttributes(match[0]));
  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  const findMeta = (key, value) =>
    metaTags.find((tag) => tag[key]?.toLowerCase() === value.toLowerCase())?.content ?? null;

  const canonicalTag = linkTags.find((tag) =>
    (tag.rel ?? "")
      .toLowerCase()
      .split(/\s+/)
      .includes("canonical")
  );

  return {
    title: titleMatch ? decodeEntities(titleMatch[1].trim()) : null,
    description: findMeta("name", "description"),
    robotsMeta: findMeta("name", "robots"),
    canonical: canonicalTag?.href ?? null,
    ogUrl: findMeta("property", "og:url"),
    ogImage: findMeta("property", "og:image"),
    twitterCard: findMeta("name", "twitter:card"),
    twitterImage: findMeta("name", "twitter:image"),
  };
}

function parseLocs(xml) {
  return Array.from(xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi), (match) =>
    decodeEntities(match[1].trim())
  );
}

function includesNoindex(value) {
  return /(^|[\s,])noindex([\s,]|$)/i.test(value ?? "");
}

function resolveUrl(value, base) {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

async function fetchText(url, extraHeaders = {}) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Langfuse-SEO-Audit/1.0",
      ...extraHeaders,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  return {
    url,
    finalUrl: response.url,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    text,
  };
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (/\.(md|mdx)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function routeFromContentFile(filePath) {
  const rel = relative(REPO_ROOT, filePath).split("\\").join("/");
  const parts = rel.split("/");
  if (parts[0] !== "content" || parts.length < 3) return null;

  const collection = parts[1];
  const base = CONTENT_ROUTE_PREFIXES[collection];
  if (base === undefined) return null;

  let slug = parts.slice(2).join("/").replace(/\.(md|mdx)$/i, "");
  if (slug === "index") slug = "";
  slug = slug.replace(/\/index$/i, "");

  const route = `${base}${slug ? `/${slug}` : ""}` || "/";
  return normalizeRoutePath(route);
}

function parseFrontmatter(raw) {
  const normalized = raw.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return {};

  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes(":")) continue;
    const separator = trimmed.indexOf(":");
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    frontmatter[key] = value.replace(/^["']|["']$/g, "");
  }

  return frontmatter;
}

async function collectContentExpectations(expectedHost) {
  const contentDir = resolve(REPO_ROOT, "content");
  const files = await walk(contentDir);
  const noindexRoutes = new Set();
  const canonicalRoutes = new Map();

  for (const filePath of files) {
    const route = routeFromContentFile(filePath);
    if (!route) continue;

    const raw = await readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(raw);

    if ((frontmatter.noindex ?? "").toLowerCase() === "true") {
      noindexRoutes.add(route);
    }

    if (frontmatter.canonical) {
      const canonical = resolveUrl(
        frontmatter.canonical.startsWith("http")
          ? frontmatter.canonical
          : `https://${expectedHost}${frontmatter.canonical.startsWith("/") ? "" : "/"}${frontmatter.canonical}`,
        `https://${expectedHost}${route}`
      );
      if (canonical) canonicalRoutes.set(route, canonical);
    }
  }

  const cookbookRoutes = JSON.parse(
    await readFile(resolve(REPO_ROOT, "cookbook/_routes.json"), "utf8")
  );
  const excludedCookbookRoutes = cookbookRoutes
    .filter((route) => route.docsPath)
    .map((route) => `/guides/cookbook/${route.notebook.replace(/\.ipynb$/i, "")}`)
    .map(normalizeRoutePath);

  return {
    noindexRoutes: Array.from(noindexRoutes).sort(),
    canonicalRoutes: Array.from(canonicalRoutes.entries())
      .map(([route, canonical]) => ({ route, canonical }))
      .sort((a, b) => a.route.localeCompare(b.route)),
    excludedCookbookRoutes: excludedCookbookRoutes.sort(),
  };
}

async function collectSitemap(sitemapUrl) {
  const visited = new Set();
  const sitemapFiles = [];
  const sitemapUrls = [];
  const issues = [];

  async function visit(url) {
    if (visited.has(url)) return;
    visited.add(url);

    let response;
    try {
      response = await fetchText(url, {
        accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
      });
    } catch (error) {
      issues.push({ url, problem: "fetch-failed", message: String(error) });
      return;
    }

    sitemapFiles.push({
      url,
      finalUrl: response.finalUrl,
      status: response.status,
    });

    if (response.status !== 200) {
      issues.push({ url, problem: "status-not-200", status: response.status });
      return;
    }

    const locs = parseLocs(response.text);
    if (/<sitemapindex[\s>]/i.test(response.text)) {
      for (const loc of locs) {
        await visit(loc);
      }
      return;
    }

    if (!/<urlset[\s>]/i.test(response.text)) {
      issues.push({ url, problem: "unexpected-xml-shape" });
      return;
    }

    sitemapUrls.push(...locs);
  }

  await visit(sitemapUrl);

  return {
    sitemapFiles,
    urls: Array.from(new Set(sitemapUrls)),
    issues,
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await mapper(items[current], current);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function buildTargetUrl(sitemapLoc, targetBaseUrl) {
  const source = new URL(sitemapLoc);
  const target = new URL(targetBaseUrl);
  source.protocol = target.protocol;
  source.host = target.host;
  return source.toString();
}

function summarizeProblems(pages, mdChecks) {
  const countProblem = (code) => pages.filter((page) => page.problems.includes(code)).length;

  return {
    pageCount: pages.length,
    mdCheckCount: mdChecks.length,
    statusNot200Count: countProblem("status-not-200"),
    redirectedCount: countProblem("redirected"),
    expectedNoindexMissingCount: countProblem("expected-noindex-missing"),
    expectedCanonicalMismatchCount: countProblem("expected-canonical-mismatch"),
    previewNoindexHeaderMissingCount: countProblem("preview-noindex-header-missing"),
    descriptionMissingCount: countProblem("description-missing"),
    ogUrlMissingCount: countProblem("og-url-missing"),
    sitemapExpectedNoindexCount: countProblem("sitemap-includes-expected-noindex"),
    sitemapCanonicalDuplicateCount: countProblem("sitemap-includes-expected-canonical-duplicate"),
    sitemapCookbookDuplicateCount: countProblem("sitemap-includes-cookbook-duplicate"),
    badMdEndpointCount: mdChecks.filter((check) => !check.ok).length,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      "target-base-url": { type: "string" },
      "sitemap-url": { type: "string" },
      "expected-canonical-host": { type: "string" },
      "expect-preview-noindex": { type: "boolean" },
      "md-paths": { type: "string" },
      concurrency: { type: "string" },
      limit: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean" },
    },
  });

  if (values.help || !values["target-base-url"]) {
    usage();
    process.exit(values.help ? 0 : 1);
  }

  const targetBaseUrl = normalizeBaseUrl(values["target-base-url"]);
  const expectedCanonicalHost = values["expected-canonical-host"] ?? DEFAULT_EXPECTED_HOST;
  const sitemapUrl = values["sitemap-url"] ?? `${targetBaseUrl}/sitemap.xml`;
  const expectPreviewNoindex = Boolean(values["expect-preview-noindex"]);
  const concurrency = Number(values.concurrency ?? DEFAULT_CONCURRENCY);
  const limit = values.limit ? Number(values.limit) : null;
  const mdPaths = (values["md-paths"] ?? DEFAULT_MD_PATHS.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => normalizeRoutePath(value));

  const contentExpectations = await collectContentExpectations(expectedCanonicalHost);
  const expectedNoindexRoutes = new Set(contentExpectations.noindexRoutes);
  const expectedCanonicalRoutes = new Map(
    contentExpectations.canonicalRoutes.map((entry) => [entry.route, entry.canonical])
  );
  const excludedCookbookRoutes = new Set(contentExpectations.excludedCookbookRoutes);

  console.log(`Collecting sitemap from ${sitemapUrl}`);
  const sitemap = await collectSitemap(sitemapUrl);
  const sitemapUrls = limit ? sitemap.urls.slice(0, limit) : sitemap.urls;
  console.log(`Found ${sitemap.urls.length} sitemap URLs; auditing ${sitemapUrls.length}`);

  let completed = 0;
  const pages = await mapWithConcurrency(sitemapUrls, concurrency, async (sitemapLoc) => {
    const targetUrl = buildTargetUrl(sitemapLoc, targetBaseUrl);
    const route = normalizeRoutePath(new URL(sitemapLoc).pathname);
    const expectedNoindex = expectedNoindexRoutes.has(route);
    const expectedCanonical = expectedCanonicalRoutes.get(route) ?? null;
    const problems = [];

    if (expectedNoindex) {
      problems.push("sitemap-includes-expected-noindex");
    }

    if (expectedCanonical) {
      problems.push("sitemap-includes-expected-canonical-duplicate");
    }

    if (excludedCookbookRoutes.has(route)) {
      problems.push("sitemap-includes-cookbook-duplicate");
    }

    try {
      const response = await fetchText(targetUrl, {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      });
      const contentType = response.headers["content-type"] ?? "";
      const isHtml = contentType.includes("text/html");
      const xRobotsTag = response.headers["x-robots-tag"] ?? null;
      const hasPreviewNoindexHeader = includesNoindex(xRobotsTag);
      const metadata = isHtml ? extractMetadata(extractHead(response.text)) : {};
      const canonical = resolveUrl(metadata.canonical, sitemapLoc);
      const ogUrl = resolveUrl(metadata.ogUrl, sitemapLoc);
      const ogImage = resolveUrl(metadata.ogImage, sitemapLoc);
      const twitterImage = resolveUrl(metadata.twitterImage, sitemapLoc);
      const metaNoindex = includesNoindex(metadata.robotsMeta);
      const hasExpectedNoindex = expectedNoindex
        ? metaNoindex || (!expectPreviewNoindex && hasPreviewNoindexHeader)
        : null;
      const canonicalMatchesExpected = expectedCanonical
        ? canonical !== null &&
          normalizeComparableUrl(canonical) === normalizeComparableUrl(expectedCanonical)
        : null;
      const pageLevelIndexable =
        response.status === 200 &&
        isHtml &&
        !metaNoindex &&
        !(hasPreviewNoindexHeader && !expectPreviewNoindex);

      if (response.status !== 200) problems.push("status-not-200");

      if (normalizeComparableUrl(response.finalUrl) !== normalizeComparableUrl(targetUrl)) {
        problems.push("redirected");
      }

      if (!isHtml) problems.push("not-html");

      if (expectPreviewNoindex && isHtml && !hasPreviewNoindexHeader) {
        problems.push("preview-noindex-header-missing");
      }

      if (expectedNoindex && !hasExpectedNoindex) {
        problems.push("expected-noindex-missing");
      }

      if (expectedCanonical && !canonicalMatchesExpected) {
        problems.push("expected-canonical-mismatch");
      }

      if (isHtml && !metadata.description) {
        problems.push("description-missing");
      }

      if (isHtml && !ogUrl) {
        problems.push("og-url-missing");
      }

      if (canonical && new URL(canonical).host !== expectedCanonicalHost) {
        problems.push("canonical-host-mismatch");
      }

      if (ogUrl && new URL(ogUrl).host !== expectedCanonicalHost) {
        problems.push("og-url-host-mismatch");
      }

      for (const [field, value] of [
        ["og-image", ogImage],
        ["twitter-image", twitterImage],
      ]) {
        if (value && !APPROVED_ASSET_HOSTS.has(new URL(value).host)) {
          problems.push(`${field}-host-mismatch`);
        }
      }

      completed += 1;
      if (completed % 50 === 0 || completed === sitemapUrls.length) {
        console.log(`Audited ${completed}/${sitemapUrls.length} sitemap URLs`);
      }

      return {
        sitemapLoc,
        targetUrl,
        route,
        status: response.status,
        finalUrl: response.finalUrl,
        contentType,
        isHtml,
        expectedNoindex,
        expectedCanonical,
        title: metadata.title ?? null,
        description: metadata.description ?? null,
        canonical,
        robotsMeta: metadata.robotsMeta ?? null,
        xRobotsTag,
        hasPreviewNoindexHeader,
        hasExpectedNoindex,
        canonicalMatchesExpected,
        pageLevelIndexable,
        ogUrl,
        ogImage,
        twitterCard: metadata.twitterCard ?? null,
        twitterImage,
        problems,
      };
    } catch (error) {
      completed += 1;
      return {
        sitemapLoc,
        targetUrl,
        route,
        status: 0,
        finalUrl: null,
        contentType: null,
        isHtml: false,
        expectedNoindex,
        expectedCanonical,
        title: null,
        description: null,
        canonical: null,
        robotsMeta: null,
        xRobotsTag: null,
        hasPreviewNoindexHeader: false,
        hasExpectedNoindex: expectedNoindex ? false : null,
        canonicalMatchesExpected: expectedCanonical ? false : null,
        pageLevelIndexable: false,
        ogUrl: null,
        ogImage: null,
        twitterCard: null,
        twitterImage: null,
        problems: [...problems, "fetch-failed"],
        error: String(error),
      };
    }
  });

  const robotsUrl = `${targetBaseUrl}/robots.txt`;
  const robots = await fetchText(robotsUrl, { accept: "text/plain,*/*;q=0.8" });
  const robotsSitemaps = robots.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^sitemap:/i.test(line))
    .map((line) => line.replace(/^sitemap:\s*/i, "").trim());

  const mdChecks = await Promise.all(
    mdPaths.map(async (route) => {
      const mdPath = route === "/" ? "/index.md" : route.endsWith(".md") ? route : `${route}.md`;
      const url = `${targetBaseUrl}${mdPath}`;

      try {
        const response = await fetchText(url, {
          accept: "text/markdown,*/*;q=0.8",
        });
        const contentType = response.headers["content-type"] ?? "";
        const xRobotsTag = response.headers["x-robots-tag"] ?? null;
        const problems = [];

        if (response.status !== 200) problems.push("status-not-200");
        if (!contentType.includes("text/markdown")) problems.push("wrong-content-type");
        if (!includesNoindex(xRobotsTag)) problems.push("missing-noindex-header");

        return {
          path: route,
          url,
          status: response.status,
          contentType,
          xRobotsTag,
          ok: problems.length === 0,
          problems,
        };
      } catch (error) {
        return {
          path: route,
          url,
          status: 0,
          contentType: null,
          xRobotsTag: null,
          ok: false,
          problems: ["fetch-failed"],
          error: String(error),
        };
      }
    })
  );

  const summary = summarizeProblems(pages, mdChecks);
  const report = {
    generatedAt: new Date().toISOString(),
    targetBaseUrl,
    sitemapUrl,
    expectedCanonicalHost,
    expectPreviewNoindex,
    summary,
    robots: {
      url: robotsUrl,
      status: robots.status,
      sitemaps: robotsSitemaps,
      content: robots.text,
      issues: [
        ...(robots.status === 200 ? [] : [`robots.txt returned ${robots.status}`]),
        ...(robotsSitemaps.length > 0 ? [] : ["robots.txt is missing a Sitemap declaration"]),
      ],
    },
    sitemap: {
      url: sitemapUrl,
      fileCount: sitemap.sitemapFiles.length,
      urlCount: sitemap.urls.length,
      files: sitemap.sitemapFiles,
      issues: sitemap.issues,
    },
    contentExpectations,
    pages,
    mdChecks,
  };

  if (values.out) {
    const outPath = resolve(process.cwd(), values.out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(report, null, 2));
    console.log(`Wrote report to ${outPath}`);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
