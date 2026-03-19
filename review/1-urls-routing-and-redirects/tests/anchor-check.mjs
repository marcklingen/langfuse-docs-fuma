import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const require = createRequire(import.meta.url);
const currentPages = require("../../../.sitemap-all-pages.json");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapterDir = path.resolve(__dirname, "..");
const artifactsDir = path.join(chapterDir, "artifacts");
const screenshotDir = path.join(artifactsDir, "anchor-screenshots");

const PREVIEW_BASE_URL =
  process.env.CHAPTER1_PREVIEW_BASE_URL ??
  "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function uniq(values) {
  return [...new Set(values)];
}

function pickExactOrPrefix(allPaths, preferredPaths) {
  const chosen = [];

  for (const preferred of preferredPaths) {
    const exact = allPaths.find((candidate) => candidate === preferred);
    if (exact) {
      chosen.push(exact);
      continue;
    }

    const prefixed = allPaths.find((candidate) => candidate.startsWith(preferred));
    if (prefixed) {
      chosen.push(prefixed);
    }
  }

  return uniq(chosen);
}

function buildAnchorSamples(allPaths) {
  return pickExactOrPrefix(allPaths, [
    "/docs/prompt-management/get-started",
    "/docs/observability/data-model",
    "/docs/docs-mcp",
    "/integrations/frameworks/langchain",
    "/self-hosting/docker-compose",
    "/guides/cookbook/evaluation_with_langchain",
  ]);
}

function slugify(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function buildMarkdown(results) {
  const lines = [
    "# Chapter 1 Anchor Check",
    "",
    `- Run at: ${new Date().toISOString()}`,
    `- Preview base URL: ${PREVIEW_BASE_URL}`,
    `- Sample pages checked: ${results.length}`,
    `- Failures: ${results.filter((result) => !result.pass).length}`,
    "",
    "## Results",
    "",
  ];

  for (const result of results) {
    lines.push(
      `- ${result.pagePath} -> #${result.anchorId} : ${result.pass ? "pass" : "fail"}`
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export async function runAnchorCheck() {
  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.mkdir(screenshotDir, { recursive: true });

  const samplePages = buildAnchorSamples(currentPages);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });

  const results = [];

  try {
    for (const pagePath of samplePages) {
      const initialUrl = new URL(pagePath, PREVIEW_BASE_URL).toString();
      await page.goto(initialUrl, { waitUntil: "networkidle2" });

      const anchor = await page.evaluate(() => {
        const candidates = document.querySelectorAll(
          "main h2[id], main h3[id], article h2[id], article h3[id]"
        );
        for (const candidate of candidates) {
          const id = candidate.id?.trim();
          const text = candidate.textContent?.trim();
          if (id && text) {
            return { id, text };
          }
        }
        return null;
      });

      if (!anchor) {
        results.push({
          pagePath,
          anchorId: null,
          anchorText: null,
          pass: false,
          reason: "no-anchor-found",
          scrollTop: null,
          targetTop: null,
          screenshot: null,
        });
        continue;
      }

      const anchorUrl = `${initialUrl}#${anchor.id}`;
      await page.goto(anchorUrl, { waitUntil: "networkidle2" });
      await sleep(500);

      const measurement = await page.evaluate((anchorId) => {
        const target = document.getElementById(anchorId);
        if (!target) {
          return {
            hash: window.location.hash,
            found: false,
            scrollTop: window.scrollY,
            targetTop: null,
            viewportHeight: window.innerHeight,
          };
        }

        const rect = target.getBoundingClientRect();
        return {
          hash: window.location.hash,
          found: true,
          scrollTop: window.scrollY,
          targetTop: rect.top,
          viewportHeight: window.innerHeight,
        };
      }, anchor.id);

      const pass =
        measurement.found &&
        measurement.hash === `#${anchor.id}` &&
        measurement.targetTop !== null &&
        measurement.targetTop >= -180 &&
        measurement.targetTop <= measurement.viewportHeight * 0.5;

      const screenshotName = `${slugify(pagePath)}-${anchor.id}.png`;
      const screenshotPath = path.join(screenshotDir, screenshotName);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      results.push({
        pagePath,
        anchorId: anchor.id,
        anchorText: anchor.text,
        pass,
        reason: pass ? null : "anchor-target-not-in-view",
        hash: measurement.hash,
        scrollTop: measurement.scrollTop,
        targetTop: measurement.targetTop,
        viewportHeight: measurement.viewportHeight,
        screenshot: path.relative(chapterDir, screenshotPath),
      });
    }
  } finally {
    await page.close();
    await browser.close();
  }

  const payload = {
    runAt: new Date().toISOString(),
    previewBaseUrl: PREVIEW_BASE_URL,
    summary: {
      sampleCount: results.length,
      failures: results.filter((result) => !result.pass).length,
    },
    results,
  };

  await Promise.all([
    fs.writeFile(
      path.join(artifactsDir, "anchor-check.json"),
      `${JSON.stringify(payload, null, 2)}\n`
    ),
    fs.writeFile(path.join(artifactsDir, "anchor-check.md"), buildMarkdown(results)),
  ]);

  console.log(
    `Anchor check complete: ${payload.summary.failures} failures across ${payload.summary.sampleCount} samples`
  );

  return payload;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runAnchorCheck();
}
