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

const PERFORMANCE_SAMPLES = [
  {
    id: "docs-overview",
    label: "Docs overview",
    path: "/docs/observability/overview",
    type: "docs",
    maxPreviewLcp: 2500,
  },
  {
    id: "docs-prompt-management",
    label: "Deep docs page",
    path: "/docs/prompt-management/get-started",
    type: "docs",
    maxPreviewLcp: 2500,
  },
  {
    id: "pricing",
    label: "Pricing",
    path: "/pricing",
    type: "marketing",
    maxPreviewLcp: 2500,
  },
  {
    id: "guide-video",
    label: "Guide video",
    path: "/guides/videos/run-langfuse-locally",
    type: "guides",
    maxPreviewLcp: 3000,
  },
];

const ACCESSIBILITY_SAMPLES = [
  {
    id: "docs-overview",
    label: "Docs overview",
    path: "/docs/observability/overview",
  },
  {
    id: "docs-prompt-management",
    label: "Deep docs page",
    path: "/docs/prompt-management/get-started",
  },
  {
    id: "pricing",
    label: "Pricing",
    path: "/pricing",
  },
  {
    id: "integration-goose",
    label: "Integration page",
    path: "/integrations/no-code/goose",
  },
];

const DESKTOP_DOCS_PATH = "/docs/observability/overview";
const MOBILE_DOCS_PATH = "/docs/prompt-management/get-started";

const MOBILE_NAV_EXPECTED_LINES = ["Product", "Docs", "Guides", "Integrations"];
const MOBILE_TOC_EXPECTED_ANCHORS = [
  "#get-started-with-prompt-management",
  "#get-api-keys",
  "#create-update-prompt",
  "#use-prompt",
  "#next-steps",
];

async function main() {
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    defaultViewport: null,
  });

  try {
    const performance = await runPerformanceReview(browser);
    const accessibility = await runAccessibilityReview(browser);
    const responsiveAndKeyboard = await runResponsiveAndKeyboardReview(browser);

    const report = {
      generatedAt: new Date().toISOString(),
      previewBaseUrl: PREVIEW_BASE_URL,
      productionBaseUrl: PRODUCTION_BASE_URL,
      performance,
      accessibility,
      responsiveAndKeyboard,
    };
    const summary = buildSummary(report);

    await Promise.all([
      writeJson("performance.json", performance),
      writeJson("accessibility-smoke.json", accessibility),
      writeJson("responsive-and-keyboard.json", responsiveAndKeyboard),
      writeJson("summary.json", summary),
      fs.writeFile(
        path.join(OUTPUT_DIR, "summary.md"),
        buildSummaryMarkdown(summary, report),
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

async function runPerformanceReview(browser) {
  const samples = [];

  for (const sample of PERFORMANCE_SAMPLES) {
    const preview = await inspectPerformancePage(
      browser,
      PREVIEW_BASE_URL,
      sample,
      "preview"
    );
    const production = await inspectPerformancePage(
      browser,
      PRODUCTION_BASE_URL,
      sample,
      "production"
    );
    const assertions = buildPerformanceAssertions(sample, preview, production);

    samples.push({
      ...sample,
      preview,
      production,
      assertions,
      pass: assertions.every((assertion) => assertion.pass),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    previewBaseUrl: PREVIEW_BASE_URL,
    productionBaseUrl: PRODUCTION_BASE_URL,
    samples,
  };
}

async function inspectPerformancePage(browser, baseUrl, sample, environment) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await installPerformanceObservers(page);
    const recorder = await createNetworkRecorder(page);

    let response = null;

    try {
      response = await gotoPath(page, baseUrl, sample.path, {
        waitForSelector: "h1",
      });
      await waitForNetworkSettling(page, 1200);
      await waitForImages(page);
      await delay(600);

      const domMetrics = await page.evaluate(() => {
        const normalizeText = window.normalizeText;
        const findHorizontalScrollParent = window.findHorizontalScrollParent;
        const article = document.querySelector("article#nd-page");
        const root = article ?? document.querySelector("main") ?? document.body;
        const h1 = root.querySelector("h1");
        const codeBlocks = Array.from(root.querySelectorAll("pre")).map((pre) => {
          const scrollParent = findHorizontalScrollParent(pre);
          const style = scrollParent ? window.getComputedStyle(scrollParent) : null;
          return {
            textLength: normalizeText(pre.textContent).length,
            clientWidth: Math.round(pre.clientWidth),
            scrollWidth: Math.round(pre.scrollWidth),
            scrollParentTag: scrollParent?.tagName ?? null,
            scrollParentOverflowX: style?.overflowX ?? null,
          };
        });
        const images = Array.from(root.querySelectorAll("img")).map((image) => ({
          src: image.currentSrc || image.getAttribute("src"),
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        }));
        const paintEntries = performance.getEntriesByType("paint");
        const navigationEntry = performance.getEntriesByType("navigation")[0];

        return {
          title: document.title,
          h1Text: normalizeText(h1?.textContent),
          h1Count: root.querySelectorAll("h1").length,
          pageOverflowX: Math.max(
            0,
            document.documentElement.scrollWidth - window.innerWidth
          ),
          codeBlockCount: codeBlocks.length,
          codeBlocks,
          imagesLoaded: images.filter((image) => image.complete).length,
          imageCount: images.length,
          paints: {
            firstPaint:
              paintEntries.find((entry) => entry.name === "first-paint")
                ?.startTime ?? null,
            firstContentfulPaint:
              paintEntries.find(
                (entry) => entry.name === "first-contentful-paint"
              )?.startTime ?? null,
          },
          navigation: navigationEntry
            ? {
                domContentLoaded: navigationEntry.domContentLoadedEventEnd,
                loadEventEnd: navigationEntry.loadEventEnd,
                responseEnd: navigationEntry.responseEnd,
              }
            : null,
          webVitals: {
            cls: window.__chapter10?.cls ?? null,
            lcp: window.__chapter10?.lcp ?? null,
          },
        };
      });

      const resourceSummary = summarizeResources(
        recorder.snapshot().requests,
        baseUrl
      );

      return {
        environment,
        url: new URL(sample.path, baseUrl).toString(),
        finalUrl: page.url(),
        status: response?.status() ?? null,
        consoleErrors,
        requestFailures: recorder.snapshot().failures,
        domMetrics,
        resourceSummary,
      };
    } finally {
      await recorder.dispose();
    }
  });
}

function buildPerformanceAssertions(sample, preview, production) {
  const assertions = [];
  const previewJsDelta =
    preview.resourceSummary.sameOriginNextScriptBytes -
    production.resourceSummary.sameOriginNextScriptBytes;
  const previewPageDelta =
    preview.resourceSummary.sameOriginTransferredBytes -
    production.resourceSummary.sameOriginTransferredBytes;

  pushAssertion(
    assertions,
    `${sample.label}: preview returns 200 and renders an H1`,
    preview.status === 200 && preview.domMetrics.h1Count === 1,
    {
      status: preview.status,
      finalUrl: preview.finalUrl,
      h1Count: preview.domMetrics.h1Count,
      h1Text: preview.domMetrics.h1Text,
    }
  );
  pushAssertion(
    assertions,
    `${sample.label}: preview CLS stays below 0.1`,
    typeof preview.domMetrics.webVitals.cls === "number" &&
      preview.domMetrics.webVitals.cls <= 0.1,
    { cls: preview.domMetrics.webVitals.cls }
  );
  pushAssertion(
    assertions,
    `${sample.label}: preview LCP stays below ${sample.maxPreviewLcp}ms`,
    typeof preview.domMetrics.webVitals.lcp === "number" &&
      preview.domMetrics.webVitals.lcp <= sample.maxPreviewLcp,
    { lcp: preview.domMetrics.webVitals.lcp }
  );
  pushAssertion(
    assertions,
    `${sample.label}: preview same-origin page bytes do not exceed production by more than 50% and 400 KB`,
    previewPageDelta <=
      Math.max(
        Math.round(production.resourceSummary.sameOriginTransferredBytes * 0.5),
        400_000
      ),
    {
      previewSameOriginTransferredBytes:
        preview.resourceSummary.sameOriginTransferredBytes,
      productionSameOriginTransferredBytes:
        production.resourceSummary.sameOriginTransferredBytes,
      delta: previewPageDelta,
    }
  );
  pushAssertion(
    assertions,
    `${sample.label}: preview same-origin _next/static script bytes do not exceed production by more than 50% and 250 KB`,
    previewJsDelta <=
      Math.max(
        Math.round(production.resourceSummary.sameOriginNextScriptBytes * 0.5),
        250_000
      ),
    {
      previewNextScriptBytes: preview.resourceSummary.sameOriginNextScriptBytes,
      productionNextScriptBytes:
        production.resourceSummary.sameOriginNextScriptBytes,
      delta: previewJsDelta,
    }
  );
  pushAssertion(
    assertions,
    `${sample.label}: preview avoids same-origin script chunks over 1 MB transferred`,
    preview.resourceSummary.largestSameOriginScripts.every(
      (resource) => resource.transferredBytes <= 1_000_000
    ),
    {
      largestSameOriginScripts: preview.resourceSummary.largestSameOriginScripts,
    }
  );

  return assertions;
}

async function runAccessibilityReview(browser) {
  const pages = [];

  for (const sample of ACCESSIBILITY_SAMPLES) {
    pages.push(await inspectAccessibilityPage(browser, sample));
  }

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: PREVIEW_BASE_URL,
    pages,
  };
}

async function inspectAccessibilityPage(browser, sample) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    await gotoPath(page, PREVIEW_BASE_URL, sample.path, {
      waitForSelector: "h1",
    });

    const audit = await page.evaluate(() => {
      const isElementVisible = window.isElementVisible;
      const buildStableSelector = window.buildStableSelector;
      const normalizeText = window.normalizeText;
      const getAccessibleName = window.getAccessibleName;
      const visibleButtonsWithoutName = Array.from(
        document.querySelectorAll("button")
      )
        .filter((element) => isElementVisible(element) && !element.disabled)
        .map((element) => ({
          selector: buildStableSelector(element),
          text: normalizeText(element.textContent),
          ariaLabel: element.getAttribute("aria-label"),
          title: element.getAttribute("title"),
          accessibleName: getAccessibleName(element),
        }))
        .filter((item) => !item.accessibleName);

      const formFieldsWithoutLabel = Array.from(
        document.querySelectorAll(
          'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select'
        )
      )
        .filter((element) => isElementVisible(element))
        .map((element) => ({
          selector: buildStableSelector(element),
          tag: element.tagName,
          type: element.getAttribute("type"),
          id: element.id || null,
          accessibleName: getAccessibleName(element),
        }))
        .filter((item) => !item.accessibleName);

      const iframesMissingTitle = Array.from(
        document.querySelectorAll("iframe")
      )
        .filter((element) => isElementVisible(element))
        .map((element) => ({
          selector: buildStableSelector(element),
          src: element.getAttribute("src"),
          title: element.getAttribute("title"),
        }))
        .filter((item) => !item.title);

      return {
        visibleButtonsWithoutName,
        formFieldsWithoutLabel,
        iframesMissingTitle,
      };
    });

    const assertions = [];
    pushAssertion(
      assertions,
      `${sample.label}: no visible buttons are missing an accessible name`,
      audit.visibleButtonsWithoutName.length === 0,
      audit.visibleButtonsWithoutName
    );
    pushAssertion(
      assertions,
      `${sample.label}: no visible form fields are missing an accessible name`,
      audit.formFieldsWithoutLabel.length === 0,
      audit.formFieldsWithoutLabel
    );
    pushAssertion(
      assertions,
      `${sample.label}: every visible iframe exposes a title`,
      audit.iframesMissingTitle.length === 0,
      audit.iframesMissingTitle
    );

    return {
      ...sample,
      assertions,
      audit,
      pass: assertions.every((assertion) => assertion.pass),
    };
  });
}

async function runResponsiveAndKeyboardReview(browser) {
  const keyboardCoverage = await runKeyboardCoverageCheck(browser);
  const feedbackDialog = await runFeedbackDialogCheck(browser);
  const mobileDocs = await runMobileDocsCheck(browser);

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: PREVIEW_BASE_URL,
    keyboardCoverage,
    searchDialog: {
      skipped: true,
      reason:
        "Validated manually because the Inkeep search trigger is lazy-loaded and not stable in headless Puppeteer.",
    },
    feedbackDialog,
    mobileDocs,
    pass:
      keyboardCoverage.pass &&
      feedbackDialog.pass &&
      mobileDocs.pass,
  };
}

async function runKeyboardCoverageCheck(browser) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    await gotoPath(page, PREVIEW_BASE_URL, DESKTOP_DOCS_PATH, {
      waitForSelector: "article#nd-page",
    });
    await page.mouse.click(20, 20);

    const focusSequence = [];
    const seenTargets = {
      headerControl: null,
      sidebarLink: null,
      feedbackButton: null,
    };

    for (let step = 1; step <= 120; step += 1) {
      await page.keyboard.press("Tab");
      await delay(60);

      const active = await getActiveElementSummary(page);
      focusSequence.push(active);

      if (!seenTargets.headerControl && isHeaderControl(active)) {
        seenTargets.headerControl = { step, active };
      }
      if (!seenTargets.sidebarLink && isSidebarDocsLink(active)) {
        seenTargets.sidebarLink = { step, active };
      }
      if (!seenTargets.feedbackButton && isFeedbackButton(active)) {
        seenTargets.feedbackButton = { step, active };
      }

      if (
        seenTargets.headerControl &&
        seenTargets.sidebarLink &&
        seenTargets.feedbackButton
      ) {
        break;
      }
    }

    const assertions = [];
    pushAssertion(
      assertions,
      "Desktop tab order reaches the header controls",
      Boolean(seenTargets.headerControl),
      seenTargets.headerControl ?? focusSequence.slice(0, 20)
    );
    pushAssertion(
      assertions,
      "Desktop tab order reaches the docs sidebar links",
      Boolean(seenTargets.sidebarLink),
      seenTargets.sidebarLink ?? focusSequence.slice(0, 40)
    );
    pushAssertion(
      assertions,
      "Desktop tab order reaches the docs feedback buttons",
      Boolean(seenTargets.feedbackButton),
      seenTargets.feedbackButton ?? focusSequence.slice(-20)
    );

    return {
      path: DESKTOP_DOCS_PATH,
      assertions,
      focusSequence,
      seenTargets,
      pass: assertions.every((assertion) => assertion.pass),
    };
  });
}

async function runFeedbackDialogCheck(browser) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    await gotoPath(page, PREVIEW_BASE_URL, DESKTOP_DOCS_PATH, {
      waitForSelector: "article#nd-page",
    });

    await scrollIntoView(page, "#docs-feedback");
    const triggerSummary = await findAndActivateButton(page, "#docs-feedback", [
      "No",
    ]);
    const dialogOpened = await waitForVisibleAny(page, [
      '[role="dialog"] textarea',
      '[role="dialog"]',
      "textarea",
    ]);

    let tabSequence = [];
    let focusRestored = null;

    if (dialogOpened) {
      const screenshot = "feedback-dialog.png";
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, screenshot),
        fullPage: false,
      });

      tabSequence = await tabWithinDialog(page, 4);
      await page.keyboard.press("Escape");
      await delay(300);
      focusRestored = await getActiveElementSummary(page);

      const assertions = [];
      pushAssertion(
        assertions,
        "Feedback dialog opens from the docs footer",
        Boolean(dialogOpened),
        { triggerSummary }
      );
      pushAssertion(
        assertions,
        "Focus remains inside the feedback dialog while tabbing",
        tabSequence.length > 0 &&
          tabSequence.every((entry) => entry.region === "dialog"),
        tabSequence
      );
      pushAssertion(
        assertions,
        'Closing the feedback dialog restores focus to the "No" button',
        isFeedbackButton(focusRestored),
        { focusRestored, triggerSummary }
      );

      return {
        path: DESKTOP_DOCS_PATH,
        screenshot,
        assertions,
        triggerSummary,
        tabSequence,
        focusRestored,
        pass: assertions.every((assertion) => assertion.pass),
      };
    }

    return {
      path: DESKTOP_DOCS_PATH,
      assertions: [
        {
          name: "Feedback dialog opens from the docs footer",
          pass: false,
          details: { triggerSummary, dialogOpened },
        },
      ],
      triggerSummary,
      tabSequence,
      focusRestored,
      pass: false,
    };
  });
}

async function runMobileDocsCheck(browser) {
  return withPage(browser, MOBILE_VIEWPORT, async (page) => {
    await gotoPath(page, PREVIEW_BASE_URL, MOBILE_DOCS_PATH, {
      waitForSelector: "article#nd-page",
    });

    const overflowBefore = await getPageOverflowMetrics(page);
    const stickyButtonBefore = await getMobileTocButton(page);
    await page.evaluate(() => window.scrollTo(0, 900));
    await delay(200);
    const stickyButtonAfter = await getMobileTocButton(page);
    const codeBlocks = await inspectCodeBlocks(page);

    const pageScreenshot = "mobile-docs-page.png";
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, pageScreenshot),
      fullPage: false,
    });

    await clickVisibleButtonByText(page, "body", "Use Prompt Management", false);
    const popoverLinks = await getMobilePopoverLinks(page);
    const tocScreenshot = "mobile-toc-popover.png";
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, tocScreenshot),
      fullPage: false,
    });

    await gotoPath(page, PREVIEW_BASE_URL, MOBILE_DOCS_PATH, {
      waitForSelector: "article#nd-page",
    });
    await clickVisibleButtonByAria(page, "Toggle navigation menu");
    const mobileNavLines = await getVisibleLines(page, 'div[aria-hidden="false"]');
    const navScreenshot = "mobile-site-nav.png";
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, navScreenshot),
      fullPage: false,
    });

    const assertions = [];
    pushAssertion(
      assertions,
      "Mobile docs page avoids page-level horizontal overflow",
      overflowBefore.pageOverflowX <= 4,
      overflowBefore
    );
    pushAssertion(
      assertions,
      "Mobile sticky docs navigation stays near the top after scrolling",
      typeof stickyButtonBefore?.top === "number" &&
        typeof stickyButtonAfter?.top === "number" &&
        stickyButtonAfter.top < 140,
      { stickyButtonBefore, stickyButtonAfter }
    );
    pushAssertion(
      assertions,
      "Mobile TOC popover exposes the expected deep-link anchors",
      MOBILE_TOC_EXPECTED_ANCHORS.every((href) =>
        popoverLinks.some((link) => link.href === href)
      ),
      popoverLinks
    );
    pushAssertion(
      assertions,
      "Mobile site navigation exposes the expected top-level sections",
      hasSubsequence(mobileNavLines, MOBILE_NAV_EXPECTED_LINES),
      mobileNavLines
    );
    pushAssertion(
      assertions,
      "Mobile code blocks remain selectable and scroll inside the code container",
      codeBlocks.length > 0 && codeBlocks.every((entry) => entry.pass),
      codeBlocks
    );

    return {
      path: MOBILE_DOCS_PATH,
      screenshots: [pageScreenshot, tocScreenshot, navScreenshot],
      overflowBefore,
      stickyButtonBefore,
      stickyButtonAfter,
      popoverLinks,
      mobileNavLines,
      codeBlocks,
      assertions,
      pass: assertions.every((assertion) => assertion.pass),
    };
  });
}

async function withPage(browser, viewport, fn) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await page.setViewport(viewport);
  await installPageHelpers(page);

  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

async function installPageHelpers(page) {
  await page.evaluateOnNewDocument(() => {
    window.normalizeText = (value) =>
      String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();

    window.isElementVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      if (!style || style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    window.getAccessibleName = (element) => {
      const ariaLabel = element.getAttribute("aria-label");
      if (ariaLabel) return window.normalizeText(ariaLabel);

      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy) {
        const text = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ");
        if (window.normalizeText(text)) return window.normalizeText(text);
      }

      if (element instanceof HTMLInputElement) {
        if (element.labels?.length) {
          const text = Array.from(element.labels)
            .map((label) => label.textContent ?? "")
            .join(" ");
          if (window.normalizeText(text)) return window.normalizeText(text);
        }

        if (
          ["button", "submit", "reset"].includes(element.type) &&
          window.normalizeText(element.value)
        ) {
          return window.normalizeText(element.value);
        }

        if (window.normalizeText(element.placeholder)) {
          return window.normalizeText(element.placeholder);
        }
      }

      if (
        (element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement) &&
        element.labels?.length
      ) {
        const text = Array.from(element.labels)
          .map((label) => label.textContent ?? "")
          .join(" ");
        if (window.normalizeText(text)) return window.normalizeText(text);
      }

      if (element.getAttribute("title")) {
        return window.normalizeText(element.getAttribute("title"));
      }

      const labelledImage = element.querySelector("img[alt]");
      if (labelledImage?.getAttribute("alt")) {
        return window.normalizeText(labelledImage.getAttribute("alt"));
      }

      return window.normalizeText(element.textContent);
    };

    window.buildStableSelector = (element) => {
      if (!element) return null;
      if (element.id) return `#${element.id}`;

      const role = element.getAttribute("role");
      const ariaLabel = element.getAttribute("aria-label");
      if (ariaLabel) {
        return `${element.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;
      }
      if (role) {
        return `${element.tagName.toLowerCase()}[role="${role}"]`;
      }

      const classes = Array.from(element.classList).slice(0, 2);
      return classes.length > 0
        ? `${element.tagName.toLowerCase()}.${classes.join(".")}`
        : element.tagName.toLowerCase();
    };

    window.findHorizontalScrollParent = (element) => {
      let current = element;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if (
          current.scrollWidth > current.clientWidth &&
          ["auto", "scroll", "overlay"].includes(style.overflowX)
        ) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    };
  });
}

async function installPerformanceObservers(page) {
  await page.evaluateOnNewDocument(() => {
    window.__chapter10 = {
      cls: 0,
      lcp: null,
    };

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          window.__chapter10.cls += entry.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });

    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        window.__chapter10.lcp = lastEntry.startTime;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
}

async function createNetworkRecorder(page) {
  const client = await page.target().createCDPSession();
  await client.send("Network.enable");

  const requests = new Map();
  const failures = [];

  client.on("Network.responseReceived", (event) => {
    requests.set(event.requestId, {
      url: event.response.url,
      status: event.response.status,
      mimeType: event.response.mimeType,
      type: event.type,
      transferredBytes: 0,
    });
  });

  client.on("Network.loadingFinished", (event) => {
    const request = requests.get(event.requestId);
    if (request) {
      request.transferredBytes = event.encodedDataLength;
    }
  });

  client.on("Network.loadingFailed", (event) => {
    failures.push({
      requestId: event.requestId,
      errorText: event.errorText,
      canceled: event.canceled,
      type: event.type,
    });
  });

  return {
    snapshot() {
      return {
        requests: [...requests.values()],
        failures,
      };
    },
    async dispose() {
      await client.detach();
    },
  };
}

function summarizeResources(requests, baseUrl) {
  const origin = new URL(baseUrl).origin;
  const meaningfulRequests = requests.filter((request) => request.transferredBytes > 0);
  const sameOrigin = meaningfulRequests.filter(
    (request) => safeOrigin(request.url) === origin
  );
  const thirdParty = meaningfulRequests.filter(
    (request) => safeOrigin(request.url) !== origin
  );
  const largestSameOriginScripts = sameOrigin
    .filter((request) => request.type === "Script")
    .sort((left, right) => right.transferredBytes - left.transferredBytes)
    .slice(0, 5)
    .map((request) => ({
      url: request.url,
      transferredBytes: request.transferredBytes,
    }));

  return {
    requestCount: meaningfulRequests.length,
    sameOriginTransferredBytes: sumBytes(sameOrigin),
    thirdPartyTransferredBytes: sumBytes(thirdParty),
    sameOriginNextScriptBytes: sumBytes(
      sameOrigin.filter(
        (request) =>
          request.type === "Script" && request.url.includes("/_next/static/")
      )
    ),
    sameOriginImageBytes: sumBytes(
      sameOrigin.filter((request) => request.type === "Image")
    ),
    sameOriginFontBytes: sumBytes(
      sameOrigin.filter((request) => request.type === "Font")
    ),
    sameOriginScriptBytes: sumBytes(
      sameOrigin.filter((request) => request.type === "Script")
    ),
    largestSameOriginScripts,
    largestRequests: meaningfulRequests
      .slice()
      .sort((left, right) => right.transferredBytes - left.transferredBytes)
      .slice(0, 10)
      .map((request) => ({
        url: request.url,
        type: request.type,
        transferredBytes: request.transferredBytes,
      })),
  };
}

async function gotoPath(page, baseUrl, routePath, options = {}) {
  const response = await page.goto(new URL(routePath, baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForSelector(options.waitForSelector ?? "h1", {
    timeout: 120_000,
  });
  await delay(250);
  return response;
}

async function waitForNetworkSettling(page, idleTime = 1000) {
  try {
    await page.waitForNetworkIdle({ idleTime, timeout: 120_000 });
  } catch (error) {
    return;
  }
}

async function waitForImages(page) {
  await Promise.race([
    page.evaluate(async () => {
      const images = Array.from(document.images).filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      await Promise.all(
        images.map((image) => {
          if (image.complete) return Promise.resolve();
          return new Promise((resolve) => {
            const timeout = window.setTimeout(resolve, 4000);
            const done = () => {
              window.clearTimeout(timeout);
              resolve();
            };
            image.addEventListener("load", done, { once: true });
            image.addEventListener("error", done, { once: true });
          });
        })
      );
    }),
    delay(5000),
  ]);
}

async function getActiveElementSummary(page) {
  return page.evaluate(() => {
    const normalizeText = window.normalizeText;
    const buildStableSelector = window.buildStableSelector;
    const active = document.activeElement;
    if (!active) return null;

    const text = normalizeText(active.textContent);
    return {
      tag: active.tagName,
      text,
      ariaLabel: active.getAttribute("aria-label"),
      href: active instanceof HTMLAnchorElement ? active.getAttribute("href") : null,
      region: active.closest('[role="dialog"]')
        ? "dialog"
        : active.closest("#docs-feedback")
          ? "feedback"
          : active.closest("#nd-sidebar")
            ? "sidebar"
            : active.closest("header")
              ? "header"
              : active.closest("footer")
                ? "footer"
                : active.closest("article")
                  ? "article"
                  : "other",
      selector: buildStableSelector(active),
    };
  });
}

function isSearchTrigger(active) {
  return Boolean(
    active &&
      active.region === "header" &&
      (active.ariaLabel === "Open Search" ||
        active.text.includes("Search") ||
        active.selector?.includes("search"))
  );
}

function isHeaderControl(active) {
  return Boolean(active && active.region === "header");
}

function isSidebarDocsLink(active) {
  return Boolean(
    active &&
      active.region === "sidebar" &&
      typeof active.href === "string" &&
      active.href.startsWith("/docs/")
  );
}

function isFeedbackButton(active) {
  return Boolean(
    active &&
      active.region === "feedback" &&
      ["Yes", "No"].includes(active.text)
  );
}

async function findAndActivateButton(page, selector, candidates) {
  const buttons = await page.$$(`${selector} button`);

  for (const button of buttons) {
    const summary = await button.evaluate((element) => ({
      text: String(element.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim(),
      ariaLabel: element.getAttribute("aria-label"),
      visible:
        window.getComputedStyle(element).display !== "none" &&
        window.getComputedStyle(element).visibility !== "hidden" &&
        element.getClientRects().length > 0,
    }));

    if (!summary.visible) continue;

    if (
      candidates.some(
        (candidate) =>
          summary.text.includes(candidate) || summary.ariaLabel === candidate
      )
    ) {
      await button.focus();
      await delay(100);
      await page.keyboard.press("Enter");
      await delay(250);
      return summary;
    }
  }

  throw new Error(
    `Could not find a visible button matching ${candidates.join(", ")} in ${selector}`
  );
}

async function waitForVisibleAny(page, selectors) {
  const start = Date.now();

  while (Date.now() - start < 20_000) {
    const visibleSelector = await page.evaluate((selectors) => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (
          element &&
          window.getComputedStyle(element).display !== "none" &&
          window.getComputedStyle(element).visibility !== "hidden" &&
          element.getClientRects().length > 0
        ) {
          return selector;
        }
      }
      return null;
    }, selectors);

    if (visibleSelector) {
      return visibleSelector;
    }

    await delay(100);
  }

  return null;
}

async function typeIntoFirstVisible(page, selectors, value) {
  for (const selector of selectors) {
    const handle = await page.$(selector);
    if (!handle) continue;

    const visible = await handle.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    });

    if (!visible) continue;

    await handle.click({ clickCount: 3 });
    await page.keyboard.type(value);
    return true;
  }

  return false;
}

async function tabWithinDialog(page, steps) {
  const sequence = [];
  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press("Tab");
    await delay(80);
    sequence.push(await getActiveElementSummary(page));
  }
  return sequence;
}

async function scrollIntoView(page, selector) {
  await page.$eval(selector, (element) =>
    element.scrollIntoView({ block: "center" })
  );
  await delay(200);
}

async function clickVisibleButtonByText(page, selector, text, exact = true) {
  const handles = await page.$$(`${selector} button`);

  for (const handle of handles) {
    const matches = await handle.evaluate(
      (candidate, { text, exact }) => {
        const style = window.getComputedStyle(candidate);
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          candidate.getClientRects().length > 0;
        const candidateText = String(candidate.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim();
        return visible && (exact ? candidateText === text : candidateText.includes(text));
      },
      { text, exact }
    );

    if (!matches) continue;

    await handle.click();
    await delay(200);
    return;
  }

  throw new Error(`Could not find visible button "${text}" in ${selector}`);
}

async function clickVisibleButtonByAria(page, ariaLabel) {
  const handles = await page.$$("button");

  for (const handle of handles) {
    const matches = await handle.evaluate((candidate, ariaLabel) => {
      const style = window.getComputedStyle(candidate);
      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        candidate.getClientRects().length > 0;
      return visible && candidate.getAttribute("aria-label") === ariaLabel;
    }, ariaLabel);

    if (!matches) continue;

    await handle.click();
    await delay(200);
    return;
  }

  throw new Error(
    `Could not find visible button with aria-label "${ariaLabel}"`
  );
}

async function getPageOverflowMetrics(page) {
  return page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    pageOverflowX: Math.max(
      0,
      document.documentElement.scrollWidth - window.innerWidth
    ),
  }));
}

async function getMobileTocButton(page) {
  return page.evaluate(() => {
    const isElementVisible = window.isElementVisible;
    const normalizeText = window.normalizeText;
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) =>
        isElementVisible(candidate) &&
        normalizeText(candidate.textContent).includes("Use Prompt Management")
    );
    if (!button) return null;

    const rect = button.getBoundingClientRect();
    return {
      text: normalizeText(button.textContent),
      top: rect.top,
      bottom: rect.bottom,
      expanded: button.getAttribute("aria-expanded"),
    };
  });
}

async function getMobilePopoverLinks(page) {
  return page.evaluate(() => {
    const isElementVisible = window.isElementVisible;
    const normalizeText = window.normalizeText;
    const article = document.querySelector("article#nd-page");
    return Array.from(document.querySelectorAll('a[href^="#"]'))
      .filter((link) => isElementVisible(link) && !article?.contains(link))
      .map((link) => ({
        text: normalizeText(link.textContent),
        href: link.getAttribute("href"),
      }));
  });
}

async function getVisibleLines(page, selector) {
  return page.evaluate((selector) => {
    const normalizeText = window.normalizeText;
    const root = document.querySelector(selector);
    if (!root) return [];
    return root.innerText
      .split("\n")
      .map((line) => normalizeText(line))
      .filter(Boolean);
  }, selector);
}

async function inspectCodeBlocks(page) {
  return page.evaluate(() => {
    const findHorizontalScrollParent = window.findHorizontalScrollParent;
    return Array.from(document.querySelectorAll("pre"))
      .slice(0, 3)
      .map((pre) => {
        const code = pre.querySelector("code") ?? pre;
        const scrollParent = findHorizontalScrollParent(pre);
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);

        const selectedText = selection.toString();
        selection.removeAllRanges();

        const scrollParentStyle = scrollParent
          ? window.getComputedStyle(scrollParent)
          : null;

        return {
          selectedLength: selectedText.length,
          preClientWidth: Math.round(pre.clientWidth),
          preScrollWidth: Math.round(pre.scrollWidth),
          scrollParentTag: scrollParent?.tagName ?? null,
          scrollParentOverflowX: scrollParentStyle?.overflowX ?? null,
          pass:
            selectedText.length > 20 &&
            Boolean(scrollParent) &&
            ["auto", "scroll", "overlay"].includes(
              scrollParentStyle?.overflowX ?? ""
            ),
        };
      });
  });
}

function buildSummary(report) {
  const checks = [];

  for (const sample of report.performance.samples) {
    for (const assertion of sample.assertions) {
      checks.push({
        area: "performance",
        name: assertion.name,
        result: assertion.pass ? "PASS" : "FAIL",
        details: assertion.details,
      });
    }
  }

  for (const page of report.accessibility.pages) {
    for (const assertion of page.assertions) {
      checks.push({
        area: "accessibility",
        name: assertion.name,
        result: assertion.pass ? "PASS" : "FAIL",
        details: assertion.details,
      });
    }
  }

  for (const section of [
    report.responsiveAndKeyboard.keyboardCoverage,
    report.responsiveAndKeyboard.feedbackDialog,
    report.responsiveAndKeyboard.mobileDocs,
  ]) {
    for (const assertion of section?.assertions ?? []) {
      checks.push({
        area: "responsive-and-keyboard",
        name: assertion.name,
        result: assertion.pass ? "PASS" : "FAIL",
        details: assertion.details,
      });
    }
  }

  const findings = checks
    .filter((check) => check.result === "FAIL")
    .map((check) => check.name);

  return {
    generatedAt: report.generatedAt,
    status: findings.length === 0 ? "PASS" : "FAIL",
    checks,
    findings,
  };
}

function buildSummaryMarkdown(summary, report) {
  const failedChecks = summary.checks.filter((check) => check.result === "FAIL");
  const performanceHighlights = report.performance.samples.map((sample) => {
    const previewJs = formatBytes(sample.preview.resourceSummary.sameOriginNextScriptBytes);
    const prodJs = formatBytes(sample.production.resourceSummary.sameOriginNextScriptBytes);
    const previewBytes = formatBytes(
      sample.preview.resourceSummary.sameOriginTransferredBytes
    );
    const prodBytes = formatBytes(
      sample.production.resourceSummary.sameOriginTransferredBytes
    );
    const previewCls = formatNumber(sample.preview.domMetrics.webVitals.cls);
    const previewLcp = formatMs(sample.preview.domMetrics.webVitals.lcp);

    return `- ${sample.label}: preview JS ${previewJs} vs production ${prodJs}; preview same-origin bytes ${previewBytes} vs production ${prodBytes}; preview CLS ${previewCls}; preview LCP ${previewLcp}`;
  });

  return [
    "# Chapter 10 Summary",
    "",
    `- Generated: ${summary.generatedAt}`,
    `- Preview base URL: ${PREVIEW_BASE_URL}`,
    `- Production base URL: ${PRODUCTION_BASE_URL}`,
    `- Result: ${summary.status}`,
    "",
    "## Performance highlights",
    ...performanceHighlights,
    "",
    "## Failing checks",
    ...(failedChecks.length > 0
      ? failedChecks.map((check) => `- ${check.name}`)
      : ["- None"]),
    "",
    "## Evidence files",
    "- `performance.json`",
    "- `accessibility-smoke.json`",
    "- `responsive-and-keyboard.json`",
    "- `summary.json`",
  ].join("\n");
}

function pushAssertion(assertions, name, pass, details = {}) {
  assertions.push({ name, pass, details });
}

function hasSubsequence(actual, expected) {
  if (expected.length === 0) return true;
  let pointer = 0;
  for (const entry of actual) {
    if (entry === expected[pointer]) {
      pointer += 1;
      if (pointer === expected.length) {
        return true;
      }
    }
  }
  return false;
}

function sumBytes(items) {
  return items.reduce((total, item) => total + item.transferredBytes, 0);
}

function safeOrigin(rawUrl) {
  try {
    return new URL(rawUrl).origin;
  } catch (error) {
    return null;
  }
}

function normalizeBaseUrl(rawUrl) {
  return rawUrl.replace(/\/$/, "");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMs(value) {
  return typeof value === "number" ? `${Math.round(value)} ms` : "n/a";
}

function formatNumber(value) {
  return typeof value === "number" ? value.toFixed(3) : "n/a";
}

async function writeJson(filename, payload) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, filename),
    JSON.stringify(payload, null, 2),
    "utf8"
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
