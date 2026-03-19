#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const DEFAULT_BASE_URL =
  "https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app";
const DEFAULT_PRODUCTION_URL = "https://langfuse.com";
const SAMPLE_DOC_PATH = "/docs/observability/data-model";
const SEARCH_QUERY = "How do I install the Docs MCP server?";
const ALLOWED_PDF_URL = "https://langfuse.com/security/dpa.md";
const BLOCKED_PDF_URL = "https://example.com/test.md";

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

function headerMap(headers) {
  return Object.fromEntries(headers.entries());
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function makeExcerpt(value, maxLength = 240) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}

function firstDifferentLine(left, right) {
  const leftLines = left.split(/\r?\n/);
  const rightLines = right.split(/\r?\n/);
  const max = Math.max(leftLines.length, rightLines.length);
  for (let index = 0; index < max; index += 1) {
    if (leftLines[index] !== rightLines[index]) {
      return {
        line: index + 1,
        left: leftLines[index] ?? null,
        right: rightLines[index] ?? null,
      };
    }
  }
  return null;
}

async function fetchText(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    url,
    status: response.status,
    ok: response.ok,
    headers: headerMap(response.headers),
    text,
  };
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return {
    url,
    status: response.status,
    ok: response.ok,
    headers: headerMap(response.headers),
    text,
    json,
  };
}

async function fetchBinary(url, init) {
  const response = await fetch(url, init);
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    url,
    status: response.status,
    ok: response.ok,
    headers: headerMap(response.headers),
    byteLength: buffer.byteLength,
    text: response.ok ? null : buffer.toString("utf8"),
  };
}

function assert(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function runCheck(name, fn) {
  const startedAt = new Date().toISOString();
  try {
    const details = await fn();
    return {
      name,
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      details,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      details:
        error && typeof error === "object" && "details" in error
          ? error.details
          : {},
    };
  }
}

async function connectMcpClient(baseUrl) {
  const client = new Client({ name: "chapter-4-review", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${baseUrl}/api/mcp`)
  );
  await client.connect(transport);
  return { client, transport };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args["base-url"] ?? DEFAULT_BASE_URL);
  const productionUrl = normalizeBaseUrl(
    args["production-url"] ?? DEFAULT_PRODUCTION_URL
  );
  const outputPath = resolve(
    args.output ??
      "review/4-ai-and-llm-facing-features/artifacts/preview-endpoint-report.json"
  );

  const previewLlms = await fetchText(`${baseUrl}/llms.txt`);
  const previewMarkdown = await fetchText(`${baseUrl}${SAMPLE_DOC_PATH}.md`);

  const checks = [];

  checks.push(
    await runCheck("llms.txt is reachable and references the expected AI assets", async () => {
      assert(previewLlms.status === 200, "Expected /llms.txt to return 200", {
        status: previewLlms.status,
      });

      const requiredSnippets = [
        "## Langfuse Docs MCP Server",
        "https://langfuse.com/api/mcp",
        "https://langfuse.com/docs/docs-mcp",
        "https://langfuse.com/llms-docs.txt",
        "https://langfuse.com/llms-integrations.txt",
        "https://langfuse.com/llms-self-hosting.txt",
      ];

      for (const snippet of requiredSnippets) {
        assert(
          previewLlms.text.includes(snippet),
          `Missing expected llms.txt content: ${snippet}`
        );
      }

      return {
        status: previewLlms.status,
        contentType: previewLlms.headers["content-type"] ?? null,
        xRobotsTag: previewLlms.headers["x-robots-tag"] ?? null,
        sha256: sha256(previewLlms.text),
      };
    })
  );

  checks.push(
    await runCheck("llms section files are reachable and expose markdown links", async () => {
      const files = [
        "/llms-docs.txt",
        "/llms-integrations.txt",
        "/llms-self-hosting.txt",
      ];

      const results = [];
      for (const file of files) {
        const response = await fetchText(`${baseUrl}${file}`);
        assert(response.status === 200, `Expected ${file} to return 200`, {
          file,
          status: response.status,
        });
        assert(
          /https:\/\/langfuse\.com\/.+\.md\)/.test(response.text),
          `${file} did not contain markdown page links`,
          { file }
        );
        results.push({
          file,
          status: response.status,
          contentType: response.headers["content-type"] ?? null,
          sha256: sha256(response.text),
        });
      }

      return { files: results };
    })
  );

  checks.push(
    await runCheck("Direct .md endpoints return markdown with noindex", async () => {
      assert(
        previewMarkdown.status === 200,
        `Expected ${SAMPLE_DOC_PATH}.md to return 200`,
        { status: previewMarkdown.status }
      );
      assert(
        (previewMarkdown.headers["content-type"] ?? "").includes("text/markdown"),
        "Expected markdown content type on .md endpoint",
        { headers: previewMarkdown.headers }
      );
      assert(
        (previewMarkdown.headers["x-robots-tag"] ?? "").includes("noindex"),
        "Expected X-Robots-Tag: noindex on .md endpoint",
        { headers: previewMarkdown.headers }
      );
      assert(
        previewMarkdown.text.includes("# Core Concepts"),
        "Expected representative markdown content in .md endpoint response"
      );

      return {
        status: previewMarkdown.status,
        contentType: previewMarkdown.headers["content-type"] ?? null,
        xRobotsTag: previewMarkdown.headers["x-robots-tag"] ?? null,
        firstLine: previewMarkdown.text.split(/\r?\n/)[0] ?? null,
        sha256: sha256(previewMarkdown.text),
      };
    })
  );

  checks.push(
    await runCheck(
      "Accept: text/markdown content negotiation matches the .md endpoint",
      async () => {
        const negotiated = await fetchText(`${baseUrl}${SAMPLE_DOC_PATH}`, {
          headers: { Accept: "text/markdown" },
        });
        const html = await fetchText(`${baseUrl}${SAMPLE_DOC_PATH}`);

        assert(
          negotiated.status === 200,
          "Expected negotiated markdown request to return 200",
          { status: negotiated.status }
        );
        assert(
          (negotiated.headers["content-type"] ?? "").includes("text/markdown"),
          "Expected negotiated markdown request to return markdown content type",
          { headers: negotiated.headers }
        );
        assert(
          negotiated.text === previewMarkdown.text,
          "Negotiated markdown response did not match the direct .md endpoint",
          {
            negotiatedHash: sha256(negotiated.text),
            directHash: sha256(previewMarkdown.text),
            firstDiff: firstDifferentLine(negotiated.text, previewMarkdown.text),
          }
        );
        assert(
          !(html.headers["content-type"] ?? "").includes("text/markdown"),
          "Expected normal docs request without Accept override to stay on HTML",
          { headers: html.headers }
        );

        return {
          negotiatedContentType: negotiated.headers["content-type"] ?? null,
          negotiatedHash: sha256(negotiated.text),
          htmlContentType: html.headers["content-type"] ?? null,
        };
      }
    )
  );

  checks.push(
    await runCheck(
      "/api/mcp exposes the expected tools and the overview tool resolves",
      async () => {
        const { client, transport } = await connectMcpClient(baseUrl);
        try {
          const toolsResult = await client.listTools();
          const toolNames = toolsResult.tools.map((tool) => tool.name).sort();
          const expected = [
            "getLangfuseDocsPage",
            "getLangfuseOverview",
            "searchLangfuseDocs",
          ].sort();
          assert(
            JSON.stringify(toolNames) === JSON.stringify(expected),
            "Unexpected MCP tool set",
            { toolNames, expected }
          );

          const overview = await client.callTool({
            name: "getLangfuseOverview",
            arguments: {},
          });
          const overviewText = overview.content?.[0]?.text ?? "";

          assert(overviewText.length > 0, "Overview tool returned empty content");

          return {
            toolNames,
            overviewExcerpt: makeExcerpt(overviewText),
            overviewHash: sha256(overviewText),
          };
        } finally {
          await transport.close();
        }
      }
    )
  );

  checks.push(
    await runCheck(
      "MCP markdown retrieval matches the preview deployment markdown output",
      async () => {
        const { client, transport } = await connectMcpClient(baseUrl);
        try {
          const response = await client.callTool({
            name: "getLangfuseDocsPage",
            arguments: { pathOrUrl: SAMPLE_DOC_PATH },
          });
          const markdown = response.content?.[0]?.text ?? "";
          const metaUrl = response._meta?.url ?? null;

          assert(markdown.length > 0, "MCP page tool returned empty markdown");
          assert(
            markdown === previewMarkdown.text,
            "MCP page tool output did not match the preview .md endpoint",
            {
              mcpMetaUrl: metaUrl,
              previewHash: sha256(previewMarkdown.text),
              mcpHash: sha256(markdown),
              firstDiff: firstDifferentLine(previewMarkdown.text, markdown),
              previewExcerpt: makeExcerpt(previewMarkdown.text, 140),
              mcpExcerpt: makeExcerpt(markdown, 140),
            }
          );

          return {
            mcpMetaUrl: metaUrl,
            mcpHash: sha256(markdown),
            previewHash: sha256(previewMarkdown.text),
          };
        } finally {
          await transport.close();
        }
      }
    )
  );

  checks.push(
    await runCheck(
      "/api/search-docs preserves response shape and CORS behavior",
      async () => {
        const optionsResponse = await fetchJson(`${baseUrl}/api/search-docs`, {
          method: "OPTIONS",
        });
        assert(
          optionsResponse.status === 204,
          "Expected OPTIONS /api/search-docs to return 204",
          { status: optionsResponse.status }
        );
        assert(
          optionsResponse.headers["access-control-allow-origin"] === "*",
          "Expected wildcard CORS on OPTIONS /api/search-docs",
          { headers: optionsResponse.headers }
        );

        const searchResponse = await fetchJson(
          `${baseUrl}/api/search-docs?query=${encodeURIComponent(SEARCH_QUERY)}`
        );
        assert(searchResponse.status === 200, "Expected search-docs to return 200", {
          status: searchResponse.status,
          body: searchResponse.text,
        });
        assert(searchResponse.json && typeof searchResponse.json === "object", "Expected JSON response body", {
          body: searchResponse.text,
        });
        for (const key of ["query", "answer", "metadata"]) {
          assert(
            Object.prototype.hasOwnProperty.call(searchResponse.json, key),
            `Expected search-docs response to include ${key}`,
            { body: searchResponse.json }
          );
        }
        assert(
          searchResponse.headers["access-control-allow-origin"] === "*",
          "Expected wildcard CORS on GET /api/search-docs",
          { headers: searchResponse.headers }
        );

        return {
          optionsStatus: optionsResponse.status,
          getStatus: searchResponse.status,
          query: searchResponse.json.query,
          answerType: typeof searchResponse.json.answer,
          metadataType: typeof searchResponse.json.metadata,
          answerExcerpt: makeExcerpt(String(searchResponse.json.answer), 180),
        };
      }
    )
  );

  checks.push(
    await runCheck(
      "/api/md-to-pdf succeeds for allowed Langfuse markdown inputs",
      async () => {
        const response = await fetchBinary(
          `${baseUrl}/api/md-to-pdf?url=${encodeURIComponent(ALLOWED_PDF_URL)}`
        );
        assert(response.status === 200, "Expected md-to-pdf to return 200", {
          status: response.status,
          body: response.text,
        });
        assert(
          (response.headers["content-type"] ?? "").includes("application/pdf"),
          "Expected md-to-pdf to return application/pdf",
          { headers: response.headers }
        );
        assert(
          (response.headers["cache-control"] ?? "").includes("s-maxage=60"),
          "Expected md-to-pdf to preserve cache headers",
          { headers: response.headers }
        );

        return {
          status: response.status,
          contentType: response.headers["content-type"] ?? null,
          cacheControl: response.headers["cache-control"] ?? null,
          byteLength: response.byteLength,
        };
      }
    )
  );

  checks.push(
    await runCheck(
      "/api/md-to-pdf blocks untrusted hosts instead of rendering them",
      async () => {
        const response = await fetchJson(
          `${baseUrl}/api/md-to-pdf?url=${encodeURIComponent(BLOCKED_PDF_URL)}`
        );
        assert(
          response.status === 400,
          "Expected md-to-pdf to reject untrusted hosts with 400",
          { status: response.status, body: response.text }
        );
        assert(
          typeof response.json?.error === "string" &&
            response.json.error.includes("not permitted"),
          "Expected md-to-pdf rejection to explain the hostname restriction",
          { body: response.json ?? response.text }
        );

        return {
          status: response.status,
          error: response.json?.error ?? null,
        };
      }
    )
  );

  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.length - passed;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    productionUrl,
    sampleDocPath: SAMPLE_DOC_PATH,
    summary: {
      total: checks.length,
      passed,
      failed,
    },
    checks,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Wrote report to ${outputPath}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

await main();
