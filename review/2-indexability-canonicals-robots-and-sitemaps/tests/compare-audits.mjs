#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

function usage() {
  console.error(`Usage:
  node review/2-indexability-canonicals-robots-and-sitemaps/tests/compare-audits.mjs \\
    --baseline path/to/production-audit.json \\
    --candidate path/to/preview-audit.json \\
    [--out path/to/prod-vs-preview.md]`);
}

function mapByLoc(pages) {
  return new Map(pages.map((page) => [page.sitemapLoc, page]));
}

function sortStrings(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function take(values, count = 25) {
  return values.slice(0, count);
}

function renderBulletList(values) {
  if (values.length === 0) return "_None._\n";
  return `${values.map((value) => `- ${value}`).join("\n")}\n`;
}

function renderTable(headers, rows) {
  if (rows.length === 0) return "_None._\n";
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyLines = rows.map((row) => `| ${row.join(" | ")} |`);
  return `${headerLine}\n${separatorLine}\n${bodyLines.join("\n")}\n`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      baseline: { type: "string" },
      candidate: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean" },
    },
  });

  if (values.help || !values.baseline || !values.candidate) {
    usage();
    process.exit(values.help ? 0 : 1);
  }

  const baseline = JSON.parse(await readFile(resolve(process.cwd(), values.baseline), "utf8"));
  const candidate = JSON.parse(await readFile(resolve(process.cwd(), values.candidate), "utf8"));

  const baselinePages = mapByLoc(baseline.pages);
  const candidatePages = mapByLoc(candidate.pages);
  const baselineUrls = new Set(baselinePages.keys());
  const candidateUrls = new Set(candidatePages.keys());
  const sharedUrls = sortStrings(
    [...baselineUrls].filter((url) => candidateUrls.has(url))
  );
  const addedUrls = sortStrings([...candidateUrls].filter((url) => !baselineUrls.has(url)));
  const removedUrls = sortStrings([...baselineUrls].filter((url) => !candidateUrls.has(url)));

  const canonicalRegressions = [];
  const noindexRegressions = [];
  const ogUrlRegressions = [];
  const descriptionRegressions = [];
  const indexabilityAdded = [];
  const indexabilityRemoved = [];

  for (const url of sharedUrls) {
    const prod = baselinePages.get(url);
    const preview = candidatePages.get(url);

    if (prod.expectedCanonical && prod.canonicalMatchesExpected && !preview.canonicalMatchesExpected) {
      canonicalRegressions.push({
        url,
        prodCanonical: prod.canonical ?? "",
        previewCanonical: preview.canonical ?? "",
      });
    }

    if (prod.expectedNoindex && prod.hasExpectedNoindex && !preview.hasExpectedNoindex) {
      noindexRegressions.push({
        url,
        prodRobots: prod.robotsMeta ?? "",
        previewRobots: preview.robotsMeta ?? "",
        previewHeader: preview.xRobotsTag ?? "",
      });
    }

    if (prod.ogUrl && !preview.ogUrl) {
      ogUrlRegressions.push({
        url,
        prodOgUrl: prod.ogUrl,
      });
    }

    if (prod.description && !preview.description) {
      descriptionRegressions.push({
        url,
        prodDescription: prod.description,
      });
    }

    if (!prod.pageLevelIndexable && preview.pageLevelIndexable) {
      indexabilityAdded.push(url);
    }

    if (prod.pageLevelIndexable && !preview.pageLevelIndexable) {
      indexabilityRemoved.push(url);
    }
  }

  const previewHeaderFailures = candidate.pages.filter(
    (page) => candidate.expectPreviewNoindex && page.isHtml && !page.hasPreviewNoindexHeader
  );
  const previewExpectedNoindexSitemapEntries = candidate.pages.filter((page) =>
    page.problems.includes("sitemap-includes-expected-noindex")
  );
  const previewCanonicalDuplicateSitemapEntries = candidate.pages.filter((page) =>
    page.problems.includes("sitemap-includes-expected-canonical-duplicate")
  );
  const previewCookbookDuplicates = candidate.pages.filter((page) =>
    page.problems.includes("sitemap-includes-cookbook-duplicate")
  );
  const previewMdFailures = candidate.mdChecks.filter((check) => !check.ok);

  const markdown = `# Chapter 2 Audit Diff

Generated: ${new Date().toISOString()}

## Targets

- Baseline: \`${baseline.targetBaseUrl}\`
- Candidate: \`${candidate.targetBaseUrl}\`

## Summary

- Shared sitemap URLs: ${sharedUrls.length}
- Added sitemap URLs in candidate: ${addedUrls.length}
- Removed sitemap URLs in candidate: ${removedUrls.length}
- Canonical regressions: ${canonicalRegressions.length}
- Page-level noindex regressions: ${noindexRegressions.length}
- Missing \`og:url\` regressions: ${ogUrlRegressions.length}
- Missing description regressions: ${descriptionRegressions.length}
- URLs that became page-level indexable in candidate: ${indexabilityAdded.length}
- URLs that stopped being page-level indexable in candidate: ${indexabilityRemoved.length}
- Preview HTML pages missing the global \`X-Robots-Tag: noindex\` header: ${previewHeaderFailures.length}
- Candidate sitemap URLs marked \`noindex\` in source: ${previewExpectedNoindexSitemapEntries.length}
- Candidate sitemap URLs canonicalized elsewhere in source: ${previewCanonicalDuplicateSitemapEntries.length}
- Candidate sitemap URLs that should be excluded by cookbook duplicate logic: ${previewCookbookDuplicates.length}
- Candidate markdown endpoint failures: ${previewMdFailures.length}

## Added Sitemap URLs

${renderBulletList(take(addedUrls, 30))}

## Removed Sitemap URLs

${renderBulletList(take(removedUrls, 30))}

## Canonical Regressions

${renderTable(
  ["URL", "Production canonical", "Candidate canonical"],
  take(canonicalRegressions, 25).map((entry) => [
    entry.url,
    entry.prodCanonical || "(missing)",
    entry.previewCanonical || "(missing)",
  ])
)}

## Page-Level Noindex Regressions

${renderTable(
  ["URL", "Production robots", "Candidate robots", "Candidate X-Robots-Tag"],
  take(noindexRegressions, 25).map((entry) => [
    entry.url,
    entry.prodRobots || "(missing)",
    entry.previewRobots || "(missing)",
    entry.previewHeader || "(missing)",
  ])
)}

## Missing og:url Regressions

${renderTable(
  ["URL", "Production og:url"],
  take(ogUrlRegressions, 25).map((entry) => [entry.url, entry.prodOgUrl])
)}

## Missing Description Regressions

${renderTable(
  ["URL", "Production description"],
  take(descriptionRegressions, 25).map((entry) => [entry.url, entry.prodDescription])
)}

## Page-Level Indexability Changes

### Became indexable in candidate

${renderBulletList(take(indexabilityAdded, 30))}

### Stopped being indexable in candidate

${renderBulletList(take(indexabilityRemoved, 30))}

## Candidate-Only Checks

### Preview pages missing the global noindex header

${renderTable(
  ["URL", "Candidate status", "Candidate X-Robots-Tag"],
  take(previewHeaderFailures, 25).map((page) => [
    page.sitemapLoc,
    String(page.status),
    page.xRobotsTag || "(missing)",
  ])
)}

### Candidate sitemap includes source-marked noindex routes

${renderTable(
  ["URL", "Expected behavior"],
  take(previewExpectedNoindexSitemapEntries, 25).map((page) => [
    page.sitemapLoc,
    "Exclude from sitemap and keep page-level noindex",
  ])
)}

### Candidate sitemap includes routes canonicalized elsewhere

${renderTable(
  ["URL", "Expected canonical"],
  take(previewCanonicalDuplicateSitemapEntries, 25).map((page) => [
    page.sitemapLoc,
    page.expectedCanonical || "(missing)",
  ])
)}

### Candidate markdown endpoint failures

${renderTable(
  ["Path", "Status", "Content-Type", "X-Robots-Tag", "Problems"],
  take(previewMdFailures, 25).map((check) => [
    check.path,
    String(check.status),
    check.contentType || "(missing)",
    check.xRobotsTag || "(missing)",
    check.problems.join(", "),
  ])
)}
`;

  if (values.out) {
    const outPath = resolve(process.cwd(), values.out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, markdown);
    console.log(`Wrote report to ${outPath}`);
  }

  console.log(markdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
