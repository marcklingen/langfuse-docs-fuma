import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapterDir = path.resolve(__dirname, "..");
const OUTPUT_DIR = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.join(chapterDir, "evidence");
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, "screenshots");

const BASE_URL = normalizeBaseUrl(
  process.env.BASE_URL ||
    "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app"
);
const HEADLESS = process.env.HEADLESS !== "false";
const EXPECT_PRODUCTION_SCRIPTS = resolveBooleanEnv(
  process.env.EXPECT_PRODUCTION_SCRIPTS,
  !isLocalBaseUrl(BASE_URL)
);
const EXPECT_ANALYTICS_EVENTS = resolveBooleanEnv(
  process.env.EXPECT_ANALYTICS_EVENTS,
  false
);
const ENABLE_FEEDBACK_API_POST = process.env.ENABLE_FEEDBACK_API_POST === "true";
const FEEDBACK_EXPECT_SUCCESS = resolveBooleanEnv(
  process.env.FEEDBACK_EXPECT_SUCCESS,
  true
);

const DESKTOP_VIEWPORT = { width: 1440, height: 1200 };
const FEEDBACK_TEST_PATH = "/docs/observability/overview";
const UTM_TEST_PATH =
  "/cloud/login?utm_source=codex&utm_medium=review&utm_campaign=chapter8#handoff";
const HUBSPOT_SCRIPT_URL = "https://js-eu1.hs-scripts.com/143255669.js";
const COOKIEYES_SCRIPT_URL =
  "https://cdn-cookieyes.com/client_data/40247147630c6589ad01a874/script.js";

const FEEDBACK_SURFACE_ROUTES = [
  {
    id: "docs-overview",
    label: "Docs overview",
    path: "/docs/observability/overview",
    expectWidget: true,
    expectCopyButton: true,
  },
  {
    id: "guide-video",
    label: "Guide video",
    path: "/guides/videos/run-langfuse-locally",
    expectWidget: true,
    expectCopyButton: true,
  },
  {
    id: "faq-article",
    label: "FAQ article",
    path: "/faq/all/langfuse-support",
    expectWidget: true,
    expectCopyButton: true,
  },
  {
    id: "changelog-entry",
    label: "Changelog entry",
    path: "/changelog/2025-06-04-open-sourcing-langfuse",
    expectWidget: true,
    expectCopyButton: false,
  },
  {
    id: "pricing",
    label: "Wide marketing page",
    path: "/pricing",
    expectWidget: true,
    expectCopyButton: false,
  },
  {
    id: "blog-negative-control",
    label: "Blog post negative control",
    path: "/blog/2025-03-19-ai-agent-comparison",
    expectWidget: false,
    expectCopyButton: false,
  },
];

const ENV_CONTRACT = {
  required: [
    {
      name: "WEBSITE_FEEDBACK_WEBHOOK",
      purpose: "Forwards docs feedback submissions from `/api/feedback`",
      files: ["app/api/feedback/route.ts", ".env.template"],
    },
    {
      name: "NEXT_PUBLIC_POSTHOG_KEY",
      purpose: "Enables client-side PostHog analytics and MCP event tracking",
      files: [
        "components/analytics/PostHogProvider.tsx",
        "lib/mcp-handler.ts",
        ".env.template",
      ],
    },
    {
      name: "NEXT_PUBLIC_POSTHOG_HOST",
      purpose: "Selects the PostHog ingestion host for browser and MCP events",
      files: [
        "components/analytics/PostHogProvider.tsx",
        "lib/mcp-handler.ts",
        ".env.template",
      ],
    },
    {
      name: "NEXT_PUBLIC_INKEEP_API_KEY",
      purpose: "Bootstraps the client-side Inkeep widget used by site search and Ask AI",
      files: ["components/inkeep/useInkeepSettings.ts", ".env.template"],
    },
    {
      name: "INKEEP_BACKEND_API_KEY",
      purpose: "Powers server-side Inkeep RAG calls used by `/api/search-docs` and MCP search",
      files: ["lib/inkeep-search.ts", ".env.template"],
    },
  ],
  optional: [
    {
      name: "NEXT_PUBLIC_PLAIN_APP_ID",
      purpose: "Enables the authenticated Plain support-chat integration",
      files: ["components/supportChat/index.tsx", ".env.template"],
    },
  ],
};

async function main() {
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    defaultViewport: null,
  });

  try {
    const docsFeedback = await runDocsFeedbackReview(browser);
    const analyticsSurface = await runAnalyticsSurfaceReview(browser);
    const feedbackApi = await inspectFeedbackApi();
    const utmRetention = await runUtmRetentionReview(browser);
    const envContract = await inspectEnvContract();

    const summary = buildSummary({
      docsFeedback,
      analyticsSurface,
      feedbackApi,
      utmRetention,
      envContract,
    });

    await Promise.all([
      writeJson("docs-feedback.json", docsFeedback),
      writeJson("analytics-surface.json", analyticsSurface),
      writeJson("feedback-api.json", feedbackApi),
      writeJson("utm-retention.json", utmRetention),
      writeJson("env-contract.json", envContract),
      writeJson("summary.json", summary),
      fs.writeFile(
        path.join(OUTPUT_DIR, "summary.md"),
        buildSummaryMarkdown(summary),
        "utf8"
      ),
    ]);

    if (summary.checks.some((check) => check.result === "FAIL")) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

async function runDocsFeedbackReview(browser) {
  const surfaceChecks = [];

  for (const route of FEEDBACK_SURFACE_ROUTES) {
    surfaceChecks.push(await inspectFeedbackSurface(browser, route));
  }

  const positiveFlow = await runFeedbackFlow(browser, "positive");
  const negativeFlow = await runFeedbackFlow(browser, "negative");

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    surfaceChecks,
    positiveFlow,
    negativeFlow,
    pass:
      surfaceChecks.every((check) => check.pass) &&
      positiveFlow.pass &&
      negativeFlow.pass,
  };
}

async function inspectFeedbackSurface(browser, route) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    await gotoPath(page, route.path);

    const details = await page.evaluate(() => {
      const footer = document.querySelector("#docs-feedback");
      const footerText = footer?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const actionElements = Array.from(
        document.querySelectorAll("button, a")
      ).map((element) => ({
        text: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
        href:
          element instanceof HTMLAnchorElement
            ? element.getAttribute("href")
            : null,
      }));

      return {
        hasFooter: Boolean(footer),
        footerText,
        hasFeedbackPrompt: footerText.includes("Was this page helpful?"),
        hasSupportLink: footerText.includes("Support"),
        hasCopyButton: actionElements.some((entry) =>
          entry.text.includes("Copy page")
        ),
      };
    });

    const assertions = [];
    pushAssertion(
      assertions,
      `${route.label} ${
        route.expectWidget ? "shows" : "does not show"
      } the docs feedback footer`,
      route.expectWidget
        ? details.hasFooter && details.hasFeedbackPrompt && details.hasSupportLink
        : !details.hasFooter,
      details
    );

    pushAssertion(
      assertions,
      `${route.label} ${
        route.expectCopyButton ? "shows" : "does not show"
      } the copy-as-markdown button`,
      route.expectCopyButton ? details.hasCopyButton : !details.hasCopyButton,
      details
    );

    return {
      ...route,
      assertions,
      pass: assertions.every((assertion) => assertion.pass),
    };
  });
}

async function runFeedbackFlow(browser, kind) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    const interceptedRequests = [];

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (isFeedbackRequest(request.url())) {
        interceptedRequests.push({
          url: request.url(),
          method: request.method(),
          body: parseJsonSafely(request.postData()),
        });
        void request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "OK" }),
        });
        return;
      }

      void request.continue();
    });

    await gotoPath(page, FEEDBACK_TEST_PATH);
    await scrollIntoView(page, "#docs-feedback");

    if (kind === "positive") {
      await clickElementWithText(page, "button", "Yes");
      await waitForText(page, "What was most helpful?");
      await page.type("textarea", "Clear walkthrough of the product surface.");
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, "positive-feedback-dialog.png"),
        fullPage: false,
      });
    } else {
      await clickElementWithText(page, "button", "No");
      await waitForText(page, "Documentation is super important to us");
      const sendDisabledBeforeTyping = await findButtonDisabledState(
        page,
        "Send feedback"
      );
      await page.type(
        "textarea",
        "The page is missing a concrete setup example and expected output."
      );
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, "negative-feedback-dialog.png"),
        fullPage: false,
      });

      if (sendDisabledBeforeTyping !== true) {
        return buildFlowResult(kind, interceptedRequests, [
          {
            label:
              "Negative flow keeps the submit button disabled until a comment is entered",
            pass: false,
            details: { sendDisabledBeforeTyping },
          },
        ]);
      }
    }

    await clickElementWithText(page, "button", "Send feedback");
    await waitForText(page, "Thank you for your feedback!");

    const assertions = [];
    pushAssertion(
      assertions,
      `${titleCase(kind)} feedback flow sends the initial rating request`,
      interceptedRequests.length >= 1,
      { interceptedRequests }
    );
    pushAssertion(
      assertions,
      `${titleCase(kind)} feedback flow sends a follow-up request with the comment`,
      interceptedRequests.length >= 2 &&
        interceptedRequests[1]?.body?.feedback === kind &&
        typeof interceptedRequests[1]?.body?.comment === "string" &&
        interceptedRequests[1].body.comment.length > 0,
      { interceptedRequests }
    );
    pushAssertion(
      assertions,
      `${titleCase(kind)} feedback flow posts the current page path`,
      interceptedRequests.every(
        (request) => request.body?.page === FEEDBACK_TEST_PATH
      ),
      { interceptedRequests }
    );

    return buildFlowResult(kind, interceptedRequests, assertions);
  });
}

function buildFlowResult(kind, interceptedRequests, assertions) {
  return {
    kind,
    interceptedRequests,
    assertions,
    pass: assertions.every((assertion) => assertion.pass),
  };
}

async function runAnalyticsSurfaceReview(browser) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    const observedRequests = [];
    const posthogEvents = [];

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (isInterestingAnalyticsRequest(url)) {
        const record = {
          url,
          method: request.method(),
          resourceType: request.resourceType(),
        };
        observedRequests.push(record);

        if (isPosthogRequest(url)) {
          posthogEvents.push(...extractPosthogEvents(request.postData()));
        }
      }

      void request.continue();
    });

    await gotoPath(page, FEEDBACK_TEST_PATH);
    await waitForNetworkSettling(page, 1500);
    await clickElementWithText(page, "button", "Copy page");
    await waitForNetworkSettling(page, 1500);

    const uniqueHosts = [...new Set(observedRequests.map((request) => hostOf(request.url)))];
    const assertions = [];

    pushAssertion(
      assertions,
      "HubSpot script loads on production-style deployments",
      !EXPECT_PRODUCTION_SCRIPTS ||
        observedRequests.some((request) =>
          request.url.startsWith(HUBSPOT_SCRIPT_URL)
        ),
      { observedRequests, EXPECT_PRODUCTION_SCRIPTS }
    );
    pushAssertion(
      assertions,
      "CookieYes script loads on production-style deployments",
      !EXPECT_PRODUCTION_SCRIPTS ||
        observedRequests.some((request) =>
          request.url.startsWith(COOKIEYES_SCRIPT_URL)
        ),
      { observedRequests, EXPECT_PRODUCTION_SCRIPTS }
    );
    pushAssertion(
      assertions,
      "PostHog pageview and copy_page events are observed when analytics parity is required",
      !EXPECT_ANALYTICS_EVENTS ||
        (posthogEvents.some((event) => event.event === "$pageview") &&
          posthogEvents.some((event) => event.event === "copy_page")),
      { posthogEvents, EXPECT_ANALYTICS_EVENTS }
    );

    return {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      expectations: {
        expectProductionScripts: EXPECT_PRODUCTION_SCRIPTS,
        expectAnalyticsEvents: EXPECT_ANALYTICS_EVENTS,
      },
      uniqueHosts,
      observedRequests,
      posthogEvents,
      assertions,
      pass: assertions.every((assertion) => assertion.pass),
    };
  });
}

async function inspectFeedbackApi() {
  if (!ENABLE_FEEDBACK_API_POST) {
    return {
      enabled: false,
      skipped: true,
      reason:
        "Disabled by default to avoid sending live feedback. Enable only when the target deployment points to a test webhook sink.",
      pass: true,
    };
  }

  const response = await fetch(`${BASE_URL}/api/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      page: FEEDBACK_TEST_PATH,
      feedback: "positive",
      comment: "Synthetic review submission from Chapter 8 automation.",
    }),
  });

  const bodyText = await response.text();

  return {
    enabled: true,
    skipped: false,
    status: response.status,
    ok: response.ok,
    headers: headersToObject(response.headers),
    bodyPreview: bodyText.slice(0, 400),
    pass: FEEDBACK_EXPECT_SUCCESS ? response.ok : true,
  };
}

async function runUtmRetentionReview(browser) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    await gotoUrl(page, `${BASE_URL}${UTM_TEST_PATH}`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      clickElementWithHrefPrefix(page, "https://us.cloud.langfuse.com"),
    ]);

    const redirectedUrl = page.url();
    const assertions = [];

    pushAssertion(
      assertions,
      "Cloud region redirect preserves the UTM query string",
      redirectedUrl.includes("utm_source=codex") &&
        redirectedUrl.includes("utm_medium=review") &&
        redirectedUrl.includes("utm_campaign=chapter8"),
      { redirectedUrl }
    );
    pushAssertion(
      assertions,
      "Cloud region redirect preserves the hash fragment",
      redirectedUrl.endsWith("#handoff"),
      { redirectedUrl }
    );

    return {
      startUrl: `${BASE_URL}${UTM_TEST_PATH}`,
      redirectedUrl,
      assertions,
      pass: assertions.every((assertion) => assertion.pass),
    };
  });
}

async function inspectEnvContract() {
  const templatePath = path.resolve(process.cwd(), ".env.template");
  const templateText = await readOptionalText(templatePath);

  const inspectEntries = async (entries) =>
    Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        inEnvTemplate: templateText?.includes(entry.name) ?? false,
        fileChecks: await Promise.all(
          entry.files.map(async (file) => {
            const fileText = await readOptionalText(path.resolve(process.cwd(), file));
            return {
              file,
              mentionsVar: fileText?.includes(entry.name) ?? false,
            };
          })
        ),
      }))
    );

  const required = await inspectEntries(ENV_CONTRACT.required);
  const optional = await inspectEntries(ENV_CONTRACT.optional);

  return {
    generatedAt: new Date().toISOString(),
    required,
    optional,
    pass: required.every(
      (entry) =>
        entry.fileChecks.every((check) => check.mentionsVar) && entry.inEnvTemplate
    ),
  };
}

function buildSummary(report) {
  const checks = [
    summarizeCheck("feedback widget surface", report.docsFeedback.pass),
    summarizeCheck("positive feedback dialog flow", report.docsFeedback.positiveFlow.pass),
    summarizeCheck("negative feedback dialog flow", report.docsFeedback.negativeFlow.pass),
    summarizeCheck("analytics surface", report.analyticsSurface.pass),
    summarizeCheck("feedback API live POST", report.feedbackApi.pass, {
      skipped: report.feedbackApi.skipped,
    }),
    summarizeCheck("UTM retention", report.utmRetention.pass),
    summarizeCheck("environment contract", report.envContract.pass),
  ];

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    checks,
    notes: [
      report.feedbackApi.skipped
        ? "Live /api/feedback verification was skipped. Enable ENABLE_FEEDBACK_API_POST only against a safe webhook sink."
        : null,
      "Inkeep search-event parity and MCP PostHog parity still require the manual checks documented in manual/notes.md.",
    ].filter(Boolean),
  };
}

function buildSummaryMarkdown(summary) {
  const lines = [
    "# Chapter 8 Summary",
    "",
    `- Base URL: ${summary.baseUrl}`,
    `- Generated at: ${summary.generatedAt}`,
    "",
    "## Checks",
    "",
    "| Check | Result |",
    "| --- | --- |",
    ...summary.checks.map((check) => `| ${check.label} | ${check.result} |`),
  ];

  if (summary.notes.length > 0) {
    lines.push("", "## Notes", "");
    for (const note of summary.notes) {
      lines.push(`- ${note}`);
    }
  }

  return lines.join("\n");
}

function summarizeCheck(label, pass, options = {}) {
  if (options.skipped) {
    return { label, result: "SKIP" };
  }

  return { label, result: pass ? "PASS" : "FAIL" };
}

async function withPage(browser, viewport, fn) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.setDefaultTimeout(30000);

  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}

async function gotoPath(page, routePath) {
  await gotoUrl(page, `${BASE_URL}${routePath}`);
}

async function gotoUrl(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("body");
  await waitForNetworkSettling(page, 750);
}

async function waitForNetworkSettling(page, delayMs) {
  await page.waitForNetworkIdle({ idleTime: 250, timeout: 5000 }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function scrollIntoView(page, selector) {
  await page.$eval(selector, (element) =>
    element.scrollIntoView({ block: "center", behavior: "auto" })
  );
}

async function waitForText(page, text) {
  await page.waitForFunction(
    (targetText) => document.body.innerText.includes(targetText),
    {},
    text
  );
}

async function clickElementWithText(page, selector, text) {
  const elements = await page.$$(selector);

  for (const element of elements) {
    const elementText = await page.evaluate(
      (node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "",
      element
    );

    if (elementText.includes(text)) {
      await element.click();
      return;
    }
  }

  throw new Error(`Failed to click ${selector} with text "${text}"`);
}

async function clickElementWithHrefPrefix(page, hrefPrefix) {
  const anchors = await page.$$("a");

  for (const anchor of anchors) {
    const href = await page.evaluate(
      (node) => node.getAttribute("href") ?? "",
      anchor
    );

    if (href.startsWith(hrefPrefix)) {
      await anchor.click();
      return;
    }
  }

  throw new Error(`Failed to click anchor with href prefix "${hrefPrefix}"`);
}

async function findButtonDisabledState(page, buttonText) {
  return page.evaluate((text) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((button) =>
      button.textContent?.replace(/\s+/g, " ").trim().includes(text)
    );
    return target instanceof HTMLButtonElement ? target.disabled : null;
  }, buttonText);
}

function pushAssertion(assertions, label, pass, details) {
  assertions.push({ label, pass, details });
}

function normalizeBaseUrl(url) {
  return url.replace(/\/$/, "");
}

function resolveBooleanEnv(rawValue, fallback) {
  if (rawValue == null) return fallback;
  return rawValue !== "false";
}

function isLocalBaseUrl(url) {
  try {
    const parsed = new URL(url);
    return ["localhost", "127.0.0.1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function isFeedbackRequest(url) {
  try {
    return new URL(url).pathname === "/api/feedback";
  } catch {
    return false;
  }
}

function isInterestingAnalyticsRequest(url) {
  return (
    url.startsWith(HUBSPOT_SCRIPT_URL) ||
    url.startsWith(COOKIEYES_SCRIPT_URL) ||
    isPosthogRequest(url)
  );
}

function isPosthogRequest(url) {
  return /posthog\.com/.test(url);
}

function extractPosthogEvents(postData) {
  if (!postData) return [];

  const candidates = [postData];

  try {
    const params = new URLSearchParams(postData);
    if (params.get("data")) candidates.push(params.get("data"));
    if (params.get("batch")) candidates.push(params.get("batch"));
  } catch {}

  for (const candidate of candidates) {
    const parsed = parseJsonSafely(candidate);
    const events = eventsFromParsedPosthogPayload(parsed);
    if (events.length > 0) return events;
  }

  return [];
}

function eventsFromParsedPosthogPayload(parsed) {
  if (!parsed || typeof parsed !== "object") return [];

  if (Array.isArray(parsed.batch)) {
    return parsed.batch
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => sanitizePosthogEvent(entry));
  }

  if (typeof parsed.event === "string") {
    return [sanitizePosthogEvent(parsed)];
  }

  return [];
}

function sanitizePosthogEvent(entry) {
  return {
    event: entry.event ?? null,
    distinctId:
      entry.distinct_id ?? entry.properties?.distinct_id ?? entry.distinctId ?? null,
    properties: entry.properties ?? {},
  };
}

function parseJsonSafely(value) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function headersToObject(headers) {
  return Object.fromEntries(headers.entries());
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function writeJson(filename, value) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, filename),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

async function readOptionalText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

await main();
