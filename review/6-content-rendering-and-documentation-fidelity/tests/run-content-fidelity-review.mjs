import fs from "node:fs/promises";
import path from "node:path";

import puppeteer from "puppeteer";

const BASE_URL = normalizeBaseUrl(
  process.env.BASE_URL ||
    "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app"
);
const OUTPUT_DIR = path.resolve(
  process.cwd(),
  process.env.OUTPUT_DIR ||
    "review/6-content-rendering-and-documentation-fidelity/evidence"
);
const HEADLESS = process.env.HEADLESS !== "false";

const ALLOWED_REMOTE_MEDIA_HOSTS = new Set([
  "static.langfuse.com",
  "www.youtube-nocookie.com",
]);

const IGNORED_PAGE_ERROR_PATTERNS = [
  /Looks like your website URL has changed/i,
];

const PAGE_SAMPLES = [
  {
    id: "docs-prompt-management-get-started",
    contentType: "docs",
    label: "Docs: Prompt Management Get Started",
    path: "/docs/prompt-management/get-started",
    sourceFile: "content/docs/prompt-management/get-started.mdx",
    checks: {
      enforceHeadingOrder: true,
      minTabs: 1,
      minCodeBlocks: 1,
      minCopyButtons: 2,
    },
  },
  {
    id: "docs-observability-data-model",
    contentType: "docs",
    label: "Docs: Observability Data Model",
    path: "/docs/observability/data-model",
    sourceFile: "content/docs/observability/data-model.mdx",
    checks: {
      enforceHeadingOrder: true,
      minTables: 1,
      minMermaidSvgs: 1,
    },
  },
  {
    id: "changelog-custom-dashboards",
    contentType: "changelog",
    label: "Changelog: Custom Dashboards",
    path: "/changelog/2025-05-21-custom-dashboards",
    sourceFile: "content/changelog/2025-05-21-custom-dashboards.mdx",
    checks: {
      minTabs: 1,
      minIframes: 1,
      enforceAllowedRemoteMediaHosts: true,
    },
  },
  {
    id: "blog-evaluate-ai-agent-skills",
    contentType: "blog",
    label: "Blog: Evaluating AI Agent Skills",
    path: "/blog/2026-02-26-evaluate-ai-agent-skills",
    sourceFile: "content/blog/2026-02-26-evaluate-ai-agent-skills.mdx",
    checks: {
      enforceHeadingOrder: true,
      minCodeBlocks: 2,
      minTables: 1,
      minCopyButtons: 2,
      requiredTextSnippets: ["agent-sandbox-repos"],
    },
  },
  {
    id: "faq-unwanted-http-database-spans",
    contentType: "faq",
    label: "FAQ: Unwanted HTTP/Database Spans",
    path: "/faq/all/unwanted-http-database-spans",
    sourceFile: "content/faq/all/unwanted-http-database-spans.mdx",
    checks: {
      enforceHeadingOrder: true,
      minTabs: 1,
      minCodeBlocks: 1,
      minCopyButtons: 2,
      requiredTextSnippets: ["blocked_instrumentation_scopes"],
    },
  },
  {
    id: "guides-video-introducing-datasets-v2",
    contentType: "guides",
    label: "Guides: Introducing Datasets v2",
    path: "/guides/videos/introducing-datasets-v2",
    sourceFile: "content/guides/videos/introducing-datasets-v2.mdx",
    checks: {
      minVideos: 1,
      enforceAllowedRemoteMediaHosts: true,
    },
  },
  {
    id: "cookbook-simulated-multi-turn-conversations",
    contentType: "cookbook",
    label: "Cookbook: Simulated Multi-Turn Conversations",
    path: "/guides/cookbook/example_simulated_multi_turn_conversations",
    sourceFile:
      "content/guides/cookbook/example_simulated_multi_turn_conversations.mdx",
    checks: {
      enforceHeadingOrder: true,
      minCodeBlocks: 3,
      minIframes: 1,
      minCopyButtons: 2,
      enforceAllowedRemoteMediaHosts: true,
    },
  },
  {
    id: "integrations-goose",
    contentType: "integrations",
    label: "Integrations: Goose",
    path: "/integrations/no-code/goose",
    sourceFile: "content/integrations/no-code/goose.mdx",
    checks: {
      enforceHeadingOrder: true,
      minCodeBlocks: 1,
      minVideos: 1,
      minIframes: 1,
      enforceAllowedRemoteMediaHosts: true,
    },
  },
  {
    id: "self-hosting-docker-compose",
    contentType: "self-hosting",
    label: "Self-Hosting: Docker Compose",
    path: "/self-hosting/deployment/docker-compose",
    sourceFile: "content/self-hosting/deployment/docker-compose.mdx",
    checks: {
      enforceHeadingOrder: true,
      minTabs: 1,
      minCodeBlocks: 1,
      minIframes: 1,
      minCopyButtons: 2,
      enforceAllowedRemoteMediaHosts: true,
    },
  },
];

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    defaultViewport: { width: 1440, height: 1200 },
  });

  try {
    const samples = [];
    for (const sample of PAGE_SAMPLES) {
      samples.push(await inspectSample(browser, sample));
    }

    const summary = buildSummary(samples);

    await Promise.all([
      writeJson("page-rendering.json", {
        generatedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        samples,
      }),
      writeJson("summary.json", summary),
      fs.writeFile(
        path.join(OUTPUT_DIR, "summary.md"),
        buildSummaryMarkdown(summary, samples),
        "utf8"
      ),
    ]);

    if (summary.failedAssertions > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

async function inspectSample(browser, sample) {
  const page = await browser.newPage();
  const pageErrors = [];
  const requestFailures = [];
  const consoleErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });
  page.on("requestfailed", (request) => {
    requestFailures.push({
      url: request.url(),
      method: request.method(),
      errorText: request.failure()?.errorText ?? null,
      resourceType: request.resourceType(),
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  const response = await page.goto(`${BASE_URL}${sample.path}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForSelector("h1", { timeout: 120000 });
  await waitForImages(page);
  await delay(500);

  const dom = await page.evaluate(() => {
    const article = document.querySelector("article");
    const root = article ?? document.querySelector("main") ?? document.body;
    const textContent = normalizeWhitespace(root.textContent ?? "");

    const headings = [...root.querySelectorAll("h1, h2, h3, h4, h5, h6")].map(
      (element) => ({
        tag: element.tagName,
        level: Number(element.tagName.slice(1)),
        id: element.id || null,
        text: normalizeWhitespace(element.textContent ?? ""),
      })
    );

    const mediaItems = [
      ...root.querySelectorAll("img, video, iframe, source"),
    ].map((element) => {
      const tag = element.tagName.toLowerCase();
      const currentSrc =
        "currentSrc" in element && typeof element.currentSrc === "string"
          ? element.currentSrc
          : null;
      const src = currentSrc || element.getAttribute("src") || null;
      const queryUrl =
        tag === "img" && src
          ? new URL(src, window.location.href).searchParams.get("url")
          : null;
      return {
        tag,
        src,
        resolvedMediaUrl: queryUrl || src,
      };
    });

    const imageStates = [...root.querySelectorAll("img")].map((image) => ({
      src: image.currentSrc || image.getAttribute("src") || null,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    }));

    const copyButtons = [...root.querySelectorAll("button")]
      .map((button) => ({
        label: normalizeWhitespace(
          button.getAttribute("aria-label") || button.textContent || ""
        ),
      }))
      .filter((button) => /copy/i.test(button.label));

    return {
      title: document.title,
      articleTag: article?.tagName ?? null,
      textLength: textContent.length,
      textSample: textContent.slice(0, 200),
      h1Count: root.querySelectorAll("h1").length,
      headings,
      metrics: {
        tabs: root.querySelectorAll('[role="tab"]').length,
        tablists: root.querySelectorAll('[role="tablist"]').length,
        codeBlocks: root.querySelectorAll("pre").length,
        highlightedCodeBlocks: [...root.querySelectorAll("pre code")].filter(
          (code) =>
            /language-|hljs|shiki/i.test(code.className) ||
            code.querySelector("span") !== null
        ).length,
        tables: root.querySelectorAll("table").length,
        details: root.querySelectorAll("details").length,
        videos: root.querySelectorAll("video").length,
        iframes: root.querySelectorAll("iframe").length,
        images: root.querySelectorAll("img").length,
        mermaidSvgs: root.querySelectorAll(
          'svg[id^="mermaid-"], .mermaid svg, [id^="mermaid-"]'
        ).length,
      },
      copyButtons,
      textContent,
      mediaItems,
      imageStates,
    };

    function normalizeWhitespace(value) {
      return value.replace(/\s+/g, " ").trim();
    }
  });

  const relevantPageErrors = pageErrors.filter(
    (error) => !IGNORED_PAGE_ERROR_PATTERNS.some((pattern) => pattern.test(error))
  );
  const relevantRequestFailures = requestFailures.filter(
    (failure) => !shouldIgnoreRequestFailure(failure)
  );
  const assertions = buildAssertions(
    sample,
    response,
    dom,
    relevantPageErrors,
    relevantRequestFailures
  );
  await page.close();

  return {
    id: sample.id,
    label: sample.label,
    contentType: sample.contentType,
    path: sample.path,
    sourceFile: sample.sourceFile,
    url: `${BASE_URL}${sample.path}`,
    response: {
      status: response?.status() ?? null,
      ok: response?.ok() ?? false,
    },
    dom,
    pageErrors: relevantPageErrors,
    consoleErrors,
    requestFailures: relevantRequestFailures,
    assertions,
    failedAssertions: assertions.filter((assertion) => !assertion.pass),
  };
}

function buildAssertions(sample, response, dom, pageErrors, requestFailures) {
  const assertions = [];

  pushAssertion(
    assertions,
    "Page returns HTTP 200",
    response?.status() === 200,
    { status: response?.status() ?? null }
  );
  pushAssertion(
    assertions,
    "Rendered page is not a 404 shell",
    dom.h1Count > 0 && !/^404\b/i.test(dom.headings[0]?.text ?? ""),
    { firstHeading: dom.headings[0]?.text ?? null }
  );
  pushAssertion(
    assertions,
    "Page uses exactly one H1",
    dom.h1Count === 1,
    { h1Count: dom.h1Count, headings: dom.headings }
  );

  if (sample.checks.enforceHeadingOrder) {
    const headingIssues = findHeadingLevelIssues(dom.headings);
    pushAssertion(
      assertions,
      "Heading levels do not skip within article content",
      headingIssues.length === 0,
      { headingIssues, headings: dom.headings }
    );
  }

  pushMinimumAssertion(assertions, "tabs", dom.metrics.tabs, sample.checks.minTabs);
  pushMinimumAssertion(
    assertions,
    "code blocks",
    dom.metrics.codeBlocks,
    sample.checks.minCodeBlocks
  );
  pushMinimumAssertion(
    assertions,
    "copy buttons",
    dom.copyButtons.length,
    sample.checks.minCopyButtons
  );
  pushMinimumAssertion(
    assertions,
    "tables",
    dom.metrics.tables,
    sample.checks.minTables
  );
  pushMinimumAssertion(
    assertions,
    "videos",
    dom.metrics.videos,
    sample.checks.minVideos
  );
  pushMinimumAssertion(
    assertions,
    "iframes",
    dom.metrics.iframes,
    sample.checks.minIframes
  );
  pushMinimumAssertion(
    assertions,
    "mermaid diagrams",
    dom.metrics.mermaidSvgs,
    sample.checks.minMermaidSvgs
  );

  if (sample.checks.minCodeBlocks != null) {
    pushAssertion(
      assertions,
      "Code blocks include syntax-highlighting markup",
      dom.metrics.highlightedCodeBlocks >= Math.min(sample.checks.minCodeBlocks, 1),
      {
        codeBlocks: dom.metrics.codeBlocks,
        highlightedCodeBlocks: dom.metrics.highlightedCodeBlocks,
      }
    );
  }

  if (sample.checks.requiredTextSnippets?.length) {
    const missingText = sample.checks.requiredTextSnippets.filter(
      (snippet) => !dom.textContent.includes(snippet)
    );
    pushAssertion(
      assertions,
      "Sample-specific text markers survive rendering",
      missingText.length === 0,
      { missingText }
    );
  }

  const brokenImages = dom.imageStates.filter(
    (image) => image.complete && image.naturalWidth === 0
  );
  pushAssertion(assertions, "Images do not report load failures", brokenImages.length === 0, {
    brokenImages,
    imageCount: dom.imageStates.length,
  });

  if (sample.checks.enforceAllowedRemoteMediaHosts) {
    const remoteMedia = dom.mediaItems
      .filter((item) => item.tag === "video" || item.tag === "iframe")
      .map((item) => {
        const host = getRemoteHost(item.resolvedMediaUrl, BASE_URL);
        return host ? { ...item, host } : null;
      })
      .filter(Boolean);
    const disallowedHosts = remoteMedia.filter(
      (item) => !ALLOWED_REMOTE_MEDIA_HOSTS.has(item.host)
    );
    pushAssertion(
      assertions,
      "Remote media uses approved hosts",
      disallowedHosts.length === 0,
      { remoteMedia, disallowedHosts }
    );
  }

  pushAssertion(
    assertions,
    "Page does not throw runtime errors during load",
    pageErrors.length === 0,
    { pageErrors }
  );
  pushAssertion(
    assertions,
    "Page does not fail article-related requests during load",
    requestFailures.length === 0,
    { requestFailures: requestFailures.slice(0, 20) }
  );

  return assertions;
}

function pushMinimumAssertion(assertions, label, actual, minimum) {
  if (minimum == null) return;
  pushAssertion(assertions, `Page exposes at least ${minimum} ${label}`, actual >= minimum, {
    actual,
    minimum,
  });
}

function pushAssertion(assertions, label, pass, details) {
  assertions.push({ label, pass, details });
}

function findHeadingLevelIssues(headings) {
  const relevant = headings.filter((heading) => heading.level >= 1 && heading.level <= 6);
  const issues = [];

  for (let index = 1; index < relevant.length; index += 1) {
    const previous = relevant[index - 1];
    const current = relevant[index];
    if (current.level - previous.level > 1) {
      issues.push({
        previous: {
          level: previous.level,
          text: previous.text,
          id: previous.id,
        },
        current: {
          level: current.level,
          text: current.text,
          id: current.id,
        },
      });
    }
  }

  return issues;
}

function buildSummary(samples) {
  const failedSamples = samples.filter((sample) =>
    sample.assertions.some((assertion) => !assertion.pass)
  );
  return {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    sampleCount: samples.length,
    passedSamples: samples.length - failedSamples.length,
    failedSamples: failedSamples.length,
    failedAssertions: samples.reduce(
      (count, sample) =>
        count + sample.assertions.filter((assertion) => !assertion.pass).length,
      0
    ),
    failingPages: failedSamples.map((sample) => ({
      id: sample.id,
      path: sample.path,
      failures: sample.assertions
        .filter((assertion) => !assertion.pass)
        .map((assertion) => assertion.label),
    })),
  };
}

function buildSummaryMarkdown(summary, samples) {
  const lines = [
    "# Chapter 6 Summary",
    "",
    `- Base URL: \`${summary.baseUrl}\``,
    `- Samples checked: ${summary.sampleCount}`,
    `- Passed samples: ${summary.passedSamples}`,
    `- Failed samples: ${summary.failedSamples}`,
    `- Failed assertions: ${summary.failedAssertions}`,
    "",
    "## Failing pages",
    "",
  ];

  if (summary.failedSamples === 0) {
    lines.push("- None");
  } else {
    for (const sample of samples.filter((entry) =>
      entry.assertions.some((assertion) => !assertion.pass)
    )) {
      lines.push(`### ${sample.label}`);
      lines.push("");
      lines.push(`- Path: \`${sample.path}\``);
      lines.push(
        `- Failed checks: ${sample.assertions
          .filter((assertion) => !assertion.pass)
          .map((assertion) => assertion.label)
          .join("; ")}`
      );
      lines.push("");
    }
  }

  lines.push("## Passing pages", "");
  const passingSamples = samples.filter((sample) =>
    sample.assertions.every((assertion) => assertion.pass)
  );
  if (passingSamples.length === 0) {
    lines.push("- None");
  } else {
    for (const sample of passingSamples) {
      lines.push(`- \`${sample.path}\``);
    }
  }

  return `${lines.join("\n")}\n`;
}

function getRemoteHost(urlString, baseUrl) {
  if (!urlString) return null;
  const url = new URL(urlString, baseUrl);
  const base = new URL(baseUrl);
  if (url.host === base.host) return null;
  return url.host;
}

function shouldIgnoreRequestFailure(failure) {
  if (failure.resourceType === "media" && failure.errorText === "net::ERR_ABORTED") {
    return true;
  }

  if (
    /https:\/\/(cloud|us\.cloud|hipaa\.cloud)\.langfuse\.com\/api\/auth\/session/.test(
      failure.url
    )
  ) {
    return true;
  }

  if (
    failure.resourceType === "other" &&
    /https:\/\/vercel\.live\/_next-live\/feedback\/feedback\.js/.test(failure.url) &&
    failure.errorText === "net::ERR_ABORTED"
  ) {
    return true;
  }

  return false;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/$/, "");
}

async function writeJson(filename, data) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, filename),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8"
  );
}

async function waitForImages(page) {
  try {
    await page.waitForFunction(
      () => [...document.images].every((image) => image.complete),
      { timeout: 3000 }
    );
  } catch {
    // Continue even if some images are still lazy-loading; image state is recorded later.
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
