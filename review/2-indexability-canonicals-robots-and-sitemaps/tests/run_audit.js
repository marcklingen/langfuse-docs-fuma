"use strict";

const fs = require("fs/promises");
const path = require("path");
const { parseStringPromise } = require("xml2js");

const PROD_ORIGIN = "https://langfuse.com";
const PREVIEW_ORIGIN =
  "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app";
const USER_AGENT = "langfuse-migration-review/2.0";
const HTML_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const HEAD_LIMIT_BYTES = 256 * 1024;
const H1_LIMIT_BYTES = 1024 * 1024;
const PAGE_CONCURRENCY = 8;
const ASSET_CONCURRENCY = 4;

const CHAPTER_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(CHAPTER_DIR, "..", "..");
const EVIDENCE_DIR = path.join(CHAPTER_DIR, "evidence");

const SAMPLE_PATHS = [
  "/",
  "/docs",
  "/docs/prompt-management/get-started",
  "/docs/observability/data-model",
  "/docs/docs-mcp",
  "/faq",
  "/faq/all",
  "/integrations/frameworks/langserve",
  "/integrations/model-providers/openai-js",
  "/guides/cookbook/integration_langserve",
  "/guides/cookbook/datasets",
  "/self-hosting",
  "/blog/2026-02-13-will-you-be-my-cli",
  "/changelog/2025-05-21-custom-dashboards",
  "/find-us",
];

const MARKDOWN_SAMPLE_PATHS = [
  "/docs/prompt-management/get-started.md",
  "/docs/observability/data-model.md",
  "/integrations/model-providers/openai-js.md",
];

const PREVIEW_HOST_PATTERN =
  /langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse\.vercel\.app|vercel\.app/i;

function decodeHtmlEntities(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function stripTags(value = "") {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function parseAttributes(tag) {
  const attrs = {};
  const attrRegex =
    /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = attrRegex.exec(tag)) !== null) {
    const key = match[1].toLowerCase();
    const rawValue = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[key] = decodeHtmlEntities(rawValue);
  }
  return attrs;
}

function extractHeadFields(head) {
  const metaTags = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) =>
    parseAttributes(m[0])
  );
  const linkTags = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) =>
    parseAttributes(m[0])
  );

  const findMetaContent = (matcher) => {
    const tag = metaTags.find(matcher);
    return tag?.content ? decodeHtmlEntities(tag.content) : null;
  };

  const titleMatch = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const canonicalTag = linkTags.find((tag) =>
    (tag.rel || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .includes("canonical")
  );

  return {
    title: titleMatch ? stripTags(titleMatch[1]) : null,
    description: findMetaContent((tag) => (tag.name || "").toLowerCase() === "description"),
    robotsMeta: findMetaContent((tag) => (tag.name || "").toLowerCase() === "robots"),
    canonical: canonicalTag?.href || null,
    ogUrl: findMetaContent((tag) => (tag.property || "").toLowerCase() === "og:url"),
    ogImage: findMetaContent((tag) => (tag.property || "").toLowerCase() === "og:image"),
    twitterImage: findMetaContent((tag) =>
      ["twitter:image", "twitter:image:src"].includes(
        (tag.name || "").toLowerCase()
      )
    ),
  };
}

function headersToObject(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

function normalizeComparableUrl(input) {
  if (!input) return null;
  const url = new URL(input, PROD_ORIGIN);
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  return `${url.origin}${pathname}${url.search}${url.hash}`;
}

function normalizePath(input) {
  const url = new URL(input, PROD_ORIGIN);
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  return `${pathname}${url.search}`;
}

function toAbsoluteProductionUrl(input) {
  if (!input) return null;
  return normalizeComparableUrl(
    input.startsWith("http://") || input.startsWith("https://")
      ? input
      : `${PROD_ORIGIN}${input}`
  );
}

async function readBodyPrefix(response, { needH1 = false } = {}) {
  if (!response.body) {
    return "";
  }

  const limit = needH1 ? H1_LIMIT_BYTES : HEAD_LIMIT_BYTES;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let text = "";
  let bytesRead = 0;

  while (bytesRead < limit) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    text += decoder.decode(value, { stream: true });

    const lower = text.toLowerCase();
    if (lower.includes("</head>") && (!needH1 || lower.includes("<h1"))) {
      break;
    }
  }

  text += decoder.decode();

  try {
    await reader.cancel();
  } catch {
    // Ignore cancellation failures after enough content was read.
  }

  return text;
}

async function fetchTextResponse(url, init = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      ...(init.headers || {}),
    },
    ...init,
  });

  return {
    requestUrl: url,
    finalUrl: response.url,
    status: response.status,
    headers: headersToObject(response.headers),
    body: await response.text(),
  };
}

async function fetchPageProbe(url, { needH1 = false } = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      accept: HTML_ACCEPT,
    },
  });

  const headers = headersToObject(response.headers);
  const bodyPrefix = await readBodyPrefix(response, { needH1 });
  const head = (bodyPrefix.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i) || [])[1] || bodyPrefix;
  const fields = extractHeadFields(head);
  const h1Match = needH1
    ? bodyPrefix.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
    : null;

  return {
    requestUrl: url,
    finalUrl: response.url,
    status: response.status,
    contentType: headers["content-type"] || null,
    xRobotsTag: headers["x-robots-tag"] || null,
    title: fields.title,
    description: fields.description,
    canonical: fields.canonical ? normalizeComparableUrl(fields.canonical) : null,
    robotsMeta: fields.robotsMeta,
    ogUrl: fields.ogUrl ? normalizeComparableUrl(fields.ogUrl) : null,
    ogImage: fields.ogImage || null,
    twitterImage: fields.twitterImage || null,
    h1: h1Match ? stripTags(h1Match[1]) : null,
    headContainsPreviewHost: PREVIEW_HOST_PATTERN.test(head),
  };
}

async function mapLimit(items, limit, iteratee) {
  const output = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        output[index] = await iteratee(items[index], index);
      } catch (error) {
        output[index] = {
          error: error instanceof Error ? error.message : String(error),
          failed: true,
          item: items[index],
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return output;
}

async function parseXml(xml) {
  return parseStringPromise(xml, { trim: true });
}

async function loadSitemap(origin) {
  const indexResponse = await fetchTextResponse(`${origin}/sitemap.xml`);
  const indexParsed = await parseXml(indexResponse.body);
  const childLocs = (indexParsed.sitemapindex?.sitemap || []).map(
    (entry) => entry.loc[0]
  );

  const children = [];
  const canonicalUrls = [];

  for (const childLoc of childLocs) {
    const childPath = normalizePath(childLoc);
    const childResponse = await fetchTextResponse(`${origin}${childPath}`);
    const childParsed = await parseXml(childResponse.body);
    const urls = (childParsed.urlset?.url || []).map((entry) =>
      normalizeComparableUrl(entry.loc[0])
    );
    canonicalUrls.push(...urls);
    children.push({
      indexLoc: normalizeComparableUrl(childLoc),
      servedPath: childPath,
      servedStatus: childResponse.status,
      servedFinalUrl: childResponse.finalUrl,
      xRobotsTag: childResponse.headers["x-robots-tag"] || null,
      count: urls.length,
    });
  }

  return {
    index: {
      requestUrl: indexResponse.requestUrl,
      finalUrl: indexResponse.finalUrl,
      status: indexResponse.status,
      xRobotsTag: indexResponse.headers["x-robots-tag"] || null,
      childLocs: childLocs.map((loc) => normalizeComparableUrl(loc)),
    },
    children,
    canonicalUrls,
  };
}

function contentPathToRoute(filePath) {
  const contentDir = path.join(ROOT_DIR, "content");
  const relative = path.relative(contentDir, filePath).replace(/\\/g, "/");
  const noExt = relative.replace(/\.(mdx|md)$/, "");
  const parts = noExt.split("/");

  const sectionMap = {
    docs: "docs",
    guides: "guides",
    integrations: "integrations",
    "self-hosting": "self-hosting",
    library: "library",
    changelog: "changelog",
    faq: "faq",
    handbook: "handbook",
    security: "security",
    blog: "blog",
    customers: "users",
    marketing: "",
  };

  const [section, ...rest] = parts;
  const urlSection = sectionMap[section];
  if (urlSection === undefined) return null;

  const slug = rest.join("/").replace(/(\/index|^index)$/, "");
  if (urlSection === "") {
    return slug ? `/${slug}` : "/";
  }
  return slug ? `/${urlSection}/${slug}` : `/${urlSection}`;
}

async function walkDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath)));
    } else if (/\.(mdx|md)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function readFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const frontmatterMatch = line.match(/^([\w-]+):\s*(.*)$/);
    if (!frontmatterMatch) continue;
    const [, key, value] = frontmatterMatch;
    out[key] = value.trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function loadLocalExpectations() {
  const contentDir = path.join(ROOT_DIR, "content");
  const files = await walkDir(contentDir);
  const routes = [];

  for (const filePath of files) {
    const route = contentPathToRoute(filePath);
    if (!route) continue;

    const source = await fs.readFile(filePath, "utf8");
    const frontmatter = readFrontmatter(source);
    routes.push({
      filePath: path.relative(ROOT_DIR, filePath),
      route,
      canonical: frontmatter.canonical
        ? toAbsoluteProductionUrl(frontmatter.canonical)
        : null,
      noindex: frontmatter.noindex === "true",
    });
  }

  const contentRouteSet = new Set(routes.map((route) => route.route));

  const cookbookRoutes = require(path.join(ROOT_DIR, "cookbook", "_routes.json"));
  const cookbookDuplicateRoutes = cookbookRoutes
    .filter((entry) => entry.docsPath)
    .map((entry) => ({
      guidePath: `/guides/cookbook/${entry.notebook.replace(".ipynb", "")}`,
      canonicalTarget: toAbsoluteProductionUrl(`/${entry.docsPath}`),
      docsPath: `/${entry.docsPath}`,
      notebook: entry.notebook,
    }))
    .filter((entry) => contentRouteSet.has(entry.guidePath));

  const canonicalOverrideRoutes = routes
    .filter(
      (route) =>
        route.canonical &&
        normalizeComparableUrl(route.canonical) !== toAbsoluteProductionUrl(route.route)
    )
    .map((route) => ({
      path: route.route,
      expectedCanonical: normalizeComparableUrl(route.canonical),
      filePath: route.filePath,
    }));

  const noindexRoutes = routes
    .filter((route) => route.noindex)
    .map((route) => ({
      path: route.route,
      filePath: route.filePath,
    }));

  return {
    routes,
    contentRouteSet,
    canonicalOverrideRoutes,
    noindexRoutes,
    cookbookDuplicateRoutes,
  };
}

function summarizeDuplicates(rows, valueKey, pathKey, limit = 15) {
  const groups = new Map();

  for (const row of rows) {
    const value = row[valueKey];
    if (!value) continue;
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value).push(row[pathKey]);
  }

  return [...groups.entries()]
    .filter(([, paths]) => paths.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, paths]) => ({
      value,
      count: paths.length,
      samplePaths: paths.slice(0, 10),
    }));
}

function summarizePageCrawl(pageRows, { expectPreviewNoindex = false } = {}) {
  const failures = {
    requestErrors: [],
    non200: [],
    redirected: [],
    missingCanonical: [],
    canonicalMismatch: [],
    unexpectedNoindexMeta: [],
    missingPreviewNoindexHeader: [],
    unexpectedPreviewHostLeak: [],
    missingTitle: [],
    missingDescription: [],
    ogUrlMismatch: [],
    missingOgImage: [],
    missingTwitterImage: [],
  };

  for (const row of pageRows) {
    if (row.failed) {
      failures.requestErrors.push(row);
      continue;
    }

    if (row.status !== 200) failures.non200.push(row);

    const normalizedRequest = normalizeComparableUrl(row.requestUrl);
    const normalizedFinal = normalizeComparableUrl(row.finalUrl);
    if (normalizedFinal !== normalizedRequest) failures.redirected.push(row);
    if (!row.canonical) failures.missingCanonical.push(row);
    if (row.canonical && row.canonical !== row.expectedCanonical) {
      failures.canonicalMismatch.push(row);
    }
    if (row.robotsMeta && /noindex/i.test(row.robotsMeta)) {
      failures.unexpectedNoindexMeta.push(row);
    }
    if (expectPreviewNoindex && !/noindex/i.test(row.xRobotsTag || "")) {
      failures.missingPreviewNoindexHeader.push(row);
    }
    if (row.headContainsPreviewHost) failures.unexpectedPreviewHostLeak.push(row);
    if (!row.title) failures.missingTitle.push(row);
    if (!row.description) failures.missingDescription.push(row);
    if (row.ogUrl !== row.canonical) failures.ogUrlMismatch.push(row);
    if (!row.ogImage) failures.missingOgImage.push(row);
    if (!row.twitterImage) failures.missingTwitterImage.push(row);
  }

  return {
    totals: {
      pages: pageRows.length,
      requestErrors: failures.requestErrors.length,
      non200: failures.non200.length,
      redirected: failures.redirected.length,
      missingCanonical: failures.missingCanonical.length,
      canonicalMismatch: failures.canonicalMismatch.length,
      unexpectedNoindexMeta: failures.unexpectedNoindexMeta.length,
      missingPreviewNoindexHeader: failures.missingPreviewNoindexHeader.length,
      unexpectedPreviewHostLeak: failures.unexpectedPreviewHostLeak.length,
      missingTitle: failures.missingTitle.length,
      missingDescription: failures.missingDescription.length,
      ogUrlMismatch: failures.ogUrlMismatch.length,
      missingOgImage: failures.missingOgImage.length,
      missingTwitterImage: failures.missingTwitterImage.length,
    },
    failures: Object.fromEntries(
      Object.entries(failures).map(([key, rows]) => [key, rows.slice(0, 25)])
    ),
    topDuplicateTitles: summarizeDuplicates(pageRows, "title", "path"),
    topDuplicateDescriptions: summarizeDuplicates(pageRows, "description", "path"),
  };
}

async function auditSitemapPages(origin, canonicalUrls, samplePathSet) {
  const tasks = canonicalUrls.map((canonicalUrl) => {
    const path = normalizePath(canonicalUrl);
    return {
      path,
      expectedCanonical: canonicalUrl,
      requestUrl: `${origin}${path}`,
      needH1: samplePathSet.has(path),
    };
  });

  const results = await mapLimit(tasks, PAGE_CONCURRENCY, async (task) => ({
    ...task,
    ...(await fetchPageProbe(task.requestUrl, { needH1: task.needH1 })),
  }));

  return results;
}

async function auditCanonicalOverrideRoutes(origin, routes, sitemapPathSet) {
  const results = await mapLimit(routes, PAGE_CONCURRENCY, async (route) => {
    const probe = await fetchPageProbe(`${origin}${route.path}`);
    return {
      ...route,
      ...probe,
      inPreviewSitemap: sitemapPathSet.has(route.path),
      canonicalMatchesExpected:
        normalizeComparableUrl(probe.canonical) ===
        normalizeComparableUrl(route.expectedCanonical),
    };
  });

  return {
    totals: {
      routes: results.length,
      failedRequests: results.filter((r) => r.failed).length,
      non200: results.filter((r) => !r.failed && r.status !== 200).length,
      wrongCanonical: results.filter(
        (r) => !r.failed && !r.canonicalMatchesExpected
      ).length,
      unexpectedlyInSitemap: results.filter((r) => !r.failed && r.inPreviewSitemap)
        .length,
    },
    failures: {
      wrongCanonical: results
        .filter((r) => !r.failed && !r.canonicalMatchesExpected)
        .slice(0, 25),
      unexpectedlyInSitemap: results
        .filter((r) => !r.failed && r.inPreviewSitemap)
        .slice(0, 25),
    },
    routes: results,
  };
}

async function auditNoindexRoutes(noindexRoutes, previewSitemapPathSet) {
  const tasks = noindexRoutes.flatMap((route) => [
    { env: "production", origin: PROD_ORIGIN, ...route },
    { env: "preview", origin: PREVIEW_ORIGIN, ...route },
  ]);

  const results = await mapLimit(tasks, PAGE_CONCURRENCY, async (task) => {
    const probe = await fetchPageProbe(`${task.origin}${task.path}`);
    return {
      ...task,
      ...probe,
      inPreviewSitemap: previewSitemapPathSet.has(task.path),
      robotsMetaHasNoindex: /noindex/i.test(probe.robotsMeta || ""),
      xRobotsHasNoindex: /noindex/i.test(probe.xRobotsTag || ""),
    };
  });

  return {
    totals: {
      checks: results.length,
      non200: results.filter((r) => !r.failed && r.status !== 200).length,
      missingRobotsNoindex: results.filter(
        (r) => !r.failed && !r.robotsMetaHasNoindex
      ).length,
      missingPreviewHeaderNoindex: results.filter(
        (r) =>
          !r.failed && r.env === "preview" && !r.xRobotsHasNoindex
      ).length,
      unexpectedlyInPreviewSitemap: results.filter(
        (r) => !r.failed && r.env === "preview" && r.inPreviewSitemap
      ).length,
    },
    failures: {
      missingRobotsNoindex: results
        .filter((r) => !r.failed && !r.robotsMetaHasNoindex)
        .slice(0, 25),
      missingPreviewHeaderNoindex: results
        .filter((r) => !r.failed && r.env === "preview" && !r.xRobotsHasNoindex)
        .slice(0, 25),
      unexpectedlyInPreviewSitemap: results
        .filter((r) => !r.failed && r.env === "preview" && r.inPreviewSitemap)
        .slice(0, 25),
    },
    routes: results,
  };
}

async function auditCookbookDuplicateRoutes(routes, previewSitemapPathSet) {
  const tasks = routes.flatMap((route) => [
    { env: "production", origin: PROD_ORIGIN, ...route },
    { env: "preview", origin: PREVIEW_ORIGIN, ...route },
  ]);

  const results = await mapLimit(tasks, PAGE_CONCURRENCY, async (task) => {
    const probe = await fetchPageProbe(`${task.origin}${task.guidePath}`);
    return {
      ...task,
      ...probe,
      inPreviewSitemap: previewSitemapPathSet.has(task.guidePath),
      canonicalMatchesExpected:
        normalizeComparableUrl(probe.canonical) ===
        normalizeComparableUrl(task.canonicalTarget),
    };
  });

  return {
    totals: {
      checks: results.length,
      non200: results.filter((r) => !r.failed && r.status !== 200).length,
      wrongCanonical: results.filter(
        (r) => !r.failed && !r.canonicalMatchesExpected
      ).length,
      previewWrongCanonical: results.filter(
        (r) =>
          !r.failed && r.env === "preview" && !r.canonicalMatchesExpected
      ).length,
      productionWrongCanonical: results.filter(
        (r) =>
          !r.failed && r.env === "production" && !r.canonicalMatchesExpected
      ).length,
      unexpectedlyInPreviewSitemap: results.filter(
        (r) => !r.failed && r.env === "preview" && r.inPreviewSitemap
      ).length,
    },
    failures: {
      previewWrongCanonical: results
        .filter((r) => !r.failed && r.env === "preview" && !r.canonicalMatchesExpected)
        .slice(0, 25),
      productionWrongCanonical: results
        .filter(
          (r) => !r.failed && r.env === "production" && !r.canonicalMatchesExpected
        )
        .slice(0, 25),
      unexpectedlyInPreviewSitemap: results
        .filter((r) => !r.failed && r.env === "preview" && r.inPreviewSitemap)
        .slice(0, 25),
    },
    routes: results,
  };
}

async function auditUnexplainedSitemapGaps(missingRows) {
  const unexplained = missingRows.filter((row) => !row.locallyExcluded);
  const tasks = unexplained.flatMap((row) => [
    { env: "production", origin: PROD_ORIGIN, ...row },
    { env: "preview", origin: PREVIEW_ORIGIN, ...row },
  ]);

  const results = await mapLimit(tasks, PAGE_CONCURRENCY, async (task) => ({
    ...task,
    ...(await fetchPageProbe(`${task.origin}${task.path}`)),
  }));

  return {
    totals: {
      paths: unexplained.length,
      checks: results.length,
      non200: results.filter((row) => !row.failed && row.status !== 200).length,
      previewStillLive: results.filter(
        (row) => !row.failed && row.env === "preview" && row.status === 200
      ).length,
      previewMissingCanonical: results.filter(
        (row) => !row.failed && row.env === "preview" && !row.canonical
      ).length,
    },
    rows: results,
  };
}

async function auditMarkdownEndpoints() {
  const tasks = MARKDOWN_SAMPLE_PATHS.flatMap((pathName) => [
    { env: "production", origin: PROD_ORIGIN, path: pathName },
    { env: "preview", origin: PREVIEW_ORIGIN, path: pathName },
  ]);

  const results = await mapLimit(tasks, PAGE_CONCURRENCY, async (task) => {
    const response = await fetchTextResponse(`${task.origin}${task.path}`, {
      headers: {
        accept: "text/markdown",
      },
    });
    return {
      ...task,
      status: response.status,
      finalUrl: response.finalUrl,
      contentType: response.headers["content-type"] || null,
      xRobotsTag: response.headers["x-robots-tag"] || null,
      bodyStartsWith: response.body.slice(0, 120),
      finalUrlNormalized: normalizeComparableUrl(response.finalUrl),
    };
  });

  return {
    totals: {
      checks: results.length,
      non200: results.filter((r) => r.status !== 200).length,
      wrongContentType: results.filter(
        (r) => !/^text\/markdown\b/i.test(r.contentType || "")
      ).length,
      missingNoindexHeader: results.filter(
        (r) => !/noindex/i.test(r.xRobotsTag || "")
      ).length,
    },
    failures: {
      wrongContentType: results
        .filter((r) => !/^text\/markdown\b/i.test(r.contentType || ""))
        .slice(0, 25),
      missingNoindexHeader: results
        .filter((r) => !/noindex/i.test(r.xRobotsTag || ""))
        .slice(0, 25),
    },
    endpoints: results,
  };
}

async function auditSamplePages() {
  const tasks = SAMPLE_PATHS.flatMap((pathName) => [
    { env: "production", origin: PROD_ORIGIN, path: pathName },
    { env: "preview", origin: PREVIEW_ORIGIN, path: pathName },
  ]);

  const pages = await mapLimit(tasks, PAGE_CONCURRENCY, async (task) => ({
    ...task,
    ...(await fetchPageProbe(`${task.origin}${task.path}`, { needH1: true })),
  }));

  const assetUrls = [
    ...new Set(
      pages
        .flatMap((page) => [page.ogImage, page.twitterImage])
        .filter(Boolean)
    ),
  ];

  const assets = await mapLimit(assetUrls, ASSET_CONCURRENCY, async (assetUrl) => {
    let response;
    try {
      response = await fetch(assetUrl, {
        method: "HEAD",
        redirect: "follow",
        headers: { "user-agent": USER_AGENT },
      });
      if (response.status === 405) {
        response = await fetch(assetUrl, {
          method: "GET",
          redirect: "follow",
          headers: { "user-agent": USER_AGENT },
        });
      }
    } catch (error) {
      return {
        url: assetUrl,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return {
      url: assetUrl,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
    };
  });

  return { pages, assets };
}

function classifySitemapDiff(prodCanonicalUrls, previewCanonicalUrls, localExpectations) {
  const prodSet = new Set(prodCanonicalUrls);
  const previewSet = new Set(previewCanonicalUrls);
  const locallyExcludedPaths = new Set([
    ...localExpectations.canonicalOverrideRoutes.map((route) => route.path),
    ...localExpectations.noindexRoutes.map((route) => route.path),
    ...localExpectations.cookbookDuplicateRoutes.map((route) => route.guidePath),
  ]);

  const missingFromPreview = [...prodSet]
    .filter((url) => !previewSet.has(url))
    .sort();
  const addedInPreview = [...previewSet]
    .filter((url) => !prodSet.has(url))
    .sort();

  const missingClassification = missingFromPreview.map((url) => {
    const pathName = normalizePath(url);
    return {
      url,
      path: pathName,
      locallyExcluded: locallyExcludedPaths.has(pathName),
    };
  });

  return {
    counts: {
      productionUrls: prodCanonicalUrls.length,
      previewUrls: previewCanonicalUrls.length,
      missingFromPreview: missingFromPreview.length,
      addedInPreview: addedInPreview.length,
      missingFromPreviewButLocallyExcluded: missingClassification.filter(
        (entry) => entry.locallyExcluded
      ).length,
      missingFromPreviewWithoutLocalExclusion: missingClassification.filter(
        (entry) => !entry.locallyExcluded
      ).length,
    },
    missingFromPreview: missingClassification,
    addedInPreview,
  };
}

function buildMarkdownSummary(results) {
  const lines = [];

  lines.push("# Chapter 2 Audit Summary");
  lines.push("");
  lines.push(`Generated on ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Production vs Preview Sitemap");
  lines.push(
    `- Production sitemap URLs: ${results.sitemapDiff.counts.productionUrls}`
  );
  lines.push(`- Preview sitemap URLs: ${results.sitemapDiff.counts.previewUrls}`);
  lines.push(
    `- URLs missing from preview sitemap: ${results.sitemapDiff.counts.missingFromPreview}`
  );
  lines.push(
    `- Missing URLs already locally excluded by canonical/noindex logic: ${results.sitemapDiff.counts.missingFromPreviewButLocallyExcluded}`
  );
  lines.push(
    `- Missing URLs without a matching local exclusion: ${results.sitemapDiff.counts.missingFromPreviewWithoutLocalExclusion}`
  );
  lines.push(
    `- URLs added in preview sitemap: ${results.sitemapDiff.counts.addedInPreview}`
  );
  lines.push(
    `- Unexplained sitemap gaps still returning 200 on preview: ${results.unexplainedSitemapGapAudit.totals.previewStillLive}`
  );
  lines.push("");
  lines.push("## Preview Sitemap Crawl");
  lines.push(
    `- Non-200 pages: ${results.previewPageSummary.totals.non200}`
  );
  lines.push(
    `- Redirected sitemap URLs: ${results.previewPageSummary.totals.redirected}`
  );
  lines.push(
    `- Canonical mismatches: ${results.previewPageSummary.totals.canonicalMismatch}`
  );
  lines.push(
    `- Missing preview noindex headers: ${results.previewPageSummary.totals.missingPreviewNoindexHeader}`
  );
  lines.push(
    `- Empty titles: ${results.previewPageSummary.totals.missingTitle}`
  );
  lines.push(
    `- Empty descriptions: ${results.previewPageSummary.totals.missingDescription}`
  );
  lines.push("");
  lines.push("## Special Cases");
  lines.push(
    `- Canonical override routes with wrong canonical: ${results.previewCanonicalOverrideAudit.totals.wrongCanonical}`
  );
  lines.push(
    `- Noindex routes missing robots noindex: ${results.noindexAudit.totals.missingRobotsNoindex}`
  );
  lines.push(
    `- Cookbook duplicate routes with wrong preview canonical: ${results.cookbookAudit.totals.previewWrongCanonical}`
  );
  lines.push(
    `- Markdown endpoint checks failing content-type or noindex: ${
      results.markdownAudit.totals.wrongContentType +
      results.markdownAudit.totals.missingNoindexHeader
    }`
  );
  lines.push("");
  lines.push("## Top Duplicate Titles");
  for (const entry of results.previewPageSummary.topDuplicateTitles.slice(0, 10)) {
    lines.push(`- ${entry.count} pages: ${entry.value}`);
  }
  lines.push("");
  lines.push("## Top Duplicate Descriptions");
  for (const entry of results.previewPageSummary.topDuplicateDescriptions.slice(
    0,
    10
  )) {
    lines.push(`- ${entry.count} pages: ${entry.value}`);
  }

  return `${lines.join("\n")}\n`;
}

async function writeJson(fileName, data) {
  await fs.writeFile(
    path.join(EVIDENCE_DIR, fileName),
    `${JSON.stringify(data, null, 2)}\n`
  );
}

async function main() {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });

  const localExpectations = await loadLocalExpectations();
  const prodSitemap = await loadSitemap(PROD_ORIGIN);
  const previewSitemap = await loadSitemap(PREVIEW_ORIGIN);
  const sitemapDiff = classifySitemapDiff(
    prodSitemap.canonicalUrls,
    previewSitemap.canonicalUrls,
    localExpectations
  );

  const previewSitemapPathSet = new Set(
    previewSitemap.canonicalUrls.map((url) => normalizePath(url))
  );
  const samplePathSet = new Set(SAMPLE_PATHS.map((pathName) => normalizePath(pathName)));

  const [prodPageCrawl, previewPageCrawl, previewCanonicalOverrideAudit, noindexAudit, cookbookAudit, markdownAudit, sampleAudit] =
    await Promise.all([
      auditSitemapPages(PROD_ORIGIN, prodSitemap.canonicalUrls, samplePathSet),
      auditSitemapPages(PREVIEW_ORIGIN, previewSitemap.canonicalUrls, samplePathSet),
      auditCanonicalOverrideRoutes(
        PREVIEW_ORIGIN,
        localExpectations.canonicalOverrideRoutes,
        previewSitemapPathSet
      ),
      auditNoindexRoutes(localExpectations.noindexRoutes, previewSitemapPathSet),
      auditCookbookDuplicateRoutes(
        localExpectations.cookbookDuplicateRoutes,
        previewSitemapPathSet
      ),
      auditMarkdownEndpoints(),
      auditSamplePages(),
    ]);
  const unexplainedSitemapGapAudit = await auditUnexplainedSitemapGaps(
    sitemapDiff.missingFromPreview
  );

  const prodPageSummary = summarizePageCrawl(prodPageCrawl, {
    expectPreviewNoindex: false,
  });
  const previewPageSummary = summarizePageCrawl(previewPageCrawl, {
    expectPreviewNoindex: true,
  });

  const results = {
    generatedAt: new Date().toISOString(),
    configuration: {
      productionOrigin: PROD_ORIGIN,
      previewOrigin: PREVIEW_ORIGIN,
      pageConcurrency: PAGE_CONCURRENCY,
      assetConcurrency: ASSET_CONCURRENCY,
    },
    localExpectations: {
      counts: {
        contentRoutes: localExpectations.routes.length,
        canonicalOverrideRoutes: localExpectations.canonicalOverrideRoutes.length,
        noindexRoutes: localExpectations.noindexRoutes.length,
        cookbookDuplicateRoutes: localExpectations.cookbookDuplicateRoutes.length,
      },
    },
    prodRobots: await fetchTextResponse(`${PROD_ORIGIN}/robots.txt`),
    previewRobots: await fetchTextResponse(`${PREVIEW_ORIGIN}/robots.txt`),
    prodSitemap,
    previewSitemap,
    sitemapDiff,
    prodPageSummary,
    previewPageSummary,
    previewCanonicalOverrideAudit,
    noindexAudit,
    cookbookAudit,
    unexplainedSitemapGapAudit,
    markdownAudit,
    sampleAudit,
  };

  await writeJson("summary.json", results);
  await writeJson("prod-sitemap-pages.json", prodPageCrawl);
  await writeJson("preview-sitemap-pages.json", previewPageCrawl);
  await writeJson("preview-canonical-override-audit.json", previewCanonicalOverrideAudit);
  await writeJson("noindex-audit.json", noindexAudit);
  await writeJson("cookbook-canonical-audit.json", cookbookAudit);
  await writeJson("unexplained-sitemap-gaps.json", unexplainedSitemapGapAudit);
  await writeJson("markdown-endpoints.json", markdownAudit);
  await writeJson("sample-pages.json", sampleAudit);
  await fs.writeFile(
    path.join(EVIDENCE_DIR, "summary.md"),
    buildMarkdownSummary(results)
  );

  console.log(`Wrote chapter 2 audit artifacts to ${EVIDENCE_DIR}`);
  console.log(
    JSON.stringify(
      {
        sitemapDiff: results.sitemapDiff.counts,
        previewPageSummary: results.previewPageSummary.totals,
        previewCanonicalOverrideAudit:
          results.previewCanonicalOverrideAudit.totals,
        noindexAudit: results.noindexAudit.totals,
        cookbookAudit: results.cookbookAudit.totals,
        unexplainedSitemapGapAudit: results.unexplainedSitemapGapAudit.totals,
        markdownAudit: results.markdownAudit.totals,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
