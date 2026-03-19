#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import puppeteer from "puppeteer";

const DEFAULT_PREVIEW_URL =
  "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app";
const DEFAULT_PRODUCTION_URL = "https://langfuse.com";
const DEFAULT_OUTPUT =
  "review/10-performance-accessibility-and-responsive-behavior/artifacts/preview-vs-production-report.json";
const AXE_SOURCE_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";

const SAMPLE_PAGES = [
  { label: "Docs landing", path: "/docs" },
  { label: "Deep docs page", path: "/docs/observability/get-started" },
  { label: "Video guide", path: "/guides/videos/introducing-datasets-v2" },
  {
    label: "Self-hosting long-form page",
    path: "/self-hosting/deployment/docker-compose",
  },
];

const DESKTOP_VIEWPORT = {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
};

const MOBILE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

const NETWORK_PROFILE = {
  offline: false,
  latency: 150,
  downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.floor((750 * 1024) / 8),
  connectionType: "cellular4g",
};

const CPU_SLOWDOWN_RATE = 4;

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

function round(value, digits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

function toKilobytes(bytes) {
  if (typeof bytes !== "number") return null;
  return round(bytes / 1024, 1);
}

function compareNumeric(previewValue, productionValue, unit) {
  if (
    typeof previewValue !== "number" ||
    Number.isNaN(previewValue) ||
    typeof productionValue !== "number" ||
    Number.isNaN(productionValue)
  ) {
    return {
      preview: previewValue ?? null,
      production: productionValue ?? null,
      delta: null,
      deltaPercent: null,
      unit,
    };
  }

  const delta = previewValue - productionValue;
  const digits = unit === "bytes" ? 0 : unit === "score" ? 3 : 1;
  return {
    preview: round(previewValue, digits),
    production: round(productionValue, digits),
    delta: round(delta, digits),
    deltaPercent:
      productionValue === 0 ? null : round((delta / productionValue) * 100, 1),
    unit,
  };
}

function describeDelta(metric) {
  if (metric.delta === null) return "n/a";
  const prefix = metric.delta > 0 ? "+" : "";
  if (metric.unit === "bytes") {
    return `${prefix}${toKilobytes(metric.delta)} KB`;
  }
  if (metric.unit === "score") {
    return `${prefix}${round(metric.delta, 3)}`;
  }
  return `${prefix}${metric.delta} ${metric.unit}`;
}

async function loadAxeSource() {
  const response = await fetch(AXE_SOURCE_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to download axe-core from ${AXE_SOURCE_URL}: ${response.status}`
    );
  }
  return response.text();
}

async function installObservers(page) {
  await page.evaluateOnNewDocument(() => {
    window.__chapter10Metrics = {
      cls: 0,
      lcp: null,
      paints: {},
      longTaskDuration: 0,
      observerErrors: [],
    };

    const state = window.__chapter10Metrics;

    function registerObserver(type, callback) {
      try {
        const observer = new PerformanceObserver((list) => {
          callback(list.getEntries());
        });
        observer.observe({ type, buffered: true });
      } catch (error) {
        state.observerErrors.push(`${type}: ${String(error)}`);
      }
    }

    registerObserver("paint", (entries) => {
      for (const entry of entries) {
        state.paints[entry.name] = entry.startTime;
      }
    });

    registerObserver("largest-contentful-paint", (entries) => {
      const last = entries[entries.length - 1];
      if (last) {
        state.lcp = last.startTime;
      }
    });

    registerObserver("layout-shift", (entries) => {
      for (const entry of entries) {
        if (!entry.hadRecentInput) {
          state.cls += entry.value;
        }
      }
    });

    registerObserver("longtask", (entries) => {
      for (const entry of entries) {
        state.longTaskDuration += entry.duration;
      }
    });
  });
}

function summarizeResources(resourceMap) {
  const resources = Array.from(resourceMap.values())
    .filter((entry) => /^https?:/.test(entry.url))
    .map((entry) => ({
      url: entry.url,
      type: entry.type,
      mimeType: entry.mimeType ?? null,
      status: entry.status ?? null,
      encodedDataLength: entry.encodedDataLength ?? 0,
      failed: entry.failed ?? false,
    }));

  const totalsByType = {};
  for (const resource of resources) {
    const type = resource.type ?? "Other";
    totalsByType[type] = (totalsByType[type] ?? 0) + resource.encodedDataLength;
  }

  const topResources = [...resources]
    .sort((left, right) => right.encodedDataLength - left.encodedDataLength)
    .slice(0, 10)
    .map((resource) => ({
      url: resource.url,
      type: resource.type,
      encodedDataLength: resource.encodedDataLength,
      kilobytes: toKilobytes(resource.encodedDataLength),
    }));

  const topByType = {};
  for (const type of ["Script", "Image", "Font", "Stylesheet"]) {
    topByType[type] = resources
      .filter((resource) => resource.type === type)
      .sort((left, right) => right.encodedDataLength - left.encodedDataLength)
      .slice(0, 5)
      .map((resource) => ({
        url: resource.url,
        encodedDataLength: resource.encodedDataLength,
        kilobytes: toKilobytes(resource.encodedDataLength),
      }));
  }

  return {
    requestCount: resources.length,
    totalBytes: resources.reduce(
      (sum, resource) => sum + resource.encodedDataLength,
      0
    ),
    totalsByType,
    topResources,
    topByType,
    failedRequests: resources.filter((resource) => resource.failed).length,
  };
}

async function runAxe(page, axeSource) {
  await page.evaluate(axeSource);
  const result = await page.evaluate(async () => {
    return await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });
  });

  const violations = result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.slice(0, 3).map((node) => ({
      target: node.target,
      failureSummary: node.failureSummary,
    })),
  }));

  return {
    violationCount: result.violations.length,
    seriousOrCriticalCount: result.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? "")
    ).length,
    moderateCount: result.violations.filter(
      (violation) => violation.impact === "moderate"
    ).length,
    minorCount: result.violations.filter(
      (violation) => violation.impact === "minor"
    ).length,
    violations,
  };
}

async function auditPage({
  browser,
  baseUrl,
  pageConfig,
  viewport,
  throttle,
  axeSource,
  runAccessibility,
}) {
  const page = await browser.newPage();
  const url = `${baseUrl}${pageConfig.path}`;
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    requestFailures.push({
      url: request.url(),
      failure: request.failure()?.errorText ?? "unknown",
    });
  });

  await page.setCacheEnabled(false);
  await page.setViewport(viewport);
  await installObservers(page);

  const cdp = await page.target().createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Runtime.enable");

  if (throttle) {
    await cdp.send("Network.emulateNetworkConditions", NETWORK_PROFILE);
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: CPU_SLOWDOWN_RATE,
    });
  }

  const resources = new Map();

  cdp.on("Network.responseReceived", (params) => {
    const { requestId, response, type } = params;
    if (!response?.url || !/^https?:/.test(response.url)) return;
    const current = resources.get(requestId) ?? {};
    resources.set(requestId, {
      ...current,
      url: response.url,
      type,
      mimeType: response.mimeType,
      status: response.status,
    });
  });

  cdp.on("Network.loadingFinished", (params) => {
    const current = resources.get(params.requestId);
    if (!current) return;
    resources.set(params.requestId, {
      ...current,
      encodedDataLength: params.encodedDataLength,
    });
  });

  cdp.on("Network.loadingFailed", (params) => {
    const current = resources.get(params.requestId) ?? {
      url: params.blockedReason ?? "unknown",
      type: "Other",
    };
    resources.set(params.requestId, {
      ...current,
      failed: true,
    });
  });

  let response;
  try {
    response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    await page
      .waitForSelector("main, article", {
        timeout: 15000,
      })
      .catch(() => {});

    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 4000));

    const runtimeMetrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const state = window.__chapter10Metrics ?? {};
      const codeBlocks = Array.from(document.querySelectorAll("pre"))
        .slice(0, 5)
        .map((node) => {
          const style = window.getComputedStyle(node);
          return {
            textLength: node.innerText.length,
            overflowX: style.overflowX,
            userSelect: style.userSelect,
            pointerEvents: style.pointerEvents,
            scrollable: node.scrollWidth > node.clientWidth + 1,
          };
        });

      return {
        title: document.title,
        finalUrl: window.location.href,
        navigation: nav
          ? {
              domContentLoadedMs: nav.domContentLoadedEventEnd,
              loadMs: nav.loadEventEnd,
              responseStartMs: nav.responseStart,
              transferSize: nav.transferSize,
              encodedBodySize: nav.encodedBodySize,
            }
          : null,
        paints: state.paints ?? {},
        lcpMs: state.lcp,
        cls: state.cls,
        longTaskDurationMs: state.longTaskDuration,
        observerErrors: state.observerErrors ?? [],
        h1Count: document.querySelectorAll("h1").length,
        horizontalOverflowPx: Math.max(
          0,
          document.documentElement.scrollWidth - window.innerWidth
        ),
        codeBlocks,
      };
    });

    const resourceSummary = summarizeResources(resources);
    const accessibility = runAccessibility
      ? await runAxe(page, axeSource)
      : null;

    return {
      ok: true,
      label: pageConfig.label,
      path: pageConfig.path,
      url,
      status: response?.status() ?? null,
      finalUrl: runtimeMetrics.finalUrl,
      title: runtimeMetrics.title,
      viewport,
      throttled: throttle,
      navigation: {
        domContentLoadedMs: round(
          runtimeMetrics.navigation?.domContentLoadedMs ?? null
        ),
        loadMs: round(runtimeMetrics.navigation?.loadMs ?? null),
        responseStartMs: round(
          runtimeMetrics.navigation?.responseStartMs ?? null
        ),
      },
      renderMetrics: {
        firstContentfulPaintMs: round(
          runtimeMetrics.paints["first-contentful-paint"] ?? null
        ),
        largestContentfulPaintMs: round(runtimeMetrics.lcpMs ?? null),
        cumulativeLayoutShift: round(runtimeMetrics.cls ?? null, 3),
        longTaskDurationMs: round(runtimeMetrics.longTaskDurationMs ?? null),
      },
      resourceSummary: {
        requestCount: resourceSummary.requestCount,
        totalBytes: resourceSummary.totalBytes,
        totalKilobytes: toKilobytes(resourceSummary.totalBytes),
        totalsByType: Object.fromEntries(
          Object.entries(resourceSummary.totalsByType).map(([key, value]) => [
            key,
            {
              bytes: value,
              kilobytes: toKilobytes(value),
            },
          ])
        ),
        topResources: resourceSummary.topResources,
        topByType: resourceSummary.topByType,
        failedRequests: resourceSummary.failedRequests,
      },
      responsive: {
        horizontalOverflowPx: round(runtimeMetrics.horizontalOverflowPx ?? null),
        codeBlockCount: runtimeMetrics.codeBlocks.length,
        unselectableCodeBlocks: runtimeMetrics.codeBlocks.filter(
          (block) =>
            block.userSelect === "none" || block.pointerEvents === "none"
        ).length,
        scrollableCodeBlocks: runtimeMetrics.codeBlocks.filter(
          (block) => block.scrollable
        ).length,
        codeBlocks: runtimeMetrics.codeBlocks,
      },
      accessibility,
      consoleErrors: consoleErrors.slice(0, 20),
      pageErrors: pageErrors.slice(0, 20),
      requestFailures: requestFailures.slice(0, 20),
      observerErrors: runtimeMetrics.observerErrors ?? [],
    };
  } catch (error) {
    return {
      ok: false,
      label: pageConfig.label,
      path: pageConfig.path,
      url,
      error: error instanceof Error ? error.message : String(error),
      consoleErrors: consoleErrors.slice(0, 20),
      pageErrors: pageErrors.slice(0, 20),
      requestFailures: requestFailures.slice(0, 20),
    };
  } finally {
    await page.close();
  }
}

function assessPage({ pageConfig, previewDesktop, productionDesktop, previewMobile }) {
  const findings = [];

  if (!previewDesktop.ok) {
    findings.push({
      severity: "fail",
      message: `Preview audit failed to run: ${previewDesktop.error}`,
    });
    return findings;
  }

  if (!productionDesktop.ok) {
    findings.push({
      severity: "fail",
      message: `Production audit failed to run: ${productionDesktop.error}`,
    });
    return findings;
  }

  if (previewDesktop.status !== 200) {
    findings.push({
      severity: "fail",
      message: `Preview returned ${previewDesktop.status} for ${pageConfig.path}.`,
    });
  }

  if (productionDesktop.status !== 200) {
    findings.push({
      severity: "fail",
      message: `Production returned ${productionDesktop.status} for ${pageConfig.path}.`,
    });
  }

  const lcp = compareNumeric(
    previewDesktop.renderMetrics.largestContentfulPaintMs,
    productionDesktop.renderMetrics.largestContentfulPaintMs,
    "ms"
  );
  if (
    lcp.delta !== null &&
    lcp.delta > 1000 &&
    (lcp.deltaPercent ?? 0) > 25
  ) {
    findings.push({
      severity: "fail",
      message: `Largest Contentful Paint regressed by ${describeDelta(lcp)} versus production.`,
    });
  } else if (
    lcp.delta !== null &&
    lcp.delta > 500 &&
    (lcp.deltaPercent ?? 0) > 15
  ) {
    findings.push({
      severity: "warn",
      message: `Largest Contentful Paint regressed by ${describeDelta(lcp)} versus production.`,
    });
  }

  const fcp = compareNumeric(
    previewDesktop.renderMetrics.firstContentfulPaintMs,
    productionDesktop.renderMetrics.firstContentfulPaintMs,
    "ms"
  );
  if (
    fcp.delta !== null &&
    fcp.delta > 600 &&
    (fcp.deltaPercent ?? 0) > 20
  ) {
    findings.push({
      severity: "warn",
      message: `First Contentful Paint regressed by ${describeDelta(fcp)} versus production.`,
    });
  }

  const totalBytes = compareNumeric(
    previewDesktop.resourceSummary.totalBytes,
    productionDesktop.resourceSummary.totalBytes,
    "bytes"
  );
  if (
    totalBytes.delta !== null &&
    totalBytes.delta > 500 * 1024 &&
    (totalBytes.deltaPercent ?? 0) > 35
  ) {
    findings.push({
      severity: "fail",
      message: `Transferred page weight increased by ${describeDelta(totalBytes)} versus production.`,
    });
  } else if (
    totalBytes.delta !== null &&
    totalBytes.delta > 250 * 1024 &&
    (totalBytes.deltaPercent ?? 0) > 20
  ) {
    findings.push({
      severity: "warn",
      message: `Transferred page weight increased by ${describeDelta(totalBytes)} versus production.`,
    });
  }

  const previewScriptBytes =
    previewDesktop.resourceSummary.totalsByType.Script?.bytes ?? 0;
  const productionScriptBytes =
    productionDesktop.resourceSummary.totalsByType.Script?.bytes ?? 0;
  const scriptBytes = compareNumeric(
    previewScriptBytes,
    productionScriptBytes,
    "bytes"
  );
  if (
    scriptBytes.delta !== null &&
    scriptBytes.delta > 300 * 1024 &&
    (scriptBytes.deltaPercent ?? 0) > 35
  ) {
    findings.push({
      severity: "fail",
      message: `Script payload increased by ${describeDelta(scriptBytes)} versus production.`,
    });
  } else if (
    scriptBytes.delta !== null &&
    scriptBytes.delta > 150 * 1024 &&
    (scriptBytes.deltaPercent ?? 0) > 20
  ) {
    findings.push({
      severity: "warn",
      message: `Script payload increased by ${describeDelta(scriptBytes)} versus production.`,
    });
  }

  const clsValue = previewDesktop.renderMetrics.cumulativeLayoutShift;
  if (typeof clsValue === "number" && clsValue > 0.1) {
    findings.push({
      severity: "fail",
      message: `Preview CLS reached ${clsValue}, exceeding the 0.1 threshold.`,
    });
  } else if (typeof clsValue === "number" && clsValue > 0.05) {
    findings.push({
      severity: "warn",
      message: `Preview CLS reached ${clsValue}, which is elevated for a docs page.`,
    });
  }

  if (previewDesktop.accessibility?.seriousOrCriticalCount) {
    findings.push({
      severity: "fail",
      message: `axe found ${previewDesktop.accessibility.seriousOrCriticalCount} serious/critical accessibility issue(s) on preview.`,
    });
  } else if (previewDesktop.accessibility?.moderateCount) {
    findings.push({
      severity: "warn",
      message: `axe found ${previewDesktop.accessibility.moderateCount} moderate accessibility issue(s) on preview.`,
    });
  }

  if (previewDesktop.consoleErrors.length || previewDesktop.pageErrors.length) {
    findings.push({
      severity: "warn",
      message: `Preview surfaced browser errors (${previewDesktop.consoleErrors.length} console, ${previewDesktop.pageErrors.length} page).`,
    });
  }

  if (previewMobile.ok) {
    if (
      typeof previewMobile.responsive.horizontalOverflowPx === "number" &&
      previewMobile.responsive.horizontalOverflowPx > 24
    ) {
      findings.push({
        severity: "fail",
        message: `Mobile viewport overflow reached ${previewMobile.responsive.horizontalOverflowPx}px on preview.`,
      });
    } else if (
      typeof previewMobile.responsive.horizontalOverflowPx === "number" &&
      previewMobile.responsive.horizontalOverflowPx > 4
    ) {
      findings.push({
        severity: "warn",
        message: `Mobile viewport overflow reached ${previewMobile.responsive.horizontalOverflowPx}px on preview.`,
      });
    }

    if (previewMobile.responsive.unselectableCodeBlocks > 0) {
      findings.push({
        severity: "fail",
        message: `Preview rendered ${previewMobile.responsive.unselectableCodeBlocks} unselectable code block(s) on mobile.`,
      });
    }
  } else {
    findings.push({
      severity: "warn",
      message: `Mobile preview audit failed to run: ${previewMobile.error}`,
    });
  }

  return findings;
}

function deriveStatus(findings) {
  if (findings.some((finding) => finding.severity === "fail")) return "fail";
  if (findings.some((finding) => finding.severity === "warn")) return "warn";
  return "pass";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const previewBaseUrl = normalizeBaseUrl(
    args["preview-url"] ?? DEFAULT_PREVIEW_URL
  );
  const productionBaseUrl = normalizeBaseUrl(
    args["production-url"] ?? DEFAULT_PRODUCTION_URL
  );
  const outputPath = resolve(args.output ?? DEFAULT_OUTPUT);

  const axeSource = await loadAxeSource();
  const browser = await puppeteer.launch({ headless: "new" });

  try {
    const pages = [];

    for (const pageConfig of SAMPLE_PAGES) {
      console.log(`Auditing preview desktop: ${pageConfig.path}`);
      const previewDesktop = await auditPage({
        browser,
        baseUrl: previewBaseUrl,
        pageConfig,
        viewport: DESKTOP_VIEWPORT,
        throttle: true,
        axeSource,
        runAccessibility: true,
      });

      console.log(`Auditing production desktop: ${pageConfig.path}`);
      const productionDesktop = await auditPage({
        browser,
        baseUrl: productionBaseUrl,
        pageConfig,
        viewport: DESKTOP_VIEWPORT,
        throttle: true,
        axeSource,
        runAccessibility: false,
      });

      console.log(`Auditing preview mobile: ${pageConfig.path}`);
      const previewMobile = await auditPage({
        browser,
        baseUrl: previewBaseUrl,
        pageConfig,
        viewport: MOBILE_VIEWPORT,
        throttle: false,
        axeSource,
        runAccessibility: false,
      });

      const findings = assessPage({
        pageConfig,
        previewDesktop,
        productionDesktop,
        previewMobile,
      });

      const comparisons = previewDesktop.ok && productionDesktop.ok
        ? {
            firstContentfulPaintMs: compareNumeric(
              previewDesktop.renderMetrics.firstContentfulPaintMs,
              productionDesktop.renderMetrics.firstContentfulPaintMs,
              "ms"
            ),
            largestContentfulPaintMs: compareNumeric(
              previewDesktop.renderMetrics.largestContentfulPaintMs,
              productionDesktop.renderMetrics.largestContentfulPaintMs,
              "ms"
            ),
            cumulativeLayoutShift: compareNumeric(
              previewDesktop.renderMetrics.cumulativeLayoutShift,
              productionDesktop.renderMetrics.cumulativeLayoutShift,
              "score"
            ),
            totalBytes: compareNumeric(
              previewDesktop.resourceSummary.totalBytes,
              productionDesktop.resourceSummary.totalBytes,
              "bytes"
            ),
            scriptBytes: compareNumeric(
              previewDesktop.resourceSummary.totalsByType.Script?.bytes ?? 0,
              productionDesktop.resourceSummary.totalsByType.Script?.bytes ?? 0,
              "bytes"
            ),
          }
        : null;

      pages.push({
        label: pageConfig.label,
        path: pageConfig.path,
        status: deriveStatus(findings),
        findings,
        previewDesktop,
        productionDesktop,
        previewMobile,
        comparisons,
      });
    }

    const summary = {
      status: pages.some((page) => page.status === "fail")
        ? "fail"
        : pages.some((page) => page.status === "warn")
          ? "warn"
          : "pass",
      counts: {
        pass: pages.filter((page) => page.status === "pass").length,
        warn: pages.filter((page) => page.status === "warn").length,
        fail: pages.filter((page) => page.status === "fail").length,
      },
      generatedAt: new Date().toISOString(),
      previewBaseUrl,
      productionBaseUrl,
    };

    const report = {
      summary,
      config: {
        previewBaseUrl,
        productionBaseUrl,
        axeSourceUrl: AXE_SOURCE_URL,
        desktopViewport: DESKTOP_VIEWPORT,
        mobileViewport: MOBILE_VIEWPORT,
        networkProfile: NETWORK_PROFILE,
        cpuSlowdownRate: CPU_SLOWDOWN_RATE,
        samplePages: SAMPLE_PAGES,
      },
      pages,
    };

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(report, null, 2));

    for (const page of pages) {
      const lcpDelta = page.comparisons
        ? describeDelta(page.comparisons.largestContentfulPaintMs)
        : "n/a";
      const weightDelta = page.comparisons
        ? describeDelta(page.comparisons.totalBytes)
        : "n/a";
      const axeIssues = page.previewDesktop.ok
        ? page.previewDesktop.accessibility?.violationCount ?? 0
        : "n/a";

      console.log(
        `[${page.status.toUpperCase()}] ${page.label} (${page.path}) | LCP delta ${lcpDelta} | weight delta ${weightDelta} | axe violations ${axeIssues}`
      );
      for (const finding of page.findings) {
        console.log(`  - [${finding.severity}] ${finding.message}`);
      }
    }

    console.log(`\nWrote report to ${outputPath}`);

    if (summary.status === "fail") {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
