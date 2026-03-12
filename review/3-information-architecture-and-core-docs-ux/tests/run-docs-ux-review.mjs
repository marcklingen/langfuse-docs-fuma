import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapterDir = path.resolve(__dirname, "..");
const outputDir = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.join(chapterDir, "evidence");
const screenshotsDir = path.join(outputDir, "screenshots");

const BASE_URL = (process.env.BASE_URL || "http://localhost:3333").replace(/\/$/, "");
const HEADLESS = process.env.HEADLESS !== "false";

const DESKTOP_VIEWPORT = { width: 1440, height: 1200 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const DEEP_DOC_PATH = "/docs/prompt-management/get-started";

const EXPECTED_DESKTOP_HEADER_SEQUENCE = [
  "Product",
  "Resources",
  "Docs",
  "Changelog",
  "Pricing",
];

const EXPECTED_PRODUCT_MENU = [
  { text: "Overview", href: "/docs" },
  { text: "LLM Observability", href: "/docs/observability/overview" },
  { text: "Prompt Management", href: "/docs/prompt-management/overview" },
  { text: "Evaluation", href: "/docs/evaluation/overview" },
  { text: "Metrics", href: "/docs/metrics/overview" },
];

const EXPECTED_RESOURCES_MENU = [
  { text: "Blog", href: "/blog" },
  { text: "Changelog", href: "/changelog" },
  { text: "Roadmap", href: "/docs/roadmap" },
  { text: "Users", href: "/users" },
  { text: "Example Project", href: "/docs/demo" },
  { text: "Walkthroughs", href: "/guides" },
  { text: "Support", href: "/support" },
];

const EXPECTED_MENU_SWITCHER = [
  { text: "Docs", href: "/docs" },
  { text: "Integrations", href: "/integrations" },
  { text: "Self Hosting", href: "/self-hosting" },
  { text: "Guides", href: "/guides" },
  { text: "AI Engineering Library", href: "/library" },
];

const EXPECTED_DOCS_ROOT_SIDEBAR = [
  "Overview",
  "Example Project",
  "Ask AI",
  "Get Started",
  "Start Tracing",
  "Use Prompt Management",
  "Set up Evals",
  "Products",
  "Observability",
  "Prompt Management",
  "Evaluation",
  "Platform",
  "Metrics",
  "API & Data Platform",
  "Administration",
  "Security & Guardrails",
  "More",
  "Glossary",
  "Roadmap",
  "Docs MCP Server",
  "SDK & API References",
  "Security & Compliance ↗",
  "Support ↗",
];

const EXPECTED_PROMPT_MANAGEMENT_SUBNAV = [
  "Prompt Management",
  "Overview",
  "Get Started",
  "Concepts",
  "Features",
  "Troubleshooting and FAQ",
];

const EXPECTED_BREADCRUMB = [
  { text: "Docs", kind: "text", href: null },
  { text: "Use Prompt Management", kind: "link", href: DEEP_DOC_PATH },
];

const EXPECTED_EDIT_LINK =
  "https://github.com/langfuse/langfuse-docs/edit/main/content/docs/prompt-management/get-started.mdx";

const EXPECTED_MOBILE_SITE_MENU_SEQUENCE = [
  "Product",
  "Overview",
  "LLM Observability",
  "Prompt Management",
  "Evaluation",
  "Metrics",
  "Resources",
  "Docs",
  "Self Hosting",
  "Guides",
  "Integrations",
  "FAQ",
  "Handbook",
  "Changelog",
  "Pricing",
  "Library",
  "Security & Compliance",
];

const EXPECTED_MOBILE_TOC_LINKS = [
  "#get-started-with-prompt-management",
  "#get-api-keys",
  "#create-update-prompt",
  "#use-prompt",
  "#next-steps",
];

const MENU_SWITCHER_ROUTE_CHECKS = [
  { path: "/docs", active: "Docs" },
  { path: "/integrations", active: "Integrations" },
  { path: "/self-hosting", active: "Self Hosting" },
];

const contributorsPath = path.resolve(chapterDir, "../../data/generated/contributors.json");
const contributorsData = JSON.parse(await fs.readFile(contributorsPath, "utf8"));
const EXPECTED_CONTRIBUTORS = contributorsData[DEEP_DOC_PATH] ?? [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await fs.mkdir(screenshotsDir, { recursive: true });

  console.log(`Using base URL:      ${BASE_URL}`);
  console.log(`Writing evidence to: ${outputDir}`);

  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    defaultViewport: null,
  });

  try {
    const docsShell = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      desktopRoot: await runDesktopRootCheck(browser),
      menuSwitcherRoutes: await runMenuSwitcherRouteChecks(browser),
      deepDoc: await runDeepDocCheck(browser),
      bannerDismissal: await runBannerDismissalCheck(browser),
      mobileDeepDoc: await runMobileCheck(browser),
    };

    await writeJson("docs-shell.json", docsShell);
    await fs.writeFile(path.join(outputDir, "summary.md"), buildSummary(docsShell), "utf8");

    console.log("Chapter 3 evidence written.");
  } finally {
    await browser.close();
  }
}

async function runDesktopRootCheck(browser) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    const assertions = [];
    const observations = [];

    await gotoPath(page, "/docs");
    const screenshot = "screenshots/desktop-docs-root.png";
    await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });

    const headerEntries = await getVisibleEntries(page, "header nav");
    const headerTexts = headerEntries.map((entry) => entry.text);
    pushAssertion(
      assertions,
      "Desktop header exposes Product, Resources, Docs, Changelog, and Pricing in order",
      hasSubsequence(headerTexts, EXPECTED_DESKTOP_HEADER_SEQUENCE),
      { headerEntries }
    );

    const productMenu = await collectDropdownLinks(page, "Product");
    pushAssertion(
      assertions,
      "Desktop Product dropdown exposes the expected docs entry points",
      arraysEqualByFields(productMenu, EXPECTED_PRODUCT_MENU, ["text", "href"]),
      { productMenu }
    );

    const resourcesMenu = await collectDropdownLinks(page, "Resources");
    pushAssertion(
      assertions,
      "Desktop Resources dropdown exposes the expected support and content links",
      arraysEqualByFields(resourcesMenu, EXPECTED_RESOURCES_MENU, ["text", "href"]),
      { resourcesMenu }
    );

    const sidebar = await getSidebarSlices(page, "#nd-sidebar");
    pushAssertion(
      assertions,
      "Docs sidebar preserves the curated root structure and order",
      arraysEqual(sidebar.root, EXPECTED_DOCS_ROOT_SIDEBAR),
      { sidebar: sidebar.root }
    );

    const menuSwitcher = await getMenuSwitcherStatus(page, "#nd-sidebar");
    const menuSwitcherPass = arraysEqual(
      menuSwitcher.map((item) => item.text),
      EXPECTED_MENU_SWITCHER.map((item) => item.text)
    ) &&
      menuSwitcher[0]?.tag === "DIV" &&
      menuSwitcher.slice(1).every((item, index) =>
        item.tag === "A" && item.href === EXPECTED_MENU_SWITCHER[index + 1].href
      );
    pushAssertion(
      assertions,
      "Docs menu-switcher shows the expected sections and keeps Docs as the active item",
      menuSwitcherPass,
      { menuSwitcher }
    );

    if (sidebar.root.length === 0) {
      observations.push("Desktop docs sidebar could not be sliced from the rendered page.");
    }

    return finishCheck({
      path: "/docs",
      screenshot,
      assertions,
      observations,
      topNav: {
        headerEntries,
        productMenu,
        resourcesMenu,
      },
      menuSwitcher,
      sidebar,
    });
  });
}

async function runMenuSwitcherRouteChecks(browser) {
  const routeResults = [];

  for (const routeCheck of MENU_SWITCHER_ROUTE_CHECKS) {
    const result = await withPage(browser, DESKTOP_VIEWPORT, async (page) => {
      await gotoPath(page, routeCheck.path);
      const menuSwitcher = await getMenuSwitcherStatus(page, "#nd-sidebar");
      const activeEntry = menuSwitcher.find((entry) => entry.text === routeCheck.active);
      const inactiveEntries = menuSwitcher.filter((entry) => entry.text !== routeCheck.active);
      const pass =
        menuSwitcher.length === EXPECTED_MENU_SWITCHER.length &&
        activeEntry?.tag === "DIV" &&
        activeEntry.href === null &&
        inactiveEntries.every((entry) => {
          const expected = EXPECTED_MENU_SWITCHER.find((item) => item.text === entry.text);
          return entry.tag === "A" && entry.href === expected?.href;
        });

      return {
        path: routeCheck.path,
        active: routeCheck.active,
        pass,
        menuSwitcher,
      };
    });

    routeResults.push(result);
  }

  return routeResults;
}

async function runDeepDocCheck(browser) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    const assertions = [];
    const observations = [];

    await gotoPath(page, DEEP_DOC_PATH);
    await clickVisibleButtonByText(page, "#nd-sidebar", "Prompt Management");

    const screenshot = "screenshots/desktop-docs-deep-page.png";
    await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });

    const sidebar = await getSidebarSlices(page, "#nd-sidebar");
    pushAssertion(
      assertions,
      "Deep docs page keeps the Prompt Management subsection entries available from the sidebar",
      hasSubsequence(sidebar.root, EXPECTED_PROMPT_MANAGEMENT_SUBNAV),
      { sidebar: sidebar.root }
    );

    const breadcrumbs = await getBreadcrumbs(page);
    pushAssertion(
      assertions,
      "Deep docs page breadcrumbs match the expected root and current page labels",
      arraysEqualByFields(breadcrumbs, EXPECTED_BREADCRUMB, ["text", "kind", "href"]),
      { breadcrumbs }
    );

    const toc = await getDesktopToc(page);
    pushAssertion(
      assertions,
      "Desktop TOC links resolve to existing anchors on the page",
      toc.missingTargets.length === 0,
      { toc }
    );

    if (toc.duplicateLabels.length > 0) {
      observations.push(
        `Duplicate TOC labels observed on ${DEEP_DOC_PATH}: ${toc.duplicateLabels.join(", ")}`
      );
    }

    const backToTop = await verifyBackToTop(page);
    pushAssertion(
      assertions,
      "Desktop TOC can return the viewport to the top of the document",
      backToTop.pass,
      backToTop
    );

    const editLink = await getLinkByText(page, "#nd-toc", "Edit this page on GitHub");
    pushAssertion(
      assertions,
      "Edit this page link targets the expected source file",
      editLink?.href === EXPECTED_EDIT_LINK,
      { editLink }
    );

    const contributors = await getContributorUsernames(page);
    pushAssertion(
      assertions,
      "Contributors block matches generated contributor data for the page",
      arraysEqual(contributors, EXPECTED_CONTRIBUTORS),
      { contributors, expected: EXPECTED_CONTRIBUTORS }
    );

    const stickyChrome = await getDesktopStickyGeometry(page);
    pushAssertion(
      assertions,
      "Desktop sticky chrome keeps the header and TOC within the viewport while scrolling",
      stickyChrome.pass,
      stickyChrome
    );

    return finishCheck({
      path: DEEP_DOC_PATH,
      screenshot,
      assertions,
      observations,
      sidebar,
      breadcrumbs,
      toc,
      backToTop,
      editLink,
      contributors,
      stickyChrome,
    });
  });
}

async function runBannerDismissalCheck(browser) {
  return withPage(browser, DESKTOP_VIEWPORT, async (page) => {
    const assertions = [];

    await gotoPath(page, "/docs");

    const initialState = await page.evaluate(() => ({
      visible: isVisible(document.querySelector("#fd-top-banner")),
      dismissed: localStorage.getItem("nd-banner-fd-top-banner"),
    }));
    pushAssertion(
      assertions,
      "Announcement banner is visible before dismissal in a fresh browser context",
      initialState.visible && initialState.dismissed === null,
      { initialState }
    );

    await clickVisibleButtonByAria(page, "Close Banner");

    const dismissedState = await page.evaluate(() => ({
      visible: isVisible(document.querySelector("#fd-top-banner")),
      dismissed: localStorage.getItem("nd-banner-fd-top-banner"),
      documentClass: document.documentElement.classList.contains("nd-banner-fd-top-banner"),
    }));
    pushAssertion(
      assertions,
      "Announcement dismissal writes the stable localStorage key",
      dismissedState.dismissed === "true" && !dismissedState.visible,
      { dismissedState }
    );

    await gotoPath(page, "/docs");

    const reloadedState = await page.evaluate(() => ({
      visible: isVisible(document.querySelector("#fd-top-banner")),
      dismissed: localStorage.getItem("nd-banner-fd-top-banner"),
      documentClass: document.documentElement.classList.contains("nd-banner-fd-top-banner"),
    }));
    pushAssertion(
      assertions,
      "Announcement banner stays hidden after a reload once dismissed",
      !reloadedState.visible && reloadedState.dismissed === "true" && reloadedState.documentClass,
      { reloadedState }
    );

    return finishCheck({
      path: "/docs",
      assertions,
      initialState,
      dismissedState,
      reloadedState,
    });
  });
}

async function runMobileCheck(browser) {
  const tocPopover = await withPage(browser, MOBILE_VIEWPORT, async (page) => {
    const assertions = [];

    await gotoPath(page, DEEP_DOC_PATH);

    const stickyButtonBefore = await getMobileTocButton(page);
    await page.evaluate(() => window.scrollTo(0, 900));
    await sleep(200);
    const stickyButtonAfter = await getMobileTocButton(page);
    pushAssertion(
      assertions,
      "Mobile sticky page chrome keeps the TOC button pinned near the top while scrolling",
      typeof stickyButtonBefore?.top === "number" &&
        typeof stickyButtonAfter?.top === "number" &&
        stickyButtonAfter.top < 140,
      { stickyButtonBefore, stickyButtonAfter }
    );

    await clickVisibleButtonByText(page, "body", "Use Prompt Management", false);
    const popoverLinks = await getMobilePopoverLinks(page);
    pushAssertion(
      assertions,
      "Mobile TOC popover exposes the expected document anchors",
      EXPECTED_MOBILE_TOC_LINKS.every((href) =>
        popoverLinks.some((link) => link.href === href)
      ),
      { popoverLinks }
    );

    const screenshot = "screenshots/mobile-toc-popover.png";
    await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: false });

    return finishCheck({
      path: DEEP_DOC_PATH,
      screenshot,
      assertions,
      stickyButtonBefore,
      stickyButtonAfter,
      popoverLinks,
    });
  });

  const navigation = await withPage(browser, MOBILE_VIEWPORT, async (page) => {
    const assertions = [];

    await gotoPath(page, DEEP_DOC_PATH);

    let siteMenuLines = await getVisibleLines(page, 'div[aria-hidden="false"]');
    if (!hasSubsequence(siteMenuLines, EXPECTED_MOBILE_SITE_MENU_SEQUENCE)) {
      await clickVisibleButtonByAria(page, "Toggle navigation menu");
      siteMenuLines = await getVisibleLines(page, 'div[aria-hidden="false"]');
    }
    pushAssertion(
      assertions,
      "Mobile site navigation exposes product shortcuts and section links",
      hasSubsequence(siteMenuLines, EXPECTED_MOBILE_SITE_MENU_SEQUENCE),
      { siteMenuLines }
    );

    const siteNavScreenshot = "screenshots/mobile-site-nav.png";
    await page.screenshot({ path: path.join(outputDir, siteNavScreenshot), fullPage: false });

    await gotoPath(page, DEEP_DOC_PATH);
    const sidebarToggle = await getMobileSidebarToggle(page);
    pushAssertion(
      assertions,
      "Mobile docs pages still expose a sidebar toggle control",
      Boolean(sidebarToggle),
      { sidebarToggle }
    );

    const sidebarScreenshot = "screenshots/mobile-docs-chrome.png";
    await page.screenshot({ path: path.join(outputDir, sidebarScreenshot), fullPage: false });

    return finishCheck({
      path: DEEP_DOC_PATH,
      screenshots: [siteNavScreenshot, sidebarScreenshot],
      assertions,
      siteMenuLines,
      sidebarToggle,
    });
  });

  return {
    pass: tocPopover.pass && navigation.pass,
    tocPopover,
    navigation,
  };
}

async function withPage(browser, viewport, fn) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(() => {
    window.normalizeText = (value) =>
      String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
    window.isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      if (!style || style.visibility === "hidden" || style.display === "none") return false;
      return element.getClientRects().length > 0;
    };
  });

  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

async function gotoPath(page, routePath) {
  await page.goto(new URL(routePath, BASE_URL).toString(), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("header");
  await page.waitForSelector("article#nd-page");
  await sleep(300);
}

async function collectDropdownLinks(page, buttonText) {
  await clickVisibleButtonByText(page, "header nav", buttonText);
  const links = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
    return items
      .filter((item) => isVisible(item))
      .map((item) => {
        const anchor = item.tagName === "A" ? item : item.querySelector("a");
        return {
          text: normalizeText(item.textContent),
          href: anchor?.getAttribute("href") ?? item.getAttribute("href"),
        };
      })
      .filter((item) => item.text);
  });
  await page.keyboard.press("Escape");
  await sleep(150);
  return dedupeByFields(links, ["text", "href"]);
}

async function getVisibleEntries(page, selector) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return [];
    return Array.from(root.querySelectorAll("a,button"))
      .filter((entry) => isVisible(entry))
      .map((entry) => ({
        tag: entry.tagName,
        text: normalizeText(entry.textContent),
        href: entry.tagName === "A" ? entry.getAttribute("href") : null,
      }))
      .filter((entry) => entry.text);
  }, selector);
}

async function getVisibleLines(page, selector) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return [];
    return root.innerText
      .split("\n")
      .map((line) => normalizeText(line))
      .filter(Boolean);
  }, selector);
}

async function getSidebarSlices(page, selector) {
  const all = await getVisibleLines(page, selector);
  const rootStart = all.indexOf("Overview");
  const rootEnd = all.lastIndexOf("Support ↗");
  return {
    all,
    switcher: rootStart === -1 ? [] : all.slice(0, rootStart),
    root: rootStart === -1 || rootEnd === -1 ? [] : all.slice(rootStart, rootEnd + 1),
  };
}

async function getMobileSidebarToggle(page) {
  return page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) =>
        ["Open Sidebar", "Collapse Sidebar"].includes(candidate.getAttribute("aria-label"))
    );
    if (!button) return null;
    const style = window.getComputedStyle(button);
    return {
      ariaLabel: button.getAttribute("aria-label"),
      text: normalizeText(button.textContent),
      visible:
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        button.getClientRects().length > 0,
    };
  });
}

async function getMenuSwitcherStatus(page, selector) {
  return page.evaluate(({ selector, labels }) => {
    const root = document.querySelector(selector);
    if (!root) return [];
    const nodes = Array.from(root.querySelectorAll("a,div"));
    return labels.map((label) => {
      const match = nodes.find(
        (node) => isVisible(node) && normalizeText(node.textContent) === label
      );
      return {
        text: label,
        tag: match?.tagName ?? null,
        href: match?.tagName === "A" ? match.getAttribute("href") : null,
      };
    });
  }, {
    selector,
    labels: EXPECTED_MENU_SWITCHER.map((item) => item.text),
  });
}

async function getBreadcrumbs(page) {
  return page.evaluate(() => {
    const root = document.querySelector("article#nd-page > div:first-child");
    if (!root) return [];
    return Array.from(root.children)
      .map((child) => {
        if (!isVisible(child)) return null;
        if (child.tagName === "A") {
          return {
            text: normalizeText(child.textContent),
            kind: "link",
            href: child.getAttribute("href"),
          };
        }
        const text = normalizeText(child.textContent);
        if (!text || text === ">") return null;
        return { text, kind: "text", href: null };
      })
      .filter(Boolean);
  });
}

async function getDesktopToc(page) {
  return page.evaluate(() => {
    const tocLinks = Array.from(document.querySelectorAll('#nd-toc a[href^="#"]'))
      .filter((link) => isVisible(link))
      .map((link) => ({
        text: normalizeText(link.textContent),
        href: link.getAttribute("href"),
      }));
    const missingTargets = tocLinks
      .map((link) => link.href)
      .filter((href) => href && !document.querySelector(href));
    const counts = new Map();
    for (const link of tocLinks) {
      counts.set(link.text, (counts.get(link.text) || 0) + 1);
    }
    const duplicateLabels = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([label]) => label);
    return {
      links: tocLinks,
      missingTargets,
      duplicateLabels,
    };
  });
}

async function verifyBackToTop(page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(300);

  const beforeScroll = await page.evaluate(() => window.scrollY);
  const firstLinkHref = await page.evaluate(() => {
    const firstLink = document.querySelector('#nd-toc a[href^="#"]');
    return firstLink?.getAttribute("href") ?? null;
  });

  if (!firstLinkHref) {
    return {
      pass: false,
      beforeScroll,
      afterScroll: null,
      hash: null,
      href: null,
    };
  }

  await page.evaluate(() => {
    const firstLink = document.querySelector('#nd-toc a[href^="#"]');
    firstLink?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await sleep(400);

  const after = await page.evaluate(() => ({
    scrollY: window.scrollY,
    hash: window.location.hash,
  }));

  return {
    pass: after.scrollY < beforeScroll / 2 && after.hash === firstLinkHref,
    beforeScroll,
    afterScroll: after.scrollY,
    hash: after.hash,
    href: firstLinkHref,
  };
}

async function getLinkByText(page, selector, text) {
  return page.evaluate(({ selector, text }) => {
    const root = document.querySelector(selector);
    if (!root) return null;
    const match = Array.from(root.querySelectorAll("a")).find(
      (link) => isVisible(link) && normalizeText(link.textContent) === text
    );
    return match
      ? {
          text: normalizeText(match.textContent),
          href: match.getAttribute("href"),
        }
      : null;
  }, { selector, text });
}

async function getContributorUsernames(page) {
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('#nd-toc a[href^="https://github.com/"]'))
      .filter((link) => isVisible(link))
      .map((link) => link.href)
      .filter((href) => {
        const parsed = new URL(href);
        const parts = parsed.pathname.split("/").filter(Boolean);
        return parts.length === 1;
      })
      .map((href) => new URL(href).pathname.split("/").filter(Boolean)[0]);
    return [...new Set(links)];
  });
}

async function getDesktopStickyGeometry(page) {
  await page.evaluate(() => window.scrollTo(0, 900));
  await sleep(200);

  const geometry = await page.evaluate(() => {
    const header = document.querySelector("header");
    const toc = document.querySelector("#nd-toc");
    const headerRect = header?.getBoundingClientRect();
    const tocRect = toc?.getBoundingClientRect();
    return {
      headerTop: headerRect?.top ?? null,
      tocTop: tocRect?.top ?? null,
      tocBottom: tocRect?.bottom ?? null,
      viewportHeight: window.innerHeight,
    };
  });

  return {
    ...geometry,
    pass:
      typeof geometry.headerTop === "number" &&
      geometry.headerTop >= 0 &&
      geometry.headerTop <= 64 &&
      typeof geometry.tocTop === "number" &&
      geometry.tocTop >= 0 &&
      geometry.tocTop < geometry.viewportHeight &&
      typeof geometry.tocBottom === "number" &&
      geometry.tocBottom > geometry.tocTop,
  };
}

async function getMobileTocButton(page) {
  return page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) =>
        isVisible(candidate) &&
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
    const article = document.querySelector("article#nd-page");
    return Array.from(document.querySelectorAll('a[href^="#"]'))
      .filter((link) => isVisible(link) && !article?.contains(link))
      .map((link) => ({
        text: normalizeText(link.textContent),
        href: link.getAttribute("href"),
      }));
  });
}

async function clickVisibleButtonByText(page, selector, text, exact = true) {
  const handles = await page.$$(`${selector} button`);
  let clicked = false;

  for (const handle of handles) {
    const matches = await handle.evaluate((candidate, { text, exact }) => {
      const style = window.getComputedStyle(candidate);
      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        candidate.getClientRects().length > 0;
      const candidateText = String(candidate.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();
      return visible && (exact ? candidateText === text : candidateText.includes(text));
    }, { text, exact });
    if (!matches) continue;
    await handle.click();
    clicked = true;
    break;
  }

  if (!clicked) {
    throw new Error(`Could not find visible button "${text}" inside ${selector}`);
  }

  await sleep(200);
}

async function clickVisibleButtonByAria(page, ariaLabel) {
  const handles = await page.$$("button");
  let clicked = false;

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
    clicked = true;
    break;
  }

  if (!clicked) {
    throw new Error(`Could not find visible button with aria-label "${ariaLabel}"`);
  }

  await sleep(200);
}

function pushAssertion(assertions, name, pass, details = {}) {
  assertions.push({ name, pass, details });
}

function finishCheck(data) {
  return {
    ...data,
    pass: data.assertions.every((assertion) => assertion.pass),
  };
}

function arraysEqual(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function arraysEqualByFields(actual, expected, fields) {
  return (
    actual.length === expected.length &&
    actual.every((entry, index) =>
      fields.every((field) => entry?.[field] === expected[index]?.[field])
    )
  );
}

function hasSubsequence(actual, expected) {
  if (expected.length === 0) return true;
  let pointer = 0;
  for (const entry of actual) {
    if (entry === expected[pointer]) {
      pointer += 1;
      if (pointer === expected.length) return true;
    }
  }
  return false;
}

function dedupeByFields(items, fields) {
  const seen = new Set();
  return items.filter((item) => {
    const key = fields.map((field) => item[field] ?? "").join("::");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSummary(docsShell) {
  const desktopRootAssertions = docsShell.desktopRoot.assertions;
  const deepDocAssertions = docsShell.deepDoc.assertions;
  const bannerAssertions = docsShell.bannerDismissal.assertions;
  const mobileAssertions = [
    ...docsShell.mobileDeepDoc.tocPopover.assertions,
    ...docsShell.mobileDeepDoc.navigation.assertions,
  ];
  const routeChecks = docsShell.menuSwitcherRoutes;

  const totalAssertions =
    desktopRootAssertions.length +
    deepDocAssertions.length +
    bannerAssertions.length +
    mobileAssertions.length +
    routeChecks.length;
  const failedAssertions = [
    ...desktopRootAssertions.filter((assertion) => !assertion.pass).map((assertion) => `Desktop root: ${assertion.name}`),
    ...deepDocAssertions.filter((assertion) => !assertion.pass).map((assertion) => `Deep doc: ${assertion.name}`),
    ...bannerAssertions.filter((assertion) => !assertion.pass).map((assertion) => `Banner: ${assertion.name}`),
    ...mobileAssertions.filter((assertion) => !assertion.pass).map((assertion) => `Mobile: ${assertion.name}`),
    ...routeChecks.filter((routeCheck) => !routeCheck.pass).map((routeCheck) => `Menu-switcher route: ${routeCheck.path}`),
  ];

  const observations = [
    ...docsShell.desktopRoot.observations,
    ...docsShell.deepDoc.observations,
    ...(docsShell.mobileDeepDoc.tocPopover.observations ?? []),
    ...(docsShell.mobileDeepDoc.navigation.observations ?? []),
  ];

  return `# Chapter 3 Summary

## Environment

- Base URL: \`${docsShell.baseUrl}\`

## Results

- Total assertions executed: ${totalAssertions}
- Failed assertions: ${failedAssertions.length}
- Menu-switcher routes checked: ${routeChecks.length}
- Desktop screenshots: \`desktop-docs-root.png\`, \`desktop-docs-deep-page.png\`
- Mobile screenshots: \`mobile-site-nav.png\`, \`mobile-docs-chrome.png\`, \`mobile-toc-popover.png\`

## Notable observations

${observations.length > 0
    ? observations.map((observation) => `- ${observation}`).join("\n")
    : "- No additional observations from the initial local run."}

## Failing assertions

${failedAssertions.length > 0
    ? failedAssertions.map((failure) => `- ${failure}`).join("\n")
    : "- No failing assertions in the initial local run."}

## Manual follow-up

- Review the screenshots in \`review/3-information-architecture-and-core-docs-ux/evidence/screenshots/\`.
- Complete the touch-device and keyboard-navigation checks listed in \`manual/notes.md\`.
`;
}

async function writeJson(filename, data) {
  await fs.writeFile(path.join(outputDir, filename), JSON.stringify(data, null, 2), "utf8");
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  if (!style || style.visibility === "hidden" || style.display === "none") return false;
  return element.getClientRects().length > 0;
}

await main();
