#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_BASE_URL =
  "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app";
const DEFAULT_PRODUCTION_URL = "https://langfuse.com";
const DEFAULT_OUTPUT =
  "review/7-metadata-structured-data-and-social-sharing/artifacts/preview-metadata-report.json";
const DEFAULT_SUMMARY_OUTPUT =
  "review/7-metadata-structured-data-and-social-sharing/artifacts/preview-metadata-summary.md";

const SAMPLES = [
  {
    name: "Docs overview metadata",
    path: "/docs/observability/overview",
    expected: {
      title: "LLM Observability & Application Tracing (Open Source) - Langfuse",
      description:
        "Open source application tracing and observability for LLM apps. Capture traces, monitor latency, track costs, and debug issues across OpenAI, LangChain, LlamaIndex, and more.",
      canonical: "https://langfuse.com/docs/observability/overview",
      ogImage: {
        kind: "dynamic",
        title: "LLM Observability & Application Tracing (Open Source)",
        description:
          "Open source application tracing and observability for LLM apps. Capture traces, monitor latency, track costs, and debug issues across OpenAI, LangChain, LlamaIndex, and more.",
        section: "Docs",
      },
    },
  },
  {
    name: "FAQ detail metadata",
    path: "/faq/all/unwanted-http-database-spans",
    expected: {
      title:
        "Why do I see HTTP requests or database queries in my Langfuse traces? - Langfuse",
      description:
        "If your Langfuse dashboard shows spans like HTTP GET, SQL queries, or health checks alongside your LLM calls, here's why it happens and how to fix it.",
      canonical:
        "https://langfuse.com/faq/all/unwanted-http-database-spans",
      ogImage: {
        kind: "dynamic",
        title:
          "Why do I see HTTP requests or database queries in my Langfuse traces?",
        description:
          "If your Langfuse dashboard shows spans like HTTP GET, SQL queries, or health checks alongside your LLM calls, here's why it happens and how to fix it.",
        section: "FAQ",
      },
    },
  },
  {
    name: "Blog post with static OG image",
    path: "/blog/2026-02-26-evaluate-ai-agent-skills",
    expected: {
      title: "Evaluating AI Agent Skills - Langfuse",
      description:
        "How we used Langfuse datasets, tracing, and the cloud agent SDK to iteratively evaluate and improve our AI agent skill.",
      canonical:
        "https://langfuse.com/blog/2026-02-26-evaluate-ai-agent-skills",
      ogImage: {
        kind: "static",
        url: "https://langfuse.com/images/blog/2026-02-26-evaluate-ai-agent-skills/og.jpg",
      },
    },
  },
  {
    name: "Guide video page with static OG image",
    path: "/guides/videos/introducing-datasets-v2",
    expected: {
      title: "Introducing Datasets v2 - Langfuse",
      description:
        "Overview of the dataset-related changes released during Launch Week",
      canonical: "https://langfuse.com/guides/videos/introducing-datasets-v2",
      ogImage: {
        kind: "static",
        url: "https://langfuse.com/images/videos/introducing-datasets-v2.jpg",
      },
    },
  },
  {
    name: "Changelog page with canonical override and og:video",
    path: "/changelog/2025-01-22-track-changes-between-prompt-versions",
    expected: {
      title: "Track changes between prompt versions - Langfuse",
      description:
        "See a detailed comparison of changes between prompt versions. Optionally, you can also review changes before creating a new prompt version.",
      canonical:
        "https://langfuse.com/docs/prompt-management/features/prompt-version-control",
      ogImage: {
        kind: "dynamic",
        title: "Track changes between prompt versions",
        description:
          "See a detailed comparison of changes between prompt versions. Optionally, you can also review changes before creating a new prompt version.",
        section: "Changelog",
      },
      ogVideo: "https://static.langfuse.com/docs-videos/prompt-diff.mp4",
    },
  },
  {
    name: "Changelog page with canonical override and static OG image",
    path: "/changelog/2025-05-21-custom-dashboards",
    expected: {
      title: "Custom Dashboards - Langfuse",
      description:
        "Create your own custom dashboards or use Langfuse-curated dashboards to analyze and understand your AI application deeply.",
      canonical:
        "https://langfuse.com/docs/metrics/features/custom-dashboards",
      ogImage: {
        kind: "static",
        url: "https://langfuse.com/images/changelog/2025-05-21-custom-dashboards/custom-dashboard.png",
      },
    },
  },
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function headerMap(headers) {
  return Object.fromEntries(headers.entries());
}

function decodeHtmlEntities(value) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity) => {
    const named = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
      nbsp: " ",
    };

    if (entity in named) {
      return named[entity];
    }

    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }

    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }

    return `&${entity};`;
  });
}

function parseAttributes(tag) {
  const attributes = {};
  const attributePattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match = null;
  let seenTagName = false;
  while ((match = attributePattern.exec(tag))) {
    if (!seenTagName) {
      seenTagName = true;
      continue;
    }

    const key = match[1].toLowerCase();
    const rawValue = match[2] ?? match[3] ?? match[4] ?? "";
    attributes[key] = decodeHtmlEntities(rawValue);
  }

  return attributes;
}

function extractHead(html) {
  const lower = html.toLowerCase();
  const headStart = lower.indexOf("<head");
  if (headStart === -1) return "";

  const headOpenEnd = html.indexOf(">", headStart);
  if (headOpenEnd === -1) return "";

  const headEnd = lower.indexOf("</head>", headOpenEnd + 1);
  if (headEnd === -1) return html.slice(headOpenEnd + 1);

  return html.slice(headOpenEnd + 1, headEnd);
}

function extractTitle(head) {
  const match = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function collectTags(source, tagName) {
  return [...source.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map(
    (match) => match[0]
  );
}

function collectMeta(head) {
  const meta = {};

  for (const tag of collectTags(head, "meta")) {
    const attributes = parseAttributes(tag);
    const key = (attributes.name ?? attributes.property ?? "").toLowerCase();
    if (!key || !("content" in attributes)) continue;
    meta[key] = attributes.content;
  }

  return meta;
}

function extractCanonical(head) {
  for (const tag of collectTags(head, "link")) {
    const attributes = parseAttributes(tag);
    const rel = attributes.rel ?? "";
    if (
      rel
        .split(/\s+/)
        .map((value) => value.toLowerCase())
        .includes("canonical")
    ) {
      return attributes.href ?? null;
    }
  }

  return null;
}

function collectJsonLdScripts(html) {
  const scripts = [];
  const pattern =
    /<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi;

  let match = null;
  while ((match = pattern.exec(html))) {
    const raw = match[1].trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      scripts.push({ raw, parsed, error: null });
    } catch (error) {
      scripts.push({
        raw,
        parsed: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return scripts;
}

function collectJsonLdTypes(value, bucket = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdTypes(item, bucket);
    }
    return bucket;
  }

  if (value && typeof value === "object") {
    if ("@type" in value) {
      const typeValue = value["@type"];
      if (Array.isArray(typeValue)) {
        for (const entry of typeValue) {
          if (typeof entry === "string") bucket.add(entry);
        }
      } else if (typeof typeValue === "string") {
        bucket.add(typeValue);
      }
    }

    for (const entry of Object.values(value)) {
      collectJsonLdTypes(entry, bucket);
    }
  }

  return bucket;
}

function collectBlockedStringHits(value, blockedTokens, hits = []) {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    for (const token of blockedTokens) {
      if (lower.includes(token.toLowerCase())) {
        hits.push(value);
        break;
      }
    }
    return hits;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectBlockedStringHits(entry, blockedTokens, hits);
    }
    return hits;
  }

  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      collectBlockedStringHits(entry, blockedTokens, hits);
    }
  }

  return hits;
}

function inspectHtmlPage(response) {
  const head = extractHead(response.text);
  const meta = collectMeta(head);
  const scripts = collectJsonLdScripts(response.text);
  const jsonLdTypes = [
    ...new Set(
      scripts
        .filter((script) => script.parsed !== null)
        .flatMap((script) => [...collectJsonLdTypes(script.parsed)])
    ),
  ].sort();

  return {
    requestedUrl: response.requestedUrl,
    finalUrl: response.finalUrl,
    status: response.status,
    ok: response.ok,
    title: extractTitle(head),
    canonical: extractCanonical(head),
    meta,
    jsonLd: {
      count: scripts.length,
      types: jsonLdTypes,
      parseErrors: scripts
        .filter((script) => script.error)
        .map((script) => script.error),
      scripts,
    },
  };
}

function summarizePage(page) {
  return {
    status: page.status,
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    title: page.title,
    description: page.meta.description ?? null,
    canonical: page.canonical,
    ogTitle: page.meta["og:title"] ?? null,
    ogDescription: page.meta["og:description"] ?? null,
    ogUrl: page.meta["og:url"] ?? null,
    ogImage: page.meta["og:image"] ?? null,
    ogVideo: page.meta["og:video"] ?? null,
    twitterCard: page.meta["twitter:card"] ?? null,
    twitterTitle: page.meta["twitter:title"] ?? null,
    twitterDescription: page.meta["twitter:description"] ?? null,
    twitterImage: page.meta["twitter:image"] ?? null,
    jsonLdCount: page.jsonLd.count,
    jsonLdTypes: page.jsonLd.types,
  };
}

function compareArrays(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function diffPreviewAgainstProduction(preview, production) {
  const fields = [
    ["title", preview.title, production.title],
    ["description", preview.meta.description ?? null, production.meta.description ?? null],
    ["canonical", preview.canonical, production.canonical],
    ["og:url", preview.meta["og:url"] ?? null, production.meta["og:url"] ?? null],
    ["og:image", preview.meta["og:image"] ?? null, production.meta["og:image"] ?? null],
    ["og:video", preview.meta["og:video"] ?? null, production.meta["og:video"] ?? null],
    ["twitter:image", preview.meta["twitter:image"] ?? null, production.meta["twitter:image"] ?? null],
  ];

  const diffs = [];
  for (const [field, previewValue, productionValue] of fields) {
    if (previewValue !== productionValue) {
      diffs.push({ field, preview: previewValue, production: productionValue });
    }
  }

  if (!compareArrays(preview.jsonLd.types, production.jsonLd.types)) {
    diffs.push({
      field: "jsonLdTypes",
      preview: preview.jsonLd.types,
      production: production.jsonLd.types,
    });
  }

  return diffs;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
    headers: {
      "user-agent": "chapter-7-metadata-review/0.1",
    },
  });
  const text = await response.text();

  return {
    requestedUrl: url,
    finalUrl: response.url,
    status: response.status,
    ok: response.ok,
    headers: headerMap(response.headers),
    text,
  };
}

async function inspectAsset(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
    headers: {
      "user-agent": "chapter-7-metadata-review/0.1",
    },
  });

  await response.body?.cancel().catch(() => {});

  return {
    requestedUrl: url,
    finalUrl: response.url,
    status: response.status,
    ok: response.ok,
    headers: headerMap(response.headers),
  };
}

function assert(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function runCheck(name, fn) {
  const startedAt = new Date().toISOString();
  try {
    const details = await fn();
    return {
      name,
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      details,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      details:
        error && typeof error === "object" && "details" in error
          ? error.details
          : {},
    };
  }
}

function validateExpectedOgImage(sample, ogImageUrl) {
  assert(ogImageUrl, "Missing og:image", { path: sample.path });

  if (sample.expected.ogImage.kind === "static") {
    assert(
      ogImageUrl === sample.expected.ogImage.url,
      "Static og:image did not match the expected override",
      {
        path: sample.path,
        expected: sample.expected.ogImage.url,
        actual: ogImageUrl,
      }
    );
    return;
  }

  const parsed = new URL(ogImageUrl);
  assert(
    parsed.origin === "https://langfuse.com",
    "Dynamic og:image should use the production host",
    { path: sample.path, ogImageUrl }
  );
  assert(parsed.pathname === "/api/og", "Dynamic og:image should point to /api/og", {
    path: sample.path,
    ogImageUrl,
  });
  assert(
    parsed.searchParams.get("title") === sample.expected.ogImage.title,
    "Dynamic og:image title parameter did not match",
    {
      path: sample.path,
      expected: sample.expected.ogImage.title,
      actual: parsed.searchParams.get("title"),
    }
  );
  assert(
    parsed.searchParams.get("description") === sample.expected.ogImage.description,
    "Dynamic og:image description parameter did not match",
    {
      path: sample.path,
      expected: sample.expected.ogImage.description,
      actual: parsed.searchParams.get("description"),
    }
  );
  assert(
    parsed.searchParams.get("section") === sample.expected.ogImage.section,
    "Dynamic og:image section parameter did not match",
    {
      path: sample.path,
      expected: sample.expected.ogImage.section,
      actual: parsed.searchParams.get("section"),
    }
  );
}

async function getCachedAsset(assetCache, url) {
  if (!assetCache.has(url)) {
    assetCache.set(url, inspectAsset(url));
  }

  return assetCache.get(url);
}

async function auditSample(sample, baseUrl, productionUrl, blockedTokens, assetCache) {
  const previewResponse = await fetchText(`${baseUrl}${sample.path}`);
  const productionResponse = await fetchText(`${productionUrl}${sample.path}`);

  const preview = inspectHtmlPage(previewResponse);
  const production = inspectHtmlPage(productionResponse);

  assert(preview.status === 200, "Preview page did not return 200", {
    path: sample.path,
    status: preview.status,
    finalUrl: preview.finalUrl,
  });

  assert(preview.title === sample.expected.title, "Title did not match expectation", {
    path: sample.path,
    expected: sample.expected.title,
    actual: preview.title,
  });

  assert(
    preview.meta.description === sample.expected.description,
    "Meta description did not match expectation",
    {
      path: sample.path,
      expected: sample.expected.description,
      actual: preview.meta.description ?? null,
    }
  );

  assert(
    preview.canonical === sample.expected.canonical,
    "Canonical URL did not match expectation",
    {
      path: sample.path,
      expected: sample.expected.canonical,
      actual: preview.canonical,
    }
  );

  assert(preview.meta["og:title"] === sample.expected.title, "og:title mismatch", {
    path: sample.path,
    expected: sample.expected.title,
    actual: preview.meta["og:title"] ?? null,
  });

  assert(
    preview.meta["og:description"] === sample.expected.description,
    "og:description mismatch",
    {
      path: sample.path,
      expected: sample.expected.description,
      actual: preview.meta["og:description"] ?? null,
    }
  );

  assert(preview.meta["og:url"] === preview.canonical, "og:url did not match canonical", {
    path: sample.path,
    canonical: preview.canonical,
    ogUrl: preview.meta["og:url"] ?? null,
  });

  assert(
    preview.meta["twitter:card"] === "summary_large_image",
    "twitter:card was not summary_large_image",
    {
      path: sample.path,
      actual: preview.meta["twitter:card"] ?? null,
    }
  );

  assert(
    preview.meta["twitter:title"] === sample.expected.title,
    "twitter:title mismatch",
    {
      path: sample.path,
      expected: sample.expected.title,
      actual: preview.meta["twitter:title"] ?? null,
    }
  );

  assert(
    preview.meta["twitter:description"] === sample.expected.description,
    "twitter:description mismatch",
    {
      path: sample.path,
      expected: sample.expected.description,
      actual: preview.meta["twitter:description"] ?? null,
    }
  );

  assert(
    preview.meta["twitter:image"] === preview.meta["og:image"],
    "twitter:image did not match og:image",
    {
      path: sample.path,
      twitterImage: preview.meta["twitter:image"] ?? null,
      ogImage: preview.meta["og:image"] ?? null,
    }
  );

  const blockedMetadataHits = collectBlockedStringHits(
    {
      title: preview.title,
      canonical: preview.canonical,
      meta: preview.meta,
    },
    blockedTokens
  );
  assert(
    blockedMetadataHits.length === 0,
    "Preview metadata referenced a preview or local hostname",
    {
      path: sample.path,
      hits: [...new Set(blockedMetadataHits)].sort(),
    }
  );

  validateExpectedOgImage(sample, preview.meta["og:image"] ?? null);

  const ogAsset = await getCachedAsset(assetCache, preview.meta["og:image"]);
  assert(ogAsset.status === 200, "og:image asset did not return 200", {
    path: sample.path,
    url: preview.meta["og:image"],
    status: ogAsset.status,
    finalUrl: ogAsset.finalUrl,
  });
  assert(
    (ogAsset.headers["content-type"] ?? "").startsWith("image/"),
    "og:image asset did not return an image content type",
    {
      path: sample.path,
      url: preview.meta["og:image"],
      contentType: ogAsset.headers["content-type"] ?? null,
    }
  );

  let ogVideoAsset = null;
  if (sample.expected.ogVideo) {
    assert(
      preview.meta["og:video"] === sample.expected.ogVideo,
      "og:video did not match expectation",
      {
        path: sample.path,
        expected: sample.expected.ogVideo,
        actual: preview.meta["og:video"] ?? null,
      }
    );

    ogVideoAsset = await getCachedAsset(assetCache, preview.meta["og:video"]);
    assert(ogVideoAsset.status === 200, "og:video asset did not return 200", {
      path: sample.path,
      url: preview.meta["og:video"],
      status: ogVideoAsset.status,
      finalUrl: ogVideoAsset.finalUrl,
    });
    assert(
      (ogVideoAsset.headers["content-type"] ?? "").startsWith("video/"),
      "og:video asset did not return a video content type",
      {
        path: sample.path,
        url: preview.meta["og:video"],
        contentType: ogVideoAsset.headers["content-type"] ?? null,
      }
    );
  } else {
    assert(!preview.meta["og:video"], "Unexpected og:video was emitted", {
      path: sample.path,
      actual: preview.meta["og:video"],
    });
  }

  assert(
    preview.jsonLd.parseErrors.length === 0,
    "JSON-LD parse failures were found on the preview page",
    {
      path: sample.path,
      parseErrors: preview.jsonLd.parseErrors,
    }
  );

  const productionTypes = production.jsonLd.types;
  if (productionTypes.length > 0) {
    const missingTypes = productionTypes.filter(
      (type) => !preview.jsonLd.types.includes(type)
    );
    assert(
      missingTypes.length === 0,
      "Preview JSON-LD dropped schema types present in production",
      {
        path: sample.path,
        productionTypes,
        previewTypes: preview.jsonLd.types,
        missingTypes,
      }
    );
  }

  const blockedJsonLdHits = preview.jsonLd.scripts.flatMap((script) =>
    script.parsed ? collectBlockedStringHits(script.parsed, blockedTokens) : []
  );
  assert(
    blockedJsonLdHits.length === 0,
    "Preview JSON-LD referenced a preview or local hostname",
    {
      path: sample.path,
      hits: [...new Set(blockedJsonLdHits)].sort(),
    }
  );

  return {
    sample: sample.name,
    path: sample.path,
    preview: summarizePage(preview),
    production: summarizePage(production),
    ogImageAsset: {
      requestedUrl: ogAsset.requestedUrl,
      finalUrl: ogAsset.finalUrl,
      status: ogAsset.status,
      contentType: ogAsset.headers["content-type"] ?? null,
    },
    ogVideoAsset: ogVideoAsset
      ? {
          requestedUrl: ogVideoAsset.requestedUrl,
          finalUrl: ogVideoAsset.finalUrl,
          status: ogVideoAsset.status,
          contentType: ogVideoAsset.headers["content-type"] ?? null,
        }
      : null,
    productionDiffs: diffPreviewAgainstProduction(preview, production),
  };
}

function buildSummaryMarkdown(report) {
  const lines = [
    "# Chapter 7 Execution Summary",
    "",
    `- Run at: ${report.generatedAt}`,
    `- Preview URL: ${report.baseUrl}`,
    `- Production URL: ${report.productionUrl}`,
    `- Pages checked: ${report.summary.total}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    "",
    "## Results",
    "",
    "| Sample | Status | Canonical | OG image | OG video | JSON-LD types | Production diffs |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const check of report.checks) {
    if (!check.ok) {
      lines.push(`| ${check.name} | FAIL |  |  |  |  | ${check.error} |`);
      continue;
    }

    const details = check.details;
    const diffCount = details.productionDiffs.length;
    lines.push(
      `| ${details.sample} | PASS | ${details.preview.canonical} | ${details.preview.ogImage} | ${
        details.preview.ogVideo ?? ""
      } | ${
        details.preview.jsonLdTypes.length > 0
          ? details.preview.jsonLdTypes.join(", ")
          : "none"
      } | ${diffCount} |`
    );
  }

  const failedChecks = report.checks.filter((check) => !check.ok);
  if (failedChecks.length > 0) {
    lines.push("", "## Failures", "");
    for (const check of failedChecks) {
      lines.push(`- ${check.name}: ${check.error}`);
    }
  }

  lines.push(
    "",
    "Detailed evidence is stored in `preview-metadata-report.json`.",
    ""
  );

  return `${lines.join("\n")}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args["base-url"] ?? DEFAULT_BASE_URL);
  const productionUrl = normalizeBaseUrl(
    args["production-url"] ?? DEFAULT_PRODUCTION_URL
  );
  const outputPath = resolve(args.output ?? DEFAULT_OUTPUT);
  const summaryPath = resolve(args.summary ?? DEFAULT_SUMMARY_OUTPUT);
  const blockedTokens = [
    new URL(baseUrl).host,
    "vercel.app",
    "localhost",
    "127.0.0.1",
  ];

  const assetCache = new Map();
  const checks = [];

  for (const sample of SAMPLES) {
    checks.push(
      await runCheck(sample.name, async () =>
        auditSample(sample, baseUrl, productionUrl, blockedTokens, assetCache)
      )
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    productionUrl,
    summary: {
      total: checks.length,
      passed: checks.filter((check) => check.ok).length,
      failed: checks.filter((check) => !check.ok).length,
    },
    checks,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(summaryPath), { recursive: true });
  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`),
    writeFile(summaryPath, buildSummaryMarkdown(report)),
  ]);

  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

await main();
