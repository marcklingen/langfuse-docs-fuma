import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapterDir = path.resolve(__dirname, "..");
const OUTPUT_DIR = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.join(chapterDir, "evidence");

const PRODUCTION_BASE_URL = normalizeBaseUrl(
  process.env.PROD_BASE_URL || "https://langfuse.com"
);
const PREVIEW_BASE_URL = normalizeBaseUrl(
  process.env.PREVIEW_BASE_URL ||
    "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app"
);
const HEADLESS = process.env.HEADLESS !== "false";

const BASELINE_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "autoplay=*, fullscreen=*, microphone=*",
  "x-frame-options": "SAMEORIGIN",
};

const HTML_HEADER_ROUTES = [
  {
    id: "home",
    label: "Homepage",
    path: "/",
  },
  {
    id: "docs-overview",
    label: "Docs overview",
    path: "/docs/observability/overview",
  },
  {
    id: "guide-video",
    label: "Guide video",
    path: "/guides/videos/run-langfuse-locally",
  },
];

const BROWSER_ROUTES = [
  {
    id: "docs-overview",
    label: "Docs overview",
    path: "/docs/observability/overview",
    expectedSecureHosts: [],
  },
  {
    id: "guide-video",
    label: "Guide video",
    path: "/guides/videos/run-langfuse-locally",
    expectedSecureHosts: ["www.youtube-nocookie.com"],
  },
  {
    id: "pricing",
    label: "Pricing",
    path: "/pricing",
    expectedSecureHosts: [],
  },
];

const PRODUCTION_ONLY_BUNDLE_TOKENS = [
  {
    label: "preview-deployment-hostname",
    pattern:
      /langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse\.vercel\.app/i,
  },
];

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const sourceContract = await inspectSourceContract();
  const [preview, production] = await Promise.all([
    inspectEnvironment("preview", PREVIEW_BASE_URL, {
      previewDeployment: true,
    }),
    inspectEnvironment("production", PRODUCTION_BASE_URL, {
      previewDeployment: false,
    }),
  ]);

  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    defaultViewport: { width: 1440, height: 1200 },
  });

  let browserSecurity;
  try {
    browserSecurity = {
      preview: await inspectBrowserSecurity(browser, PREVIEW_BASE_URL),
      production: await inspectBrowserSecurity(browser, PRODUCTION_BASE_URL),
    };
  } finally {
    await browser.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    previewBaseUrl: PREVIEW_BASE_URL,
    productionBaseUrl: PRODUCTION_BASE_URL,
    sourceContract,
    environments: {
      preview,
      production,
    },
    browserSecurity,
  };

  const findings = buildFindings(report);
  const summary = buildSummary(report, findings);

  await Promise.all([
    writeJson("source-contract.json", sourceContract),
    writeJson("header-snapshots.json", {
      preview: preview.headerSnapshots,
      production: production.headerSnapshots,
    }),
    writeJson("https-redirects.json", {
      preview: preview.httpsRedirects,
      production: production.httpsRedirects,
    }),
    writeJson("cors-surface.json", {
      source: sourceContract.corsSurface,
      preview: preview.corsSurface,
      production: production.corsSurface,
    }),
    writeJson("pdf-ssrf.json", {
      sourceAllowlist: sourceContract.pdfAllowlist,
      preview: preview.pdfSsrf,
      production: production.pdfSsrf,
    }),
    writeJson("bundle-scan.json", {
      preview: preview.bundleScan,
      production: production.bundleScan,
    }),
    writeJson("browser-security.json", browserSecurity),
    writeJson("summary.json", summary),
    fs.writeFile(
      path.join(OUTPUT_DIR, "summary.md"),
      buildSummaryMarkdown(summary),
      "utf8"
    ),
  ]);

  const hasFailures =
    summary.findings.length > 0 ||
    summary.checks.some(
      (check) => check.preview === "FAIL" || check.production === "FAIL"
    );

  if (hasFailures) {
    process.exitCode = 1;
  }
}

async function inspectSourceContract() {
  const [nextConfig, pdfRoute] = await Promise.all([
    fs.readFile(path.resolve(process.cwd(), "next.config.mjs"), "utf8"),
    fs.readFile(path.resolve(process.cwd(), "app/api/md-to-pdf/route.ts"), "utf8"),
  ]);

  const corsSurface = await inspectCorsSurfaceFromSource();
  const clientEnvAudit = await inspectClientEnvAudit();

  return {
    headers: {
      baseline: BASELINE_HEADERS,
      hasProductionCsp:
        nextConfig.includes("Content-Security-Policy") &&
        nextConfig.includes("default-src 'self' https: wss:;"),
      cspTokens: {
        frameAncestorsNone: nextConfig.includes("frame-ancestors 'none';"),
        objectSrcNone: nextConfig.includes("object-src 'none';"),
        upgradeInsecureRequests: nextConfig.includes(
          "upgrade-insecure-requests;"
        ),
        blockAllMixedContent: nextConfig.includes("block-all-mixed-content;"),
      },
      previewNoindexGuard: nextConfig.includes(
        'process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"'
      ),
    },
    pdfAllowlist: extractQuotedArrayValues(pdfRoute, "ALLOWED_HOSTNAMES"),
    corsSurface,
    clientEnvAudit,
  };
}

async function inspectCorsSurfaceFromSource() {
  const apiDir = path.resolve(process.cwd(), "app/api");
  const routeFiles = await walkFiles(apiDir, (entryPath) =>
    entryPath.endsWith("/route.ts") || entryPath.endsWith("\\route.ts")
  );

  const wildcardEndpoints = [];

  for (const filePath of routeFiles) {
    const text = await fs.readFile(filePath, "utf8");
    if (!matchesWildcardCors(text)) {
      continue;
    }

    const route = routeFromApiFile(filePath);
    const methods = extractExportedMethods(text);
    const documentedIn = await findRouteMentions(route);

    wildcardEndpoints.push({
      route,
      sourceFile: path.relative(process.cwd(), filePath),
      methods,
      documentedIn,
      wildcardOrigin: true,
    });
  }

  return {
    wildcardEndpoints,
    pass: wildcardEndpoints.every((endpoint) => endpoint.documentedIn.length > 0),
  };
}

async function inspectClientEnvAudit() {
  const sourceRoots = [
    path.resolve(process.cwd(), "app"),
    path.resolve(process.cwd(), "components"),
    path.resolve(process.cwd(), "lib"),
  ];

  const files = [];
  for (const root of sourceRoots) {
    files.push(
      ...(await walkFiles(root, (entryPath) =>
        /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entryPath)
      ))
    );
  }

  const violations = [];

  for (const filePath of files) {
    const text = await fs.readFile(filePath, "utf8");
    if (!hasUseClientDirective(text)) {
      continue;
    }

    const envMatches = Array.from(text.matchAll(/process\.env\.([A-Z0-9_]+)/g)).map(
      (match) => match[1]
    );

    const forbidden = envMatches.filter(
      (name) => name !== "NODE_ENV" && !name.startsWith("NEXT_PUBLIC_")
    );

    if (forbidden.length > 0) {
      violations.push({
        file: path.relative(process.cwd(), filePath),
        variables: [...new Set(forbidden)].sort(),
      });
    }
  }

  return {
    scannedFiles: files.length,
    violations,
    pass: violations.length === 0,
  };
}

async function inspectEnvironment(name, baseUrl, options) {
  const headerSnapshots = [];

  for (const route of HTML_HEADER_ROUTES) {
    headerSnapshots.push(
      await inspectHttpSurface(baseUrl, route, {
        kind: "html",
        expectNoindex: options.previewDeployment,
        expectCors: true,
      })
    );
  }

  headerSnapshots.push(
    await inspectHttpSurface(
      baseUrl,
      {
        id: "search-docs",
        label: "Search docs API",
        path: "/api/search-docs?query=Langfuse%20MCP",
      },
      {
        kind: "api",
        expectNoindex: options.previewDeployment,
        expectCors: true,
      }
    )
  );

  headerSnapshots.push(
    await inspectHttpSurface(
      baseUrl,
      {
        id: "markdown-endpoint",
        label: "Markdown endpoint",
        path: "/docs/observability/overview.md",
      },
      {
        kind: "markdown",
        expectNoindex: true,
        expectCors: true,
      }
    )
  );

  const httpsRedirects = await inspectHttpsRedirects(baseUrl);
  const corsSurface = await inspectCorsSurface(baseUrl);
  const pdfSsrf = await inspectPdfSsrf(baseUrl);
  const bundleScan = await inspectBundleSurface(name, baseUrl);

  return {
    name,
    baseUrl,
    headerSnapshots,
    httpsRedirects,
    corsSurface,
    pdfSsrf,
    bundleScan,
    checks: {
      headerBaseline: headerSnapshots.every((snapshot) => snapshot.pass),
      httpsOnly: httpsRedirects.pass,
      indexingGuardrails: headerSnapshots.every((snapshot) => snapshot.indexingPass),
      corsSurface: corsSurface.pass,
      pdfSsrf: pdfSsrf.pass,
      bundleScan: bundleScan.pass,
    },
  };
}

async function inspectHttpSurface(baseUrl, route, options) {
  const response = await fetchResponse(`${baseUrl}${route.path}`);
  const headers = pickHeaders(response.headers, [
    "access-control-allow-headers",
    "access-control-allow-methods",
    "access-control-allow-origin",
    "content-security-policy",
    "content-type",
    "permissions-policy",
    "referrer-policy",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options",
    "x-robots-tag",
  ]);

  const baselineAssertions = Object.entries(BASELINE_HEADERS).map(
    ([headerName, expected]) => ({
      header: headerName,
      expected,
      actual: headers[headerName] || null,
      pass: normalizeHeaderValue(headers[headerName]) === normalizeHeaderValue(expected),
    })
  );

  const csp = headers["content-security-policy"] || null;
  const cspPass =
    options.kind === "api"
      ? csp == null
      : csp == null ||
        (Boolean(csp.includes("upgrade-insecure-requests")) &&
          Boolean(csp.includes("block-all-mixed-content")) &&
          Boolean(csp.includes("frame-ancestors 'none'")));

  const indexingPass = options.expectNoindex
    ? normalizeHeaderValue(headers["x-robots-tag"]) === "noindex"
    : options.kind === "markdown"
      ? normalizeHeaderValue(headers["x-robots-tag"]) === "noindex"
      : normalizeHeaderValue(headers["x-robots-tag"]) !== "noindex";

  const corsPass = options.expectCors
    ? headers["access-control-allow-origin"] === "*"
    : !headers["access-control-allow-origin"];

  return {
    id: route.id,
    label: route.label,
    path: route.path,
    status: response.status,
    finalUrl: response.finalUrl,
    headers,
    baselineAssertions,
    cspPass,
    indexingPass,
    corsPass,
    pass:
      response.ok &&
      baselineAssertions.every((assertion) => assertion.pass) &&
      cspPass &&
      indexingPass &&
      corsPass,
  };
}

async function inspectHttpsRedirects(baseUrl) {
  const url = new URL(baseUrl);
  const httpUrl = `http://${url.host}/docs/observability/overview`;
  const response = await fetch(httpUrl, { redirect: "manual" });

  const location = response.headers.get("location");
  const pass =
    [301, 302, 307, 308].includes(response.status) &&
    typeof location === "string" &&
    location.startsWith(`https://${url.host}/`);

  return {
    url: httpUrl,
    status: response.status,
    location,
    pass,
  };
}

async function inspectCorsSurface(baseUrl) {
  const getResponse = await fetchResponse(
    `${baseUrl}/api/search-docs?query=${encodeURIComponent("Langfuse MCP")}`
  );
  const optionsResponse = await fetchResponse(`${baseUrl}/api/search-docs`, {
    method: "OPTIONS",
  });

  return {
    route: "/api/search-docs",
    get: {
      status: getResponse.status,
      contentType: headerValue(getResponse.headers, "content-type"),
      corsOrigin: headerValue(getResponse.headers, "access-control-allow-origin"),
      corsMethods: headerValue(getResponse.headers, "access-control-allow-methods"),
      corsHeaders: headerValue(getResponse.headers, "access-control-allow-headers"),
    },
    options: {
      status: optionsResponse.status,
      corsOrigin: headerValue(
        optionsResponse.headers,
        "access-control-allow-origin"
      ),
      corsMethods: headerValue(
        optionsResponse.headers,
        "access-control-allow-methods"
      ),
      corsHeaders: headerValue(
        optionsResponse.headers,
        "access-control-allow-headers"
      ),
    },
    pass:
      getResponse.status === 200 &&
      headerValue(getResponse.headers, "access-control-allow-origin") === "*" &&
      [200, 204].includes(optionsResponse.status) &&
      headerValue(optionsResponse.headers, "access-control-allow-origin") === "*",
  };
}

async function inspectPdfSsrf(baseUrl) {
  const blocked = await fetchJson(
    `${baseUrl}/api/md-to-pdf?url=${encodeURIComponent("https://example.com/foo.md")}`
  );
  const allowlisted = await fetchResponse(
    `${baseUrl}/api/md-to-pdf?url=${encodeURIComponent("https://langfuse.com/privacy.md")}`
  );

  return {
    blocked: {
      status: blocked.status,
      error: blocked.json?.error || null,
      allowed: blocked.json?.allowed || null,
    },
    allowlisted: {
      status: allowlisted.status,
      contentType: headerValue(allowlisted.headers, "content-type"),
    },
    pass:
      blocked.status === 400 &&
      Array.isArray(blocked.json?.allowed) &&
      blocked.json.allowed.includes("langfuse.com"),
  };
}

async function inspectBundleSurface(environmentName, baseUrl) {
  const scriptAssets = new Map();
  const inlineDocuments = [];

  for (const route of ["/", "/pricing"]) {
    const response = await fetchResponse(`${baseUrl}${route}`);
    inlineDocuments.push({
      route,
      byteLength: Buffer.byteLength(response.text, "utf8"),
    });

    for (const assetUrl of extractJavaScriptAssets(baseUrl, response.text)) {
      scriptAssets.set(assetUrl, { route });
    }
  }

  const assets = [];
  const findings = [];

  for (const assetUrl of scriptAssets.keys()) {
    const response = await fetchResponse(assetUrl);
    assets.push({
      url: assetUrl,
      status: response.status,
      byteLength: Buffer.byteLength(response.text, "utf8"),
    });

    const hits = scanBundleText(response.text, environmentName);
    if (hits.length > 0) {
      findings.push({
        assetUrl,
        hits,
      });
    }
  }

  return {
    scannedRoutes: inlineDocuments,
    scannedAssets: assets,
    findings,
    pass: findings.length === 0,
  };
}

function scanBundleText(text, environmentName) {
  const hits = [];
  const executableText = stripJavaScriptStringsAndComments(text);
  const privateEnvMatches = Array.from(
    executableText.matchAll(/process\.env\.([A-Z0-9_]+)/g)
  )
    .map((match) => match[1])
    .filter(
      (name) => name !== "NODE_ENV" && !name.startsWith("NEXT_PUBLIC_")
    );

  for (const token of [...new Set(privateEnvMatches)].sort()) {
    hits.push({
      label: token,
      type: "private-env-reference",
    });
  }

  if (environmentName === "production") {
    for (const token of PRODUCTION_ONLY_BUNDLE_TOKENS) {
      if (token.pattern.test(text)) {
        hits.push({
          label: token.label,
          type: "forbidden-hostname",
        });
      }
    }
  }

  return hits;
}

async function inspectBrowserSecurity(browser, baseUrl) {
  const pages = [];

  for (const route of BROWSER_ROUTES) {
    pages.push(await inspectBrowserPage(browser, baseUrl, route));
  }

  return {
    baseUrl,
    pages,
    pass: pages.every((page) => page.pass),
  };
}

async function inspectBrowserPage(browser, baseUrl, route) {
  const page = await browser.newPage();
  const securityMessages = [];
  const insecureRequestFailures = [];

  page.on("console", (message) => {
    const text = message.text();
    if (looksLikeSecurityMessage(text)) {
      securityMessages.push({
        type: message.type(),
        text,
      });
    }
  });

  page.on("pageerror", (error) => {
    if (looksLikeSecurityMessage(error.message)) {
      securityMessages.push({
        type: "pageerror",
        text: error.message,
      });
    }
  });

  page.on("requestfailed", (request) => {
    if (request.url().startsWith("http://")) {
      insecureRequestFailures.push({
        url: request.url(),
        failureText: request.failure()?.errorText ?? null,
      });
    }
  });

  try {
    await page.goto(`${baseUrl}${route.path}`, {
      waitUntil: "networkidle2",
      timeout: 90_000,
    });
    await delay(1_500);

    const domSecurity = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll(
          "script[src], link[href], img[src], iframe[src], video[src], audio[src], source[src]"
        )
      );

      const resources = nodes
        .map((node) => {
          if (node instanceof HTMLLinkElement) {
            return node.href;
          }

          if ("src" in node && typeof node.src === "string") {
            return node.src;
          }

          return null;
        })
        .filter(Boolean);

      return {
        resources,
      };
    });

    const resourceUrls = domSecurity.resources;
    const insecureResources = resourceUrls.filter((value) =>
      value.startsWith("http://")
    );
    const observedHosts = [
      ...new Set(resourceUrls.map((value) => safeHost(value, baseUrl)).filter(Boolean)),
    ].sort();
    const missingExpectedHosts = route.expectedSecureHosts.filter(
      (host) => !observedHosts.includes(host)
    );

    return {
      id: route.id,
      label: route.label,
      path: route.path,
      securityMessages,
      insecureRequestFailures,
      insecureResources,
      observedHosts,
      missingExpectedHosts,
      pass:
        securityMessages.length === 0 &&
        insecureRequestFailures.length === 0 &&
        insecureResources.length === 0 &&
        missingExpectedHosts.length === 0,
    };
  } catch (error) {
    return {
      id: route.id,
      label: route.label,
      path: route.path,
      securityMessages,
      insecureRequestFailures,
      insecureResources: [],
      observedHosts: [],
      missingExpectedHosts: route.expectedSecureHosts,
      navigationError: error instanceof Error ? error.message : String(error),
      pass: false,
    };
  } finally {
    await page.close();
  }
}

function buildFindings(report) {
  const findings = [];
  const preview = report.environments.preview;
  const production = report.environments.production;

  if (!report.sourceContract.clientEnvAudit.pass) {
    findings.push({
      id: "client-env-audit-violations",
      severity: "high",
      title: "Client-marked modules reference non-public environment variables",
      evidenceFile: "source-contract.json",
      details:
        "The source audit found at least one `use client` module that references server-only environment variables.",
    });
  }

  if (
    !report.browserSecurity.preview.pass &&
    report.browserSecurity.production.pass
  ) {
    findings.push({
      id: "preview-browser-security-regression",
      severity: "high",
      title: "Preview introduces CSP or mixed-content browser failures",
      evidenceFile: "browser-security.json",
      details:
        "The preview browser pass reported security-specific console or resource failures that were not reproduced on the current production site.",
    });
  }

  if (!preview.checks.headerBaseline && production.checks.headerBaseline) {
    findings.push({
      id: "preview-header-regression",
      severity: "high",
      title: "Preview drops a baseline security header present on production",
      evidenceFile: "header-snapshots.json",
      details:
        "At least one representative preview route is missing a baseline header that is still present on the current production site.",
    });
  }

  if (!preview.checks.httpsOnly && production.checks.httpsOnly) {
    findings.push({
      id: "preview-https-redirect-regression",
      severity: "high",
      title: "Preview no longer enforces HTTP-to-HTTPS redirects",
      evidenceFile: "https-redirects.json",
      details:
        "The preview deployment failed the explicit HTTP redirect check while production still redirects correctly.",
    });
  }

  if (!preview.checks.indexingGuardrails) {
    findings.push({
      id: "preview-indexing-guardrail-failure",
      severity: "high",
      title: "Preview is missing required noindex guardrails",
      evidenceFile: "header-snapshots.json",
      details:
        "One or more representative preview surfaces do not emit the expected `X-Robots-Tag: noindex` response header.",
    });
  }

  if (!preview.checks.corsSurface || !production.checks.corsSurface) {
    findings.push({
      id: "cors-surface-mismatch",
      severity: "medium",
      title: "The documented wildcard-CORS search endpoint is not behaving as expected",
      evidenceFile: "cors-surface.json",
      details:
        "The live `/api/search-docs` responses no longer match the documented permissive CORS contract in at least one environment.",
    });
  }

  if (!report.sourceContract.corsSurface.pass) {
    findings.push({
      id: "undocumented-wildcard-cors-endpoint",
      severity: "medium",
      title: "A wildcard-CORS API route is not documented in the repository",
      evidenceFile: "source-contract.json",
      details:
        "The source audit found an API route with `Access-Control-Allow-Origin: *` but no matching documentation reference.",
    });
  }

  if (!preview.checks.pdfSsrf || !production.checks.pdfSsrf) {
    findings.push({
      id: "pdf-ssrf-guard-failure",
      severity: "high",
      title: "The markdown-to-PDF route no longer blocks untrusted source hosts",
      evidenceFile: "pdf-ssrf.json",
      details:
        "The blocked-host request to `/api/md-to-pdf` did not return the expected 400 response in at least one environment.",
    });
  }

  if (!preview.checks.bundleScan || !production.checks.bundleScan) {
    findings.push({
      id: "public-bundle-sensitive-token-hit",
      severity: "high",
      title: "Sensitive server-side tokens or forbidden hosts appear in public bundles",
      evidenceFile: "bundle-scan.json",
      details:
        "The bundle scan found at least one server-side environment token or forbidden hostname in the downloaded client JavaScript.",
    });
  }

  return findings;
}

function buildSummary(report, findings) {
  const preview = report.environments.preview;
  const production = report.environments.production;

  return {
    generatedAt: report.generatedAt,
    previewBaseUrl: report.previewBaseUrl,
    productionBaseUrl: report.productionBaseUrl,
    findings,
    checks: [
      summarizeCheck(
        "header-baseline",
        preview.checks.headerBaseline,
        production.checks.headerBaseline
      ),
      summarizeCheck(
        "https-only",
        preview.checks.httpsOnly,
        production.checks.httpsOnly
      ),
      summarizeCheck(
        "indexing-guardrails",
        preview.checks.indexingGuardrails,
        production.checks.indexingGuardrails
      ),
      summarizeCheck(
        "cors-surface",
        preview.checks.corsSurface,
        production.checks.corsSurface
      ),
      summarizeCheck("pdf-ssrf", preview.checks.pdfSsrf, production.checks.pdfSsrf),
      summarizeCheck(
        "bundle-scan",
        preview.checks.bundleScan,
        production.checks.bundleScan
      ),
      summarizeCheck(
        "browser-csp-mixed-content",
        report.browserSecurity.preview.pass,
        report.browserSecurity.production.pass
      ),
      summarizeCheck(
        "client-env-audit",
        report.sourceContract.clientEnvAudit.pass,
        report.sourceContract.clientEnvAudit.pass
      ),
    ],
  };
}

function buildSummaryMarkdown(summary) {
  const lines = [
    "# Chapter 9 Summary",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    `Preview base: \`${summary.previewBaseUrl}\``,
    `Production base: \`${summary.productionBaseUrl}\``,
    "",
    "## Findings",
    "",
  ];

  if (summary.findings.length === 0) {
    lines.push("- No Chapter 9 findings were recorded in this run.");
  } else {
    for (const finding of summary.findings) {
      lines.push(
        `- ${finding.severity.toUpperCase()}: ${finding.title} (${finding.evidenceFile})`
      );
      lines.push(`  ${finding.details}`);
    }
  }

  lines.push("", "## Check Summary", "", "| Check | Preview | Production |", "| --- | --- | --- |");

  for (const check of summary.checks) {
    lines.push(`| ${check.name} | ${check.preview} | ${check.production} |`);
  }

  lines.push("");
  return lines.join("\n");
}

function summarizeCheck(name, previewPass, productionPass) {
  return {
    name,
    preview: previewPass ? "PASS" : "FAIL",
    production: productionPass ? "PASS" : "FAIL",
  };
}

function extractQuotedArrayValues(text, variableName) {
  const match = text.match(
    new RegExp(`const\\s+${variableName}\\s*=\\s*\\[(?<values>[\\s\\S]*?)\\]`)
  );

  if (!match?.groups?.values) {
    return [];
  }

  return Array.from(match.groups.values.matchAll(/"([^"]+)"/g)).map(
    (entry) => entry[1]
  );
}

async function findRouteMentions(route) {
  const roots = [
    path.resolve(process.cwd(), "README.md"),
    path.resolve(process.cwd(), "content"),
  ];

  const files = [];
  for (const root of roots) {
    try {
      const stat = await fs.stat(root);
      if (stat.isDirectory()) {
        files.push(
          ...(await walkFiles(root, (entryPath) =>
            /\.(md|mdx|txt)$/.test(entryPath)
          ))
        );
      } else {
        files.push(root);
      }
    } catch {}
  }

  const mentions = [];

  for (const filePath of files) {
    const text = await fs.readFile(filePath, "utf8");
    if (text.includes(route)) {
      mentions.push(path.relative(process.cwd(), filePath));
    }
  }

  return mentions.sort();
}

function routeFromApiFile(filePath) {
  const relative = path.relative(path.resolve(process.cwd(), "app/api"), filePath);
  const normalized = relative.replaceAll(path.sep, "/");
  return `/api/${normalized.replace(/\/route\.(t|j)sx?$/, "")}`;
}

function extractExportedMethods(text) {
  return Array.from(text.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)/g))
    .map((match) => match[1])
    .sort();
}

function matchesWildcardCors(text) {
  return /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/.test(text);
}

function hasUseClientDirective(text) {
  const match = text.match(/^\s*(?:"use client"|'use client');/);
  return Boolean(match);
}

function extractJavaScriptAssets(baseUrl, html) {
  const assets = new Set();
  const regex = /\b(?:src|href)="([^"]+\.js[^"]*)"/g;

  for (const match of html.matchAll(regex)) {
    const url = new URL(match[1], baseUrl);
    if (url.origin === new URL(baseUrl).origin) {
      assets.add(url.toString());
    }
  }

  return [...assets];
}

function looksLikeSecurityMessage(text) {
  return /content security policy|mixed content|block-all-mixed-content|upgrade-insecure-requests|refused to (load|execute)|violates the following content security policy directive/i.test(
    text
  );
}

async function walkFiles(root, predicate) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkFiles(entryPath, predicate)));
      continue;
    }

    if (predicate(entryPath)) {
      results.push(entryPath);
    }
  }

  return results.sort();
}

async function fetchResponse(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();

  return {
    status: response.status,
    ok: response.ok,
    finalUrl: response.url,
    headers: headersToObject(response.headers),
    text,
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJson(url, init) {
  const response = await fetchResponse(url, init);
  let json = null;

  try {
    json = response.text ? JSON.parse(response.text) : null;
  } catch {}

  return {
    ...response,
    json,
  };
}

function pickHeaders(headers, keys) {
  return Object.fromEntries(keys.map((key) => [key, headerValue(headers, key)]));
}

function headerValue(headers, key) {
  return headers[key.toLowerCase()] ?? null;
}

function headersToObject(headers) {
  return Object.fromEntries(
    Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value])
  );
}

function normalizeBaseUrl(url) {
  return url.replace(/\/$/, "");
}

function normalizeHeaderValue(value) {
  return value?.replace(/\s+/g, " ").trim().toLowerCase() ?? null;
}

function safeHost(value, baseUrl) {
  try {
    return new URL(value, baseUrl).host;
  } catch {
    return null;
  }
}

function stripJavaScriptStringsAndComments(source) {
  let result = "";
  let state = "code";

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "code") {
      if (char === "'" || char === '"' || char === "`") {
        state = char === "'" ? "single" : char === '"' ? "double" : "template";
        result += " ";
        continue;
      }

      if (char === "/" && next === "/") {
        state = "line-comment";
        result += "  ";
        index += 1;
        continue;
      }

      if (char === "/" && next === "*") {
        state = "block-comment";
        result += "  ";
        index += 1;
        continue;
      }

      result += char;
      continue;
    }

    if (state === "line-comment") {
      if (char === "\n") {
        state = "code";
        result += "\n";
      } else {
        result += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        state = "code";
        result += "  ";
        index += 1;
      } else {
        result += char === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (char === "\\") {
      result += " ";
      if (index + 1 < source.length) {
        result += " ";
        index += 1;
      }
      continue;
    }

    const closesString =
      (state === "single" && char === "'") ||
      (state === "double" && char === '"') ||
      (state === "template" && char === "`");

    if (closesString) {
      state = "code";
      result += " ";
      continue;
    }

    result += char === "\n" ? "\n" : " ";
  }

  return result;
}

async function writeJson(filename, payload) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, filename),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
