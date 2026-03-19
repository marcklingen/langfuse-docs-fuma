# Chapter 1 Route Audit

- Run at: 2026-03-19T22:50:21.768Z
- Production sitemap URLs replayed: 788
- Configured redirect sources checked: 488
- Preview pages crawled for internal links: 649
- Unique internal links checked: 773

## Failure Summary

- Production vs preview path regressions: 0
- Redirect expectation failures: 118
- Trailing-slash duplicate live URLs: 0
- Mixed-case URL issues: 0
- Internal links hitting redirects or broken pages: 119

## Preview Regressions

- None

## Redirect Failures

- /docs/sso expected /self-hosting/authentication-and-sso, got /self-hosting/security/authentication-and-sso (redirect-chain, unexpected-final-target)
- /docs/analytics expected /docs/analytics/overview, got /docs/metrics/overview (redirect-chain, unexpected-final-target)
- /public-metrics-dashboard expected /why, got /handbook/chapters/why (redirect-chain, unexpected-final-target)
- /docs/integrations expected /docs/integrations/overview, got /integrations (redirect-chain, unexpected-final-target)
- /docs/scores expected /docs/scores/overview, got /docs/evaluation/overview (redirect-chain, unexpected-final-target)
- /docs/datasets expected /docs/datasets/overview, got /docs/evaluation/experiments/datasets (redirect-chain, unexpected-final-target)
- /docs/security expected /docs/security/overview, got /docs/security-and-guardrails (redirect-chain, unexpected-final-target)
- /docs/admin-api expected /docs/api, got /docs/api-and-data-platform/features/public-api (redirect-chain, unexpected-final-target)
- /docs/integrations/api expected /docs/api, got /docs/api-and-data-platform/features/public-api (redirect-chain, unexpected-final-target)
- /docs/integrations/sdk/typescript expected /docs/sdk/typescript, got /docs/observability/sdk/overview (redirect-chain, unexpected-final-target)
- /docs/langchain expected /docs/integrations/langchain/tracing, got /integrations/frameworks/langchain (redirect-chain, unexpected-final-target)
- /docs/langchain/python expected /docs/integrations/langchain/tracing, got /integrations/frameworks/langchain (redirect-chain, unexpected-final-target)
- /docs/langchain/typescript expected /docs/integrations/langchain/tracing, got /integrations/frameworks/langchain (redirect-chain, unexpected-final-target)
- /docs/integrations/vercel expected /docs/integrations/vercel-ai-sdk, got /integrations/frameworks/vercel-ai-sdk (redirect-chain, unexpected-final-target)
- /docs/integrations/langchain expected /docs/integrations/langchain/tracing, got /integrations/frameworks/langchain (redirect-chain, unexpected-final-target)
- /docs/integrations/langchain/python expected /docs/integrations/langchain/tracing, got /integrations/frameworks/langchain (redirect-chain, unexpected-final-target)
- /docs/integrations/langchain/typescript expected /docs/integrations/langchain/tracing, got /integrations/frameworks/langchain (redirect-chain, unexpected-final-target)
- /docs/integrations/langchain/overview expected /docs/integrations/langchain/tracing, got /integrations/frameworks/langchain (redirect-chain, unexpected-final-target)
- /docs/integrations/langchain/get-started expected /docs/integrations/langchain/tracing, got /integrations/frameworks/langchain (redirect-chain, unexpected-final-target)
- /docs/integrations/llama-index expected /docs/integrations/llama-index/get-started, got /integrations/frameworks/llamaindex (redirect-chain, unexpected-final-target)

## Trailing Slash Duplicates

- None

## Case Handling Issues

- None

## Internal Link Issues

- /why referenced by /about, /blog/2024-09-langfuse-proxy, /blog/2024-11-most-used-oss-llmops, /blog/2025-06-04-open-sourcing-langfuse-product, /docs (internal-link-redirect)
- /discord referenced by /about, /blog/2024-07-dify-langfuse-integration, /blog/2024-04-python-decorator, /blog/2024-05-haystack-integration, /blog/2024-04-introducing-langfuse-2.0 (internal-link-redirect)
- /docs/tracing referenced by /blog/2024-07-dify-langfuse-integration, /blog/2024-04-python-decorator, /blog/2024-05-haystack-integration, /blog/2024-04-introducing-langfuse-2.0, /blog/2024-06-monitoring-llm-security (internal-link-redirect)
- /docs/model-usage-and-cost referenced by /blog/2024-07-dify-langfuse-integration, /blog/2024-10-observability-in-multi-step-llm-systems, /blog/2024-10-opentelemetry-for-llm-observability, /blog/update-2023-07, /changelog/2024-04-21-openai-integration-JS-SDK (internal-link-redirect)
- /docs/analytics/overview referenced by /blog/2024-07-dify-langfuse-integration, /blog/2024-10-observability-in-multi-step-llm-systems, /blog/2024-10-opentelemetry-for-llm-observability, /blog/update-2023-09, /blog/update-2023-07 (internal-link-redirect)
- /docs/scores/model-based-evals referenced by /blog/2024-07-dify-langfuse-integration, /blog/2024-04-introducing-langfuse-2.0, /blog/2024-06-monitoring-llm-security, /blog/2024-10-observability-in-multi-step-llm-systems, /blog/2025-03-13-use-hugging-face-together-with-langfuse (internal-link-redirect)
- /docs/datasets/overview referenced by /blog/2024-07-dify-langfuse-integration, /blog/2024-10-observability-in-multi-step-llm-systems, /blog/2025-03-13-use-hugging-face-together-with-langfuse, /blog/2025-03-04-llm-evaluation-101-best-practices-and-challenges, /blog/llama-index-integration (internal-link-redirect)
- /docs/sdk/python/decorators referenced by /blog/2024-04-python-decorator, /blog/2024-06-monitoring-llm-security, /blog/launch-week-1, /changelog/2024-05-16-mirascope-integration, /changelog/2024-09-23-github-discussion-across-documentation (internal-link-redirect)
- /docs/sdk/python/example referenced by /blog/2024-04-python-decorator, /guides/videos/introducing-python-decorator (internal-link-redirect)
- /guides/cookbook/integration_haystack referenced by /blog/2024-05-haystack-integration, /changelog/2024-05-17-haystack-integration (internal-link-redirect)
- /docs/prompts referenced by /blog/2024-04-introducing-langfuse-2.0, /blog/2024-11-llm-product-management, /changelog/2024-05-16-prompts-version-insights, /changelog/2024-09-23-github-discussion-across-documentation, /changelog/2024-12-09-Langfuse-v3-stable-release (internal-link-redirect)
- /docs/playground referenced by /blog/2024-04-introducing-langfuse-2.0, /blog/2025-03-13-use-hugging-face-together-with-langfuse, /blog/2025-06-04-open-sourcing-langfuse-product, /blog/launch-week-1, /changelog/2024-09-23-github-discussion-across-documentation (internal-link-redirect)
- /docs/datasets referenced by /blog/2024-04-introducing-langfuse-2.0, /blog/2024-10-observability-in-multi-step-llm-systems, /blog/2025-09-05-automated-evaluations, /changelog/2025-03-04-dataset-items-duplicate-and-add-to-many, /changelog/2025-06-23-exports-datasets-audit-logs (internal-link-redirect)
- /ideas referenced by /blog/2024-04-introducing-langfuse-2.0, /blog/2025-06-04-open-sourcing-langfuse-product, /changelog/2024-10-10-text-color-for-latency-and-costs, /changelog/2025-06-04-open-sourcing-langfuse, /docs/metrics/features/metrics-api (internal-link-redirect)
- /docs/scores referenced by /blog/2024-06-monitoring-llm-security, /blog/launch-week-1, /blog/update-2023-07, /changelog/2024-03-05-uptrain-integration, /docs/observability/features/user-feedback (internal-link-redirect)
- /docs/scores/annotation referenced by /blog/2024-06-monitoring-llm-security, /blog/2024-10-observability-in-multi-step-llm-systems, /blog/2025-06-04-open-sourcing-langfuse-product, /changelog/2025-06-04-open-sourcing-langfuse, /cn (internal-link-redirect)
- /docs/sdk referenced by /blog/2024-06-monitoring-llm-security, /blog/showcase-llm-chatbot, /blog/update-2023-07, /docs/security-and-guardrails, /security/data-regions (internal-link-redirect)
- /docs/security/example-python referenced by /blog/2024-06-monitoring-llm-security, /docs/security-and-guardrails (internal-link-redirect)
- /docs/security/overview referenced by /blog/2024-06-monitoring-llm-security, /security/security-faq (internal-link-redirect)
- /gh-discussions referenced by /blog/2024-06-monitoring-llm-security (internal-link-redirect)
