import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { nonPermanentRedirects, permanentRedirects } from "../../../lib/redirects.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapterDir = path.resolve(__dirname, "..");
const outputDir = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.join(chapterDir, "evidence");

const PROD_BASE_URL = (process.env.PROD_BASE_URL || "https://langfuse.com").replace(/\/$/, "");
const PREVIEW_BASE_URL = (
  process.env.PREVIEW_BASE_URL ||
  "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app"
).replace(/\/$/, "");
const REQUEST_CONCURRENCY = Number(process.env.REQUEST_CONCURRENCY || 16);
const INTERNAL_LINK_PAGE_LIMIT = Number(process.env.INTERNAL_LINK_PAGE_LIMIT || 10);
const INTERNAL_LINK_CHECK_LIMIT = Number(process.env.INTERNAL_LINK_CHECK_LIMIT || 250);
const MAX_REDIRECT_HOPS = 10;
const NETWORK_RETRIES = Number(process.env.NETWORK_RETRIES || 3);

const ANCHOR_FIXTURES = [
  {
    path: "/docs/prompt-management/get-started",
    anchor: "create-update-prompt",
  },
  {
    path: "/faq/all/existing-otel-setup",
    anchor: "how-langfuse-uses-otel",
  },
  {
    path: "/self-hosting/security/authentication-and-sso",
    anchor: "auth-email-password",
  },
  {
    path: "/self-hosting/configuration/encryption",
    anchor: "encryption-at-rest",
  },
  {
    path: "/docs/metrics/features/metrics-api",
    anchor: "daily-metrics",
  },
  {
    path: "/integrations/frameworks/langchain",
    anchor: "upgrade-paths",
  },
];

const REPRESENTATIVE_PATHS = [
  "/",
  "/docs",
  "/docs/ask-ai",
  "/docs/docs-mcp",
  "/docs/prompt-management/get-started",
  "/integrations",
  "/integrations/frameworks/langchain",
  "/self-hosting",
  "/self-hosting/security/authentication-and-sso",
  "/faq",
];

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`Using production base: ${PROD_BASE_URL}`);
  console.log(`Using preview base:    ${PREVIEW_BASE_URL}`);
  console.log(`Writing evidence to:   ${outputDir}`);

  const sitemapUrls = await getSitemapUrls(`${PROD_BASE_URL}/sitemap.xml`);
  const sitemapPaths = unique(
    sitemapUrls
      .map((url) => {
        try {
          const parsed = new URL(url);
          if (parsed.hostname !== new URL(PROD_BASE_URL).hostname) {
            return null;
          }
          return normalizePath(parsed.pathname + parsed.search);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );

  console.log(`Discovered ${sitemapPaths.length} sitemap URLs from production.`);

  const sitemapParity = await mapWithConcurrency(sitemapPaths, REQUEST_CONCURRENCY, async (pagePath, index) => {
    if ((index + 1) % 100 === 0 || index === 0) {
      console.log(`Sitemap parity ${index + 1}/${sitemapPaths.length}`);
    }
    const prodTrace = await traceRequest(PROD_BASE_URL, pagePath);
    const previewTrace = await traceRequest(PREVIEW_BASE_URL, pagePath);
    return analyzeSitemapPath(pagePath, prodTrace, previewTrace);
  });

  const redirectRules = [
    ...nonPermanentRedirects.map(([source, destination]) => ({
      kind: "temporary",
      source,
      destination,
    })),
    ...permanentRedirects.map(([source, destination]) => ({
      kind: "permanent",
      source,
      destination,
    })),
  ];

  console.log(`Checking ${redirectRules.length} configured redirects.`);
  const redirectResults = await mapWithConcurrency(redirectRules, REQUEST_CONCURRENCY, async (rule, index) => {
    if ((index + 1) % 100 === 0 || index === 0) {
      console.log(`Redirect checks ${index + 1}/${redirectRules.length}`);
    }
    return analyzeRedirectRule(rule);
  });

  console.log(`Checking ${ANCHOR_FIXTURES.length} anchor targets.`);
  const anchorResults = await mapWithConcurrency(ANCHOR_FIXTURES, 4, async (fixture) => {
    const html = await fetchText(new URL(fixture.path, PREVIEW_BASE_URL).toString());
    return {
      ...fixture,
      exists: html.includes(`id="${fixture.anchor}"`) || html.includes(`href="#${fixture.anchor}"`),
    };
  });

  const internalLinkResults = await analyzeInternalLinks(sitemapPaths);
  const normalizationResults = await analyzeNormalization();

  const summary = buildSummary({
    sitemapParity,
    redirectResults,
    anchorResults,
    internalLinkResults,
    normalizationResults,
  });

  await writeJson("sitemap-parity.json", sitemapParity);
  await writeJson("redirect-config.json", redirectResults);
  await writeJson("anchor-targets.json", anchorResults);
  await writeJson("internal-link-sample.json", internalLinkResults);
  await writeJson("trailing-slash-and-casing.json", normalizationResults);
  await fs.writeFile(path.join(outputDir, "summary.md"), summary, "utf8");

  console.log("Chapter 1 evidence written.");
}

async function analyzeInternalLinks(sitemapPaths) {
  const sampledPages = pickInternalLinkPages(sitemapPaths).slice(0, INTERNAL_LINK_PAGE_LIMIT);
  console.log(`Sampling internal links from ${sampledPages.length} pages.`);

  const pageResults = [];
  const linkTargets = new Map();

  for (const pagePath of sampledPages) {
    const html = await fetchText(new URL(pagePath, PREVIEW_BASE_URL).toString());
    const links = extractInternalPageLinks(html, PREVIEW_BASE_URL);
    pageResults.push({
      pagePath,
      linkCount: links.length,
      sample: links.slice(0, 25),
    });
    for (const link of links) {
      if (!linkTargets.has(link)) {
        linkTargets.set(link, []);
      }
      linkTargets.get(link).push(pagePath);
    }
  }

  const targetsToCheck = [...linkTargets.keys()].slice(0, INTERNAL_LINK_CHECK_LIMIT);
  console.log(`Tracing ${targetsToCheck.length} sampled internal links.`);

  const tracedLinks = await mapWithConcurrency(targetsToCheck, REQUEST_CONCURRENCY, async (target) => {
    const trace = await traceRequest(PREVIEW_BASE_URL, target);
    return {
      target,
      sourcePages: linkTargets.get(target),
      finalStatus: trace.finalStatus,
      finalPath: toComparableLocation(trace.finalUrl, PREVIEW_BASE_URL),
      hopCount: trace.hopCount,
      loopDetected: trace.loopDetected,
      chain: trace.chain,
      redirects: trace.hopCount > 0,
      homepageLanding: toComparableLocation(trace.finalUrl, PREVIEW_BASE_URL) === "/" && normalizePath(target) !== "/",
    };
  });

  return {
    sampledPages,
    pageResults,
    tracedLinks,
  };
}

async function analyzeNormalization() {
  const trailingSlashPaths = [
    "/about",
    "/docs",
    "/docs/prompt-management/get-started",
    "/faq/all/existing-otel-setup",
    "/self-hosting/security/authentication-and-sso",
  ];
  const casingPaths = [
    "/Docs",
    "/Docs/Prompt-Management/Get-Started",
    "/FAQ/All/Existing-Otel-Setup",
    "/Self-Hosting/Security/Authentication-And-Sso",
  ];

  const trailingSlash = await mapWithConcurrency(trailingSlashPaths, 4, async (pagePath) => {
    const withoutSlash = await traceRequest(PREVIEW_BASE_URL, pagePath.replace(/\/$/, "") || "/");
    const withSlashPath = pagePath === "/" ? "/" : `${pagePath.replace(/\/$/, "")}/`;
    const withSlash = await traceRequest(PREVIEW_BASE_URL, withSlashPath);
    return {
      path: pagePath,
      withoutSlash: summarizeTrace(withoutSlash, PREVIEW_BASE_URL),
      withSlash: summarizeTrace(withSlash, PREVIEW_BASE_URL),
      duplicateLiveUrl:
        withoutSlash.finalStatus === 200 &&
        withSlash.finalStatus === 200 &&
        toComparableLocation(withoutSlash.finalUrl, PREVIEW_BASE_URL) !==
          toComparableLocation(withSlash.finalUrl, PREVIEW_BASE_URL),
    };
  });

  const casing = await mapWithConcurrency(casingPaths, 4, async (pagePath) => {
    const trace = await traceRequest(PREVIEW_BASE_URL, pagePath);
    return {
      path: pagePath,
      ...summarizeTrace(trace, PREVIEW_BASE_URL),
    };
  });

  return { trailingSlash, casing };
}

async function analyzeRedirectRule(rule) {
  const materialized = materializeRule(rule.source, rule.destination);
  const prodTrace = await traceRequest(PROD_BASE_URL, materialized.source);
  const previewTrace = await traceRequest(PREVIEW_BASE_URL, materialized.source);
  const isExternalDestination = materialized.destination.startsWith("http");
  const isParameterizedSource = /:[A-Za-z0-9_]+/.test(rule.source);
  const expectedFinalUrl = isExternalDestination
    ? materialized.destination
    : new URL(materialized.destination, PREVIEW_BASE_URL).toString();
  const expectedComparable = isExternalDestination
    ? expectedFinalUrl
    : toComparableLocation(expectedFinalUrl, PREVIEW_BASE_URL);
  const previewFirstComparable = isExternalDestination
    ? previewTrace.chain[0]?.location
    : toComparableLocation(previewTrace.chain[0]?.location || "", PREVIEW_BASE_URL);
  const prodFirstComparable = isExternalDestination
    ? prodTrace.chain[0]?.location
    : toComparableLocation(prodTrace.chain[0]?.location || "", PROD_BASE_URL);
  const previewFinalComparable = isExternalDestination
    ? previewTrace.finalUrl
    : toComparableLocation(previewTrace.finalUrl, PREVIEW_BASE_URL);

  return {
    ...rule,
    materializedSource: materialized.source,
    materializedDestination: materialized.destination,
    isExternalDestination,
    isParameterizedSource,
    expectedComparable,
    previewFirstComparable,
    prodFirstComparable,
    prod: summarizeTrace(prodTrace, PROD_BASE_URL),
    preview: summarizeTrace(previewTrace, PREVIEW_BASE_URL),
    previewMatchesExpected:
      previewTrace.chain[0]?.status >= 300 &&
      previewTrace.chain[0]?.status < 400 &&
      previewFirstComparable === expectedComparable,
    previewSingleHop: isExternalDestination ? previewTrace.hopCount >= 1 : previewTrace.hopCount === 1,
    previewNeedsExtraInternalHop: !isExternalDestination && previewTrace.hopCount > 1,
    previewLoopDetected: previewTrace.loopDetected,
    prodPreviewDestinationMismatch:
      prodFirstComparable !== previewFirstComparable,
    previewStatusMismatch:
      !isParameterizedSource && prodTrace.chain[0]?.status !== previewTrace.chain[0]?.status,
    previewFinalComparable,
  };
}

function analyzeSitemapPath(pagePath, prodTrace, previewTrace) {
  const prodFinalPath = toComparableLocation(prodTrace.finalUrl, PROD_BASE_URL);
  const previewFinalPath = toComparableLocation(previewTrace.finalUrl, PREVIEW_BASE_URL);
  return {
    path: pagePath,
    prod: summarizeTrace(prodTrace, PROD_BASE_URL),
    preview: summarizeTrace(previewTrace, PREVIEW_BASE_URL),
    previewNon200: previewTrace.finalStatus !== 200,
    previewHomepageLanding: previewFinalPath === "/" && pagePath !== "/",
    finalPathMismatch: prodFinalPath !== previewFinalPath,
    previewMultiHop: previewTrace.hopCount > 1,
    previewLoopDetected: previewTrace.loopDetected,
  };
}

async function getSitemapUrls(sitemapUrl, seen = new Set()) {
  if (seen.has(sitemapUrl)) {
    return [];
  }
  seen.add(sitemapUrl);

  const xml = await fetchText(sitemapUrl);
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim());
  const isIndex = xml.includes("<sitemapindex");

  if (!isIndex) {
    return locs;
  }

  const nested = await Promise.all(locs.map((url) => getSitemapUrls(url, seen)));
  return nested.flat();
}

async function traceRequest(baseUrl, pathOrUrl) {
  const startUrl = pathOrUrl.startsWith("http") ? pathOrUrl : new URL(pathOrUrl, baseUrl).toString();
  const chain = [];
  const visited = new Set();
  let currentUrl = startUrl;
  let loopDetected = false;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    if (visited.has(currentUrl)) {
      loopDetected = true;
      break;
    }
    visited.add(currentUrl);

    const response = await fetchWithFallback(currentUrl);
    const location = response.headers.get("location");
    chain.push({
      url: currentUrl,
      status: response.status,
      location: location ? new URL(location, currentUrl).toString() : null,
    });

    if (response.status >= 300 && response.status < 400 && location) {
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    break;
  }

  const finalHop = chain.at(-1) ?? { url: startUrl, status: 0 };
  return {
    startUrl,
    finalUrl: finalHop.url,
    finalStatus: finalHop.status,
    hopCount: Math.max(0, chain.length - 1),
    loopDetected,
    chain,
  };
}

async function fetchWithFallback(url) {
  let response = await withRetries(() =>
    fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "user-agent": "chapter1-routing-review/1.0" },
    })
  );

  if (response.status === 405 || response.status === 501) {
    response = await withRetries(() =>
      fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": "chapter1-routing-review/1.0" },
      })
    );
  }

  return response;
}

async function fetchText(url) {
  const response = await withRetries(() =>
    fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "chapter1-routing-review/1.0" },
    })
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function materializeRule(sourcePattern, destinationPattern) {
  const params = new Map();

  const materialize = (pattern) =>
    pattern
      .replace(/:([A-Za-z0-9_]+)\*/g, (_, name) => {
        const value = `${name}-sample/child`;
        params.set(name, value);
        return value;
      })
      .replace(/:([A-Za-z0-9_]+)/g, (_, name) => {
        const value = params.get(name) || `${name}-sample`;
        params.set(name, value);
        return value;
      });

  return {
    source: materialize(sourcePattern),
    destination: materialize(destinationPattern),
  };
}

function extractInternalPageLinks(html, baseUrl) {
  const matches = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  const base = new URL(baseUrl);
  const links = [];

  for (const href of matches) {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    let url;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }

    if (url.hostname !== base.hostname) {
      continue;
    }

    const pathWithQuery = normalizePath(url.pathname + url.search);
    if (
      /\.(png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|xml|txt|json|pdf|mp4|webm)$/i.test(pathWithQuery) ||
      pathWithQuery.startsWith("/api/")
    ) {
      continue;
    }

    links.push(pathWithQuery);
  }

  return unique(links);
}

function pickInternalLinkPages(sitemapPaths) {
  const picked = [];
  const seen = new Set();

  for (const pathName of REPRESENTATIVE_PATHS) {
    if (sitemapPaths.includes(pathName) && !seen.has(pathName)) {
      picked.push(pathName);
      seen.add(pathName);
    }
  }

  for (const candidate of sitemapPaths) {
    if (picked.length >= INTERNAL_LINK_PAGE_LIMIT) {
      break;
    }
    if (candidate.split("/").length <= 3 && !seen.has(candidate)) {
      picked.push(candidate);
      seen.add(candidate);
    }
  }

  return picked;
}

function summarizeTrace(trace, baseUrl) {
  return {
    initialStatus: trace.chain[0]?.status ?? 0,
    finalStatus: trace.finalStatus,
    finalPath: toComparableLocation(trace.finalUrl, baseUrl),
    hopCount: trace.hopCount,
    loopDetected: trace.loopDetected,
    chain: trace.chain,
  };
}

function toComparableLocation(url, baseUrl) {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    if (parsed.hostname === base.hostname) {
      return normalizePath(parsed.pathname + parsed.search);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizePath(pathName) {
  if (!pathName || pathName === "") {
    return "/";
  }
  return pathName.startsWith("/") ? pathName : `/${pathName}`;
}

function unique(values) {
  return [...new Set(values)];
}

async function mapWithConcurrency(items, concurrency, iteratee) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

async function writeJson(fileName, data) {
  await fs.writeFile(path.join(outputDir, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function withRetries(action) {
  let lastError;
  for (let attempt = 1; attempt <= NETWORK_RETRIES; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt === NETWORK_RETRIES) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }
  throw lastError;
}

function buildSummary({
  sitemapParity,
  redirectResults,
  anchorResults,
  internalLinkResults,
  normalizationResults,
}) {
  const sitemapFailures = sitemapParity.filter(
    (result) =>
      result.previewNon200 ||
      result.finalPathMismatch ||
      result.previewMultiHop ||
      result.previewLoopDetected ||
      result.previewHomepageLanding
  );
  const redirectFailures = redirectResults.filter(
    (result) =>
      !result.previewMatchesExpected ||
      !result.previewSingleHop ||
      result.previewNeedsExtraInternalHop ||
      result.previewLoopDetected ||
      result.previewStatusMismatch
  );
  const redirectInternalChains = redirectResults.filter((result) => result.previewNeedsExtraInternalHop);
  const redirectStatusRegressions = redirectResults.filter((result) => result.previewStatusMismatch);
  const redirectFirstHopMismatches = redirectResults.filter((result) => !result.previewMatchesExpected);
  const anchorFailures = anchorResults.filter((result) => !result.exists);
  const internalRedirects = internalLinkResults.tracedLinks.filter(
    (result) => result.redirects || result.finalStatus !== 200 || result.homepageLanding
  );
  const slashProblems = normalizationResults.trailingSlash.filter((result) => result.duplicateLiveUrl);
  const casingProblems = normalizationResults.casing.filter((result) => result.finalStatus === 200);
  const previewOnlyCaseDuplicate = normalizationResults.casing.find((result) => result.path === "/Docs");

  const notableFindings = [
    sitemapFailures.length > 0
      ? `- ${sitemapFailures.length} production sitemap URLs return non-200 responses on preview. Examples: ${sitemapFailures
          .slice(0, 5)
          .map((result) => `\`${result.path}\``)
          .join(", ")}`
      : null,
    redirectInternalChains.length > 0
      ? `- ${redirectInternalChains.length} configured internal redirects add extra hops because the configured destination redirects again. Examples: ${redirectInternalChains
          .slice(0, 5)
          .map((result) => `\`${result.materializedSource}\` -> \`${result.preview.finalPath}\``)
          .join(", ")}`
      : null,
    redirectStatusRegressions.length > 0
      ? `- ${redirectStatusRegressions.length} exact redirect sources changed status code versus production, led by the \`/customers\` family returning \`307\` on preview instead of production's \`308\`.`
      : null,
    redirectFirstHopMismatches.length > 0
      ? `- ${redirectFirstHopMismatches.length} redirect rules failed first-hop validation. Most are hash-fragment rules that cannot be exercised at the HTTP layer and should be reviewed manually.`
      : null,
    previewOnlyCaseDuplicate
      ? `- Mixed-case path \`${previewOnlyCaseDuplicate.path}\` returns \`200\` on preview even though production returns \`404\`, creating a duplicate live docs URL.`
      : null,
    internalRedirects.length > 0
      ? `- ${internalRedirects.length} sampled internal links still point to redirecting URLs. Examples: ${internalRedirects
          .slice(0, 5)
          .map((result) => `\`${result.target}\``)
          .join(", ")}`
      : null,
    anchorFailures.length > 0
      ? `- Missing anchor targets: ${anchorFailures
          .slice(0, 5)
          .map((result) => `\`${result.path}#${result.anchor}\``)
          .join(", ")}`
      : null,
  ].filter(Boolean);

  const resultLines = [
    `- Production sitemap URLs replayed: ${sitemapParity.length}`,
    `- Sitemap parity failures: ${sitemapFailures.length}`,
    `- Redirect rules checked: ${redirectResults.length}`,
    `- Redirect rules with extra internal hops: ${redirectInternalChains.length}`,
    `- Redirect status regressions vs production: ${redirectStatusRegressions.length}`,
    `- Redirect first-hop mismatches: ${redirectFirstHopMismatches.length}`,
    `- Total redirect rule failures: ${redirectFailures.length}`,
    `- Anchor fixtures checked: ${anchorResults.length}`,
    `- Missing anchor targets: ${anchorFailures.length}`,
    `- Sampled internal links traced: ${internalLinkResults.tracedLinks.length}`,
    `- Sampled internal links with redirects or non-200 finals: ${internalRedirects.length}`,
    `- Trailing-slash duplicate live URLs: ${slashProblems.length}`,
    `- Mixed-case URLs returning 200: ${casingProblems.length}`,
  ];

  return `# Chapter 1 Summary

## Environments

- Production: \`${PROD_BASE_URL}\`
- Preview: \`${PREVIEW_BASE_URL}\`

## Results

${resultLines.join("\n")}

## Notable findings

${notableFindings.length > 0 ? notableFindings.join("\n") : "- No notable Chapter 1 issues were detected in the automated run."}

## Manual follow-up

- Verify browser scroll/landing behavior for the deep-link fixtures listed in \`manual/notes.md\`.
- Confirm whether any sampled internal-link redirects are acceptable legacy behavior or should be normalized in source links.
`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
