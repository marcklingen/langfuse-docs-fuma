import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { nonPermanentRedirects, permanentRedirects } = require("../../../lib/redirects.js");
const currentPages = require("../../../.sitemap-all-pages.json");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapterDir = path.resolve(__dirname, "..");
const artifactsDir = path.join(chapterDir, "artifacts");

const PROD_BASE_URL =
  process.env.CHAPTER1_PROD_BASE_URL ?? "https://langfuse.com";
const PREVIEW_BASE_URL =
  process.env.CHAPTER1_PREVIEW_BASE_URL ??
  "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app";
const PROD_SITEMAP_URL = new URL("/sitemap.xml", PROD_BASE_URL).toString();
const USER_AGENT = "Langfuse-Chapter-1-Route-Audit/1.0";
const MAX_REDIRECTS = Number(process.env.CHAPTER1_MAX_REDIRECTS ?? 10);
const MAX_CONCURRENCY = Number(process.env.CHAPTER1_CONCURRENCY ?? 10);
const SOFT_404_PATTERNS = [
  /page not found/i,
  /this page could not be found/i,
  /\b404\b/i,
];
const INTERNAL_LINK_EXTENSION_BLOCKLIST =
  /\.(?:png|jpe?g|gif|svg|webp|ico|pdf|xml|txt|json|mp4|webm|mp3|wav|zip|gz|tar|css|js|map|md)$/i;

function toComparablePath(rawUrl) {
  const url = new URL(rawUrl, PROD_BASE_URL);
  const pathname =
    url.pathname.length > 1 && url.pathname.endsWith("/")
      ? url.pathname.slice(0, -1)
      : url.pathname;
  return `${pathname || "/"}${url.search}`;
}

function toComparableTarget(rawUrl) {
  const url = new URL(rawUrl, PROD_BASE_URL);
  if (isInternalHost(url.origin)) {
    return toComparablePath(url.toString());
  }
  const pathname =
    url.pathname.length > 1 && url.pathname.endsWith("/")
      ? url.pathname.slice(0, -1)
      : url.pathname;
  return `${url.origin}${pathname || "/"}${url.search}`;
}

function isInternalHost(origin) {
  return (
    origin === new URL(PROD_BASE_URL).origin ||
    origin === new URL(PREVIEW_BASE_URL).origin
  );
}

function uniq(values) {
  return [...new Set(values)];
}

function stripTags(value) {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstMatch(html, regex) {
  const match = html.match(regex);
  return match ? stripTags(match[1]) : null;
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/xml,text/xml,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function loadSitemapPaths(url, visited = new Set()) {
  if (visited.has(url)) {
    return [];
  }

  visited.add(url);
  const xml = await fetchText(url);
  const locs = extractLocs(xml);

  if (xml.includes("<sitemapindex")) {
    const nested = await Promise.all(
      locs.map((loc) => loadSitemapPaths(loc, visited))
    );
    return uniq(nested.flat());
  }

  return uniq(locs.map((loc) => toComparablePath(loc)));
}

async function ensureArtifactsDir() {
  await fs.mkdir(artifactsDir, { recursive: true });
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, Math.max(items.length, 1)) },
    () => runWorker()
  );
  await Promise.all(workers);
  return results;
}

function pickExactOrPrefix(allPaths, preferredPaths) {
  const chosen = [];

  for (const preferred of preferredPaths) {
    const exact = allPaths.find((candidate) => candidate === preferred);
    if (exact) {
      chosen.push(exact);
      continue;
    }

    const prefixed = allPaths.find((candidate) => candidate.startsWith(preferred));
    if (prefixed) {
      chosen.push(prefixed);
    }
  }

  return uniq(chosen);
}

function buildRedirectExpectations() {
  const literal = [
    ...nonPermanentRedirects.map(([source, destination]) => ({
      source,
      destination,
      mode: "temporary",
      expectationType: "literal",
    })),
    ...permanentRedirects.map(([source, destination]) => ({
      source,
      destination,
      mode: "permanent",
      expectationType: "literal",
    })),
  ].filter((entry) => !entry.source.includes(":"));

  const wildcardSamples = [
    {
      source: "/cookbook/evaluation_with_langchain",
      destination: "/guides/cookbook/evaluation_with_langchain",
      mode: "temporary",
      expectationType: "wildcard-sample",
      sourcePattern: "/cookbook/:path*",
    },
    {
      source: "/customers/example-company",
      destination: "/users/example-company",
      mode: "permanent",
      expectationType: "wildcard-sample",
      sourcePattern: "/customers/:path*",
    },
  ];

  return [...literal, ...wildcardSamples];
}

function buildCaseSamples(allPaths) {
  return pickExactOrPrefix(allPaths, [
    "/docs/prompt-management/get-started",
    "/docs/observability/data-model",
    "/guides/cookbook/evaluation_with_langchain",
    "/integrations/frameworks/langchain",
    "/self-hosting/docker-compose",
    "/faq/",
    "/blog/",
    "/changelog/",
  ]).slice(0, 8);
}

function mutateCase(pathname) {
  const segments = pathname.split("/");
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (!segment || !/[a-z]/.test(segment)) {
      continue;
    }

    segments[index] = segment.replace(/[a-z]/, (character) =>
      character.toUpperCase()
    );
    return segments.join("/");
  }
  return pathname;
}

function findSoft404Signals({ title, h1, html }) {
  const text = [title, h1, html.slice(0, 12000)].filter(Boolean).join("\n");
  return SOFT_404_PATTERNS.filter((pattern) => pattern.test(text)).map(
    (pattern) => pattern.source
  );
}

function isHtmlRoute(pathname) {
  if (!pathname.startsWith("/")) {
    return false;
  }
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/md-src/")
  ) {
    return false;
  }
  return !INTERNAL_LINK_EXTENSION_BLOCKLIST.test(pathname);
}

function extractInternalLinks(html, pageUrl) {
  const baseUrl = new URL(pageUrl);
  const rawLinks = [...html.matchAll(/\shref=(["'])(.*?)\1/gi)].map(
    (match) => match[2].trim()
  );

  return uniq(
    rawLinks
      .filter(Boolean)
      .filter((href) => !href.startsWith("#"))
      .filter((href) => !/^(mailto:|tel:|javascript:|data:)/i.test(href))
      .map((href) => {
        try {
          const url = new URL(href, baseUrl);
          return url;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((url) => url.origin === baseUrl.origin)
      .map((url) => url.pathname)
      .filter(isHtmlRoute)
  );
}

async function probeUrl(startUrl) {
  const hops = [];
  const seen = new Set();
  let currentUrl = startUrl;

  for (let depth = 0; depth <= MAX_REDIRECTS; depth += 1) {
    if (seen.has(currentUrl)) {
      return {
        requestedUrl: startUrl,
        requestedPath: toComparablePath(startUrl),
        finalUrl: currentUrl,
        finalPath: toComparablePath(currentUrl),
        finalStatus: null,
        firstStatus: hops[0]?.status ?? null,
        redirectDepth: hops.length - 1,
        hops,
        loopDetected: true,
        redirectLimitExceeded: false,
        contentType: null,
        title: null,
        h1: null,
        soft404: false,
        soft404Signals: [],
        html: null,
      };
    }

    seen.add(currentUrl);
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const location = response.headers.get("location");
    const contentType = response.headers.get("content-type");
    const normalizedLocation = location
      ? new URL(location, currentUrl).toString()
      : null;

    hops.push({
      url: currentUrl,
      status: response.status,
      location: normalizedLocation,
      contentType,
    });

    if (
      response.status >= 300 &&
      response.status < 400 &&
      normalizedLocation
    ) {
      currentUrl = normalizedLocation;
      continue;
    }

    let html = null;
    let title = null;
    let h1 = null;
    let soft404Signals = [];

    if (contentType?.includes("text/html")) {
      html = await response.text();
      title = extractFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
      h1 = extractFirstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
      soft404Signals = findSoft404Signals({ title, h1, html });
    } else {
      await response.body?.cancel?.();
    }

    return {
      requestedUrl: startUrl,
      requestedPath: toComparablePath(startUrl),
      finalUrl: currentUrl,
      finalPath: toComparablePath(currentUrl),
      finalStatus: response.status,
      firstStatus: hops[0]?.status ?? response.status,
      redirectDepth: hops.length - 1,
      hops,
      loopDetected: false,
      redirectLimitExceeded: false,
      contentType,
      title,
      h1,
      soft404: soft404Signals.length > 0,
      soft404Signals,
      html,
    };
  }

  return {
    requestedUrl: startUrl,
    requestedPath: toComparablePath(startUrl),
    finalUrl: currentUrl,
    finalPath: toComparablePath(currentUrl),
    finalStatus: null,
    firstStatus: hops[0]?.status ?? null,
    redirectDepth: hops.length - 1,
    hops,
    loopDetected: false,
    redirectLimitExceeded: true,
    contentType: null,
    title: null,
    h1: null,
    soft404: false,
    soft404Signals: [],
    html: null,
  };
}

function summarizePreviewMismatches(productionResult, previewResult) {
  const mismatches = [];

  if (!previewResult) {
    mismatches.push("missing-preview-result");
    return mismatches;
  }

  if (previewResult.loopDetected) {
    mismatches.push("redirect-loop");
  }

  if (previewResult.redirectLimitExceeded) {
    mismatches.push("redirect-limit");
  }

  if (previewResult.redirectDepth > 1) {
    mismatches.push("redirect-chain");
  }

  if (previewResult.finalStatus && previewResult.finalStatus >= 400) {
    mismatches.push(`final-status-${previewResult.finalStatus}`);
  }

  if (previewResult.soft404) {
    mismatches.push("soft-404");
  }

  if (
    previewResult.finalPath === "/" &&
    productionResult.requestedPath !== "/" &&
    productionResult.requestedPath !== "/index"
  ) {
    mismatches.push("redirected-to-homepage");
  }

  if (
    productionResult.finalPath &&
    previewResult.finalPath &&
    productionResult.finalPath !== previewResult.finalPath
  ) {
    mismatches.push("final-path-changed");
  }

  return mismatches;
}

function summarizeRedirectExpectation(expectation, previewResult) {
  const issues = [];
  const expectedTarget = toComparableTarget(expectation.destination);
  const destinationUrl = new URL(expectation.destination, PROD_BASE_URL);
  const destinationIsInternal = isInternalHost(destinationUrl.origin);
  const matcherOnly = expectation.expectationType === "wildcard-sample";

  if (!previewResult) {
    issues.push("missing-preview-result");
    return issues;
  }

  if (previewResult.firstStatus < 300 || previewResult.firstStatus >= 400) {
    issues.push("no-initial-redirect");
  }

  const firstHopTarget = previewResult.hops[0]?.location
    ? toComparableTarget(previewResult.hops[0].location)
    : null;

  if (firstHopTarget !== expectedTarget) {
    issues.push("unexpected-first-hop");
  }

  if (!matcherOnly && destinationIsInternal) {
    if (previewResult.redirectDepth !== 1) {
      issues.push(
        previewResult.redirectDepth > 1 ? "redirect-chain" : "missing-single-hop"
      );
    }

    if (toComparableTarget(previewResult.finalUrl) !== expectedTarget) {
      issues.push("unexpected-final-target");
    }
  }

  if (previewResult.loopDetected) {
    issues.push("redirect-loop");
  }

  if (
    !matcherOnly &&
    destinationIsInternal &&
    previewResult.finalStatus &&
    previewResult.finalStatus >= 400
  ) {
    issues.push(`final-status-${previewResult.finalStatus}`);
  }

  return issues;
}

function summarizeTrailingSlashIssue(originalResult, variantResult) {
  return (
    originalResult.finalStatus === 200 &&
    variantResult.finalStatus === 200 &&
    originalResult.redirectDepth === 0 &&
    variantResult.redirectDepth === 0
  );
}

function summarizeCaseIssue(result, expectedPath) {
  if (!result) {
    return ["missing-result"];
  }

  const issues = [];
  if (result.loopDetected) {
    issues.push("redirect-loop");
  }
  if (result.redirectDepth > 1) {
    issues.push("redirect-chain");
  }
  if (result.finalStatus === 200 && result.redirectDepth === 0) {
    issues.push("mixed-case-path-live");
  }
  if (
    result.finalStatus === 200 &&
    result.redirectDepth > 0 &&
    result.finalPath !== expectedPath
  ) {
    issues.push("redirected-to-unexpected-target");
  }
  return issues;
}

function createMarkdownReport({
  inventory,
  comparisonFailures,
  redirectFailures,
  trailingSlashFailures,
  caseFailures,
  internalLinkFailures,
}) {
  const lines = [
    "# Chapter 1 Route Audit",
    "",
    `- Run at: ${new Date().toISOString()}`,
    `- Production sitemap URLs replayed: ${inventory.productionPaths.length}`,
    `- Configured redirect sources checked: ${inventory.redirectExpectations.length}`,
    `- Preview pages crawled for internal links: ${inventory.internalLinkPageCount}`,
    `- Unique internal links checked: ${inventory.internalLinkTargetCount}`,
    "",
    "## Failure Summary",
    "",
    `- Production vs preview path regressions: ${comparisonFailures.length}`,
    `- Redirect expectation failures: ${redirectFailures.length}`,
    `- Trailing-slash duplicate live URLs: ${trailingSlashFailures.length}`,
    `- Mixed-case URL issues: ${caseFailures.length}`,
    `- Internal links hitting redirects or broken pages: ${internalLinkFailures.length}`,
    "",
  ];

  function appendSampleSection(title, failures, formatter) {
    lines.push(`## ${title}`, "");
    if (failures.length === 0) {
      lines.push("- None", "");
      return;
    }

    for (const failure of failures.slice(0, 20)) {
      lines.push(`- ${formatter(failure)}`);
    }
    lines.push("");
  }

  appendSampleSection("Preview Regressions", comparisonFailures, (failure) => {
    return `${failure.path} -> ${failure.preview.finalPath} (${failure.issues.join(
      ", "
    )})`;
  });

  appendSampleSection("Redirect Failures", redirectFailures, (failure) => {
    return `${failure.source} expected ${failure.expectedTarget}, got ${failure.preview.finalPath} (${failure.issues.join(
      ", "
    )})`;
  });

  appendSampleSection("Trailing Slash Duplicates", trailingSlashFailures, (failure) => {
    return `${failure.originalPath} and ${failure.variantPath} both resolve live without normalization`;
  });

  appendSampleSection("Case Handling Issues", caseFailures, (failure) => {
    return `${failure.mutatedPath} -> ${failure.preview.finalPath} (${failure.issues.join(
      ", "
    )})`;
  });

  appendSampleSection("Internal Link Issues", internalLinkFailures, (failure) => {
    return `${failure.path} referenced by ${failure.referrers.join(", ")} (${failure.issues.join(
      ", "
    )})`;
  });

  return `${lines.join("\n").trim()}\n`;
}

function compactProbeResult(result) {
  if (!result) {
    return result;
  }

  const { html, ...rest } = result;
  return rest;
}

export async function runRouteAudit() {
  await ensureArtifactsDir();

  const productionPaths = await loadSitemapPaths(PROD_SITEMAP_URL);
  const redirectExpectations = buildRedirectExpectations();
  const importantPaths = uniq([
    "/",
    ...productionPaths,
    ...redirectExpectations.map((entry) => entry.source),
  ]);

  console.log(
    `Route audit: replaying ${importantPaths.length} important URLs across production and preview`
  );

  const importantResults = await mapLimit(importantPaths, MAX_CONCURRENCY, async (pathName) => {
    const productionUrl = new URL(pathName, PROD_BASE_URL).toString();
    const previewUrl = new URL(pathName, PREVIEW_BASE_URL).toString();
    const [production, preview] = await Promise.all([
      probeUrl(productionUrl),
      probeUrl(previewUrl),
    ]);

    return {
      path: pathName,
      production,
      preview,
    };
  });

  const comparisonFailures = importantResults
    .filter((result) => productionPaths.includes(result.path))
    .map((result) => ({
      ...result,
      issues: summarizePreviewMismatches(result.production, result.preview),
    }))
    .filter((result) => result.issues.length > 0);

  const redirectFailures = redirectExpectations
    .map((expectation) => {
      const matchingResult = importantResults.find(
        (result) => result.path === expectation.source
      );
      const issues = summarizeRedirectExpectation(expectation, matchingResult?.preview);
      return {
        source: expectation.source,
        expectedTarget: toComparableTarget(expectation.destination),
        expectationType: expectation.expectationType,
        preview: matchingResult?.preview,
        issues,
      };
    })
    .filter((result) => result.issues.length > 0);

  const trailingSlashSourcePaths = productionPaths.filter((pathname) => {
    return (
      pathname !== "/" &&
      !pathname.endsWith("/") &&
      !INTERNAL_LINK_EXTENSION_BLOCKLIST.test(pathname)
    );
  });

  console.log(
    `Route audit: checking trailing-slash behavior on ${trailingSlashSourcePaths.length} production paths`
  );

  const trailingSlashResults = await mapLimit(
    trailingSlashSourcePaths,
    MAX_CONCURRENCY,
    async (pathname) => {
      const variantPath = `${pathname}/`;
      const [original, variant] = await Promise.all([
        probeUrl(new URL(pathname, PREVIEW_BASE_URL).toString()),
        probeUrl(new URL(variantPath, PREVIEW_BASE_URL).toString()),
      ]);
      return {
        originalPath: pathname,
        variantPath,
        original,
        variant,
      };
    }
  );

  const trailingSlashFailures = trailingSlashResults.filter((result) =>
    summarizeTrailingSlashIssue(result.original, result.variant)
  );

  const caseSamplePaths = buildCaseSamples(currentPages);
  console.log(`Route audit: checking mixed-case behavior on ${caseSamplePaths.length} sample URLs`);

  const caseResults = await mapLimit(caseSamplePaths, MAX_CONCURRENCY, async (pathname) => {
    const mutatedPath = mutateCase(pathname);
    const preview = await probeUrl(new URL(mutatedPath, PREVIEW_BASE_URL).toString());
    return {
      originalPath: pathname,
      mutatedPath,
      preview,
      issues: summarizeCaseIssue(preview, pathname),
    };
  });

  const caseFailures = caseResults.filter((result) => result.issues.length > 0);

  const internalLinkPages = uniq(["/", ...currentPages]).filter(isHtmlRoute);
  console.log(
    `Route audit: crawling ${internalLinkPages.length} preview pages for internal links`
  );

  const internalLinkSources = new Map();
  await mapLimit(internalLinkPages, MAX_CONCURRENCY, async (pathname) => {
    const previewResult = await probeUrl(new URL(pathname, PREVIEW_BASE_URL).toString());
    if (previewResult.finalStatus !== 200 || !previewResult.html) {
      return null;
    }

    const links = extractInternalLinks(previewResult.html, previewResult.finalUrl);
    for (const link of links) {
      const entry = internalLinkSources.get(link) ?? { referrers: [] };
      if (entry.referrers.length < 5 && !entry.referrers.includes(pathname)) {
        entry.referrers.push(pathname);
      }
      internalLinkSources.set(link, entry);
    }

    return null;
  });

  const internalLinkTargets = [...internalLinkSources.keys()];
  console.log(
    `Route audit: probing ${internalLinkTargets.length} unique internal link targets`
  );

  const internalLinkResults = await mapLimit(
    internalLinkTargets,
    MAX_CONCURRENCY,
    async (pathname) => {
      const preview = await probeUrl(new URL(pathname, PREVIEW_BASE_URL).toString());
      const issues = [];

      if (preview.redirectDepth > 0) {
        issues.push("internal-link-redirect");
      }
      if (preview.finalStatus && preview.finalStatus >= 400) {
        issues.push(`final-status-${preview.finalStatus}`);
      }
      if (preview.soft404) {
        issues.push("soft-404");
      }
      if (preview.loopDetected) {
        issues.push("redirect-loop");
      }

      return {
        path: pathname,
        preview,
        referrers: internalLinkSources.get(pathname)?.referrers ?? [],
        issues,
      };
    }
  );

  const internalLinkFailures = internalLinkResults.filter(
    (result) => result.issues.length > 0
  );

  const summary = {
    runAt: new Date().toISOString(),
    environments: {
      productionBaseUrl: PROD_BASE_URL,
      previewBaseUrl: PREVIEW_BASE_URL,
    },
    inventory: {
      productionPaths: productionPaths.length,
      redirectExpectations: redirectExpectations.length,
      importantPaths: importantPaths.length,
      trailingSlashPaths: trailingSlashSourcePaths.length,
      caseSamples: caseSamplePaths.length,
      internalLinkPageCount: internalLinkPages.length,
      internalLinkTargetCount: internalLinkTargets.length,
    },
    findings: {
      comparisonFailures: comparisonFailures.length,
      redirectFailures: redirectFailures.length,
      trailingSlashFailures: trailingSlashFailures.length,
      caseFailures: caseFailures.length,
      internalLinkFailures: internalLinkFailures.length,
    },
  };

  const report = {
    summary,
    inventory: {
      productionPaths,
      redirectExpectations,
      internalLinkPageCount: internalLinkPages.length,
      internalLinkTargetCount: internalLinkTargets.length,
    },
    importantResults: importantResults.map((result) => ({
      ...result,
      production: compactProbeResult(result.production),
      preview: compactProbeResult(result.preview),
    })),
    comparisonFailures: comparisonFailures.map((result) => ({
      ...result,
      production: compactProbeResult(result.production),
      preview: compactProbeResult(result.preview),
    })),
    redirectFailures: redirectFailures.map((result) => ({
      ...result,
      preview: compactProbeResult(result.preview),
    })),
    trailingSlashResults: trailingSlashResults.map((result) => ({
      ...result,
      original: compactProbeResult(result.original),
      variant: compactProbeResult(result.variant),
    })),
    trailingSlashFailures: trailingSlashFailures.map((result) => ({
      ...result,
      original: compactProbeResult(result.original),
      variant: compactProbeResult(result.variant),
    })),
    caseResults: caseResults.map((result) => ({
      ...result,
      preview: compactProbeResult(result.preview),
    })),
    caseFailures: caseFailures.map((result) => ({
      ...result,
      preview: compactProbeResult(result.preview),
    })),
    internalLinkResults: internalLinkResults.map((result) => ({
      ...result,
      preview: compactProbeResult(result.preview),
    })),
    internalLinkFailures: internalLinkFailures.map((result) => ({
      ...result,
      preview: compactProbeResult(result.preview),
    })),
  };

  const markdown = createMarkdownReport({
    inventory: {
      productionPaths,
      redirectExpectations,
      internalLinkPageCount: internalLinkPages.length,
      internalLinkTargetCount: internalLinkTargets.length,
    },
    comparisonFailures,
    redirectFailures,
    trailingSlashFailures,
    caseFailures,
    internalLinkFailures,
  });

  await Promise.all([
    fs.writeFile(
      path.join(artifactsDir, "route-audit.json"),
      `${JSON.stringify(report, null, 2)}\n`
    ),
    fs.writeFile(path.join(artifactsDir, "route-audit.md"), markdown),
  ]);

  console.log(
    `Route audit complete: ${comparisonFailures.length} preview regressions, ${redirectFailures.length} redirect failures, ${internalLinkFailures.length} internal link issues`
  );

  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runRouteAudit();
}
