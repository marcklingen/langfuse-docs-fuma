import fs from "node:fs/promises";
import path from "node:path";

const PROD_BASE_URL = normalizeBaseUrl(
  process.env.PROD_BASE_URL || "https://langfuse.com"
);
const PREVIEW_BASE_URL = normalizeBaseUrl(
  process.env.PREVIEW_BASE_URL ||
    "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app"
);
const OUTPUT_DIR = path.resolve(
  process.cwd(),
  process.env.OUTPUT_DIR ||
    "review/7-metadata-structured-data-and-social-sharing/evidence"
);

const PREVIEW_HOST = new URL(PREVIEW_BASE_URL).host;
const SITE_DEFAULT_OG_IMAGE = "https://langfuse.com/og.png";

const REPRESENTATIVE_PAGES = [
  {
    id: "docs-observability-overview",
    label: "Docs overview",
    route: "/docs/observability/overview",
    contentFile: "content/docs/observability/overview.mdx",
    category: "docs-overview",
  },
  {
    id: "docs-prompt-management-overview",
    label: "Prompt management overview",
    route: "/docs/prompt-management/overview",
    contentFile: "content/docs/prompt-management/overview.mdx",
    category: "docs-overview",
  },
  {
    id: "docs-evaluation-overview",
    label: "Evaluation overview",
    route: "/docs/evaluation/overview",
    contentFile: "content/docs/evaluation/overview.mdx",
    category: "docs-overview",
  },
  {
    id: "docs-api-platform-overview",
    label: "API and data platform overview",
    route: "/docs/api-and-data-platform/overview",
    contentFile: "content/docs/api-and-data-platform/overview.mdx",
    category: "docs-overview",
  },
  {
    id: "guides-run-langfuse-locally",
    label: "Guide video with custom OG image",
    route: "/guides/videos/run-langfuse-locally",
    contentFile: "content/guides/videos/run-langfuse-locally.mdx",
    category: "guides",
  },
  {
    id: "blog-ai-agent-comparison",
    label: "Blog post with custom OG image",
    route: "/blog/2025-03-19-ai-agent-comparison",
    contentFile: "content/blog/2025-03-19-ai-agent-comparison.mdx",
    category: "blog",
  },
  {
    id: "changelog-comments",
    label: "Changelog entry with canonical and OG video",
    route: "/changelog/2024-08-20-comments",
    contentFile: "content/changelog/2024-08-20-comments.mdx",
    category: "changelog",
  },
  {
    id: "changelog-open-source",
    label: "Changelog entry with custom OG image",
    route: "/changelog/2025-06-04-open-sourcing-langfuse",
    contentFile: "content/changelog/2025-06-04-open-sourcing-langfuse.mdx",
    category: "changelog",
  },
  {
    id: "pricing",
    label: "Wide marketing page",
    route: "/pricing",
    contentFile: "content/marketing/pricing.mdx",
    category: "wide-marketing",
  },
  {
    id: "faq-support",
    label: "FAQ article",
    route: "/faq/all/langfuse-support",
    contentFile: "content/faq/all/langfuse-support.mdx",
    category: "faq",
  },
];

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const sourceExpectations = await loadSourceExpectations();
  const [preview, production] = await Promise.all([
    inspectEnvironment("preview", PREVIEW_BASE_URL),
    inspectEnvironment("production", PROD_BASE_URL),
  ]);

  const comparisons = REPRESENTATIVE_PAGES.map((page) =>
    comparePage(
      page,
      sourceExpectations[page.id],
      production.pages[page.id],
      preview.pages[page.id]
    )
  );

  const report = {
    generatedAt: new Date().toISOString(),
    previewBaseUrl: PREVIEW_BASE_URL,
    productionBaseUrl: PROD_BASE_URL,
    sourceExpectations,
    environments: {
      preview,
      production,
    },
    comparisons,
  };

  const findings = buildFindings(report);
  const summary = buildSummary(report, findings);

  await Promise.all([
    writeJson("page-metadata.json", {
      preview: preview.pages,
      production: production.pages,
    }),
    writeJson("asset-checks.json", {
      preview: pluckPageFields(preview.pages, "assets"),
      production: pluckPageFields(production.pages, "assets"),
    }),
    writeJson("structured-data.json", {
      preview: pluckPageFields(preview.pages, "structuredData"),
      production: pluckPageFields(production.pages, "structuredData"),
    }),
    writeJson("comparisons.json", comparisons),
    writeJson("summary.json", summary),
    fs.writeFile(
      path.join(OUTPUT_DIR, "summary.md"),
      buildSummaryMarkdown(summary),
      "utf8"
    ),
  ]);

  const hasFailures =
    summary.checks.some((check) => check.preview === "FAIL" || check.production === "FAIL") ||
    summary.findings.length > 0;
  if (hasFailures) {
    process.exitCode = 1;
  }
}

async function loadSourceExpectations() {
  const entries = await Promise.all(
    REPRESENTATIVE_PAGES.map(async (page) => {
      const filePath = path.resolve(process.cwd(), page.contentFile);
      const raw = await readOptionalText(filePath);
      const frontmatter = raw ? parseFrontmatter(raw) : {};

      return [
        page.id,
        {
          filePath: page.contentFile,
          route: page.route,
          title: normalizeTextValue(frontmatter.title),
          description: normalizeTextValue(frontmatter.description),
          canonical: resolveSourceField(frontmatter.canonical, page.route),
          ogImage: resolveSourceField(frontmatter.ogImage, page.route),
          ogVideo: resolveSourceField(frontmatter.ogVideo, page.route),
        },
      ];
    })
  );

  return Object.fromEntries(entries);
}

async function inspectEnvironment(name, baseUrl) {
  const pageEntries = await Promise.all(
    REPRESENTATIVE_PAGES.map(async (page) => {
      return [page.id, await inspectPage(baseUrl, page)];
    })
  );

  return {
    name,
    baseUrl,
    pages: Object.fromEntries(pageEntries),
  };
}

async function inspectPage(baseUrl, page) {
  const response = await fetchText(`${baseUrl}${page.route}`);
  const head = extractHead(response.text);
  const metadata = extractMetadata(head, response.finalUrl);
  const structuredData = parseStructuredData(head);
  const assets = await inspectAssets(metadata);

  return {
    route: page.route,
    label: page.label,
    category: page.category,
    url: `${baseUrl}${page.route}`,
    finalUrl: response.finalUrl,
    status: response.status,
    contentType: response.headers["content-type"] ?? null,
    metadata,
    structuredData,
    assets,
  };
}

function comparePage(page, source, production, preview) {
  return {
    id: page.id,
    label: page.label,
    route: page.route,
    category: page.category,
    source,
    previewVsProduction: {
      titleMatches: sameText(preview.metadata.title, production.metadata.title),
      descriptionMatches: sameText(
        preview.metadata.description,
        production.metadata.description
      ),
      canonicalMatches: sameUrl(
        preview.metadata.canonical,
        production.metadata.canonical
      ),
      ogUrlMatches: sameUrl(preview.metadata.ogUrl, production.metadata.ogUrl),
      ogImageMatches: sameUrl(
        preview.metadata.ogImage,
        production.metadata.ogImage
      ),
      ogVideoMatches: sameUrl(
        preview.metadata.ogVideo,
        production.metadata.ogVideo
      ),
      structuredDataTypesMatch: sameStringArray(
        preview.structuredData.types,
        production.structuredData.types
      ),
    },
    sourceChecks: {
      previewCanonicalMatches: source.canonical
        ? sameUrl(preview.metadata.canonical, source.canonical)
        : null,
      productionCanonicalMatches: source.canonical
        ? sameUrl(production.metadata.canonical, source.canonical)
        : null,
      previewOgImageMatches: source.ogImage
        ? sameUrl(preview.metadata.ogImage, source.ogImage)
        : null,
      productionOgImageMatches: source.ogImage
        ? sameUrl(production.metadata.ogImage, source.ogImage)
        : null,
      previewOgVideoMatches: source.ogVideo
        ? sameUrl(preview.metadata.ogVideo, source.ogVideo)
        : null,
      productionOgVideoMatches: source.ogVideo
        ? sameUrl(production.metadata.ogVideo, source.ogVideo)
        : null,
      previewDescriptionMatches: source.description
        ? sameText(preview.metadata.description, source.description)
        : null,
      productionDescriptionMatches: source.description
        ? sameText(production.metadata.description, source.description)
        : null,
    },
    consistency: {
      previewOgUrlMatchesCanonicalOrPage: ogUrlMatchesCanonicalOrPage(preview),
      productionOgUrlMatchesCanonicalOrPage: ogUrlMatchesCanonicalOrPage(production),
      previewLeaksPreviewDomain: metadataLeaksPreviewDomain(preview.metadata),
      productionLeaksPreviewDomain: metadataLeaksPreviewDomain(production.metadata),
    },
    assetChecks: {
      preview: summarizeAssetState(preview.assets),
      production: summarizeAssetState(production.assets),
    },
  };
}

function buildFindings(report) {
  const findings = [];
  const comparisons = report.comparisons;

  const canonicalAndOgUrlRegressions = comparisons.filter(
    (entry) =>
      entry.previewVsProduction.canonicalMatches === false ||
      entry.previewVsProduction.ogUrlMatches === false ||
      entry.consistency.previewLeaksPreviewDomain
  );
  if (canonicalAndOgUrlRegressions.length > 0) {
    findings.push({
      severity: "HIGH",
      title: "Preview omits canonical tags and/or `og:url` on representative pages",
      evidence: "comparisons.json, page-metadata.json",
      details: canonicalAndOgUrlRegressions.map((entry) => ({
        route: entry.route,
        previewCanonical: report.environments.preview.pages[entry.id].metadata.canonical,
        productionCanonical:
          report.environments.production.pages[entry.id].metadata.canonical,
        previewOgUrl: report.environments.preview.pages[entry.id].metadata.ogUrl,
        productionOgUrl:
          report.environments.production.pages[entry.id].metadata.ogUrl,
      })),
    });
  }

  const docsTitleRegressions = comparisons.filter(
    (entry) =>
      entry.category === "docs-overview" &&
      entry.previewVsProduction.titleMatches === false
  );
  if (docsTitleRegressions.length > 0) {
    findings.push({
      severity: "MEDIUM",
      title: "Representative docs overview pages regress to generic `Overview - Langfuse` titles",
      evidence: "comparisons.json, page-metadata.json",
      details: docsTitleRegressions.map((entry) => ({
        route: entry.route,
        previewTitle: report.environments.preview.pages[entry.id].metadata.title,
        productionTitle:
          report.environments.production.pages[entry.id].metadata.title,
      })),
    });
  }

  const ogImageOverrideRegressions = comparisons.filter(
    (entry) =>
      entry.sourceChecks.previewOgImageMatches === false ||
      (entry.category === "wide-marketing" &&
        report.environments.preview.pages[entry.id].metadata.ogImage ===
          SITE_DEFAULT_OG_IMAGE &&
        report.environments.production.pages[entry.id].metadata.ogImage !==
          SITE_DEFAULT_OG_IMAGE)
  );
  if (ogImageOverrideRegressions.length > 0) {
    findings.push({
      severity: "HIGH",
      title: "Preview loses page-specific social cards on guides and wide marketing pages",
      evidence: "comparisons.json, page-metadata.json",
      details: ogImageOverrideRegressions.map((entry) => ({
        route: entry.route,
        previewOgImage: report.environments.preview.pages[entry.id].metadata.ogImage,
        productionOgImage:
          report.environments.production.pages[entry.id].metadata.ogImage,
        sourceOgImage: entry.source.ogImage,
      })),
    });
  }

  const ogVideoOverrideRegressions = comparisons.filter(
    (entry) => entry.sourceChecks.previewOgVideoMatches === false
  );
  if (ogVideoOverrideRegressions.length > 0) {
    findings.push({
      severity: "MEDIUM",
      title: "Preview drops changelog `og:video` overrides",
      evidence: "comparisons.json, page-metadata.json",
      details: ogVideoOverrideRegressions.map((entry) => ({
        route: entry.route,
        previewOgVideo: report.environments.preview.pages[entry.id].metadata.ogVideo,
        productionOgVideo:
          report.environments.production.pages[entry.id].metadata.ogVideo,
        sourceOgVideo: entry.source.ogVideo,
      })),
    });
  }

  const productionVideoAssetFailures = comparisons.filter(
    (entry) =>
      entry.source.ogVideo &&
      report.environments.production.pages[entry.id].assets.ogVideo?.ok === false
  );
  if (productionVideoAssetFailures.length > 0) {
    findings.push({
      severity: "LOW",
      title: "Current production `og:video` URLs are malformed for absolute frontmatter values",
      evidence: "asset-checks.json, comparisons.json",
      details: productionVideoAssetFailures.map((entry) => ({
        route: entry.route,
        productionOgVideo:
          report.environments.production.pages[entry.id].metadata.ogVideo,
        sourceOgVideo: entry.source.ogVideo,
      })),
    });
  }

  return findings;
}

function buildSummary(report, findings) {
  const comparisons = report.comparisons;
  const checks = [
    {
      name: "Representative head metadata parity",
      preview: hasAny(
        comparisons,
        (entry) =>
          entry.previewVsProduction.titleMatches === false ||
          entry.previewVsProduction.descriptionMatches === false
      )
        ? "FAIL"
        : "PASS",
      production: "PASS",
    },
    {
      name: "Canonical and `og:url` coverage",
      preview: hasAny(
        comparisons,
        (entry) =>
          entry.previewVsProduction.canonicalMatches === false ||
          entry.previewVsProduction.ogUrlMatches === false ||
          entry.consistency.previewLeaksPreviewDomain
      )
        ? "FAIL"
        : "PASS",
      production: "PASS",
    },
    {
      name: "Custom OG image overrides",
      preview: hasAny(
        comparisons,
        (entry) => entry.sourceChecks.previewOgImageMatches === false
      ) ||
        hasAny(
          comparisons,
          (entry) =>
            entry.category === "wide-marketing" &&
            report.environments.preview.pages[entry.id].metadata.ogImage ===
              SITE_DEFAULT_OG_IMAGE &&
            report.environments.production.pages[entry.id].metadata.ogImage !==
              SITE_DEFAULT_OG_IMAGE
        )
        ? "FAIL"
        : "PASS",
      production: hasAny(
        comparisons,
        (entry) => entry.sourceChecks.productionOgImageMatches === false
      )
        ? "FAIL"
        : "PASS",
    },
    {
      name: "Custom `og:video` overrides",
      preview: hasAny(
        comparisons,
        (entry) => entry.sourceChecks.previewOgVideoMatches === false
      )
        ? "FAIL"
        : "PASS",
      production: hasAny(
        comparisons,
        (entry) => entry.sourceChecks.productionOgVideoMatches === false
      )
        ? "FAIL"
        : "PASS",
    },
    {
      name: "Emitted OG/Twitter assets reachable",
      preview: hasAny(
        Object.values(report.environments.preview.pages),
        (page) => hasBrokenAsset(page.assets)
      )
        ? "FAIL"
        : "PASS",
      production: hasAny(
        Object.values(report.environments.production.pages),
        (page) => hasBrokenAsset(page.assets)
      )
        ? "FAIL"
        : "PASS",
    },
    {
      name: "JSON-LD structured-data parity",
      preview: hasAny(
        comparisons,
        (entry) => entry.previewVsProduction.structuredDataTypesMatch === false
      )
        ? "FAIL"
        : "PASS",
      production: "PASS",
    },
  ];

  const previewStructuredDataTypes = unique(
    Object.values(report.environments.preview.pages).flatMap(
      (page) => page.structuredData.types
    )
  );
  const productionStructuredDataTypes = unique(
    Object.values(report.environments.production.pages).flatMap(
      (page) => page.structuredData.types
    )
  );

  return {
    generatedAt: report.generatedAt,
    previewBaseUrl: report.previewBaseUrl,
    productionBaseUrl: report.productionBaseUrl,
    findings,
    checks,
    observations: {
      previewStructuredDataTypes,
      productionStructuredDataTypes,
      previewStructuredDataCount: Object.values(report.environments.preview.pages).reduce(
        (sum, page) => sum + page.structuredData.count,
        0
      ),
      productionStructuredDataCount: Object.values(
        report.environments.production.pages
      ).reduce((sum, page) => sum + page.structuredData.count, 0),
    },
  };
}

function buildSummaryMarkdown(summary) {
  const findingLines =
    summary.findings.length === 0
      ? ["- No metadata regressions detected on the audited representative pages."]
      : summary.findings.map((finding) => {
          const routes = finding.details.map((detail) => `\`${detail.route}\``).join(", ");
          return `- ${finding.severity}: ${finding.title} (${finding.evidence})\n  Affected routes: ${routes}`;
        });

  const previewStructuredData = summary.observations.previewStructuredDataTypes.length
    ? summary.observations.previewStructuredDataTypes.join(", ")
    : "none detected";
  const productionStructuredData =
    summary.observations.productionStructuredDataTypes.length
      ? summary.observations.productionStructuredDataTypes.join(", ")
      : "none detected";

  return `# Chapter 7 Summary

Generated: ${summary.generatedAt}

Preview base: \`${summary.previewBaseUrl}\`
Production base: \`${summary.productionBaseUrl}\`

## Findings

${findingLines.join("\n")}

## Check Summary

| Check | Preview | Production |
| --- | --- | --- |
${summary.checks
  .map((check) => `| ${check.name} | ${check.preview} | ${check.production} |`)
  .join("\n")}

## Structured Data Observations

- Preview JSON-LD types: ${previewStructuredData}
- Production JSON-LD types: ${productionStructuredData}
- Preview JSON-LD script count across audited pages: ${summary.observations.previewStructuredDataCount}
- Production JSON-LD script count across audited pages: ${summary.observations.productionStructuredDataCount}
`;
}

async function writeJson(filename, data) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, filename),
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );
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

function extractHead(html) {
  return html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
}

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(
    /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g
  )) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function extractMetadata(head, finalUrl) {
  const metaTags = Array.from(head.matchAll(/<meta\b[^>]*>/gi), (match) =>
    parseAttributes(match[0])
  );
  const linkTags = Array.from(head.matchAll(/<link\b[^>]*>/gi), (match) =>
    parseAttributes(match[0])
  );

  const findMeta = (key, value) =>
    normalizeTextValue(
      metaTags.find((tag) => tag[key]?.toLowerCase() === value.toLowerCase())
        ?.content ?? null
    );
  const canonicalTag = linkTags.find((tag) =>
    (tag.rel ?? "")
      .toLowerCase()
      .split(/\s+/)
      .includes("canonical")
  );

  const ogVideoValue =
    findMeta("property", "og:video:secure_url") ??
    findMeta("property", "og:video:url") ??
    findMeta("property", "og:video");

  return {
    title: normalizeTextValue(
      head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null
    ),
    description: findMeta("name", "description"),
    canonical: resolveUrl(canonicalTag?.href ?? null, finalUrl),
    ogUrl: resolveUrl(findMeta("property", "og:url"), finalUrl),
    ogType: findMeta("property", "og:type"),
    ogImage: resolveUrl(findMeta("property", "og:image"), finalUrl),
    twitterCard: findMeta("name", "twitter:card"),
    twitterImage: resolveUrl(findMeta("name", "twitter:image"), finalUrl),
    ogVideo: resolveUrl(ogVideoValue, finalUrl),
  };
}

function parseStructuredData(head) {
  const scripts = Array.from(
    head.matchAll(
      /<script\b[^>]*type=("|')application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi
    ),
    (match) => match[2]
  );

  const types = [];
  const parseErrors = [];
  for (const [index, script] of scripts.entries()) {
    const parsed = safeJsonParse(script);
    if (parsed.ok) {
      collectTypes(parsed.value, types);
    } else {
      parseErrors.push({ index, error: parsed.error });
    }
  }

  return {
    count: scripts.length,
    types: unique(types).sort(),
    parseErrors,
  };
}

function collectTypes(value, collector) {
  if (Array.isArray(value)) {
    for (const item of value) collectTypes(item, collector);
    return;
  }
  if (!value || typeof value !== "object") return;

  const typeValue = value["@type"];
  if (Array.isArray(typeValue)) {
    for (const entry of typeValue) {
      const normalized = normalizeTextValue(entry);
      if (normalized) collector.push(normalized);
    }
  } else {
    const normalized = normalizeTextValue(typeValue);
    if (normalized) collector.push(normalized);
  }

  if (Array.isArray(value["@graph"])) {
    for (const entry of value["@graph"]) collectTypes(entry, collector);
  }
}

async function inspectAssets(metadata) {
  const ogImage = await inspectAsset(metadata.ogImage, "image");
  const twitterImage =
    metadata.twitterImage && !sameUrl(metadata.twitterImage, metadata.ogImage)
      ? await inspectAsset(metadata.twitterImage, "image")
      : null;
  const ogVideo = metadata.ogVideo
    ? await inspectAsset(metadata.ogVideo, "video")
    : null;

  return { ogImage, twitterImage, ogVideo };
}

async function inspectAsset(url, expectedKind) {
  if (!url) return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return {
      url,
      ok: false,
      status: null,
      finalUrl: null,
      contentType: null,
      error: "invalid-url",
    };
  }

  let response = await fetchAsset(parsed.toString(), "HEAD");
  if (!response.ok && [400, 403, 405, 501].includes(response.status ?? 0)) {
    response = await fetchAsset(parsed.toString(), "GET");
  }

  const contentType = response.headers["content-type"] ?? null;
  const kindMatches =
    expectedKind === "image"
      ? contentType?.startsWith("image/") ?? false
      : contentType?.startsWith("video/") ?? false;

  return {
    url,
    ok: response.ok && kindMatches,
    status: response.status,
    finalUrl: response.finalUrl,
    contentType,
    method: response.method,
    error: response.error ?? null,
  };
}

async function fetchAsset(url, method) {
  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      headers: {
        "user-agent": "Langfuse-Metadata-Review/1.0",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (method === "GET") {
      await response.arrayBuffer();
    }

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      headers: Object.fromEntries(response.headers.entries()),
      method,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      finalUrl: null,
      headers: {},
      method,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Langfuse-Metadata-Review/1.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    finalUrl: response.url,
    headers: Object.fromEntries(response.headers.entries()),
    text,
  };
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

function resolveUrl(value, base) {
  const normalized = normalizeTextValue(value);
  if (!normalized) return null;
  try {
    return new URL(normalized, base).toString();
  } catch {
    return null;
  }
}

function resolveSourceField(value, route) {
  const normalized = normalizeTextValue(value);
  if (!normalized) return null;
  return resolveUrl(normalized, `https://langfuse.com${route}`);
}

function normalizeTextValue(value) {
  if (value == null) return null;
  const decoded = decodeEntities(String(value))
    .replace(/\s+/g, " ")
    .trim();
  return decoded.length > 0 ? decoded : null;
}

function sameText(left, right) {
  return normalizeTextValue(left) === normalizeTextValue(right);
}

function sameUrl(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  try {
    return normalizeComparableUrl(left) === normalizeComparableUrl(right);
  } catch {
    return false;
  }
}

function sameStringArray(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function metadataLeaksPreviewDomain(metadata) {
  return [metadata.canonical, metadata.ogUrl, metadata.ogImage, metadata.twitterImage, metadata.ogVideo]
    .filter(Boolean)
    .some((value) => {
      try {
        return new URL(value).host === PREVIEW_HOST;
      } catch {
        return String(value).includes(PREVIEW_HOST);
      }
    });
}

function ogUrlMatchesCanonicalOrPage(page) {
  const target = page.metadata.canonical ?? page.finalUrl;
  if (!page.metadata.ogUrl || !target) return false;
  return sameUrl(page.metadata.ogUrl, target);
}

function summarizeAssetState(assets) {
  return {
    ogImageOk: assets.ogImage?.ok ?? null,
    twitterImageOk: assets.twitterImage?.ok ?? null,
    ogVideoOk: assets.ogVideo?.ok ?? null,
  };
}

function hasBrokenAsset(assets) {
  return Object.values(assets).some((asset) => asset && asset.ok === false);
}

function pluckPageFields(pages, key) {
  return Object.fromEntries(
    Object.entries(pages).map(([pageId, page]) => [pageId, page[key]])
  );
}

function hasAny(values, predicate) {
  return values.some(predicate);
}

function unique(values) {
  return Array.from(new Set(values));
}

function decodeEntities(value) {
  if (value == null) return value;
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function safeJsonParse(value) {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readOptionalText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

await main();
