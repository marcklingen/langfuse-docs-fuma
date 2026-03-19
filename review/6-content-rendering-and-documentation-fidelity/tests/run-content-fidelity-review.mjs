#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import puppeteer from "puppeteer";

const DEFAULT_BASE_URL =
  "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app";
const DEFAULT_OUTPUT =
  "review/6-content-rendering-and-documentation-fidelity/artifacts/preview-content-fidelity-report.json";
const DEFAULT_SCREENSHOT_DIR =
  "review/6-content-rendering-and-documentation-fidelity/artifacts/screenshots";
const VIEWPORT = { width: 1440, height: 1200 };

const PAGE_SPECS = [
  {
    id: "docs-prompt-management-get-started",
    type: "docs",
    path: "/docs/prompt-management/get-started",
    mustContain: [
      "Get Started with Prompt Management",
      "Set up your AI agent",
      "Create a prompt",
      "Use the prompt in your code",
    ],
    tailMarker:
      "Looking for something specific? Take a look under Features for guides on specific topics.",
    expected: {
      minTabs: 1,
      requireTabSwitching: true,
      requireSteps: true,
      minCodeBlocks: 2,
      requireCodeCopy: true,
    },
  },
  {
    id: "docs-observability-data-model",
    type: "docs",
    path: "/docs/observability/data-model",
    mustContain: [
      "Core Concepts",
      "Observations, Traces, and Sessions",
      "Underlying data model",
      "How Langfuse Captures Data",
    ],
    tailMarker:
      "must explicitly call flush() before exiting",
    expected: {
      minMermaidSvgs: 5,
      minTables: 2,
      calloutMarker: "This data model is live on Langfuse Cloud.",
    },
  },
  {
    id: "changelog-custom-dashboards",
    type: "changelog",
    path: "/changelog/2025-05-21-custom-dashboards",
    mustContain: [
      "Custom Dashboards",
      "Overview",
      "Key Features",
      "Questions or feedback?",
    ],
    tailMarker: "Please open a GitHub issue if you run into any issues.",
    expected: {
      minTabs: 1,
      requireTabSwitching: true,
      iframeHosts: ["www.youtube-nocookie.com"],
    },
  },
  {
    id: "blog-evaluate-ai-agent-skills",
    type: "blog",
    path: "/blog/2026-02-26-evaluate-ai-agent-skills",
    mustContain: [
      "Evaluating AI Agent Skills",
      "The Evaluation Setup",
      "Improving the Skill",
      "What's Next",
    ],
    tailMarker:
      "If you're interested in trying the out skill yourself, you can find them in the Langfuse Skills GitHub repository.",
    expected: {
      minCodeBlocks: 2,
      requireCodeCopy: true,
      minTables: 1,
    },
  },
  {
    id: "faq-unwanted-http-database-spans",
    type: "faq",
    path: "/faq/all/unwanted-http-database-spans",
    mustContain: [
      "Why do I see HTTP requests or database queries in my Langfuse traces?",
      "Why this happens",
      "How to fix it",
      "Filtering can cause orphaned traces",
    ],
    tailMarker: "Still seeing unexpected spans? Reach out to support.",
    expected: {
      minTabs: 1,
      requireTabSwitching: true,
      minCodeBlocks: 4,
      requireCodeCopy: true,
      calloutMarker: "Filtering can cause orphaned traces",
    },
  },
  {
    id: "guides-video-introducing-datasets-v2",
    type: "guide",
    path: "/guides/videos/introducing-datasets-v2",
    mustContain: [
      "Introducing Datasets v2",
      "Overview of the dataset-related changes released during Launch Week",
      "Learn more",
      "Example Notebook",
    ],
    tailMarker: "Example Notebook",
    expected: {
      videoHosts: ["static.langfuse.com"],
    },
  },
  {
    id: "guides-cookbook-multi-turn-conversations",
    type: "cookbook",
    path: "/guides/cookbook/example_simulated_multi_turn_conversations",
    mustContain: [
      "Evaluating Multi-Turn Conversations (Simulation)",
      "Setup",
      "Step 1 - Create a chat app and generate traces in Langfuse",
      "Conclusion",
    ],
    tailMarker:
      "You can read more about effective ways to create datasets for experiments here.",
    expected: {
      iframeHosts: ["www.youtube-nocookie.com"],
      minCodeBlocks: 4,
      requireCodeCopy: true,
      minTables: 1,
    },
  },
  {
    id: "integrations-goose",
    type: "integration",
    path: "/integrations/no-code/goose",
    mustContain: [
      "Integrating Goose with Langfuse",
      "About Goose",
      "Get Started",
      "Demo",
    ],
    tailMarker: "Langfuse Docs: https://langfuse.com/docs",
    expected: {
      requireSteps: true,
      iframeHosts: ["www.youtube-nocookie.com"],
      videoHosts: ["static.langfuse.com"],
      minCodeBlocks: 1,
      requireCodeCopy: true,
    },
  },
  {
    id: "self-hosting-docker-compose",
    type: "self-hosting",
    path: "/self-hosting/deployment/docker-compose",
    mustContain: [
      "Docker Compose",
      "Walkthrough",
      "Get Started",
      "How to Upgrade",
    ],
    tailMarker:
      "For more details on upgrading, please refer to the upgrade guide.",
    expected: {
      minTabs: 1,
      requireTabSwitching: true,
      requireSteps: true,
      iframeHosts: ["www.youtube-nocookie.com"],
      minCodeBlocks: 4,
      requireCodeCopy: true,
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

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function summarizeHeadingOrder(headings) {
  const issues = [];
  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];
    if (current.level > previous.level + 1) {
      issues.push({
        previous: { level: previous.level, text: previous.text },
        current: { level: current.level, text: current.text },
      });
    }
  }
  return issues;
}

function toSlug(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let traveled = 0;
      const distance = 1000;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        traveled += distance;
        if (traveled > document.body.scrollHeight + 1000) {
          clearInterval(timer);
          resolve();
        }
      }, 20);
    });
  });
}

async function probeRemoteUrl(url) {
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (!response.ok) {
      response = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
      });
    }
    return {
      url,
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
    };
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function recordFailure(failures, condition, message, details = {}) {
  if (condition) return;
  failures.push({ message, details });
}

async function extractPageState(page) {
  return page.evaluate(() => {
    const article = document.querySelector("article");
    if (!article) {
      return { articleFound: false };
    }

    const text = article.innerText.replace(/\s+/g, " ").trim();
    const headings = Array.from(
      article.querySelectorAll("h1, h2, h3, h4, h5, h6")
    ).map((element) => ({
      tag: element.tagName,
      level: Number(element.tagName.slice(1)),
      text: element.textContent.replace(/\s+/g, " ").trim(),
      id: element.id || null,
    }));

    const codeCopyButtons = Array.from(
      article.querySelectorAll('button[aria-label="Copy Text"]')
    ).filter((element) => element.offsetParent !== null);

    const tabLists = Array.from(
      article.querySelectorAll('[role="tablist"]')
    ).filter((element) => element.offsetParent !== null);

    const iframes = Array.from(article.querySelectorAll("iframe")).map(
      (element) => ({
        src: element.src,
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      })
    );

    const videos = Array.from(article.querySelectorAll("video")).map(
      (element) => ({
        src:
          element.currentSrc ||
          element.getAttribute("src") ||
          element.querySelector("source")?.src ||
          null,
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        visible: element.offsetParent !== null,
      })
    );

    const images = Array.from(article.querySelectorAll("img")).map((img) => ({
      src: img.currentSrc || img.src,
      alt: img.alt || "",
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      visible: img.offsetParent !== null,
    }));

    return {
      articleFound: true,
      text,
      headings,
      h1Count: headings.filter((heading) => heading.level === 1).length,
      tabListCount: tabLists.length,
      tabLabels: tabLists.map((tabList) =>
        Array.from(tabList.querySelectorAll('[role="tab"]'))
          .filter((element) => element.offsetParent !== null)
          .map((element) => element.textContent.replace(/\s+/g, " ").trim())
      ),
      stepsCount: article.querySelectorAll(".fd-steps").length,
      preCount: article.querySelectorAll("pre").length,
      codeCopyButtonCount: codeCopyButtons.length,
      tableCount: article.querySelectorAll("table").length,
      mermaidSvgCount: article.querySelectorAll('svg[id^="mermaid-diagram-"]')
        .length,
      iframeDetails: iframes,
      videoDetails: videos,
      imageDetails: images,
    };
  });
}

async function exerciseVisibleTabLists(page) {
  const tabLists = await page.$$(`article [role="tablist"]`);
  const results = [];

  for (const tabList of tabLists) {
    const listVisible = await tabList.evaluate((element) => element.offsetParent !== null);
    if (!listVisible) continue;

    const tabs = await tabList.$$(`[role="tab"]`);
    const visibleTabs = [];

    for (const tab of tabs) {
      const visible = await tab.evaluate((element) => element.offsetParent !== null);
      if (!visible) continue;
      const text = await tab.evaluate((element) =>
        element.textContent.replace(/\s+/g, " ").trim()
      );
      visibleTabs.push({ handle: tab, text });
    }

    if (visibleTabs.length < 2) continue;

    const target = visibleTabs[visibleTabs.length - 1];
    await target.handle.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "center" })
    );
    await target.handle.click();
    await page.waitForFunction(
      (expectedLabel, element) =>
        element
          .querySelector('[role="tab"][aria-selected="true"]')
          ?.textContent.replace(/\s+/g, " ")
          .trim() === expectedLabel,
      { timeout: 5000 },
      target.text,
      tabList
    );

    const active = await tabList.evaluate(
      (element) =>
        element
          .querySelector('[role="tab"][aria-selected="true"]')
          ?.textContent.replace(/\s+/g, " ")
          .trim() ?? null
    );
    results.push({ expected: target.text, active, ok: active === target.text });
  }

  return results;
}

async function exerciseCodeCopy(page) {
  return page.evaluate(async () => {
    const button = Array.from(
      document.querySelectorAll('article button[aria-label="Copy Text"]')
    ).find((element) => element.offsetParent !== null);
    if (!button) return { attempted: false, copiedTextLength: 0 };

    button.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const copiedTexts = window.__codexCopiedTexts ?? [];
    const copiedText = copiedTexts[copiedTexts.length - 1] ?? "";

    return {
      attempted: true,
      copiedTextLength: copiedText.length,
      excerpt: copiedText.slice(0, 120),
    };
  });
}

async function runPageAudit(browser, baseUrl, screenshotDir, pageSpec) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(window, "__codexCopiedTexts", {
      value: [],
      configurable: true,
      writable: false,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__codexCopiedTexts.push(String(text));
        },
        readText: async () =>
          window.__codexCopiedTexts[window.__codexCopiedTexts.length - 1] ?? "",
      },
    });
  });

  const url = `${baseUrl}${pageSpec.path}`;
  const failures = [];

  try {
    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 120000,
    });

    await page.waitForSelector("article", { timeout: 30000 });

    if (pageSpec.expected.minMermaidSvgs) {
      await page.waitForFunction(
        (minimum) =>
          document.querySelectorAll("article svg[id^='mermaid-diagram-']").length >=
          minimum,
        { timeout: 15000 },
        pageSpec.expected.minMermaidSvgs
      );
    }

    await autoScroll(page);

    const state = await extractPageState(page);
    const headingIssues = summarizeHeadingOrder(state.headings);
    const tabExercise = pageSpec.expected.requireTabSwitching
      ? await exerciseVisibleTabLists(page)
      : [];
    const copyExercise = pageSpec.expected.requireCodeCopy
      ? await exerciseCodeCopy(page)
      : { attempted: false, copiedTextLength: 0 };

    const remoteMediaUrls = [
      ...state.iframeDetails.map((item) => item.src).filter(Boolean),
      ...state.videoDetails.map((item) => item.src).filter(Boolean),
    ].filter((value) => /^https?:\/\//.test(value));

    const mediaProbes = [];
    for (const mediaUrl of remoteMediaUrls) {
      mediaProbes.push(await probeRemoteUrl(mediaUrl));
    }

    recordFailure(
      failures,
      response?.status() === 200,
      "Expected page response status 200",
      { status: response?.status() ?? null }
    );
    recordFailure(failures, state.articleFound, "Expected rendered article content");
    recordFailure(
      failures,
      state.h1Count === 1,
      "Expected exactly one H1 in article",
      { h1Count: state.h1Count }
    );
    recordFailure(
      failures,
      headingIssues.length === 0,
      "Expected heading levels to progress without skipping levels",
      { headingIssues }
    );

    for (const marker of pageSpec.mustContain) {
      recordFailure(
        failures,
        state.text.includes(marker),
        `Expected page text to include marker: ${marker}`
      );
    }

    recordFailure(
      failures,
      state.text.includes(pageSpec.tailMarker),
      "Expected page text to include the tail marker, to guard against truncation",
      { tailMarker: pageSpec.tailMarker }
    );

    if (pageSpec.expected.minTabs) {
      recordFailure(
        failures,
        state.tabListCount >= pageSpec.expected.minTabs,
        "Expected visible tab lists on the page",
        { tabListCount: state.tabListCount }
      );
    }

    if (pageSpec.expected.requireTabSwitching) {
      recordFailure(
        failures,
        tabExercise.length > 0 && tabExercise.every((result) => result.ok),
        "Expected every visible tab list to switch to the selected tab",
        { tabExercise }
      );
    }

    if (pageSpec.expected.requireSteps) {
      recordFailure(
        failures,
        state.stepsCount > 0,
        "Expected rendered steps component on the page",
        { stepsCount: state.stepsCount }
      );
    }

    if (pageSpec.expected.minCodeBlocks) {
      recordFailure(
        failures,
        state.preCount >= pageSpec.expected.minCodeBlocks,
        "Expected rendered code blocks on the page",
        { preCount: state.preCount }
      );
    }

    if (pageSpec.expected.requireCodeCopy) {
      recordFailure(
        failures,
        state.codeCopyButtonCount > 0,
        "Expected visible code copy buttons on the page",
        { codeCopyButtonCount: state.codeCopyButtonCount }
      );
      recordFailure(
        failures,
        copyExercise.attempted && copyExercise.copiedTextLength > 0,
        "Expected code copy action to produce non-empty copied text",
        { copyExercise }
      );
    }

    if (pageSpec.expected.minTables) {
      recordFailure(
        failures,
        state.tableCount >= pageSpec.expected.minTables,
        "Expected rendered tables on the page",
        { tableCount: state.tableCount }
      );
    }

    if (pageSpec.expected.minMermaidSvgs) {
      recordFailure(
        failures,
        state.mermaidSvgCount >= pageSpec.expected.minMermaidSvgs,
        "Expected rendered mermaid SVG diagrams on the page",
        { mermaidSvgCount: state.mermaidSvgCount }
      );
    }

    if (pageSpec.expected.calloutMarker) {
      recordFailure(
        failures,
        state.text.includes(pageSpec.expected.calloutMarker),
        "Expected the representative callout content to be present",
        { calloutMarker: pageSpec.expected.calloutMarker }
      );
    }

    if (pageSpec.expected.iframeHosts) {
      const iframeHosts = state.iframeDetails.map((item) => new URL(item.src).host);
      recordFailure(
        failures,
        iframeHosts.length > 0,
        "Expected rendered iframe embeds on the page",
        { iframeHosts }
      );
      recordFailure(
        failures,
        iframeHosts.every((host) => pageSpec.expected.iframeHosts.includes(host)),
        "Expected iframe embeds to use approved hosts only",
        { iframeHosts, allowedHosts: pageSpec.expected.iframeHosts }
      );
    }

    if (pageSpec.expected.videoHosts) {
      const videoHosts = state.videoDetails
        .map((item) => item.src)
        .filter(Boolean)
        .map((src) => new URL(src).host);
      recordFailure(
        failures,
        videoHosts.length > 0,
        "Expected rendered video embeds on the page",
        { videoHosts }
      );
      recordFailure(
        failures,
        videoHosts.every((host) => pageSpec.expected.videoHosts.includes(host)),
        "Expected video embeds to use approved hosts only",
        { videoHosts, allowedHosts: pageSpec.expected.videoHosts }
      );
    }

    for (const iframe of state.iframeDetails) {
      recordFailure(
        failures,
        iframe.width > 0 && iframe.height > 0,
        "Expected iframe embed to have a visible layout box",
        { iframe }
      );
    }

    for (const video of state.videoDetails.filter((item) => item.visible)) {
      recordFailure(
        failures,
        video.width > 0 && video.height > 0,
        "Expected video embed to have a visible layout box",
        { video }
      );
    }

    const brokenImages = state.imageDetails.filter(
      (image) => image.visible && (!image.complete || image.naturalWidth === 0)
    );
    recordFailure(
      failures,
      brokenImages.length === 0,
      "Expected visible article images to load successfully",
      { brokenImages }
    );

    const failedMediaProbes = mediaProbes.filter((probe) => !probe.ok);
    recordFailure(
      failures,
      failedMediaProbes.length === 0,
      "Expected probed remote media URLs to respond successfully",
      { failedMediaProbes }
    );

    if (failures.length > 0) {
      const screenshotPath = resolve(
        screenshotDir,
        `${toSlug(pageSpec.id)}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return {
        id: pageSpec.id,
        type: pageSpec.type,
        path: pageSpec.path,
        url,
        ok: false,
        screenshot: screenshotPath,
        failures,
        metrics: {
          h1Count: state.h1Count,
          headings: state.headings,
          tabListCount: state.tabListCount,
          tabLabels: state.tabLabels,
          stepsCount: state.stepsCount,
          preCount: state.preCount,
          codeCopyButtonCount: state.codeCopyButtonCount,
          tableCount: state.tableCount,
          mermaidSvgCount: state.mermaidSvgCount,
          iframeDetails: state.iframeDetails,
          videoDetails: state.videoDetails,
          imageCount: state.imageDetails.length,
        },
        tabExercise,
        copyExercise,
        mediaProbes,
      };
    }

    return {
      id: pageSpec.id,
      type: pageSpec.type,
      path: pageSpec.path,
      url,
      ok: true,
      metrics: {
        h1Count: state.h1Count,
        headings: state.headings,
        tabListCount: state.tabListCount,
        tabLabels: state.tabLabels,
        stepsCount: state.stepsCount,
        preCount: state.preCount,
        codeCopyButtonCount: state.codeCopyButtonCount,
        tableCount: state.tableCount,
        mermaidSvgCount: state.mermaidSvgCount,
        iframeDetails: state.iframeDetails,
        videoDetails: state.videoDetails,
        imageCount: state.imageDetails.length,
      },
      tabExercise,
      copyExercise,
      mediaProbes,
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args["base-url"] ?? DEFAULT_BASE_URL);
  const outputPath = resolve(args.output ?? DEFAULT_OUTPUT);
  const screenshotDir = resolve(args["screenshot-dir"] ?? DEFAULT_SCREENSHOT_DIR);

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(screenshotDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: "new" });

  try {
    const pages = [];
    for (const pageSpec of PAGE_SPECS) {
      pages.push(await runPageAudit(browser, baseUrl, screenshotDir, pageSpec));
    }

    const summary = {
      totalPages: pages.length,
      passedPages: pages.filter((page) => page.ok).length,
      failedPages: pages.filter((page) => !page.ok).length,
    };

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      outputPath,
      pages,
      summary,
    };

    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    if (summary.failedPages > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

await main();
