#!/usr/bin/env node

import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:3333";
const DEFAULT_PREVIEW_URL =
  "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app";
const DEFAULT_PRODUCTION_URL = "https://langfuse.com";
const DEFAULT_LEGACY_REPO =
  "/Users/marcklingen/repos/github/langfuse/langfuse-docs";
const SAMPLE_DOC_PATH = "/docs/observability/data-model";
const SAMPLE_QUERY = "How do I trace LangGraph agents with Langfuse?";
const SCRIPT_EXPECTATIONS = {
  gtmId: "GTM-NGLK4TZX",
  hubspotHost: "https://js-eu1.hs-scripts.com/143255669.js",
  cookieyesHost:
    "https://cdn-cookieyes.com/client_data/40247147630c6589ad01a874/script.js",
};

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

async function fetchText(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    url,
    status: response.status,
    ok: response.ok,
    headers: headerMap(response.headers),
    text,
  };
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return {
    url,
    status: response.status,
    ok: response.ok,
    headers: headerMap(response.headers),
    text,
    json,
  };
}

function extractTemplateVars(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => line.split("=", 1)[0]);
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

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function waitForHttp(url, timeoutMs = 180000) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0) return response;
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }
  throw new Error(
    `Timed out waiting for ${url}${
      lastError instanceof Error ? `: ${lastError.message}` : ""
    }`
  );
}

async function startSinkServer() {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks);
    let body = rawBody.toString("utf8");
    try {
      JSON.parse(body);
    } catch {
      try {
        body = gunzipSync(rawBody).toString("utf8");
      } catch {}
    }

    let json = null;
    try {
      json = body ? JSON.parse(body) : null;
    } catch {}

    requests.push({
      method: request.method ?? null,
      path: request.url ?? null,
      headers: request.headers,
      body,
      json,
      receivedAt: new Date().toISOString(),
    });

    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ok: true }));
  });

  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => resolvePromise());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine sink server address");
  }

  return {
    server,
    requests,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise((resolvePromise, rejectPromise) =>
        server.close((error) => (error ? rejectPromise(error) : resolvePromise()))
      );
    },
  };
}

async function startDevServer(repoRoot, sinkBaseUrl, localBaseUrl) {
  const url = new URL(localBaseUrl);
  const env = {
    ...process.env,
    WEBSITE_FEEDBACK_WEBHOOK: `${sinkBaseUrl}/feedback-webhook`,
    NEXT_PUBLIC_POSTHOG_HOST: sinkBaseUrl,
    NEXT_PUBLIC_POSTHOG_KEY: "chapter8-test-key",
    NEXT_PUBLIC_PLAIN_APP_ID: "chapter8-plain-test",
    NEXT_PUBLIC_INKEEP_API_KEY: "chapter8-inkeep-public-test",
    PORT: url.port,
  };

  const logs = [];
  const child = spawn("pnpm", ["dev"], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const rememberLog = (prefix) => (chunk) => {
    const lines = chunk
      .toString("utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => `${prefix}${line}`);
    logs.push(...lines);
    if (logs.length > 200) logs.splice(0, logs.length - 200);
  };

  child.stdout.on("data", rememberLog("stdout: "));
  child.stderr.on("data", rememberLog("stderr: "));

  try {
    await waitForHttp(`${localBaseUrl}${SAMPLE_DOC_PATH}`, 240000);
  } catch (error) {
    child.kill("SIGTERM");
    throw new Error(
      `Local dev server did not become ready${
        error instanceof Error ? `: ${error.message}` : ""
      }`
    );
  }

  return {
    child,
    logs,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolvePromise) => child.once("exit", resolvePromise)),
        sleep(10000).then(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }),
      ]);
    },
  };
}

function collectPosthogEvents(requests) {
  const events = [];

  for (const request of requests) {
    if (!request.json || typeof request.json !== "object") continue;
    const payload = request.json;

    if (Array.isArray(payload.batch)) {
      for (const event of payload.batch) {
        events.push({
          path: request.path,
          event: event?.event ?? null,
          properties: event?.properties ?? null,
        });
      }
      continue;
    }

    if (Array.isArray(payload.events)) {
      for (const event of payload.events) {
        events.push({
          path: request.path,
          event: event?.event ?? null,
          properties: event?.properties ?? null,
        });
      }
      continue;
    }

    if (payload.event) {
      events.push({
        path: request.path,
        event: payload.event,
        properties: payload.properties ?? null,
      });
    }
  }

  return events;
}

function textIncludesAny(text, snippets) {
  return snippets.some((snippet) => text.includes(snippet));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const localBaseUrl = normalizeBaseUrl(
    args["local-base-url"] ?? DEFAULT_LOCAL_BASE_URL
  );
  const previewUrl = normalizeBaseUrl(args["preview-url"] ?? DEFAULT_PREVIEW_URL);
  const productionUrl = normalizeBaseUrl(
    args["production-url"] ?? DEFAULT_PRODUCTION_URL
  );
  const legacyRepoPath = resolve(args["legacy-repo"] ?? DEFAULT_LEGACY_REPO);
  const repoRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    ".."
  );
  const outputPath = resolve(
    args.output ??
      "review/8-feedback-analytics-and-operational-integrations/artifacts/review-report.json"
  );

  const checks = [];

  const templatePath = resolve(repoRoot, ".env.template");
  const searchRoutePath = resolve(repoRoot, "app/api/search-docs/route.ts");
  const layoutPath = resolve(repoRoot, "app/layout.tsx");
  const feedbackRoutePath = resolve(repoRoot, "app/api/feedback/route.ts");
  const cloudRedirectPath = resolve(repoRoot, "app/cloud/[[...path]]/page.tsx");
  const mcpHandlerPath = resolve(repoRoot, "lib/mcp-handler.ts");
  const legacySearchRoutePath = resolve(
    legacyRepoPath,
    "pages/api/search-docs.ts"
  );
  const legacyAppPath = resolve(legacyRepoPath, "pages/_app.tsx");

  const [
    templateSource,
    searchRouteSource,
    layoutSource,
    feedbackRouteSource,
    cloudRedirectSource,
    mcpHandlerSource,
    legacySearchRouteSource,
    legacyAppSource,
  ] = await Promise.all([
    readFile(templatePath, "utf8"),
    readFile(searchRoutePath, "utf8"),
    readFile(layoutPath, "utf8"),
    readFile(feedbackRoutePath, "utf8"),
    readFile(cloudRedirectPath, "utf8"),
    readFile(mcpHandlerPath, "utf8"),
    readFile(legacySearchRoutePath, "utf8"),
    readFile(legacyAppPath, "utf8"),
  ]);

  checks.push(
    await runCheck(
      "Feedback route still forwards docs-feedback payloads to WEBSITE_FEEDBACK_WEBHOOK",
      async () => {
        assert(
          feedbackRouteSource.includes("WEBSITE_FEEDBACK_WEBHOOK"),
          "Feedback route no longer references WEBSITE_FEEDBACK_WEBHOOK"
        );
        assert(
          feedbackRouteSource.includes('type: "docs-feedback"'),
          'Feedback route no longer stamps payloads with type: "docs-feedback"'
        );

        return {
          route: "app/api/feedback/route.ts",
          webhookVarPresent: true,
          docsFeedbackTypePresent: true,
        };
      }
    )
  );

  checks.push(
    await runCheck(
      "Public docs search route preserves the legacy PostHog query event",
      async () => {
        const legacyHasEvent =
          legacySearchRouteSource.includes("docs_search:query") &&
          legacySearchRouteSource.includes("posthog?.capture");
        const newHasEvent =
          searchRouteSource.includes("docs_search:query") &&
          searchRouteSource.includes("posthog");

        assert(legacyHasEvent, "Legacy route did not include the expected event");
        assert(
          newHasEvent,
          "Migrated route no longer captures docs_search:query events",
          {
            legacyRoute: legacySearchRoutePath,
            newRoute: searchRoutePath,
          }
        );

        return {
          legacyHasEvent,
          newHasEvent,
        };
      }
    )
  );

  checks.push(
    await runCheck(
      "Root analytics shell preserves the legacy Google Tag Manager integration",
      async () => {
        const legacyHasGtm =
          legacyAppSource.includes("GoogleTagManager") &&
          legacyAppSource.includes(SCRIPT_EXPECTATIONS.gtmId);
        const newHasGtm =
          layoutSource.includes("GoogleTagManager") &&
          layoutSource.includes(SCRIPT_EXPECTATIONS.gtmId);

        assert(legacyHasGtm, "Legacy app shell did not include the expected GTM");
        assert(
          newHasGtm,
          "Migrated root layout no longer includes the legacy GTM integration",
          {
            legacyApp: legacyAppPath,
            newLayout: layoutPath,
          }
        );

        return {
          legacyHasGtm,
          newHasGtm,
        };
      }
    )
  );

  checks.push(
    await runCheck(
      ".env.template includes the environment variables required by active analytics/search integrations",
      async () => {
        const templateVars = new Set(extractTemplateVars(templateSource));
        const requiredVars = [
          "NEXT_PUBLIC_POSTHOG_HOST",
          "NEXT_PUBLIC_POSTHOG_KEY",
          "WEBSITE_FEEDBACK_WEBHOOK",
          "NEXT_PUBLIC_INKEEP_API_KEY",
          "INKEEP_BACKEND_API_KEY",
          "NEXT_PUBLIC_PLAIN_APP_ID",
        ];

        const missing = requiredVars.filter((name) => !templateVars.has(name));

        assert(
          missing.length === 0,
          "Missing required environment variables in .env.template",
          { missing, requiredVars }
        );

        return {
          requiredVars,
          templateVars: [...templateVars].sort(),
        };
      }
    )
  );

  checks.push(
    await runCheck(
      "MCP handler still captures the docs_mcp:execute_tool analytics event",
      async () => {
        assert(
          mcpHandlerSource.includes("docs_mcp:execute_tool"),
          "MCP handler no longer emits docs_mcp:execute_tool"
        );
        assert(
          mcpHandlerSource.includes("posthog?.capture"),
          "MCP handler no longer calls PostHog capture"
        );

        return {
          handler: mcpHandlerPath,
          eventName: "docs_mcp:execute_tool",
        };
      }
    )
  );

  checks.push(
    await runCheck(
      "Preview docs page still renders the feedback widget and avoids preview host leakage",
      async () => {
        const response = await fetchText(`${previewUrl}${SAMPLE_DOC_PATH}`);
        assert(response.status === 200, "Expected preview docs page to return 200", {
          status: response.status,
        });
        assert(
          response.text.includes("Was this page helpful?"),
          "Preview docs page did not contain the feedback widget text"
        );
        assert(
          !response.text.includes("langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app"),
          "Preview page HTML leaked the preview hostname"
        );

        return {
          status: response.status,
          containsFeedbackWidget: true,
        };
      }
    )
  );

  checks.push(
    await runCheck(
      "Migrated root layout still includes the HubSpot and CookieYes integrations kept in the legacy app shell",
      async () => {
        const legacyHasHubspot = legacyAppSource.includes("Hubspot");
        const legacyHasCookieyes = legacyAppSource.includes("cookieyes");
        const newHasHubspot = layoutSource.includes("Hubspot");
        const newHasCookieyes = layoutSource.includes("cookieyes");

        assert(legacyHasHubspot, "Legacy app shell did not include HubSpot");
        assert(legacyHasCookieyes, "Legacy app shell did not include CookieYes");
        assert(newHasHubspot, "Migrated root layout no longer includes HubSpot");
        assert(
          newHasCookieyes,
          "Migrated root layout no longer includes CookieYes"
        );

        return {
          legacyHasHubspot,
          legacyHasCookieyes,
          newHasHubspot,
          newHasCookieyes,
        };
      }
    )
  );

  checks.push(
    await runCheck(
      "Cloud redirect flow still preserves query parameters and hash fragments on same-tab navigation",
      async () => {
        assert(
          cloudRedirectSource.includes("window.location.search"),
          "Cloud redirect page no longer reads the current query string"
        );
        assert(
          cloudRedirectSource.includes("window.location.hash"),
          "Cloud redirect page no longer reads the current hash fragment"
        );
        assert(
          cloudRedirectSource.includes("window.location.assign(targetUrl)"),
          "Cloud redirect page no longer performs the client-side redirect"
        );

        return {
          route: cloudRedirectPath,
          preservesSearch: true,
          preservesHash: true,
        };
      }
    )
  );

  let sink = null;
  let devServer = null;

  try {
    sink = await startSinkServer();
    devServer = await startDevServer(repoRoot, sink.baseUrl, localBaseUrl);

    checks.push(
      await runCheck(
        "Controlled local public docs search call still emits the legacy docs_search:query event",
        async () => {
          const before = sink.requests.length;
          const response = await fetchJson(
            `${localBaseUrl}/api/search-docs?query=${encodeURIComponent(SAMPLE_QUERY)}`
          );
          await sleep(3000);
          const requestsAfter = sink.requests.slice(before);
          const events = collectPosthogEvents(requestsAfter);
          const searchEvent = events.find(
            (event) => event.event === "docs_search:query"
          );

          assert(
            searchEvent,
            "Missing docs_search:query event after public docs search call",
            {
              status: response.status,
              responseBody: response.text,
              events,
              requestsAfter,
            }
          );

          return {
            status: response.status,
            responseBody: response.text,
            events,
          };
        }
      )
    );
  } finally {
    if (devServer) await devServer.stop();
    if (sink) await sink.close();
  }

  const report = {
    executedAt: new Date().toISOString(),
    localBaseUrl,
    previewUrl,
    productionUrl,
    legacyRepoPath,
    summary: {
      total: checks.length,
      passed: checks.filter((check) => check.ok).length,
      failed: checks.filter((check) => !check.ok).length,
    },
    checks,
    devServerLogsTail: devServer?.logs ?? [],
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  const fallbackOutputPath = resolve(
    "review/8-feedback-analytics-and-operational-integrations/artifacts/review-report.json"
  );

  await mkdir(dirname(fallbackOutputPath), { recursive: true });
  await writeFile(
    fallbackOutputPath,
    `${JSON.stringify(
      {
        executedAt: new Date().toISOString(),
        fatalError: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  throw error;
});
