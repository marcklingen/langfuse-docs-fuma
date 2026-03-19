#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const args = process.argv.slice(2);

let outputPath = "review/11-fumadocs-architecture-and-best-practice-alignment/artifacts/repo-audit.json";

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--output") {
    outputPath = args[i + 1];
    i += 1;
  }
}

function abs(relPath) {
  return path.join(repoRoot, relPath);
}

function exists(relPath) {
  return fs.existsSync(abs(relPath));
}

function read(relPath) {
  return fs.readFileSync(abs(relPath), "utf8");
}

function writeJson(relPath, value) {
  const resolved = abs(relPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(value, null, 2) + "\n");
}

function rel(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function runGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function walk(dirPath) {
  const out = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
      continue;
    }
    const full = path.join(dirPath, entry.name);
    out.push(full);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    }
  }
  return out;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function extractDefinedDocs(text) {
  return [...text.matchAll(/export const (\w+)\s*=\s*defineDocs\(/g)].map((match) => match[1]);
}

function extractRuntimeFrontmatterFields(text) {
  return [...text.matchAll(/page\?\.(?:data)\?\.(\w+)/g)].map((match) => match[1]);
}

function extractSchemaFields(text) {
  return [...text.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*z\./g)].map((match) => match[1]);
}

function extractSourceServerImports(text) {
  for (const match of text.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*"([^"]+)";/g)) {
    if (match[2] !== "../.source/server") continue;
    return match[1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function extractDefineDocsDirs(text) {
  const dirs = [];
  const regex = /export const (\w+)\s*=\s*defineDocs\(\{\s*dir:\s*"([^"]+)"/g;
  for (const match of text.matchAll(regex)) {
    dirs.push({ name: match[1], dir: match[2] });
  }
  return dirs;
}

function summarizeNavDirectories(contentDir) {
  const directories = walk(contentDir).filter((entry) => fs.statSync(entry).isDirectory());
  const missingMeta = [];

  for (const directory of directories) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const pageFiles = entries.filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))
    );
    const childDirs = entries.filter((entry) => entry.isDirectory());
    const looksNavigational = pageFiles.length >= 2 || (pageFiles.length >= 1 && childDirs.length >= 1);
    const hasMeta = entries.some((entry) => entry.isFile() && entry.name === "meta.json");

    if (looksNavigational && !hasMeta) {
      missingMeta.push(rel(directory));
    }
  }

  return missingMeta;
}

const sourceConfigPath = "source.config.ts";
const nextConfigPath = "next.config.mjs";
const rootLayoutPath = "app/layout.tsx";
const sourceLibPath = "lib/source.ts";
const mdxComponentsPath = "mdx-components.tsx";
const docsLayoutPath = "app/docs/layout.tsx";
const sharedDocsLayoutPath = "app/docs/SharedDocsLayout.tsx";
const docsPagePath = "app/docs/[[...slug]]/page.tsx";
const sectionLayoutPath = "app/[section]/layout.tsx";
const sectionPagePath = "app/[section]/[[...slug]]/page.tsx";
const docsWrapperPath = "app/docs/DocsLayoutWrapper.tsx";
const sectionWrapperPath = "app/[section]/SectionLayoutWrapper.tsx";
const searchDocsRoutePath = "app/api/search-docs/route.ts";

const files = {
  sourceConfig: read(sourceConfigPath),
  nextConfig: read(nextConfigPath),
  rootLayout: read(rootLayoutPath),
  sourceLib: read(sourceLibPath),
  mdxComponents: read(mdxComponentsPath),
  docsLayout: read(docsLayoutPath),
  sharedDocsLayout: read(sharedDocsLayoutPath),
  docsPage: read(docsPagePath),
  sectionLayout: read(sectionLayoutPath),
  sectionPage: read(sectionPagePath),
  docsWrapper: read(docsWrapperPath),
  sectionWrapper: read(sectionWrapperPath),
  searchDocsRoute: read(searchDocsRoutePath),
};

const checks = [];

function addCheck(id, title, status, summary, evidence = []) {
  checks.push({ id, title, status, summary, evidence });
}

const baselineFiles = [
  sourceConfigPath,
  nextConfigPath,
  rootLayoutPath,
  sourceLibPath,
  mdxComponentsPath,
  docsLayoutPath,
  docsPagePath,
];

const missingBaselineFiles = baselineFiles.filter((file) => !exists(file));
const hasCreateMdx = files.nextConfig.includes("createMDX");
const hasRootProvider = files.rootLayout.includes("RootProvider");
const hasLoader = files.sourceLib.includes("loader({");
const extendsDefaultMdx = files.mdxComponents.includes("...defaultMdxComponents");

addCheck(
  "baseline-wiring",
  "Baseline Fumadocs wiring exists",
  missingBaselineFiles.length === 0 && hasCreateMdx && hasRootProvider && hasLoader && extendsDefaultMdx ? "pass" : "fail",
  missingBaselineFiles.length === 0 && hasCreateMdx && hasRootProvider && hasLoader && extendsDefaultMdx
    ? "The repo keeps the expected Fumadocs baseline files and core wiring."
    : "One or more baseline Fumadocs files or wiring hooks are missing.",
  [
    ...baselineFiles.map((file) => ({ type: "file", path: file, exists: exists(file) })),
    { type: "signal", name: "createMDX", present: hasCreateMdx },
    { type: "signal", name: "RootProvider", present: hasRootProvider },
    { type: "signal", name: "loader()", present: hasLoader },
    { type: "signal", name: "default MDX extension", present: extendsDefaultMdx },
  ]
);

const definedDocs = extractDefinedDocs(files.sourceConfig);
const importedCollections = extractSourceServerImports(files.sourceLib);
const missingCollectionsInSourceConfig = importedCollections.filter((name) => !definedDocs.includes(name));
const runtimeFrontmatterFields = [...new Set(extractRuntimeFrontmatterFields(files.sourceLib))];
const declaredSchemaFields = [...new Set(extractSchemaFields(files.sourceConfig))];
const undeclaredRuntimeFields = runtimeFrontmatterFields.filter((field) => !declaredSchemaFields.includes(field));

addCheck(
  "source-of-truth",
  "source.config.ts remains the schema source of truth",
  missingCollectionsInSourceConfig.length === 0 && undeclaredRuntimeFields.length === 0 ? "pass" : "fail",
  missingCollectionsInSourceConfig.length === 0 && undeclaredRuntimeFields.length === 0
    ? "Collections and runtime frontmatter fields align with source.config.ts."
    : "Runtime code consumes collection/schema information that source.config.ts does not fully declare.",
  [
    { type: "list", name: "definedDocs", value: definedDocs },
    { type: "list", name: "importedCollections", value: importedCollections },
    { type: "list", name: "undeclaredRuntimeFields", value: undeclaredRuntimeFields },
  ]
);

const docsLikeRouteFiles = [
  "app/docs/[[...slug]]/page.tsx",
  "app/guides/[[...slug]]/page.tsx",
  "app/integrations/[[...slug]]/page.tsx",
  "app/self-hosting/[[...slug]]/page.tsx",
  "app/library/[[...slug]]/page.tsx",
  "app/[section]/[[...slug]]/page.tsx",
];

const routeAudit = docsLikeRouteFiles.map((file) => {
  const text = read(file);
  return {
    file,
    usesGetPage: text.includes(".getPage("),
    usesGenerateStaticParams: text.includes("generateStaticParams"),
    importsFs: /\bfrom\s+"node:fs"|\bfrom\s+"fs"/.test(text),
  };
});

const routeAuditPassed = routeAudit.every(
  (entry) => entry.usesGetPage && entry.usesGenerateStaticParams && !entry.importsFs
);

addCheck(
  "loader-backed-routes",
  "Docs-like routes are loader-backed",
  routeAuditPassed ? "pass" : "fail",
  routeAuditPassed
    ? "Representative docs-style routes resolve content through Fumadocs loaders, not request-time filesystem access."
    : "At least one docs-style route is not clearly loader-backed.",
  routeAudit
);

const collectionDirs = extractDefineDocsDirs(files.sourceConfig);
const missingRootMeta = [];
const missingNavigationalMeta = [];

for (const { dir } of collectionDirs) {
  const rootMetaPath = path.join(dir, "meta.json");
  if (!exists(rootMetaPath)) {
    missingRootMeta.push(rootMetaPath);
  }

  if (exists(dir)) {
    missingNavigationalMeta.push(...summarizeNavDirectories(abs(dir)));
  }
}

addCheck(
  "content-structure",
  "content trees expose predictable meta.json structure",
  missingRootMeta.length === 0 && missingNavigationalMeta.length === 0 ? "pass" : "warn",
  missingRootMeta.length === 0 && missingNavigationalMeta.length === 0
    ? "Collection roots and navigation-heavy subdirectories consistently declare meta.json."
    : "Some navigation-heavy content directories rely on implicit filesystem ordering instead of explicit meta.json.",
  [
    { type: "list", name: "missingRootMeta", value: missingRootMeta },
    { type: "list", name: "missingNavigationalMeta", value: missingNavigationalMeta },
  ]
);

const sharedDocsLayoutText = normalizeWhitespace(files.sharedDocsLayout);
const sectionLayoutText = normalizeWhitespace(files.sectionLayout);
const duplicateDocsLayoutSignals = [
  'githubUrl="https://github.com/langfuse/langfuse-docs"',
  "nav={{ enabled: false }}",
  "searchToggle={{ enabled: false }}",
].filter((needle) => sharedDocsLayoutText.includes(needle) && sectionLayoutText.includes(needle));

const wrapperBodiesMatch =
  normalizeWhitespace(files.docsWrapper.replace(/DocsLayoutWrapper/g, "Wrapper")) ===
  normalizeWhitespace(files.sectionWrapper.replace(/SectionLayoutWrapper/g, "Wrapper"));

addCheck(
  "layout-centralization",
  "DocsLayout configuration is centralized where possible",
  wrapperBodiesMatch || duplicateDocsLayoutSignals.length > 0 ? "warn" : "pass",
  wrapperBodiesMatch || duplicateDocsLayoutSignals.length > 0
    ? "Common DocsLayout behavior is partly centralized, but there is still duplicated wrapper/layout configuration that can drift."
    : "DocsLayout behavior is effectively centralized.",
  [
    { type: "list", name: "duplicateDocsLayoutSignals", value: duplicateDocsLayoutSignals },
    { type: "signal", name: "wrapperBodiesMatch", present: wrapperBodiesMatch },
  ]
);

const hasDefaultSearchRoute = exists("app/api/search/route.ts");
const usesCustomSearchApi = exists(searchDocsRoutePath);
const usesInkeepComponents =
  files.searchDocsRoute.includes("searchLangfuseDocsWithInkeep") &&
  exists("components/inkeep/InkeepSearchBar.tsx");

addCheck(
  "search-wiring",
  "Search is intentionally implemented rather than half-migrated",
  !hasDefaultSearchRoute && usesCustomSearchApi && usesInkeepComponents ? "pass" : "warn",
  !hasDefaultSearchRoute && usesCustomSearchApi && usesInkeepComponents
    ? "The repo intentionally replaces the documented default search route with an Inkeep-backed search stack."
    : "Search wiring is not clearly aligned to either the default Fumadocs route or a fully intentional replacement.",
  [
    { type: "signal", name: "defaultSearchRouteExists", present: hasDefaultSearchRoute },
    { type: "signal", name: "customSearchDocsRouteExists", present: usesCustomSearchApi },
    { type: "signal", name: "InkeepSearchBarExists", present: exists("components/inkeep/InkeepSearchBar.tsx") },
  ]
);

const customTreeSignals = [
  "getSelfHostingPageTree",
  "getIntegrationsPageTree",
  "getPageTreeWithShortTitles",
  "SECTION_CONFIG",
  "DOCS_STYLE_APP_SECTIONS",
  "POST_SECTIONS",
  "CHANGELOG_SECTIONS",
  "WIDE_SECTION_SLUGS",
].filter((signal) => files.sourceLib.includes(signal));

addCheck(
  "custom-registry",
  "Custom page-tree rewrites and registries stay minimal",
  customTreeSignals.length <= 3 ? "pass" : "warn",
  customTreeSignals.length <= 3
    ? "Only a small amount of custom tree or section logic sits on top of Fumadocs."
    : "The repo layers several custom page-tree rewrite helpers and section registries on top of Fumadocs.",
  [{ type: "list", name: "customTreeSignals", value: customTreeSignals }]
);

const trackedSourceFiles = runGit(["ls-files", ".source"])
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
const gitignoreText = exists(".gitignore") ? read(".gitignore") : "";
const ignoresDotSource = gitignoreText.includes(".source/");
const hasGeneratedSourceDir = exists(".source");

addCheck(
  "generated-artifacts",
  "Generated .source output is not manually maintained",
  trackedSourceFiles.length === 0 && ignoresDotSource && hasGeneratedSourceDir ? "pass" : "warn",
  trackedSourceFiles.length === 0 && ignoresDotSource && hasGeneratedSourceDir
    ? ".source exists locally as generated output, is gitignored, and is not tracked."
    : ".source hygiene is incomplete or inconsistent.",
  [
    { type: "list", name: "trackedSourceFiles", value: trackedSourceFiles },
    { type: "signal", name: "ignoresDotSource", present: ignoresDotSource },
    { type: "signal", name: "hasGeneratedSourceDir", present: hasGeneratedSourceDir },
  ]
);

const nextraAliasTargets = [
  "lib/nextra-shim/context.tsx",
  "lib/nextra-shim/hooks.ts",
  "lib/nextra-shim/nextra-types.ts",
  "lib/nextra-shim/theme-docs.tsx",
  "lib/nextra-shim/components.tsx",
];
const missingNextraTargets = nextraAliasTargets.filter((target) => !exists(target));
const liveNextraImports = walk(repoRoot)
  .filter((entry) => /\.(ts|tsx|js|jsx|mdx)$/.test(entry))
  .filter((entry) => !entry.includes("/node_modules/") && !entry.includes("/.next/"))
  .flatMap((entry) => {
    const text = fs.readFileSync(entry, "utf8");
    return /\bfrom\s+["']nextra(?:\/|["'])|\bfrom\s+["']nextra-theme-docs["']/.test(text)
      ? [rel(entry)]
      : [];
  });

addCheck(
  "migration-shims",
  "Migration shims are still required and isolated",
  missingNextraTargets.length === 0 || liveNextraImports.length > 0 ? "pass" : "fail",
  missingNextraTargets.length === 0 || liveNextraImports.length > 0
    ? "Nextra compatibility paths are either still present or still consumed."
    : "Webpack/TypeScript still alias nextra modules to lib/nextra-shim/*, but those files are gone and no live imports remain.",
  [
    { type: "list", name: "missingNextraTargets", value: missingNextraTargets },
    { type: "list", name: "liveNextraImports", value: liveNextraImports },
  ]
);

addCheck(
  "mdx-overrides",
  "MDX overrides extend Fumadocs cleanly",
  files.mdxComponents.includes("...defaultMdxComponents") ? "pass" : "fail",
  files.mdxComponents.includes("...defaultMdxComponents")
    ? "mdx-components.tsx starts from the default Fumadocs component map and adds repo-specific overrides."
    : "MDX components replace the default Fumadocs component map instead of extending it.",
  [{ type: "file", path: mdxComponentsPath }]
);

const counts = checks.reduce(
  (acc, check) => {
    acc[check.status] = (acc[check.status] ?? 0) + 1;
    return acc;
  },
  { pass: 0, warn: 0, fail: 0 }
);

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  officialBaseline: [
    "https://www.fumadocs.dev/docs/manual-installation/next",
    "https://www.fumadocs.dev/docs/mdx/collections",
    "https://www.fumadocs.dev/docs/headless/source-api",
    "https://www.fumadocs.dev/docs/headless/page-tree",
  ],
  summary: {
    totalChecks: checks.length,
    ...counts,
  },
  checks,
};

writeJson(outputPath, report);

if (counts.fail > 0) {
  console.error(`Chapter 11 audit found ${counts.fail} failing check(s).`);
  process.exit(1);
}

console.log(`Chapter 11 audit completed: ${counts.pass} pass, ${counts.warn} warn, ${counts.fail} fail.`);
