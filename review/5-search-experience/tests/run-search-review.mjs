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

const PREVIEW_BASE_URL = normalizeBaseUrl(
  process.env.PREVIEW_BASE_URL ||
    "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app"
);
const PRODUCTION_BASE_URL = normalizeBaseUrl(
  process.env.PROD_BASE_URL || "https://langfuse.com"
);
const HEADLESS = process.env.HEADLESS !== "false";

const DESKTOP_VIEWPORT = { width: 1440, height: 1200 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DOCS_PATH = "/docs/prompt-management/get-started";

const UI_QUERIES = [
  {
    id: "docker-compose",
    query: "docker compose",
    expectedScopes: [
      "Integrations",
      "Self Hosting",
      "FAQ & Guides",
      "All",
      "GitHub",
    ],
  },
  {
    id: "open-source-handbook",
    query: "open source handbook",
    expectedScopes: ["Handbook", "All"],
  },
];

const API_QUERY_CASES = [
  {
    id: "docs",
    label: "Docs",
    query: "prompt management",
    expectedUrl: "https://langfuse.com/docs/prompt-management/overview",
  },
  {
    id: "integrations",
    label: "Integrations",
    query: "goose integration",
    expectedUrl: "https://langfuse.com/integrations/no-code/goose",
  },
  {
    id: "self-hosting",
    label: "Self-hosting",
    query: "docker compose",
    expectedUrl: "https://langfuse.com/self-hosting/deployment/docker-compose",
  },
  {
    id: "faq",
    label: "FAQ",
    query: "unwanted http database spans",
    expectedUrl: "https://langfuse.com/faq/all/unwanted-http-database-spans",
  },
  {
    id: "handbook",
    label: "Handbook",
    query: "open source handbook",
    expectedUrl: "https://langfuse.com/handbook/chapters/open-source",
  },
];

async function main() {
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    defaultViewport: null,
  });

  try {
    const previewDesktop = await runPreviewDesktopCheck(browser);
    const productionDesktop = await runProductionDesktopBaseline(browser);
    const previewThemeSync = await runPreviewThemeSyncCheck(browser);
    const previewMobile = await runPreviewMobileCheck(browser);
    const apiRelevance = await runApiRelevanceChecks();

    const searchUi = {
      generatedAt: new Date().toISOString(),
      previewBaseUrl: PREVIEW_BASE_URL,
      productionBaseUrl: PRODUCTION_BASE_URL,
      previewDesktop,
      productionDesktop,
      previewThemeSync,
      previewMobile,
    };

    const summary = buildSummary(searchUi, apiRelevance);

    await Promise.all([
      writeJson("search-ui.json", searchUi),
      writeJson("search-api-relevance.json", apiRelevance),
      writeJson("summary.json", summary),
      fs.writeFile(
        path.join(OUTPUT_DIR, "summary.md"),
        buildSummaryMarkdown(summary, searchUi, apiRelevance),
        "utf8"
      ),
    ]);

    if (summary.status === "FAIL") {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

async function runPreviewDesktopCheck(browser) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    const consoleMessages = [];
    page.on("console", (message) => {
      consoleMessages.push({
        type: message.type(),
        text: message.text(),
      });
    });

    await gotoPath(page, PREVIEW_BASE_URL, DOCS_PATH, {
      waitForSelector: "h1",
    });

    const triggerInventory = await collectVisibleSearchTriggers(page);

    const keyboardShortcut = await (async () => {
      await page.mouse.click(30, 30);
      await page.keyboard.down("Control");
      await page.keyboard.press("KeyK");
      await page.keyboard.up("Control");
      const opened = await waitForSearchDialog(page);
      const dialogState = opened ? await collectDialogState(page) : null;
      if (opened) {
        await closeSearchDialog(page);
      }
      return {
        opened,
        dialogState,
      };
    })();

    const queries = [];
    for (const querySpec of UI_QUERIES) {
      const consoleStartIndex = consoleMessages.length;
      await openSearchViaTrigger(page);
      await runDialogQuery(page, querySpec.query);
      const dialogState = await collectDialogState(page);
      dialogState.graphqlWarnings = consoleMessages
        .slice(consoleStartIndex)
        .filter((entry) => /graphqlRequest|Not authenticated/i.test(entry.text));
      const screenshot =
        querySpec.id === "docker-compose"
          ? "screenshots/preview-desktop-search-light.png"
          : null;
      if (screenshot) {
        await page.screenshot({
          path: path.join(OUTPUT_DIR, screenshot),
          fullPage: false,
        });
      }
      queries.push({
        ...querySpec,
        dialogState,
        screenshot,
      });
      await closeSearchDialog(page);
    }

    const assertions = [];
    pushAssertion(
      assertions,
      "Preview desktop docs page renders at least one visible search trigger",
      triggerInventory.visibleCount > 0,
      triggerInventory
    );
    pushAssertion(
      assertions,
      "Preview desktop search opens via keyboard shortcut",
      keyboardShortcut.opened,
      keyboardShortcut
    );

    return {
      path: DOCS_PATH,
      triggerInventory,
      keyboardShortcut,
      queries,
      consoleMessages,
      assertions,
      pass: assertions.every((assertion) => assertion.pass),
    };
  });
}

async function runProductionDesktopBaseline(browser) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    await gotoPath(page, PRODUCTION_BASE_URL, DOCS_PATH, {
      waitForSelector: "h1",
    });

    const queries = [];
    for (const querySpec of UI_QUERIES) {
      await openSearchViaTrigger(page);
      await runDialogQuery(page, querySpec.query);
      const dialogState = await collectDialogState(page);
      const screenshot =
        querySpec.id === "docker-compose"
          ? "screenshots/production-desktop-search-light.png"
          : null;
      if (screenshot) {
        await page.screenshot({
          path: path.join(OUTPUT_DIR, screenshot),
          fullPage: false,
        });
      }
      queries.push({
        ...querySpec,
        dialogState,
        screenshot,
      });
      await closeSearchDialog(page);
    }

    return {
      path: DOCS_PATH,
      queries,
    };
  });
}

async function runPreviewThemeSyncCheck(browser) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    await gotoPath(page, PREVIEW_BASE_URL, DOCS_PATH, {
      waitForSelector: "h1",
    });

    await openSearchViaTrigger(page);
    await runDialogQuery(page, UI_QUERIES[0].query);
    const lightDialog = await collectDialogState(page);
    await closeSearchDialog(page);

    await toggleTheme(page);
    await page.waitForFunction(() =>
      document.documentElement.className.includes("dark")
    );

    await openSearchViaTrigger(page);
    await runDialogQuery(page, UI_QUERIES[0].query);
    const darkDialog = await collectDialogState(page);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "screenshots/preview-desktop-search-dark.png"),
      fullPage: false,
    });
    await closeSearchDialog(page);

    const assertions = [];
    pushAssertion(
      assertions,
      "Preview search modal follows the site theme toggle",
      lightDialog.dialogBackground !== darkDialog.dialogBackground &&
        lightDialog.documentClassName.includes("light") &&
        darkDialog.documentClassName.includes("dark"),
      { lightDialog, darkDialog }
    );

    return {
      lightDialog,
      darkDialog,
      assertions,
      pass: assertions.every((assertion) => assertion.pass),
    };
  });
}

async function runPreviewMobileCheck(browser) {
  return withPage(browser, MOBILE_VIEWPORT, async (page) => {
    const consoleMessages = [];
    page.on("console", (message) => {
      consoleMessages.push({
        type: message.type(),
        text: message.text(),
      });
    });

    await gotoPath(page, PREVIEW_BASE_URL, DOCS_PATH, {
      waitForSelector: "h1",
    });

    await openSearchViaTrigger(page);
    await runDialogQuery(page, UI_QUERIES[0].query);
    const dialogState = await collectDialogState(page);
    dialogState.graphqlWarnings = consoleMessages.filter((entry) =>
      /graphqlRequest|Not authenticated/i.test(entry.text)
    );
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "screenshots/preview-mobile-search.png"),
      fullPage: false,
    });
    await closeSearchDialog(page);

    const assertions = [];
    pushAssertion(
      assertions,
      "Preview mobile search modal opens from the docs page",
      dialogState.isOpen,
      dialogState
    );

    return {
      path: DOCS_PATH,
      dialogState,
      consoleMessages,
      assertions,
      pass: assertions.every((assertion) => assertion.pass),
    };
  });
}

async function runApiRelevanceChecks() {
  const previewQueries = [];
  const productionQueries = [];

  for (const querySpec of API_QUERY_CASES) {
    previewQueries.push(await inspectApiQuery(PREVIEW_BASE_URL, querySpec));
    productionQueries.push(await inspectApiQuery(PRODUCTION_BASE_URL, querySpec));
  }

  return {
    generatedAt: new Date().toISOString(),
    previewBaseUrl: PREVIEW_BASE_URL,
    productionBaseUrl: PRODUCTION_BASE_URL,
    previewQueries,
    productionQueries,
  };
}

async function inspectApiQuery(baseUrl, querySpec) {
  const response = await fetch(
    `${baseUrl}/api/search-docs?query=${encodeURIComponent(querySpec.query)}`
  );
  const body = await response.json();
  const parsedAnswer = safeJsonParse(body.answer) ?? { content: [] };
  const documents = Array.isArray(parsedAnswer.content)
    ? parsedAnswer.content.filter((item) => item?.type === "document")
    : [];
  const urls = documents.map((item) => item.url).filter(Boolean);
  const duplicateUrls = findDuplicates(urls);
  const topUrl = urls[0] ?? null;
  const hosts = Array.from(new Set(urls.map((url) => safeUrl(url)?.host).filter(Boolean)));
  const hasPreviewHost = hosts.some((host) => host.includes("vercel.app"));
  const topUrlMatchesExpectation = topUrl === querySpec.expectedUrl;

  return {
    ...querySpec,
    status: response.status,
    topUrl,
    topUrlMatchesExpectation,
    hosts,
    hasPreviewHost,
    duplicateUrls,
    topDocuments: documents.slice(0, 5).map((item) => ({
      recordType: item.record_type ?? null,
      title: item.title ?? null,
      url: item.url ?? null,
    })),
  };
}

function buildSummary(searchUi, apiRelevance) {
  const findings = [];
  const checks = [];

  checks.push({
    name: "preview-desktop-trigger",
    previewPass: searchUi.previewDesktop.assertions.every((item) => item.pass),
    productionPass: true,
  });
  checks.push({
    name: "preview-theme-sync",
    previewPass: searchUi.previewThemeSync.pass,
    productionPass: true,
  });
  checks.push({
    name: "preview-mobile-search",
    previewPass: searchUi.previewMobile.pass,
    productionPass: true,
  });

  for (const querySpec of UI_QUERIES) {
    const previewQuery = searchUi.previewDesktop.queries.find(
      (item) => item.id === querySpec.id
    );
    const productionQuery = searchUi.productionDesktop.queries.find(
      (item) => item.id === querySpec.id
    );
    const previewScopes = previewQuery
      ? normalizeScopeLabels(previewQuery.dialogState.tabs)
      : [];
    const productionScopes = productionQuery
      ? normalizeScopeLabels(productionQuery.dialogState.tabs)
      : [];
    const missingScopes = productionScopes.filter(
      (scope) => !previewScopes.includes(scope)
    );

    checks.push({
      name: `ui-query-${querySpec.id}`,
      previewPass:
        previewScopes.length > 0 &&
        querySpec.expectedScopes.every((scope) => previewScopes.includes(scope)),
      productionPass:
        productionScopes.length > 0 &&
        querySpec.expectedScopes.every((scope) => productionScopes.includes(scope)),
    });

    if (missingScopes.length > 0) {
      findings.push({
        id: `preview-ui-${querySpec.id}-missing-scopes`,
        severity: "high",
        title: `Preview search query "${querySpec.query}" does not expose the expected search scopes`,
        evidenceFile: "search-ui.json",
        details: `Preview scopes ${formatList(previewScopes)} do not match production scopes ${formatList(productionScopes)} for "${querySpec.query}". Missing on preview: ${formatList(missingScopes)}.`,
      });
    }

    if (
      previewQuery &&
      productionQuery &&
      previewQuery.dialogState.optionCount <= 1 &&
      productionQuery.dialogState.optionCount > previewQuery.dialogState.optionCount
    ) {
      findings.push({
        id: `preview-ui-${querySpec.id}-no-results`,
        severity: "high",
        title: `Preview search query "${querySpec.query}" returns no real client-side results`,
        evidenceFile: "search-ui.json",
        details: `Preview only surfaced ${previewQuery.dialogState.optionCount} option(s) and emitted GraphQL warnings, while production surfaced ${productionQuery.dialogState.optionCount} option(s) for the same query.`,
      });
    }
  }

  for (const previewQuery of apiRelevance.previewQueries) {
    const productionQuery = apiRelevance.productionQueries.find(
      (item) => item.id === previewQuery.id
    );
    const previewPass =
      previewQuery.status === 200 &&
      previewQuery.topUrlMatchesExpectation &&
      !previewQuery.hasPreviewHost &&
      previewQuery.duplicateUrls.length <= (productionQuery?.duplicateUrls.length ?? 0);
    const productionPass =
      productionQuery?.status === 200 &&
      productionQuery.topUrlMatchesExpectation &&
      !productionQuery.hasPreviewHost;

    checks.push({
      name: `api-query-${previewQuery.id}`,
      previewPass,
      productionPass,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    status: findings.length > 0 ? "FAIL" : "PASS",
    previewBaseUrl: PREVIEW_BASE_URL,
    productionBaseUrl: PRODUCTION_BASE_URL,
    findings: dedupeFindings(findings),
    checks,
  };
}

function buildSummaryMarkdown(summary, searchUi, apiRelevance) {
  const lines = [];
  lines.push("# Chapter 5 Search Review Summary");
  lines.push("");
  lines.push(`- Generated: ${summary.generatedAt}`);
  lines.push(`- Preview: ${summary.previewBaseUrl}`);
  lines.push(`- Production baseline: ${summary.productionBaseUrl}`);
  lines.push(`- Status: ${summary.status}`);
  lines.push("");

  if (summary.findings.length > 0) {
    lines.push("## Findings");
    lines.push("");
    for (const finding of summary.findings) {
      lines.push(
        `- **${capitalize(finding.severity)}:** ${finding.title} (${finding.evidenceFile})`
      );
      lines.push(`  ${finding.details}`);
    }
    lines.push("");
  } else {
    lines.push("## Findings");
    lines.push("");
    lines.push("- No Chapter 5 findings were detected in this run.");
    lines.push("");
  }

  lines.push("## Preview UI");
  lines.push("");
  lines.push(
    `- Visible search triggers on preview docs page: ${searchUi.previewDesktop.triggerInventory.visibleCount}`
  );
  lines.push(
    `- Keyboard shortcut opened preview search: ${searchUi.previewDesktop.keyboardShortcut.opened ? "yes" : "no"}`
  );
  for (const query of searchUi.previewDesktop.queries) {
    lines.push(
      `- Preview query \`${query.query}\`: scopes ${formatList(
        normalizeScopeLabels(query.dialogState.tabs)
      )}; options ${query.dialogState.optionCount}; warnings ${query.dialogState.graphqlWarnings.length}`
    );
  }
  lines.push("");

  lines.push("## Production Baseline");
  lines.push("");
  for (const query of searchUi.productionDesktop.queries) {
    lines.push(
      `- Production query \`${query.query}\`: scopes ${formatList(
        normalizeScopeLabels(query.dialogState.tabs)
      )}; options ${query.dialogState.optionCount}`
    );
  }
  lines.push("");

  lines.push("## API Relevance");
  lines.push("");
  for (const query of apiRelevance.previewQueries) {
    const productionQuery = apiRelevance.productionQueries.find(
      (item) => item.id === query.id
    );
    lines.push(
      `- ${query.label}: preview top URL ${query.topUrl ?? "none"}; production top URL ${productionQuery?.topUrl ?? "none"}`
    );
  }
  lines.push("");

  lines.push("## Artifacts");
  lines.push("");
  lines.push("- `search-ui.json`");
  lines.push("- `search-api-relevance.json`");
  lines.push("- `screenshots/preview-desktop-search-light.png`");
  lines.push("- `screenshots/preview-desktop-search-dark.png`");
  lines.push("- `screenshots/preview-mobile-search.png`");
  lines.push("- `screenshots/production-desktop-search-light.png`");

  return lines.join("\n");
}

async function withPage(browser, viewport, fn) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}

async function gotoPath(page, baseUrl, pagePath, options = {}) {
  const url = new URL(pagePath, baseUrl).toString();
  const response = await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  if (options.waitForSelector) {
    await page.waitForSelector(options.waitForSelector, { timeout: 30000 });
  }
  return response;
}

async function collectVisibleSearchTriggers(page) {
  return page.evaluate(() => {
    const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    };

    const hosts = Array.from(document.querySelectorAll('[id^="inkeep-shadowradix"]'));
    const entries = [];

    for (const host of hosts) {
      const shadow = host.shadowRoot;
      if (!shadow) continue;
      for (const button of shadow.querySelectorAll("button")) {
        const text = normalizeText(button.textContent);
        if (!/Search/.test(text)) continue;
        entries.push({
          hostId: host.id,
          text,
          visible: isVisible(button),
        });
      }
    }

    return {
      visibleCount: entries.filter((entry) => entry.visible).length,
      entries,
    };
  });
}

async function openSearchViaTrigger(page) {
  await page.evaluate(() => {
    const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    };

    const hosts = Array.from(document.querySelectorAll('[id^="inkeep-shadowradix"]'));
    for (const host of hosts) {
      const shadow = host.shadowRoot;
      if (!shadow) continue;
      for (const button of shadow.querySelectorAll("button")) {
        const text = normalizeText(button.textContent);
        if (/Search/.test(text) && isVisible(button)) {
          button.click();
          return;
        }
      }
    }

    throw new Error("No visible search trigger found.");
  });
  await waitForSearchDialog(page);
}

async function waitForSearchDialog(page) {
  try {
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('[id^="inkeep-shadowradix"]')).some(
        (host) => host.shadowRoot?.querySelector('[role="dialog"]')
      );
    }, { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

async function closeSearchDialog(page) {
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => {
    return !Array.from(document.querySelectorAll('[id^="inkeep-shadowradix"]')).some(
      (host) => host.shadowRoot?.querySelector('[role="dialog"]')
    );
  }, { timeout: 10000 }).catch(() => {});
  await delay(200);
}

async function runDialogQuery(page, query) {
  await setSearchInputValue(page, "");
  await page.keyboard.type(query, { delay: 20 });
  await delay(1800);
}

async function setSearchInputValue(page, value) {
  await page.evaluate(() => {
    const host = Array.from(document.querySelectorAll('[id^="inkeep-shadowradix"]')).find(
      (item) => item.shadowRoot?.querySelector('[role="dialog"]')
    );
    const input =
      host?.shadowRoot?.querySelector('input') ??
      host?.shadowRoot?.querySelector('[role="combobox"]');

    if (!(input instanceof HTMLElement)) {
      throw new Error("Search input not found in dialog.");
    }

    input.focus();
  });

  await page.evaluate((nextValue) => {
    const host = Array.from(document.querySelectorAll('[id^="inkeep-shadowradix"]')).find(
      (item) => item.shadowRoot?.querySelector('[role="dialog"]')
    );
    const input =
      host?.shadowRoot?.querySelector("input") ??
      host?.shadowRoot?.querySelector('[role="combobox"]');

    if (input instanceof HTMLInputElement) {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(input, nextValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.focus();
      return;
    }

    if (input instanceof HTMLElement) {
      input.textContent = nextValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.focus();
      return;
    }

    throw new Error("Search input not found in dialog.");
  }, value);
}

async function collectDialogState(page) {
  return page.evaluate(() => {
    const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const extractCount = (label) => {
      const match = /\((\d+)\)/.exec(label);
      return match ? Number(match[1]) : null;
    };
    const host = Array.from(document.querySelectorAll('[id^="inkeep-shadowradix"]')).find(
      (item) => item.shadowRoot?.querySelector('[role="dialog"]')
    );
    const shadow = host?.shadowRoot;
    const dialog = shadow?.querySelector('[role="dialog"]');
    const combobox =
      shadow?.querySelector("input") ?? shadow?.querySelector('[role="combobox"]');
    const tabs = shadow
      ? Array.from(shadow.querySelectorAll('[role="tab"]')).map((tab) => ({
          label: normalizeText(tab.textContent),
          selected: tab.getAttribute("aria-selected") === "true",
          count: extractCount(normalizeText(tab.textContent)),
        }))
      : [];
    const options = shadow
      ? Array.from(shadow.querySelectorAll('[role="option"]')).map((option) => ({
          text: normalizeText(option.textContent),
          selected: option.getAttribute("aria-selected") === "true",
        }))
      : [];
    const style = dialog ? getComputedStyle(dialog) : null;

    return {
      isOpen: Boolean(dialog),
      hostId: host?.id ?? null,
      inputValue:
        combobox instanceof HTMLInputElement
          ? combobox.value
          : normalizeText(combobox?.textContent),
      tabs,
      options,
      optionCount: options.length,
      dialogBackground: style?.backgroundColor ?? null,
      dialogColor: style?.color ?? null,
      documentClassName: document.documentElement.className,
      graphqlWarnings: [],
    };
  });
}

async function toggleTheme(page) {
  await page.locator('button[aria-label="Toggle Theme"]').click();
  await delay(400);
}

function pushAssertion(assertions, name, pass, details) {
  assertions.push({ name, pass, details });
}

function normalizeScopeLabels(tabs) {
  return tabs.map((tab) => tab.label.replace(/\s*\(\d+\)\s*$/, ""));
}

function findDuplicates(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) return false;
    seen.add(finding.id);
    return true;
  });
}

function writeJson(filename, data) {
  return fs.writeFile(
    path.join(OUTPUT_DIR, filename),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8"
  );
}

function normalizeBaseUrl(value) {
  return value.replace(/\/$/, "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatList(values) {
  if (!values || values.length === 0) return "(none)";
  return values.join(", ");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

await main();
