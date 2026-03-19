import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runRouteAudit } from "./route-audit.mjs";
import { runAnchorCheck } from "./anchor-check.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapterDir = path.resolve(__dirname, "..");
const artifactsDir = path.join(chapterDir, "artifacts");

function buildSummaryMarkdown(routeAudit, anchorCheck) {
  const lines = [
    "# Chapter 1 Execution Summary",
    "",
    `- Run at: ${new Date().toISOString()}`,
    `- Route regressions: ${routeAudit.summary.findings.comparisonFailures}`,
    `- Redirect failures: ${routeAudit.summary.findings.redirectFailures}`,
    `- Trailing-slash duplicates: ${routeAudit.summary.findings.trailingSlashFailures}`,
    `- Case-handling failures: ${routeAudit.summary.findings.caseFailures}`,
    `- Internal-link failures: ${routeAudit.summary.findings.internalLinkFailures}`,
    `- Anchor-check failures: ${anchorCheck.summary.failures}`,
    "",
    "Detailed evidence is stored in `route-audit.json`, `route-audit.md`, `anchor-check.json`, and `anchor-check.md`.",
    "",
  ];

  return `${lines.join("\n")}`;
}

await fs.mkdir(artifactsDir, { recursive: true });

const routeAudit = await runRouteAudit();
const anchorCheck = await runAnchorCheck();

const payload = {
  runAt: new Date().toISOString(),
  routeAudit: routeAudit.summary,
  anchorCheck: anchorCheck.summary,
};

await Promise.all([
  fs.writeFile(
    path.join(artifactsDir, "chapter-1-summary.json"),
    `${JSON.stringify(payload, null, 2)}\n`
  ),
  fs.writeFile(
    path.join(artifactsDir, "chapter-1-summary.md"),
    buildSummaryMarkdown(routeAudit, anchorCheck)
  ),
]);

console.log("Chapter 1 execution complete");
