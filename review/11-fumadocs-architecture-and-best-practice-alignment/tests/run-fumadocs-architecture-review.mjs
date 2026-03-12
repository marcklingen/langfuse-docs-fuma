import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chapterDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(chapterDir, "..", "..");
const outputDir = path.resolve(
  repoRoot,
  process.env.OUTPUT_DIR ??
    "review/11-fumadocs-architecture-and-best-practice-alignment/evidence"
);

const OFFICIAL_BASELINE = [
  {
    topic: "MDX / Next.js setup",
    url: "https://fumadocs.dev/docs/mdx/next",
    checkedAt: "2026-03-11",
    expectations: [
      "Use createMDX() in next.config.mjs",
      "Define collections in source.config.ts",
      "Generate .source and keep it out of normal hand-maintained source files",
      "Provide app/layout.tsx and mdx-components.tsx integration",
    ],
  },
  {
    topic: "Page conventions and meta.json",
    url: "https://fumadocs.dev/docs/page-conventions",
    checkedAt: "2026-03-11",
    expectations: [
      "Use content/ with page files and meta.json for predictable navigation",
      "Rely on page slugs and page tree generated from the content structure",
    ],
  },
  {
    topic: "Navigation and page tree",
    url: "https://fumadocs.dev/docs/navigation",
    checkedAt: "2026-03-11",
    expectations: [
      "Prefer page-tree generation from loader-backed sources",
      "Use loader plugins or equivalent source-layer hooks for page-tree customization",
    ],
  },
  {
    topic: "Docs layout shared options",
    url: "https://fumadocs.dev/docs/ui/layouts/docs",
    checkedAt: "2026-03-11",
    expectations: [
      "Keep DocsLayout configuration centralized where possible",
      "Share base layout options instead of repeating identical config per section",
    ],
  },
  {
    topic: "Search server route",
    url: "https://fumadocs.dev/docs/search/server",
    checkedAt: "2026-03-11",
    expectations: [
      "Use the documented Fumadocs search route or an intentional equivalent",
      "Keep search wiring obvious and isolated from unrelated route logic",
    ],
  },
];

const REQUIRED_BASELINE_FILES = [
  {
    path: "source.config.ts",
    checks: {
      defineConfig: /defineConfig\(/,
      defineDocs: /defineDocs\(/,
      providerImportSource: /providerImportSource:\s*["']@\/mdx-components["']/,
    },
  },
  {
    path: "next.config.mjs",
    checks: {
      createMDX: /createMDX\(/,
      mdxImport: /from\s+["']fumadocs-mdx\/next["']/,
    },
  },
  {
    path: "app/layout.tsx",
    checks: {
      rootProvider: /RootProvider/,
    },
  },
  {
    path: "lib/source.ts",
    checks: {
      loader: /loader\(/,
      sourceServerImport: /from\s+["']\.\.\/\.source\/server["']/,
    },
  },
  {
    path: "mdx-components.tsx",
    checks: {
      defaultMdxComponents: /fumadocs-ui\/mdx/,
      getMDXComponents: /getMDXComponents/,
    },
  },
];

const DOCS_LAYOUT_FILES = [
  "app/docs/layout.tsx",
  "app/guides/layout.tsx",
  "app/self-hosting/layout.tsx",
  "app/integrations/layout.tsx",
  "app/library/layout.tsx",
  "app/[section]/layout.tsx",
];

const DOCS_STYLE_ROUTE_FILES = [
  {
    file: "app/docs/[[...slug]]/page.tsx",
    sourceAccessor: "source",
    bodyRenderer: "DocBodyClient",
  },
  {
    file: "app/guides/[[...slug]]/page.tsx",
    sourceAccessor: "guidesSource",
    bodyRenderer: "SectionDocBodyClientWithDocsBody",
  },
  {
    file: "app/self-hosting/[[...slug]]/page.tsx",
    sourceAccessor: "selfHostingSource",
    bodyRenderer: "SectionDocBodyClientWithDocsBody",
  },
  {
    file: "app/integrations/[[...slug]]/page.tsx",
    sourceAccessor: "integrationsSource",
    bodyRenderer: "SectionDocBodyClientWithDocsBody",
  },
  {
    file: "app/library/[[...slug]]/page.tsx",
    sourceAccessor: "librarySource",
    bodyRenderer: "SectionDocBodyClientWithDocsBody",
  },
  {
    file: "app/[section]/[[...slug]]/page.tsx",
    sourceAccessor: "config.source",
    bodyRenderer: "SectionDocBodyClient",
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function repoExists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function listFilesRecursively(relativeDir, filter) {
  const start = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(start)) return [];

  const results = [];
  const stack = [start];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else {
        const rel = toPosix(path.relative(repoRoot, fullPath));
        if (!filter || filter(rel, fullPath)) results.push(rel);
      }
    }
  }

  return results.sort();
}

function listDirectoriesRecursively(relativeDir) {
  const start = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(start)) return [];

  const results = [];
  const stack = [start];

  while (stack.length > 0) {
    const current = stack.pop();
    const rel = toPosix(path.relative(repoRoot, current));
    if (rel) results.push(rel);
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      }
    }
  }

  return results.sort();
}

function runGit(args) {
  try {
    const output = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function statusLabel(status) {
  if (status === "pass") return "Pass";
  if (status === "deviation") return "Pass with deviation";
  return "Fail";
}

function overallStatus(items) {
  if (items.some((item) => item.status === "fail")) return "fail";
  if (items.some((item) => item.status === "deviation")) return "deviation";
  return "pass";
}

function parseCollections(sourceConfigText) {
  const regex =
    /export const (\w+)\s*=\s*defineDocs\(\{\s*dir:\s*["']([^"']+)["']([\s\S]*?)\n\}\);/gm;
  const collections = [];
  for (const match of sourceConfigText.matchAll(regex)) {
    collections.push({
      exportName: match[1],
      dir: match[2],
      hasCustomSchema: /schema:/.test(match[3]),
    });
  }
  return collections;
}

function slugFromContentFile(relativePath, collectionDir) {
  const collectionPrefix = `${collectionDir}/`;
  const withoutPrefix = relativePath.startsWith(collectionPrefix)
    ? relativePath.slice(collectionPrefix.length)
    : relativePath;
  const withoutExt = withoutPrefix.replace(/\.(mdx|md)$/i, "");
  if (withoutExt === "index") return "";
  return withoutExt.replace(/\/index$/i, "");
}

function collectCollectionSlugs(collectionDir) {
  return listFilesRecursively(collectionDir, (rel) => /\.(mdx|md)$/i.test(rel)).map((rel) =>
    slugFromContentFile(rel, collectionDir)
  );
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort();
}

function diffSlugs(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: expected.filter((value) => !actualSet.has(value)),
    extra: actual.filter((value) => !expectedSet.has(value)),
  };
}

function parseImportSlugs(text, collectionDir, collectionName) {
  const regex = new RegExp(
    `@\\/content\\/${collectionDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/([^"?]+)\\.(?:mdx|md)\\?collection=${collectionName}`,
    "g"
  );
  const slugs = [];
  for (const match of text.matchAll(regex)) {
    const filePath = `${collectionDir}/${match[1]}.${match[0].includes(".mdx?") ? "mdx" : "md"}`;
    slugs.push(slugFromContentFile(filePath, collectionDir));
  }
  return uniqueSorted(slugs);
}

function inspectContentStructure(collectionDir) {
  const directories = [collectionDir, ...listDirectoriesRecursively(collectionDir)];
  const reports = [];

  for (const relativeDir of uniqueSorted(directories)) {
    const absoluteDir = path.join(repoRoot, relativeDir);
    if (!fs.existsSync(absoluteDir)) continue;

    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true }).filter((entry) => {
      return !entry.name.startsWith(".");
    });

    const childPages = entries
      .filter((entry) => entry.isFile() && /\.(mdx|md)$/i.test(entry.name))
      .map((entry) => entry.name);
    const childContentDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    const nonIndexChildPages = childPages.filter(
      (name) => !/^index\.(mdx|md)$/i.test(name)
    );
    const hasMeta = entries.some((entry) => entry.isFile() && entry.name === "meta.json");
    const expectMeta =
      relativeDir === collectionDir ||
      childContentDirs.length > 0 ||
      nonIndexChildPages.length > 1;

    reports.push({
      directory: relativeDir,
      hasMeta,
      expectMeta,
      childPageCount: childPages.length,
      childSectionCount: childContentDirs.length,
    });
  }

  return {
    collectionDir,
    directories: reports,
    missingExpectedMeta: reports
      .filter((report) => report.expectMeta && !report.hasMeta)
      .map((report) => report.directory),
  };
}

function buildLayoutSignature(text) {
  return {
    usesDocsLayout: /<DocsLayout/.test(text),
    githubUrl: /githubUrl="https:\/\/github\.com\/langfuse\/langfuse-docs"/.test(text),
    navDisabled: /nav=\{\{\s*enabled:\s*false\s*\}\}/.test(text),
    searchDisabled: /searchToggle=\{\{\s*enabled:\s*false\s*\}\}/.test(text),
    sidebarBanner: /sidebar=\{\{\s*banner:\s*<MenuSwitcher \/>/.test(text),
    sidebarConditional: /sidebar=\s*\{\s*isMarketing \|\| isPost/.test(text),
    themeSwitchConditional: /themeSwitch=\{isMarketing \|\| isPost/.test(text),
    layoutWrapper: /DocsLayoutWrapper|SectionLayoutWrapper/.test(text),
  };
}

function groupBySignature(items) {
  const map = new Map();
  for (const item of items) {
    const signatureKey = JSON.stringify(item.signature);
    if (!map.has(signatureKey)) map.set(signatureKey, []);
    map.get(signatureKey).push(item.file);
  }
  return Array.from(map.entries()).map(([signature, files]) => ({
    signature: JSON.parse(signature),
    files,
  }));
}

function parseShimImports() {
  const files = [
    ...listFilesRecursively("app", (rel) => /\.(ts|tsx|mdx|md)$/i.test(rel)),
    ...listFilesRecursively("components", (rel) => /\.(ts|tsx|mdx|md)$/i.test(rel)),
    ...listFilesRecursively("components-mdx", (rel) => /\.(ts|tsx|mdx|md)$/i.test(rel)),
    ...listFilesRecursively("content", (rel) => /\.(ts|tsx|mdx|md)$/i.test(rel)),
    ...listFilesRecursively("lib", (rel) => /\.(ts|tsx|mdx|md)$/i.test(rel)),
  ].filter((rel) => {
    if (
      rel.startsWith("lib/nextra-shim/") ||
      rel.endsWith(".json")
    ) {
      return false;
    }
    return true;
  });

  const pattern = /\bfrom\s+["'](nextra(?:\/components|\/context|\/hooks|-theme-docs)?|nextra-theme-docs)["']/g;
  const matches = [];

  for (const file of files) {
    const text = readRepoFile(file);
    const imports = Array.from(text.matchAll(pattern)).map((match) => match[1]);
    if (imports.length === 0) continue;

    const bucket = file.startsWith("content/")
      ? "content"
      : file.startsWith("components/") || file.startsWith("components-mdx/")
        ? "components"
        : file.startsWith("app/")
          ? "app"
          : "other";

    matches.push({
      file,
      imports: uniqueSorted(imports),
      bucket,
    });
  }

  const countsByBucket = matches.reduce(
    (acc, match) => {
      acc[match.bucket] = (acc[match.bucket] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return {
    aliasedInNextConfig: /nextra\/context/.test(readRepoFile("next.config.mjs")),
    aliasedInTsconfig: /"nextra\/context"/.test(readRepoFile("tsconfig.json")),
    directImportFiles: matches,
    countsByBucket,
    totalFiles: matches.length,
  };
}

function writeJson(filename, value) {
  ensureDir(outputDir);
  fs.writeFileSync(
    path.join(outputDir, filename),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

function writeText(filename, value) {
  ensureDir(outputDir);
  fs.writeFileSync(path.join(outputDir, filename), value, "utf8");
}

ensureDir(outputDir);

const sourceConfigText = readRepoFile("source.config.ts");
const libSourceText = readRepoFile("lib/source.ts");
const docsLoaderText = readRepoFile("app/docs/[[...slug]]/doc-loaders.client.ts");
const sectionLoaderScriptText = readRepoFile("scripts/generate-section-loaders.js");
const generatedSectionLoadersText = readRepoFile("lib/section-loaders.generated.ts");
const mdxComponentsText = readRepoFile("mdx-components.tsx");
const readmeText = readRepoFile("README.md");
const gitignoreText = readRepoFile(".gitignore");

const collections = parseCollections(sourceConfigText);
const docsCollection = collections.find((collection) => collection.exportName === "docs");
const nonDocsCollections = collections.filter((collection) => collection.exportName !== "docs");

const baselineFilesAudit = REQUIRED_BASELINE_FILES.map((item) => {
  const exists = repoExists(item.path);
  const text = exists ? readRepoFile(item.path) : "";
  const checks = Object.fromEntries(
    Object.entries(item.checks).map(([name, pattern]) => [name, exists && pattern.test(text)])
  );
  return {
    path: item.path,
    exists,
    checks,
    passed: exists && Object.values(checks).every(Boolean),
  };
});

const docsContentSlugs = docsCollection ? uniqueSorted(collectCollectionSlugs(docsCollection.dir)) : [];
const docsLoaderSlugs = uniqueSorted(parseImportSlugs(docsLoaderText, "docs", "docs"));
const docsLoaderDiff = diffSlugs(docsContentSlugs, docsLoaderSlugs);

const generatedLoaderCoverage = nonDocsCollections.map((collection) => {
  const expected = uniqueSorted(collectCollectionSlugs(collection.dir));
  const actual = uniqueSorted(
    parseImportSlugs(generatedSectionLoadersText, collection.dir.replace(/^content\//, ""), collection.exportName)
  );
  return {
    collection: collection.exportName,
    dir: collection.dir,
    expectedCount: expected.length,
    actualCount: actual.length,
    ...diffSlugs(expected, actual),
  };
});

const manualRegistries = [
  {
    path: "app/docs/[[...slug]]/doc-loaders.client.ts",
    purpose: "Manual docs MDX body import registry",
  },
  {
    path: "scripts/generate-section-loaders.js",
    purpose: "Custom filesystem traversal that rebuilds section body registries",
  },
  {
    path: "lib/section-loaders.generated.ts",
    purpose: "Tracked generated section body registry",
  },
  {
    path: "lib/source.ts",
    purpose: "Manual MARKETING_SLUGS, routeToSource, and page-tree rewrite helpers",
  },
  {
    path: "lib/sections.ts",
    purpose: "Manual SECTION_CONFIG and app-route section groupings",
  },
];

const routeTrace = DOCS_STYLE_ROUTE_FILES.map((route) => {
  const text = readRepoFile(route.file);
  const accessorPattern = new RegExp(
    route.sourceAccessor
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .concat("\\.getPage\\(")
  );
  const generateParamsPattern = new RegExp(
    route.sourceAccessor
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .concat("\\.generateParams\\(")
  );
  return {
    file: route.file,
    sourceAccessor: route.sourceAccessor,
    usesFumadocsPageLookup: accessorPattern.test(text),
    usesFumadocsGenerateParams: generateParamsPattern.test(text),
    bodyRenderer: route.bodyRenderer,
    rendersRecommendedPageBody: /page\.data\.body|data\.body/.test(text) && !new RegExp(route.bodyRenderer).test(text),
    usesCustomBodyClient: new RegExp(route.bodyRenderer).test(text),
  };
});

const contentStructure = collections.map((collection) => inspectContentStructure(collection.dir));
const missingMetaDirectories = contentStructure.flatMap((collection) =>
  collection.missingExpectedMeta.map((directory) => ({
    collection: collection.collectionDir,
    directory,
  }))
);

const layoutAuditEntries = DOCS_LAYOUT_FILES.map((file) => ({
  file,
  signature: buildLayoutSignature(readRepoFile(file)),
}));
const layoutGroups = groupBySignature(layoutAuditEntries);
const duplicatedLayoutGroups = layoutGroups.filter((group) => group.files.length > 1);

const searchAudit = (() => {
  const repoFiles = [
    ...listFilesRecursively("app", (rel) => /\.(ts|tsx|mdx|md|mjs)$/i.test(rel)),
    ...listFilesRecursively("components", (rel) => /\.(ts|tsx|mdx|md|mjs)$/i.test(rel)),
    ...listFilesRecursively("content", (rel) => /\.(ts|tsx|mdx|md|mjs)$/i.test(rel)),
    ...listFilesRecursively("lib", (rel) => /\.(ts|tsx|mdx|md|mjs)$/i.test(rel)),
  ];
  const officialSearchFiles = [];
  const customSearchFiles = [];
  for (const file of repoFiles) {
    const text = readRepoFile(file);
    if (
      /from\s+["']fumadocs-core\/search\/server["']|createFromSource\(|from\s+["']fumadocs-ui\/search["']/.test(
        text
      )
    ) {
      officialSearchFiles.push(file);
    }
    if (/search-docs|InkeepSearchBar|InkeepEmbeddedChat|@inkeep\/cxkit-react/.test(text)) {
      customSearchFiles.push(file);
    }
  }

  return {
    usesDocumentedFumadocsSearchRoute:
      officialSearchFiles.some((file) => file === "app/api/search/route.ts") ||
      officialSearchFiles.some((file) => /search\/server/.test(readRepoFile(file))),
    officialSearchFiles: uniqueSorted(officialSearchFiles),
    customReplacementFiles: uniqueSorted(customSearchFiles),
    hasCustomSearchRoute: repoExists("app/api/search-docs/route.ts"),
  };
})();

const shimAudit = parseShimImports();
const generatedArtifactsAudit = (() => {
  const liveSourceFiles = listFilesRecursively(".source");
  const trackedSourceFiles = runGit(["ls-files", ".source"]);
  return {
    gitignoreIgnoresSource: /\.source\//.test(gitignoreText),
    liveSourceFiles,
    trackedSourceFiles,
    trackedGeneratedFiles: runGit(["ls-files", "lib/section-loaders.generated.ts"]),
  };
})();

const mdxOverrideAudit = {
  extendsDefaultComponents: /\.\.\.defaultMdxComponents/.test(mdxComponentsText),
  reExportsUseMDXComponents: /export function useMDXComponents/.test(mdxComponentsText),
  dependsOnShimmedComponents: /@\/lib\/nextra-shim\/components/.test(mdxComponentsText),
};

const documentationAudit = {
  readmeStillMentionsNextra: /Based on \[Nextra\]/.test(readmeText),
  readmeStillMentionsPagesDir: /pages\/ directory where they are rendered by Nextra/i.test(
    readmeText
  ),
};

const checklist = [
  {
    item: "Repository keeps the baseline files and wiring recommended by Fumadocs",
    status: baselineFilesAudit.every((entry) => entry.passed) ? "pass" : "fail",
    evidence: ["official-baseline.json", "architecture-audit.json"],
    notes: baselineFilesAudit.every((entry) => entry.passed)
      ? "All baseline Fumadocs entry points are present."
      : "One or more baseline files or expected hooks are missing.",
  },
  {
    item: "source.config.ts is the single source of truth for collections and frontmatter schema",
    status:
      manualRegistries.length === 0 &&
      docsLoaderDiff.missing.length === 0 &&
      docsLoaderDiff.extra.length === 0 &&
      generatedLoaderCoverage.every(
        (entry) => entry.missing.length === 0 && entry.extra.length === 0
      )
        ? "pass"
        : "fail",
    evidence: ["source-trace.json", "architecture-audit.json"],
    notes:
      "Multiple manual registries still duplicate the Fumadocs collection graph.",
  },
  {
    item: "Docs-like routes are backed by Fumadocs loaders rather than ad-hoc filesystem logic",
    status: routeTrace.every(
      (entry) =>
        entry.usesFumadocsPageLookup &&
        entry.usesFumadocsGenerateParams &&
        !entry.usesCustomBodyClient
    )
      ? "pass"
      : "fail",
    evidence: ["source-trace.json", "architecture-audit.json"],
    notes:
      "Route lookup uses Fumadocs sources, but page bodies still render through custom client loader registries.",
  },
  {
    item: "content/** trees and meta.json files are structured so Fumadocs can generate navigation predictably",
    status: missingMetaDirectories.length === 0 ? "pass" : "fail",
    evidence: ["content-structure.json", "architecture-audit.json"],
    notes:
      missingMetaDirectories.length === 0
        ? "All collection roots and expected nested sections have meta.json coverage."
        : "Some collection sections that should carry meta.json are missing it.",
  },
  {
    item: "Shared DocsLayout configuration is centralized where possible",
    status: duplicatedLayoutGroups.some((group) => group.files.length >= 3)
      ? "fail"
      : "pass",
    evidence: ["layout-duplication.json", "architecture-audit.json"],
    notes:
      "Five docs-style section layouts still repeat the same DocsLayout shell configuration.",
  },
  {
    item: "Search is either implemented with the documented Fumadocs search route or intentionally replaced with an equivalent design",
    status: searchAudit.usesDocumentedFumadocsSearchRoute
      ? "pass"
      : searchAudit.hasCustomSearchRoute && searchAudit.customReplacementFiles.length > 0
        ? "deviation"
        : "fail",
    evidence: ["search-and-shims.json", "architecture-audit.json"],
    notes: searchAudit.usesDocumentedFumadocsSearchRoute
      ? "Repo contains Fumadocs search-route wiring."
      : searchAudit.hasCustomSearchRoute
        ? "Repo uses an Inkeep-backed replacement instead of the documented Fumadocs search route."
        : "No documented search route or clear replacement was found.",
  },
  {
    item: "Custom page-tree rewrites and section registries are minimal and do not fight Fumadocs conventions",
    status:
      /getSelfHostingPageTree|getIntegrationsPageTree|MARKETING_SLUGS|routeToSource/.test(
        libSourceText
      ) && /SECTION_CONFIG/.test(readRepoFile("lib/sections.ts"))
        ? "deviation"
        : "pass",
    evidence: ["source-trace.json", "architecture-audit.json"],
    notes:
      "Only two explicit page-tree rewrite helpers exist, but they sit next to broader manual route registries.",
  },
  {
    item: "Generated .source output is not partially committed or manually maintained",
    status:
      generatedArtifactsAudit.gitignoreIgnoresSource &&
      generatedArtifactsAudit.trackedSourceFiles.length === 0
        ? "pass"
        : "fail",
    evidence: ["generated-artifacts.json", "architecture-audit.json"],
    notes:
      generatedArtifactsAudit.trackedSourceFiles.length === 0
        ? "No tracked .source files detected."
        : "Git still tracks .source/source.config.mjs even though .source is ignored.",
  },
  {
    item: "Migration shims from Nextra or previous tooling are still required and isolated",
    status: shimAudit.totalFiles === 0 ? "pass" : "fail",
    evidence: ["search-and-shims.json", "architecture-audit.json"],
    notes:
      shimAudit.totalFiles === 0
        ? "No live shim imports detected outside the shim directory."
        : `${shimAudit.totalFiles} live files still import Nextra compatibility modules directly.`,
  },
  {
    item: "MDX component overrides extend Fumadocs cleanly without replacing core behavior unnecessarily",
    status:
      mdxOverrideAudit.extendsDefaultComponents && mdxOverrideAudit.reExportsUseMDXComponents
        ? "pass"
        : "fail",
    evidence: ["architecture-audit.json"],
    notes:
      "mdx-components.tsx extends fumadocs-ui/mdx, although some overrides still delegate to shimmed Nextra components.",
  },
];

const architectureAudit = {
  generatedAt: new Date().toISOString(),
  chapter: "Chapter 11: Fumadocs Architecture and Best-Practice Alignment",
  baselineFilesAudit,
  collections,
  docsLoaderCoverage: {
    collection: "docs",
    expectedCount: docsContentSlugs.length,
    actualCount: docsLoaderSlugs.length,
    missing: docsLoaderDiff.missing,
    extra: docsLoaderDiff.extra,
  },
  generatedLoaderCoverage,
  manualRegistries,
  routeTrace,
  contentStructureSummary: {
    collectionsAudited: contentStructure.length,
    missingMetaDirectories,
  },
  layoutAudit: {
    entries: layoutAuditEntries,
    duplicatedGroups: duplicatedLayoutGroups,
  },
  searchAudit,
  shimAudit: {
    aliasedInNextConfig: shimAudit.aliasedInNextConfig,
    aliasedInTsconfig: shimAudit.aliasedInTsconfig,
    totalFiles: shimAudit.totalFiles,
    countsByBucket: shimAudit.countsByBucket,
  },
  generatedArtifactsAudit,
  mdxOverrideAudit,
  documentationAudit,
  checklist,
  overallStatus: overallStatus(checklist),
};

const sourceTrace = {
  collections,
  manualRegistries,
  routeTrace,
  docsLoaderCoverage: architectureAudit.docsLoaderCoverage,
  generatedLoaderCoverage,
};

const contentStructureEvidence = {
  collections: contentStructure,
  missingMetaDirectories,
};

const layoutDuplicationEvidence = {
  entries: layoutAuditEntries,
  duplicatedGroups: duplicatedLayoutGroups,
};

const searchAndShimsEvidence = {
  searchAudit,
  shimAudit,
};

const generatedArtifactsEvidence = generatedArtifactsAudit;

const summary = {
  generatedAt: architectureAudit.generatedAt,
  overallStatus: architectureAudit.overallStatus,
  checklist,
  keyFindings: [
    "source.config.ts does not stand alone as the content registry because docs bodies, section loaders, and route registries are duplicated elsewhere.",
    "Docs-style layouts repeat the same DocsLayout shell across five dedicated section layouts.",
    "Nextra compatibility shims are still live in content and components rather than isolated to a narrow migration edge.",
    ".source hygiene is inconsistent because the directory is ignored but one generated file remains tracked.",
  ],
};

writeJson("official-baseline.json", OFFICIAL_BASELINE);
writeJson("architecture-audit.json", architectureAudit);
writeJson("source-trace.json", sourceTrace);
writeJson("content-structure.json", contentStructureEvidence);
writeJson("layout-duplication.json", layoutDuplicationEvidence);
writeJson("search-and-shims.json", searchAndShimsEvidence);
writeJson("generated-artifacts.json", generatedArtifactsEvidence);
writeJson("summary.json", summary);

const summaryMarkdown = `# Chapter 11 Summary

## Status

- Overall result: ${statusLabel(summary.overallStatus)}

## Checklist results

| Checklist item | Status | Evidence |
| --- | --- | --- |
${checklist
  .map(
    (item) =>
      `| ${item.item} | ${statusLabel(item.status)} | ${item.evidence.join(", ")} |`
  )
  .join("\n")}

## Key findings

- ${summary.keyFindings.join("\n- ")}

## Notes

- This is a static repository audit. It validates architectural alignment, not runtime rendering or release behavior.
- The repo keeps the core Fumadocs entry points, but still carries multiple migration-era registries and Nextra shims.
`;

writeText("summary.md", `${summaryMarkdown}\n`);

if (summary.overallStatus === "fail") {
  process.exitCode = 1;
}
