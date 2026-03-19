#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import puppeteer from "puppeteer";

const DEFAULT_BASE_URL =
  "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app";
const DEFAULT_PRODUCTION_URL = "https://langfuse.com";
const DEFAULT_OUTPUT =
  "review/5-search-experience/artifacts/preview-search-report.json";
const SAMPLE_PATH = "/docs/observability/get-started";

const DESKTOP_VIEWPORT = {
  width: 1440,
  height: 1024,
  deviceScaleFactor: 1,
};

const MOBILE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

const QUERY_SPECS = [
  {
    id: "docs",
    label: "Docs",
    query: "python decorator tracing",
    expectedPrefixes: ["/docs/"],
  },
  {
    id: "integrations",
    label: "Integrations",
    query: "goose integration",
    expectedPrefixes: ["/integrations/"],
  },
  {
    id: "self_hosting",
    label: "Self Hosting",
    query: "docker compose self hosting",
    expectedPrefixes: ["/self-hosting/"],
  },
  {
    id: "faq_guides",
    label: "FAQ & Guides",
    query: "missing traces langfuse faq",
    expectedPrefixes: ["/faq/", "/guides/"],
  },
  {
    id: "handbook",
    label: "Handbook",
    query: "hiring process handbook",
    expectedPrefixes: ["/handbook/"],
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

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function summarizeGraphQlResponse(bodyText) {
  const json = safeJsonParse(bodyText);
  const searchHits = json?.data?.search?.searchHits ?? [];
  const errors = (json?.errors ?? []).map((error) => error.message);
  return {
    json,
    errors,
    searchHits,
    hitCount: Array.isArray(searchHits) ? searchHits.length : 0,
  };
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function urlHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function matchesExpectedPrefix(url, expectedPrefixes) {
  try {
    const pathname = new URL(url).pathname;
    return expectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

function redactAuthorizationHeader(headers) {
  return {
    authorizationPresent: Boolean(headers.authorization),
    referer: headers.referer ?? null,
  };
}

function toRelativePath(absPath) {
  const cwd = process.cwd().replace(/\/$/, "");
  return absPath.startsWith(`${cwd}/`) ? absPath.slice(cwd.length + 1) : absPath;
}

function luminance(rgbString) {
  const match = rgbString.match(/\d+/g);
  if (!match || match.length < 3) return null;
  const [red, green, blue] = match.slice(0, 3).map(Number);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
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

async function setViewport(page, viewport) {
  await page.setViewport(viewport);
}

async function gotoSamplePage(page, baseUrl) {
  await page.goto(`${baseUrl}${SAMPLE_PATH}`, {
    waitUntil: "networkidle2",
    timeout: 60_000,
  });
}

async function getThemeState(page) {
  return page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
  }));
}

async function clickThemeToggle(page, targetTheme) {
  const themeState = await getThemeState(page);
  const isDark = /\bdark\b/.test(themeState.htmlClass);
  const desiredDark = targetTheme === "dark";

  if (isDark === desiredDark) return themeState;

  const selector = desiredDark
    ? 'button[aria-label="Switch to dark mode"]'
    : 'button[aria-label="Switch to light mode"]';

  await page.waitForSelector(selector, { timeout: 10_000 });
  await page.click(selector);
  await delay(1_000);

  return getThemeState(page);
}

async function openSearchModalByShortcut(page) {
  const modifier = process.platform === "darwin" ? "Meta" : "Control";

  await page.keyboard.down(modifier);
  await page.keyboard.press("KeyK");
  await page.keyboard.up(modifier);

  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[id^="inkeep-shadowradix"]')].some(
        (host) =>
          host.shadowRoot?.querySelector('[role="dialog"]') &&
          host.shadowRoot?.querySelector('input[placeholder="Search..."]')
      ),
    { timeout: 10_000 }
  );
}

async function getActiveSearchHostId(page) {
  return page.evaluate(() => {
    const candidates = [...document.querySelectorAll('[id^="inkeep-shadowradix"]')]
      .filter(
        (host) =>
          host.shadowRoot?.querySelector('[role="dialog"]') &&
          host.shadowRoot?.querySelector('input[placeholder="Search..."]')
      )
      .filter((host) => {
        const dialog = host.shadowRoot?.querySelector('[role="dialog"]');
        if (!dialog) return false;
        const style = getComputedStyle(dialog);
        return style.display !== "none" && style.visibility !== "hidden";
      });

    return candidates.at(-1)?.id ?? null;
  });
}

async function getInputHandle(page, hostId) {
  const handle = await page.evaluateHandle((id) => {
    return document
      .getElementById(id)
      ?.shadowRoot?.querySelector('input[placeholder="Search..."]');
  }, hostId);

  const element = handle.asElement();
  assert(element, "Failed to resolve search input inside Inkeep shadow root", {
    hostId,
  });
  return element;
}

async function clearAndTypeQuery(page, inputHandle, query) {
  await inputHandle.focus();
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.down(modifier);
  await page.keyboard.press("KeyA");
  await page.keyboard.up(modifier);
  await page.keyboard.press("Backspace");
  await page.keyboard.type(query, { delay: 35 });
}

async function collectDialogState(page, hostId) {
  return page.evaluate((id) => {
    const root = document.getElementById(id)?.shadowRoot;
    const dialog = root?.querySelector('[role="dialog"]');
    const input = root?.querySelector('input[placeholder="Search..."]');

    const tabs = [...(dialog?.querySelectorAll('[role="tab"]') ?? [])].map(
      (tab) => ({
        text: (tab.textContent || "").replace(/\s+/g, " ").trim(),
        selected: tab.getAttribute("aria-selected") === "true",
      })
    );

    const resultLinks = [...(dialog?.querySelectorAll('a[href^="https://"]') ?? [])]
      .map((link) => ({
        text: (link.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200),
        href: link.href,
      }))
      .filter((link) => !link.href.startsWith("https://www.inkeep.com/"));

    const dialogRect = dialog?.getBoundingClientRect();

    return {
      inputValue: input?.value ?? null,
      tabs,
      resultLinks: resultLinks.slice(0, 10),
      dialogText: dialog
        ? (dialog.textContent || "").replace(/\s+/g, " ").trim().slice(0, 1_500)
        : null,
      dialogStyles: dialog
        ? {
            backgroundColor: getComputedStyle(dialog).backgroundColor,
            color: getComputedStyle(dialog).color,
          }
        : null,
      dialogRect: dialogRect
        ? {
            x: dialogRect.x,
            y: dialogRect.y,
            width: dialogRect.width,
            height: dialogRect.height,
            right: dialogRect.right,
            bottom: dialogRect.bottom,
          }
        : null,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  }, hostId);
}

async function runSearchProbeOnce(browser, options) {
  const {
    baseUrl,
    query,
    viewport = DESKTOP_VIEWPORT,
    theme = "dark",
    screenshotPath = null,
    captureRequestHeaders = false,
  } = options;

  const page = await browser.newPage();
  await setViewport(page, viewport);

  const graphqlEvents = [];

  page.on("response", async (response) => {
    if (!response.url().includes("api.inkeep.com/graphql")) return;

    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch {}

    graphqlEvents.push({
      status: response.status(),
      url: response.url(),
      headers: captureRequestHeaders
        ? redactAuthorizationHeader(response.request().headers())
        : null,
      bodyText,
    });
  });

  await gotoSamplePage(page, baseUrl);
  await clickThemeToggle(page, theme);
  await openSearchModalByShortcut(page);

  const hostId = await getActiveSearchHostId(page);
  assert(hostId, "Search modal opened but active host could not be resolved");

  const inputHandle = await getInputHandle(page, hostId);
  await clearAndTypeQuery(page, inputHandle, query);
  await delay(4_500);

  if (screenshotPath) {
    await page.screenshot({
      path: screenshotPath,
      type: "png",
      fullPage: false,
    });
  }

  const dialogState = await collectDialogState(page, hostId);
  const lastGraphqlEvent = graphqlEvents.at(-1) ?? null;
  const graphQlSummary = lastGraphqlEvent
    ? summarizeGraphQlResponse(lastGraphqlEvent.bodyText)
    : { json: null, errors: ["Missing GraphQL response"], searchHits: [], hitCount: 0 };

  await page.close();

  return {
    pageUrl: `${baseUrl}${SAMPLE_PATH}`,
    modalOpened: true,
    hostId,
    theme,
    query,
    screenshotPath: screenshotPath ? toRelativePath(screenshotPath) : null,
    request: lastGraphqlEvent?.headers ?? null,
    graphQl: {
      status: lastGraphqlEvent?.status ?? null,
      errors: graphQlSummary.errors,
      hitCount: graphQlSummary.hitCount,
      hits: graphQlSummary.searchHits.slice(0, 10).map((hit) => ({
        url: hit.url,
        title: hit.title,
        preview: hit.preview ?? null,
      })),
    },
    dialog: dialogState,
  };
}

async function runSearchProbe(browser, options) {
  try {
    return await runSearchProbeOnce(browser, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldRetry =
      message.includes("detached Frame") ||
      message.includes("Target closed") ||
      message.includes("Session closed");

    if (!shouldRetry) throw error;
    await delay(500);
    return runSearchProbeOnce(browser, options);
  }
}

async function runThemeProbe(browser, baseUrl, artifactDir) {
  const darkScreenshot = resolve(artifactDir, "preview-search-dark.png");
  const lightScreenshot = resolve(artifactDir, "preview-search-light.png");

  const darkProbe = await runSearchProbe(browser, {
    baseUrl,
    query: QUERY_SPECS[0].query,
    theme: "dark",
    screenshotPath: darkScreenshot,
    captureRequestHeaders: true,
  });

  const lightProbe = await runSearchProbe(browser, {
    baseUrl,
    query: QUERY_SPECS[0].query,
    theme: "light",
    screenshotPath: lightScreenshot,
  });

  return {
    darkProbe,
    lightProbe,
    darkLuminance: luminance(darkProbe.dialog.dialogStyles?.backgroundColor ?? ""),
    lightLuminance: luminance(lightProbe.dialog.dialogStyles?.backgroundColor ?? ""),
  };
}

async function runMobileProbe(browser, baseUrl, artifactDir) {
  const screenshotPath = resolve(artifactDir, "preview-search-mobile.png");

  return runSearchProbe(browser, {
    baseUrl,
    query: QUERY_SPECS[0].query,
    viewport: MOBILE_VIEWPORT,
    theme: "dark",
    screenshotPath,
    captureRequestHeaders: true,
  });
}

function matchingHitSummary(probe, expectedPrefixes) {
  const hits = probe.graphQl.hits ?? [];
  const matches = hits.filter((hit) =>
    matchesExpectedPrefix(hit.url, expectedPrefixes)
  );
  const hosts = uniqueStrings(hits.map((hit) => urlHost(hit.url)).filter(Boolean));
  const urls = hits.map((hit) => hit.url);
  const duplicateUrls = urls.filter(
    (value, index) => value && urls.indexOf(value) !== index
  );

  return {
    matchingHits: matches,
    hosts,
    duplicateUrls: uniqueStrings(duplicateUrls),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args["base-url"] ?? DEFAULT_BASE_URL);
  const productionUrl = normalizeBaseUrl(
    args["production-url"] ?? DEFAULT_PRODUCTION_URL
  );
  const outputPath = resolve(args.output ?? DEFAULT_OUTPUT);
  const artifactDir = dirname(outputPath);

  await mkdir(artifactDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: "new" });
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    productionUrl,
    samplePath: SAMPLE_PATH,
    queries: QUERY_SPECS,
    evidence: {},
    checks: [],
  };

  try {
    const previewThemeProbe = await runThemeProbe(browser, baseUrl, artifactDir);
    report.evidence.theme = {
      dark: {
        screenshot: previewThemeProbe.darkProbe.screenshotPath,
        request: previewThemeProbe.darkProbe.request,
        tabs: previewThemeProbe.darkProbe.dialog.tabs,
        dialogStyles: previewThemeProbe.darkProbe.dialog.dialogStyles,
        graphQl: previewThemeProbe.darkProbe.graphQl,
      },
      light: {
        screenshot: previewThemeProbe.lightProbe.screenshotPath,
        tabs: previewThemeProbe.lightProbe.dialog.tabs,
        dialogStyles: previewThemeProbe.lightProbe.dialog.dialogStyles,
        graphQl: previewThemeProbe.lightProbe.graphQl,
      },
    };

    report.checks.push(
      await runCheck(
        "Search modal loads on preview docs pages and the keyboard shortcut works",
        async () => {
          assert(previewThemeProbe.darkProbe.modalOpened, "Search modal did not open");
          assert(
            previewThemeProbe.darkProbe.dialog.inputValue === QUERY_SPECS[0].query,
            "Search input did not accept the desktop query",
            {
              inputValue: previewThemeProbe.darkProbe.dialog.inputValue,
            }
          );

          return {
            pageUrl: previewThemeProbe.darkProbe.pageUrl,
            screenshot: previewThemeProbe.darkProbe.screenshotPath,
            request: previewThemeProbe.darkProbe.request,
            tabs: previewThemeProbe.darkProbe.dialog.tabs,
          };
        }
      )
    );

    report.checks.push(
      await runCheck(
        "Theme synchronization survives dark and light mode transitions",
        async () => {
          const { darkProbe, lightProbe, darkLuminance, lightLuminance } =
            previewThemeProbe;

          assert(
            darkLuminance !== null && lightLuminance !== null,
            "Failed to compute dialog luminance for one or both themes",
            {
              darkBackground: darkProbe.dialog.dialogStyles?.backgroundColor ?? null,
              lightBackground: lightProbe.dialog.dialogStyles?.backgroundColor ?? null,
            }
          );
          assert(
            darkLuminance < lightLuminance,
            "Search dialog did not become lighter after switching the site to light mode",
            {
              darkBackground: darkProbe.dialog.dialogStyles?.backgroundColor ?? null,
              lightBackground: lightProbe.dialog.dialogStyles?.backgroundColor ?? null,
              darkLuminance,
              lightLuminance,
            }
          );

          return {
            dark: {
              screenshot: darkProbe.screenshotPath,
              dialogStyles: darkProbe.dialog.dialogStyles,
            },
            light: {
              screenshot: lightProbe.screenshotPath,
              dialogStyles: lightProbe.dialog.dialogStyles,
            },
          };
        }
      )
    );

    const productionDesktopScreenshot = resolve(
      artifactDir,
      "production-search-dark.png"
    );

    const productionDocsProbe = await runSearchProbe(browser, {
      baseUrl: productionUrl,
      query: QUERY_SPECS[0].query,
      theme: "dark",
      screenshotPath: productionDesktopScreenshot,
      captureRequestHeaders: true,
    });
    report.evidence.productionDocs = {
      screenshot: toRelativePath(productionDesktopScreenshot),
      request: productionDocsProbe.request,
      tabs: productionDocsProbe.dialog.tabs,
      graphQl: productionDocsProbe.graphQl,
    };

    const comparisons = [];
    for (const spec of QUERY_SPECS) {
      const previewProbe =
        spec.id === "docs"
          ? previewThemeProbe.darkProbe
          : await runSearchProbe(browser, {
              baseUrl,
              query: spec.query,
              theme: "dark",
            });

      const productionProbe =
        spec.id === "docs"
          ? productionDocsProbe
          : await runSearchProbe(browser, {
              baseUrl: productionUrl,
              query: spec.query,
              theme: "dark",
            });

      comparisons.push({
        spec,
        previewProbe,
        productionProbe,
        previewMatches: matchingHitSummary(previewProbe, spec.expectedPrefixes),
        productionMatches: matchingHitSummary(productionProbe, spec.expectedPrefixes),
      });
    }

    report.evidence.comparisons = comparisons.map((comparison) => ({
      queryId: comparison.spec.id,
      label: comparison.spec.label,
      query: comparison.spec.query,
      expectedPrefixes: comparison.spec.expectedPrefixes,
      preview: {
        request: comparison.previewProbe.request,
        tabs: comparison.previewProbe.dialog.tabs,
        graphQl: comparison.previewProbe.graphQl,
        matchingHits: comparison.previewMatches.matchingHits,
        hosts: comparison.previewMatches.hosts,
        duplicateUrls: comparison.previewMatches.duplicateUrls,
      },
      production: {
        request: comparison.productionProbe.request,
        tabs: comparison.productionProbe.dialog.tabs,
        graphQl: comparison.productionProbe.graphQl,
        matchingHits: comparison.productionMatches.matchingHits,
        hosts: comparison.productionMatches.hosts,
        duplicateUrls: comparison.productionMatches.duplicateUrls,
      },
    }));

    report.checks.push(
      await runCheck(
        "Representative preview queries return the same content groups production exposes",
        async () => {
          for (const comparison of comparisons) {
            const { spec, previewProbe, productionProbe, previewMatches, productionMatches } =
              comparison;

            assert(
              productionProbe.graphQl.errors.length === 0,
              `Production baseline search failed for ${spec.label}`,
              {
                query: spec.query,
                errors: productionProbe.graphQl.errors,
              }
            );
            assert(
              productionMatches.matchingHits.length > 0,
              `Production baseline did not return a ${spec.label} result for the representative query`,
              {
                query: spec.query,
                expectedPrefixes: spec.expectedPrefixes,
                productionHits: productionProbe.graphQl.hits,
              }
            );
            assert(
              previewProbe.graphQl.errors.length === 0,
              `Preview search returned a provider error for ${spec.label}`,
              {
                query: spec.query,
                errors: previewProbe.graphQl.errors,
                request: previewProbe.request,
              }
            );
            assert(
              previewMatches.matchingHits.length > 0,
              `Preview search did not return a ${spec.label} result for the representative query`,
              {
                query: spec.query,
                expectedPrefixes: spec.expectedPrefixes,
                previewHits: previewProbe.graphQl.hits,
                previewTabs: previewProbe.dialog.tabs,
                productionTabs: productionProbe.dialog.tabs,
                productionHits: productionProbe.graphQl.hits,
              }
            );
          }

          return {
            productionScreenshot: toRelativePath(productionDesktopScreenshot),
            comparisons: comparisons.map((comparison) => ({
              queryId: comparison.spec.id,
              label: comparison.spec.label,
              query: comparison.spec.query,
              preview: {
                request: comparison.previewProbe.request,
                tabs: comparison.previewProbe.dialog.tabs,
                errors: comparison.previewProbe.graphQl.errors,
                hitCount: comparison.previewProbe.graphQl.hitCount,
                matchingHits: comparison.previewMatches.matchingHits,
              },
              production: {
                request: comparison.productionProbe.request,
                tabs: comparison.productionProbe.dialog.tabs,
                errors: comparison.productionProbe.graphQl.errors,
                hitCount: comparison.productionProbe.graphQl.hitCount,
                matchingHits: comparison.productionMatches.matchingHits,
              },
            })),
          };
        }
      )
    );

    report.checks.push(
      await runCheck(
        "Preview search results stay canonical and deduplicated",
        async () => {
          for (const comparison of comparisons) {
            const { spec, previewProbe, previewMatches } = comparison;
            assert(
              previewProbe.graphQl.errors.length === 0,
              `Preview search could not be validated for ${spec.label} because the provider returned an error`,
              {
                query: spec.query,
                errors: previewProbe.graphQl.errors,
                request: previewProbe.request,
              }
            );
            assert(
              previewProbe.graphQl.hits.length > 0,
              `Preview search returned no hits to validate for ${spec.label}`,
              {
                query: spec.query,
              }
            );
            assert(
              previewMatches.hosts.every((host) => host === new URL(productionUrl).host),
              `Preview search returned a non-canonical host for ${spec.label}`,
              {
                query: spec.query,
                hosts: previewMatches.hosts,
              }
            );
            assert(
              previewMatches.duplicateUrls.length === 0,
              `Preview search returned duplicate URLs for ${spec.label}`,
              {
                query: spec.query,
                duplicateUrls: previewMatches.duplicateUrls,
              }
            );
          }

          return {
            canonicalHost: new URL(productionUrl).host,
            comparisons: comparisons.map((comparison) => ({
              queryId: comparison.spec.id,
              hosts: comparison.previewMatches.hosts,
              duplicateUrls: comparison.previewMatches.duplicateUrls,
            })),
          };
        }
      )
    );

    const mobileProbe = await runMobileProbe(browser, baseUrl, artifactDir);
    report.evidence.mobile = {
      screenshot: mobileProbe.screenshotPath,
      tabs: mobileProbe.dialog.tabs,
      dialogRect: mobileProbe.dialog.dialogRect,
      viewport: mobileProbe.dialog.viewport,
      graphQl: mobileProbe.graphQl,
      request: mobileProbe.request,
    };
    report.checks.push(
      await runCheck(
        "Mobile search overlay stays within the viewport and remains usable",
        async () => {
          const { dialogRect, viewport } = mobileProbe.dialog;

          assert(dialogRect, "Mobile search dialog did not render a measurable box");
          assert(
            dialogRect.width <= viewport.width + 1,
            "Mobile search dialog overflowed the viewport width",
            { dialogRect, viewport }
          );
          assert(
            dialogRect.x >= -1 && dialogRect.right <= viewport.width + 1,
            "Mobile search dialog was positioned outside the viewport",
            { dialogRect, viewport }
          );
          assert(
            mobileProbe.graphQl.errors.length === 0,
            "Mobile search returned a provider error",
            {
              errors: mobileProbe.graphQl.errors,
              request: mobileProbe.request,
            }
          );
          assert(
            mobileProbe.graphQl.hitCount > 0,
            "Mobile search returned no results for the representative docs query",
            {
              query: mobileProbe.query,
              tabs: mobileProbe.dialog.tabs,
            }
          );

          return {
            screenshot: mobileProbe.screenshotPath,
            dialogRect,
            viewport,
          };
        }
      )
    );
  } finally {
    await browser.close();
  }

  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const failedChecks = report.checks.filter((check) => !check.ok);
  if (failedChecks.length > 0) {
    process.exitCode = 1;
  }
}

await main();
