#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

const DEFAULT_PREVIEW_URL =
  "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app";
const DEFAULT_PRODUCTION_URL = "https://langfuse.com";

const HTML_ROUTES = [
  "/",
  "/docs/prompt-management/get-started",
  "/guides/videos/introducing-datasets-v2",
];

const HTTP_REDIRECT_ROUTES = ["/", "/docs/prompt-management/get-started"];

const REQUIRED_HTML_HEADERS = [
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "x-frame-options",
  "strict-transport-security",
];

const REQUIRED_API_HEADERS = [
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "x-frame-options",
  "strict-transport-security",
];

const REQUIRED_CSP_DIRECTIVES = [
  "default-src",
  "script-src",
  "style-src",
  "img-src",
  "media-src",
  "font-src",
  "frame-src",
  "worker-src",
  "object-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
  "upgrade-insecure-requests",
  "block-all-mixed-content",
];

const SUSPICIOUS_PUBLIC_TOKENS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "WEBSITE_FEEDBACK_WEBHOOK",
  "METABASE_SECRET_KEY",
  "EU_LANGFUSE_SECRET_KEY",
  "US_LANGFUSE_SECRET_KEY",
  "JP_LANGFUSE_SECRET_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_API_KEY",
  "INKEEP_BACKEND_API_KEY",
  "GITHUB_ACCESS_TOKEN",
  "LOOPS_API_KEY",
  "SMTP_CONNECTION_URL",
];

const LOCAL_HOST_URL_PATTERNS = [
  { label: "http://localhost", regex: /http:\/\/localhost(?::\d+)?/g },
  { label: "https://localhost", regex: /https:\/\/localhost(?::\d+)?/g },
  { label: "ws://localhost", regex: /ws:\/\/localhost(?::\d+)?/g },
  { label: "wss://localhost", regex: /wss:\/\/localhost(?::\d+)?/g },
  { label: "http://127.0.0.1", regex: /http:\/\/127\.0\.0\.1(?::\d+)?/g },
  { label: "https://127.0.0.1", regex: /https:\/\/127\.0\.0\.1(?::\d+)?/g },
  { label: "ws://127.0.0.1", regex: /ws:\/\/127\.0\.0\.1(?::\d+)?/g },
  { label: "wss://127.0.0.1", regex: /wss:\/\/127\.0\.0\.1(?::\d+)?/g },
];
const SEARCH_QUERY = "How do I install the Docs MCP server?";
const ALLOWED_PDF_URL = "https://langfuse.com/security/dpa.md";
const BLOCKED_PDF_URL = "https://example.com/chapter-9-ssrf-probe.md";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
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

function assert(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function makeExcerpt(value, maxLength = 200) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function unique(values) {
  return [...new Set(values)];
}

async function fetchText(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    url,
    finalUrl: response.url,
    status: response.status,
    ok: response.ok,
    headers: headerMap(response.headers),
    text,
  };
}

async function fetchBinary(url, init) {
  const response = await fetch(url, init);
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    url,
    finalUrl: response.url,
    status: response.status,
    ok: response.ok,
    headers: headerMap(response.headers),
    byteLength: buffer.byteLength,
    text: response.ok ? null : buffer.toString("utf8"),
  };
}

function parseCsp(header) {
  const directives = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...values] = trimmed.split(/\s+/);
    directives[name] = values;
  }
  return directives;
}

function extractLoadBearingUrls(html) {
  const urls = [];
  const tagPattern = /<(script|img|iframe|source|video|audio|link)\b([^>]*?)>/gi;
  const attrPattern = /\b(src|href|poster)=["']([^"']+)["']/gi;
  const relPattern = /\brel=["']([^"']+)["']/i;

  for (const match of html.matchAll(tagPattern)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];

    if (tag === "link") {
      const rel = relPattern.exec(attrs)?.[1]?.toLowerCase() ?? "";
      const allowedLinkRels = [
        "stylesheet",
        "preload",
        "modulepreload",
        "icon",
        "preconnect",
        "dns-prefetch",
      ];
      if (!allowedLinkRels.some((entry) => rel.includes(entry))) {
        continue;
      }
    }

    for (const attrMatch of attrs.matchAll(attrPattern)) {
      urls.push({
        tag,
        attr: attrMatch[1].toLowerCase(),
        url: attrMatch[2],
      });
    }
  }

  return urls;
}

function extractScriptUrls(html, baseUrl) {
  const scriptUrls = [];
  const scriptPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const src = match[1];
    try {
      const resolved = new URL(src, baseUrl);
      if (resolved.origin === new URL(baseUrl).origin) {
        scriptUrls.push(resolved.toString());
      }
    } catch {}
  }

  return unique(scriptUrls);
}

function findTokenMatches(text, tokens) {
  const matches = [];
  for (const token of tokens) {
    if (text.includes(token)) {
      matches.push(token);
    }
  }
  return matches;
}

function findPatternMatches(text, patterns) {
  const matches = [];
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      matches.push(pattern.label);
    }
    pattern.regex.lastIndex = 0;
  }
  return matches;
}

async function walkFiles(rootDir) {
  const files = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const current = queue.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      files.push(fullPath);
    }
  }

  return files;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const previewUrl = normalizeBaseUrl(args["preview-url"] ?? DEFAULT_PREVIEW_URL);
  const productionUrl = normalizeBaseUrl(
    args["production-url"] ?? DEFAULT_PRODUCTION_URL,
  );
  const outputPath = resolve(
    args.output ??
      "review/9-security-headers-policies-and-public-surface-area/artifacts/security-review-report.json",
  );

  const previewHost = new URL(previewUrl).host;
  const htmlSnapshots = [];

  const checks = [];

  checks.push(
    await runCheck(
      "Preview HTML routes preserve baseline security headers, CSP directives, and noindex posture",
      async () => {
        const routes = [];

        for (const route of HTML_ROUTES) {
          const production = await fetchText(`${productionUrl}${route}`);
          const preview = await fetchText(`${previewUrl}${route}`);

          assert(production.status === 200, "Expected production route to return 200", {
            route,
            status: production.status,
          });
          assert(preview.status === 200, "Expected preview route to return 200", {
            route,
            status: preview.status,
          });

          for (const headerName of REQUIRED_HTML_HEADERS) {
            assert(
              Boolean(preview.headers[headerName]),
              `Missing ${headerName} on preview HTML route`,
              { route, headers: preview.headers },
            );
          }

          const previewCsp = preview.headers["content-security-policy"] ?? "";
          const productionCsp = production.headers["content-security-policy"] ?? "";
          const parsedPreviewCsp = parseCsp(previewCsp);

          assert(previewCsp === productionCsp, "Preview CSP did not match production", {
            route,
            previewCsp,
            productionCsp,
          });

          for (const directive of REQUIRED_CSP_DIRECTIVES) {
            assert(
              Object.prototype.hasOwnProperty.call(parsedPreviewCsp, directive),
              `Missing CSP directive: ${directive}`,
              { route, previewCsp },
            );
          }

          for (const headerName of [
            "x-content-type-options",
            "referrer-policy",
            "permissions-policy",
            "x-frame-options",
          ]) {
            assert(
              preview.headers[headerName] === production.headers[headerName],
              `Preview ${headerName} differed from production`,
              {
                route,
                headerName,
                preview: preview.headers[headerName] ?? null,
                production: production.headers[headerName] ?? null,
              },
            );
          }

          assert(
            (preview.headers["x-robots-tag"] ?? "").includes("noindex"),
            "Preview HTML route did not emit X-Robots-Tag: noindex",
            { route, headers: preview.headers },
          );
          assert(
            !(production.headers["x-robots-tag"] ?? "").includes("noindex"),
            "Production HTML route unexpectedly emits noindex",
            { route, headers: production.headers },
          );

          htmlSnapshots.push({ route, html: preview.text });

          routes.push({
            route,
            previewHeaders: {
              contentSecurityPolicy: preview.headers["content-security-policy"] ?? null,
              xContentTypeOptions: preview.headers["x-content-type-options"] ?? null,
              referrerPolicy: preview.headers["referrer-policy"] ?? null,
              permissionsPolicy: preview.headers["permissions-policy"] ?? null,
              xFrameOptions: preview.headers["x-frame-options"] ?? null,
              strictTransportSecurity:
                preview.headers["strict-transport-security"] ?? null,
              xRobotsTag: preview.headers["x-robots-tag"] ?? null,
            },
            productionHeaders: {
              contentSecurityPolicy:
                production.headers["content-security-policy"] ?? null,
              strictTransportSecurity:
                production.headers["strict-transport-security"] ?? null,
              xRobotsTag: production.headers["x-robots-tag"] ?? null,
            },
          });
        }

        return { routes };
      },
    ),
  );

  checks.push(
    await runCheck(
      "Preview API routes preserve baseline security headers and expected public CORS behavior",
      async () => {
        const previewOptions = await fetchText(`${previewUrl}/api/search-docs`, {
          method: "OPTIONS",
        });
        const previewSearch = await fetchText(
          `${previewUrl}/api/search-docs?query=${encodeURIComponent(SEARCH_QUERY)}`,
        );

        assert(previewOptions.status === 204, "Expected OPTIONS /api/search-docs to return 204", {
          status: previewOptions.status,
        });
        assert(previewSearch.status === 200, "Expected GET /api/search-docs to return 200", {
          status: previewSearch.status,
          body: previewSearch.text,
        });

        for (const headerName of REQUIRED_API_HEADERS) {
          assert(
            Boolean(previewSearch.headers[headerName]),
            `Missing ${headerName} on search-docs response`,
            { headerName, headers: previewSearch.headers },
          );
        }

        assert(
          previewOptions.headers["access-control-allow-origin"] === "*",
          "Expected wildcard CORS on OPTIONS /api/search-docs",
          { headers: previewOptions.headers },
        );
        assert(
          previewSearch.headers["access-control-allow-origin"] === "*",
          "Expected wildcard CORS on GET /api/search-docs",
          { headers: previewSearch.headers },
        );
        assert(
          (previewSearch.headers["x-robots-tag"] ?? "").includes("noindex"),
          "Expected preview API responses to remain non-indexable",
          { headers: previewSearch.headers },
        );

        const parsed = JSON.parse(previewSearch.text);
        assert(typeof parsed.answer === "string", "Expected search-docs answer to be a string", {
          body: parsed,
        });
        assert(
          Object.prototype.hasOwnProperty.call(parsed, "metadata"),
          "Expected search-docs response to include metadata",
          { body: parsed },
        );

        return {
          optionsStatus: previewOptions.status,
          getStatus: previewSearch.status,
          accessControlAllowOrigin:
            previewSearch.headers["access-control-allow-origin"] ?? null,
          answerExcerpt: makeExcerpt(parsed.answer, 180),
        };
      },
    ),
  );

  checks.push(
    await runCheck("Production HTTP routes redirect cleanly to HTTPS", async () => {
      const routes = [];

      for (const route of HTTP_REDIRECT_ROUTES) {
        const response = await fetch(`http://langfuse.com${route}`, {
          redirect: "manual",
        });
        const headers = headerMap(response.headers);
        const location = headers.location ?? null;

        assert(
          [301, 302, 307, 308].includes(response.status),
          "Expected HTTP request to redirect",
          { route, status: response.status, headers },
        );
        assert(
          typeof location === "string" && location.startsWith("https://langfuse.com"),
          "Expected HTTP redirect target to stay on https://langfuse.com",
          { route, location },
        );

        routes.push({
          route,
          status: response.status,
          location,
        });
      }

      return { routes };
    }),
  );

  checks.push(
    await runCheck(
      "Preview HTML routes do not advertise mixed-content or staging/local hosts in load-bearing markup",
      async () => {
        const findings = [];

        for (const snapshot of htmlSnapshots) {
          const loadBearingUrls = extractLoadBearingUrls(snapshot.html);
          const insecure = loadBearingUrls.filter((entry) => {
            if (!entry.url.startsWith("http://")) return false;
            return entry.url !== "http://www.w3.org/2000/svg";
          });

          const hostLeaks = [];
          const previewHostMatches = findTokenMatches(snapshot.html, [previewHost]);
          if (previewHostMatches.length > 0) {
            hostLeaks.push(...previewHostMatches);
          }

          const localHostMatches = findPatternMatches(
            snapshot.html,
            LOCAL_HOST_URL_PATTERNS,
          );
          if (localHostMatches.length > 0) {
            hostLeaks.push(...localHostMatches);
          }

          assert(
            insecure.length === 0,
            "Found insecure load-bearing URLs in preview HTML",
            { route: snapshot.route, insecure },
          );
          assert(
            hostLeaks.length === 0,
            "Found preview or local host references in preview HTML",
            { route: snapshot.route, hostLeaks: unique(hostLeaks) },
          );

          findings.push({
            route: snapshot.route,
            inspectedResourceCount: loadBearingUrls.length,
          });
        }

        return { routes: findings };
      },
    ),
  );

  checks.push(
    await runCheck(
      "Public JS bundles do not expose forbidden secret identifiers or local/staging hostnames",
      async () => {
        const scriptUrls = unique(
          htmlSnapshots.flatMap((snapshot) =>
            extractScriptUrls(snapshot.html, previewUrl),
          ),
        );

        const inspectedAssets = [];
        const matches = [];

        for (const scriptUrl of scriptUrls) {
          const response = await fetchText(scriptUrl);
          assert(response.status === 200, "Expected script asset to return 200", {
            scriptUrl,
            status: response.status,
          });

          const tokenMatches = findTokenMatches(response.text, SUSPICIOUS_PUBLIC_TOKENS);
          const hostMatches = [
            ...findTokenMatches(response.text, [previewHost]),
            ...findPatternMatches(response.text, LOCAL_HOST_URL_PATTERNS),
          ];

          inspectedAssets.push({
            url: scriptUrl,
            size: response.text.length,
          });

          if (tokenMatches.length > 0 || hostMatches.length > 0) {
            matches.push({
              url: scriptUrl,
              tokenMatches: unique(tokenMatches),
              hostMatches: unique(hostMatches),
            });
          }
        }

        assert(
          matches.length === 0,
          "Found forbidden tokens or hostnames in public script assets",
          { matches },
        );

        return {
          assetCount: inspectedAssets.length,
          assets: inspectedAssets,
        };
      },
    ),
  );

  checks.push(
    await runCheck(
      "Wildcard CORS remains intentionally limited to the documented search endpoint",
      async () => {
        const appFiles = (await walkFiles(resolve("app"))).filter(
          (filePath) => [".ts", ".tsx", ".js", ".mjs"].includes(extname(filePath)),
        );
        const matches = [];

        for (const filePath of appFiles) {
          const content = await readFile(filePath, "utf8");
          if (content.includes("Access-Control-Allow-Origin")) {
            matches.push(filePath.replace(`${process.cwd()}/`, ""));
          }
        }

        const docsMcpSource = await readFile(
          resolve("content/docs/docs-mcp.mdx"),
          "utf8",
        );

        assert(
          matches.length === 1 &&
            matches[0] === "app/api/search-docs/route.ts",
          "Unexpected explicit wildcard CORS definitions found in app routes",
          { matches },
        );
        assert(
          docsMcpSource.includes("https://langfuse.com/api/search-docs"),
          "Expected public search API to remain documented in docs-mcp page",
          {},
        );
        assert(
          docsMcpSource.includes("REST API"),
          "Expected public search API docs to describe the endpoint as a REST API",
          {},
        );

        return {
          explicitCorsDefinitions: matches,
          documentedIn: "content/docs/docs-mcp.mdx",
        };
      },
    ),
  );

  checks.push(
    await runCheck(
      "PDF generation keeps SSRF protections while allowing trusted markdown inputs",
      async () => {
        const allowed = await fetchBinary(
          `${previewUrl}/api/md-to-pdf?url=${encodeURIComponent(ALLOWED_PDF_URL)}`,
        );
        const blocked = await fetchText(
          `${previewUrl}/api/md-to-pdf?url=${encodeURIComponent(BLOCKED_PDF_URL)}`,
        );
        const routeSource = await readFile(
          resolve("app/api/md-to-pdf/route.ts"),
          "utf8",
        );

        assert(allowed.status === 200, "Expected trusted md-to-pdf input to succeed", {
          status: allowed.status,
          body: allowed.text,
        });
        assert(
          (allowed.headers["content-type"] ?? "").includes("application/pdf"),
          "Expected trusted md-to-pdf input to return a PDF",
          { headers: allowed.headers },
        );

        assert(blocked.status === 400, "Expected untrusted md-to-pdf host to be rejected", {
          status: blocked.status,
          body: blocked.text,
        });
        assert(
          blocked.text.includes("not permitted"),
          "Expected md-to-pdf rejection to explain the host restriction",
          { body: blocked.text },
        );

        for (const hostname of [
          "langfuse.com",
          "raw.githubusercontent.com",
          "github.com",
        ]) {
          assert(
            routeSource.includes(`"${hostname}"`),
            `Expected ${hostname} to remain in the md-to-pdf allowlist`,
            { hostname },
          );
        }

        return {
          allowedStatus: allowed.status,
          allowedContentType: allowed.headers["content-type"] ?? null,
          blockedStatus: blocked.status,
          blockedBodyExcerpt: makeExcerpt(blocked.text),
        };
      },
    ),
  );

  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.length - passed;

  const report = {
    generatedAt: new Date().toISOString(),
    previewUrl,
    productionUrl,
    htmlRoutes: HTML_ROUTES,
    summary: {
      total: checks.length,
      passed,
      failed,
    },
    checks,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Wrote report to ${outputPath}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

await main();
