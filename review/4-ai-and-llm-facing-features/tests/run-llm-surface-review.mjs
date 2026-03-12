import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const PROD_BASE_URL = normalizeBaseUrl(
  process.env.PROD_BASE_URL || "https://langfuse.com"
);
const PREVIEW_BASE_URL = normalizeBaseUrl(
  process.env.PREVIEW_BASE_URL ||
    "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app"
);
const OUTPUT_DIR = path.resolve(
  process.cwd(),
  process.env.OUTPUT_DIR || "review/4-ai-and-llm-facing-features/evidence"
);

const EXPECTED_MCP_TOOLS = [
  "searchLangfuseDocs",
  "getLangfuseDocsPage",
  "getLangfuseOverview",
];

const REPRESENTATIVE_MARKDOWN_PATHS = [
  "/docs/observability/overview",
  "/docs/docs-mcp",
  "/integrations/frameworks/langchain",
  "/self-hosting/deployment/docker-compose",
  "/faq/all/langfuse-support",
];

const LLM_SUBFILES = [
  "llms-docs.txt",
  "llms-integrations.txt",
  "llms-self-hosting.txt",
];

const ALLOWED_PDF_SOURCE_URL = `${PROD_BASE_URL}/docs/observability/overview.md`;
const BLOCKED_PDF_SOURCE_URL = "https://example.com/foo.md";

const localLlmsTxt = await readOptionalText(
  path.resolve(process.cwd(), "public/llms.txt")
);

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const [preview, prod] = await Promise.all([
    inspectEnvironment("preview", PREVIEW_BASE_URL),
    inspectEnvironment("production", PROD_BASE_URL),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    environments: {
      preview,
      production: prod,
    },
  };

  const findings = buildFindings(report);
  const summary = buildSummary(report, findings);

  await Promise.all([
    writeJson("llms.json", {
      preview: preview.llms,
      production: prod.llms,
    }),
    writeJson("markdown-endpoints.json", {
      preview: preview.markdown,
      production: prod.markdown,
    }),
    writeJson("ask-ai-http.json", {
      preview: preview.askAiHttp,
      production: prod.askAiHttp,
    }),
    writeJson("mcp.json", {
      preview: preview.mcp,
      production: prod.mcp,
    }),
    writeJson("search-docs.json", {
      preview: preview.searchDocs,
      production: prod.searchDocs,
    }),
    writeJson("md-to-pdf.json", {
      preview: preview.mdToPdf,
      production: prod.mdToPdf,
    }),
    writeJson("summary.json", summary),
    fs.writeFile(
      path.join(OUTPUT_DIR, "summary.md"),
      buildSummaryMarkdown(summary),
      "utf8"
    ),
  ]);

  const failedChecks =
    countFailedChecks(preview) + countFailedChecks(prod) + findings.length;
  if (failedChecks > 0) {
    process.exitCode = 1;
  }
}

async function inspectEnvironment(name, baseUrl) {
  const llms = await inspectLlms(baseUrl);
  const markdown = await inspectMarkdown(baseUrl);
  const askAiHttp = await inspectAskAiHttp(baseUrl);
  const mcp = await inspectMcp(baseUrl, markdown.samplePath, llms.body);
  const searchDocs = await inspectSearchDocs(baseUrl);
  const mdToPdf = await inspectMdToPdf(baseUrl);

  return {
    name,
    baseUrl,
    llms,
    markdown,
    askAiHttp,
    mcp,
    searchDocs,
    mdToPdf,
  };
}

async function inspectLlms(baseUrl) {
  const llms = await fetchText(`${baseUrl}/llms.txt`);
  const body = llms.body;
  const requiredMentions = [
    "Langfuse Docs MCP Server",
    "https://langfuse.com/api/mcp",
    "https://langfuse.com/docs/docs-mcp",
    "https://langfuse.com/llms-docs.txt",
    "https://langfuse.com/llms-integrations.txt",
    "https://langfuse.com/llms-self-hosting.txt",
  ];
  const missingMentions = requiredMentions.filter(
    (mention) => !body.includes(mention)
  );

  const subfiles = {};
  for (const filename of LLM_SUBFILES) {
    const response = await fetchText(`${baseUrl}/${filename}`);
    subfiles[filename] = {
      status: response.status,
      ok: response.ok,
      firstLine: firstNonEmptyLine(response.body),
      hasMarkdownLinks: /\[[^\]]+\]\([^)]+\)/.test(response.body),
      sha256: sha256(normalizeText(response.body)),
    };
  }

  return {
    status: llms.status,
    ok: llms.ok,
    contentType: headerValue(llms.headers, "content-type"),
    bodyLength: body.length,
    sha256: sha256(normalizeText(body)),
    matchesRepoPublicLlmsTxt:
      localLlmsTxt == null
        ? null
        : normalizeText(body) === normalizeText(localLlmsTxt),
    missingMentions,
    subfiles,
    body,
    pass:
      llms.ok &&
      missingMentions.length === 0 &&
      Object.values(subfiles).every((entry) => entry.ok && entry.hasMarkdownLinks),
  };
}

async function inspectMarkdown(baseUrl) {
  const results = [];

  for (const docPath of REPRESENTATIVE_MARKDOWN_PATHS) {
    const direct = await fetchText(`${baseUrl}${docPath}.md`);
    const negotiated = await fetchText(`${baseUrl}${docPath}`, {
      headers: { Accept: "text/markdown" },
    });
    const html = await fetchText(`${baseUrl}${docPath}`);

    const directBody = normalizeText(direct.body);
    const negotiatedBody = normalizeText(negotiated.body);
    const bodyMatches = directBody === negotiatedBody;

    results.push({
      path: docPath,
      direct: summarizeTextResponse(direct),
      negotiated: summarizeTextResponse(negotiated),
      html: summarizeTextResponse(html),
      directContentTypeOk: includesHeader(direct.headers, "content-type", "text/markdown"),
      negotiatedContentTypeOk: includesHeader(
        negotiated.headers,
        "content-type",
        "text/markdown"
      ),
      directNoindexOk: includesHeader(direct.headers, "x-robots-tag", "noindex"),
      negotiatedNoindexOk: includesHeader(
        negotiated.headers,
        "x-robots-tag",
        "noindex"
      ),
      htmlLooksHtml: includesHeader(html.headers, "content-type", "text/html"),
      bodyMatches,
      firstDifference: bodyMatches
        ? null
        : firstDifference(directBody, negotiatedBody),
    });
  }

  return {
    samplePath: REPRESENTATIVE_MARKDOWN_PATHS[0],
    results,
    pass: results.every(
      (entry) =>
        entry.direct.status === 200 &&
        entry.negotiated.status === 200 &&
        entry.directContentTypeOk &&
        entry.negotiatedContentTypeOk &&
        entry.directNoindexOk &&
        entry.bodyMatches
    ),
  };
}

async function inspectAskAiHttp(baseUrl) {
  const legacy = await fetchText(`${baseUrl}/ask-ai`, { redirect: "manual" });
  const docsPage = await fetchText(`${baseUrl}/docs/ask-ai`);

  return {
    legacyRoute: {
      status: legacy.status,
      location: headerValue(legacy.headers, "location"),
    },
    docsPage: {
      status: docsPage.status,
      contentType: headerValue(docsPage.headers, "content-type"),
      containsHeading: docsPage.body.includes("<h1") || docsPage.body.includes("Ask AI"),
    },
    pass:
      [307, 308].includes(legacy.status) &&
      headerValue(legacy.headers, "location") === "/docs/ask-ai" &&
      docsPage.status === 200,
  };
}

async function inspectMcp(baseUrl, samplePath, llmsBody) {
  const initialize = await postMcp(baseUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "chapter4-review", version: "0.0.1" },
    },
  });

  const toolsList = await postMcp(baseUrl, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });

  const overviewCall = await postMcp(baseUrl, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "getLangfuseOverview",
      arguments: {},
    },
  });

  const docsPageCall = await postMcp(baseUrl, {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "getLangfuseDocsPage",
      arguments: {
        pathOrUrl: samplePath,
      },
    },
  });

  const searchCall = await postMcp(baseUrl, {
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "searchLangfuseDocs",
      arguments: {
        query: "Langfuse Docs MCP Server",
      },
    },
  });

  const listedTools =
    toolsList.payload?.result?.tools?.map((tool) => tool.name).sort() || [];
  const missingTools = EXPECTED_MCP_TOOLS.filter(
    (toolName) => !listedTools.includes(toolName)
  );

  const overviewText =
    toolsCallText(overviewCall.payload) || "";
  const docsPageText = toolsCallText(docsPageCall.payload) || "";
  const previewMdResponse = await fetchText(`${baseUrl}${samplePath}.md`);
  const previewMdText = normalizeText(previewMdResponse.body);
  const normalizedDocsPageText = normalizeText(docsPageText);
  const docsPageMatchesMarkdown = normalizedDocsPageText === previewMdText;

  return {
    initialize: summarizeSseResponse(initialize),
    toolsList: {
      ...summarizeSseResponse(toolsList),
      toolNames: listedTools,
      missingTools,
    },
    overviewCall: {
      ...summarizeSseResponse(overviewCall),
      contentSha256: sha256(normalizeText(overviewText)),
      matchesLlmsTxt: normalizeText(overviewText) === normalizeText(llmsBody),
    },
    docsPageCall: {
      ...summarizeSseResponse(docsPageCall),
      metaUrl: docsPageCall.payload?.result?._meta?.url || null,
      samplePath,
      contentSha256: sha256(normalizeText(docsPageText)),
      endpointSha256: sha256(previewMdText),
      matchesMarkdownEndpoint: docsPageMatchesMarkdown,
      firstDifference: docsPageMatchesMarkdown
        ? null
        : firstDifference(normalizedDocsPageText, previewMdText),
    },
    searchCall: {
      ...summarizeSseResponse(searchCall),
      isError: Boolean(searchCall.payload?.result?.isError),
      textLength: toolsCallText(searchCall.payload)?.length || 0,
    },
    pass:
      initialize.status === 200 &&
      toolsList.status === 200 &&
      missingTools.length === 0 &&
      normalizeText(overviewText) === normalizeText(llmsBody) &&
      docsPageMatchesMarkdown &&
      !Boolean(searchCall.payload?.result?.isError),
  };
}

async function inspectSearchDocs(baseUrl) {
  const valid = await fetchJson(
    `${baseUrl}/api/search-docs?query=${encodeURIComponent(
      "Langfuse Docs MCP Server"
    )}`
  );
  const invalid = await fetchJson(`${baseUrl}/api/search-docs`);
  const options = await fetchResponse(`${baseUrl}/api/search-docs`, {
    method: "OPTIONS",
  });

  return {
    valid: {
      status: valid.status,
      ok: valid.ok,
      contentType: headerValue(valid.headers, "content-type"),
      corsOrigin: headerValue(valid.headers, "access-control-allow-origin"),
      corsMethods: headerValue(valid.headers, "access-control-allow-methods"),
      corsHeaders: headerValue(valid.headers, "access-control-allow-headers"),
      keys: valid.json ? Object.keys(valid.json).sort() : [],
      answerType: typeof valid.json?.answer,
      metadataType: typeof valid.json?.metadata,
    },
    invalid: {
      status: invalid.status,
      contentType: headerValue(invalid.headers, "content-type"),
      error: invalid.json?.error || null,
    },
    options: {
      status: options.status,
      corsOrigin: headerValue(options.headers, "access-control-allow-origin"),
      corsMethods: headerValue(options.headers, "access-control-allow-methods"),
      corsHeaders: headerValue(options.headers, "access-control-allow-headers"),
      allow: headerValue(options.headers, "allow"),
    },
    pass:
      valid.status === 200 &&
      valid.json &&
      typeof valid.json.query === "string" &&
      Object.prototype.hasOwnProperty.call(valid.json, "answer") &&
      Object.prototype.hasOwnProperty.call(valid.json, "metadata") &&
      headerValue(valid.headers, "access-control-allow-origin") === "*" &&
      [200, 204].includes(options.status) &&
      headerValue(options.headers, "access-control-allow-origin") === "*" &&
      invalid.status === 400,
  };
}

async function inspectMdToPdf(baseUrl) {
  const allowed = await fetchBinary(
    `${baseUrl}/api/md-to-pdf?url=${encodeURIComponent(ALLOWED_PDF_SOURCE_URL)}`
  );
  const blocked = await fetchJson(
    `${baseUrl}/api/md-to-pdf?url=${encodeURIComponent(BLOCKED_PDF_SOURCE_URL)}`
  );

  return {
    allowed: {
      status: allowed.status,
      ok: allowed.ok,
      contentType: headerValue(allowed.headers, "content-type"),
      contentDisposition: headerValue(allowed.headers, "content-disposition"),
      byteLength: allowed.byteLength,
      isPdf: startsWithPdfHeader(allowed.buffer),
      bodyPreview:
        allowed.ok || !allowed.text
          ? null
          : allowed.text.slice(0, 200),
    },
    blocked: {
      status: blocked.status,
      ok: blocked.ok,
      contentType: headerValue(blocked.headers, "content-type"),
      error: blocked.json?.error || null,
      allowed: blocked.json?.allowed || null,
    },
    pass:
      allowed.status === 200 &&
      startsWithPdfHeader(allowed.buffer) &&
      blocked.status === 400,
  };
}

function buildFindings(report) {
  const findings = [];
  const preview = report.environments.preview;
  const prod = report.environments.production;

  if (!preview.mdToPdf.allowed.isPdf && prod.mdToPdf.allowed.isPdf) {
    findings.push({
      id: "preview-md-to-pdf-500",
      severity: "high",
      title: "Preview md-to-pdf export fails for an allowlisted Langfuse markdown URL",
      evidenceFile: "md-to-pdf.json",
      details:
        `Preview returned ${preview.mdToPdf.allowed.status} while production returned ${prod.mdToPdf.allowed.status} for the same allowlisted markdown input.`,
    });
  }

  if (
    !preview.mcp.docsPageCall.matchesMarkdownEndpoint &&
    prod.mcp.docsPageCall.matchesMarkdownEndpoint
  ) {
    findings.push({
      id: "preview-mcp-hardcodes-production-markdown-host",
      severity: "medium",
      title: "Preview MCP markdown retrieval does not match the preview markdown endpoint",
      evidenceFile: "mcp.json",
      details:
        `Preview MCP returned _meta.url=${preview.mcp.docsPageCall.metaUrl} and the tool output differs from ${preview.baseUrl}${preview.mcp.docsPageCall.samplePath}.md.`,
    });
  }

  return findings;
}

function buildSummary(report, findings) {
  const preview = report.environments.preview;
  const prod = report.environments.production;

  return {
    generatedAt: report.generatedAt,
    previewBaseUrl: preview.baseUrl,
    productionBaseUrl: prod.baseUrl,
    findings,
    checks: [
      summarizeCheck("llms.txt", preview.llms.pass, prod.llms.pass),
      summarizeCheck("markdown-endpoints", preview.markdown.pass, prod.markdown.pass),
      summarizeCheck("ask-ai-http", preview.askAiHttp.pass, prod.askAiHttp.pass),
      summarizeCheck("mcp", preview.mcp.pass, prod.mcp.pass),
      summarizeCheck("search-docs", preview.searchDocs.pass, prod.searchDocs.pass),
      summarizeCheck("md-to-pdf", preview.mdToPdf.pass, prod.mdToPdf.pass),
    ],
  };
}

function buildSummaryMarkdown(summary) {
  const lines = [
    "# Chapter 4 Summary",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    `Preview base: \`${summary.previewBaseUrl}\``,
    `Production base: \`${summary.productionBaseUrl}\``,
    "",
    "## Findings",
    "",
  ];

  if (summary.findings.length === 0) {
    lines.push("- No chapter 4 findings recorded in this run.");
  } else {
    for (const finding of summary.findings) {
      lines.push(
        `- ${finding.severity.toUpperCase()}: ${finding.title} (${finding.evidenceFile})`
      );
      lines.push(`  ${finding.details}`);
    }
  }

  lines.push("", "## Check Summary", "", "| Check | Preview | Production |", "| --- | --- | --- |");
  for (const check of summary.checks) {
    lines.push(
      `| ${check.name} | ${emojiStatus(check.previewPass)} | ${emojiStatus(
        check.productionPass
      )} |`
    );
  }

  lines.push("");
  return lines.join("\n");
}

function summarizeCheck(name, previewPass, productionPass) {
  return { name, previewPass, productionPass };
}

function summarizeSseResponse(response) {
  return {
    status: response.status,
    ok: response.ok,
    contentType: headerValue(response.headers, "content-type"),
  };
}

function summarizeTextResponse(response) {
  return {
    status: response.status,
    ok: response.ok,
    contentType: headerValue(response.headers, "content-type"),
    xRobotsTag: headerValue(response.headers, "x-robots-tag"),
    bodyLength: response.body.length,
    sha256: sha256(normalizeText(response.body)),
  };
}

async function postMcp(baseUrl, body) {
  const response = await fetchResponse(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });

  return {
    ...response,
    payload: parseSsePayload(response.text),
  };
}

function parseSsePayload(text) {
  const dataLines = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6));

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return JSON.parse(dataLines.join("\n"));
  } catch {
    return { parseError: true, raw: text };
  }
}

function toolsCallText(payload) {
  return (
    payload?.result?.content?.find((entry) => entry.type === "text")?.text || null
  );
}

async function fetchText(url, init) {
  const response = await fetchResponse(url, init);
  return response;
}

async function fetchJson(url, init) {
  const response = await fetchResponse(url, init);
  let json = null;
  try {
    json = response.text ? JSON.parse(response.text) : null;
  } catch {}

  return {
    ...response,
    json,
  };
}

async function fetchBinary(url, init) {
  const response = await fetch(url, init);
  const headers = headersToObject(response.headers);
  const buffer = Buffer.from(await response.arrayBuffer());
  let text = null;

  if (!startsWithPdfHeader(buffer)) {
    try {
      text = buffer.toString("utf8");
    } catch {}
  }

  return {
    status: response.status,
    ok: response.ok,
    headers,
    buffer,
    byteLength: buffer.byteLength,
    text,
  };
}

async function fetchResponse(url, init) {
  const response = await fetch(url, init);
  const body = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    headers: headersToObject(response.headers),
    body,
    text: body,
  };
}

function headersToObject(headers) {
  return Object.fromEntries(
    Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value])
  );
}

function headerValue(headers, key) {
  return headers[key.toLowerCase()] || null;
}

function includesHeader(headers, key, value) {
  const header = headerValue(headers, key);
  return header != null && header.toLowerCase().includes(value.toLowerCase());
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function normalizeText(text) {
  return text.replace(/\r\n/g, "\n");
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function firstDifference(a, b) {
  const left = a.split("\n");
  const right = b.split("\n");
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      return {
        line: index + 1,
        left: left[index] ?? null,
        right: right[index] ?? null,
      };
    }
  }

  return null;
}

function firstNonEmptyLine(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || null;
}

function startsWithPdfHeader(buffer) {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, 4).toString("utf8") === "%PDF";
}

function emojiStatus(pass) {
  return pass ? "PASS" : "FAIL";
}

function countFailedChecks(environment) {
  const checks = [
    environment.llms.pass,
    environment.markdown.pass,
    environment.askAiHttp.pass,
    environment.mcp.pass,
    environment.searchDocs.pass,
    environment.mdToPdf.pass,
  ];

  return checks.filter((check) => !check).length;
}

async function readOptionalText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function writeJson(filename, data) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, filename),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8"
  );
}

await main();
