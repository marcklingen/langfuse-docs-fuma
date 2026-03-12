# Chapter 2 Audit Diff

Generated: 2026-03-12T03:25:32.279Z

## Targets

- Baseline: `https://langfuse.com`
- Candidate: `https://langfuse-docs-git-fork-altalogy-to-fumadocs-langfuse.vercel.app`

## Summary

- Shared sitemap URLs: 785
- Added sitemap URLs in candidate: 0
- Removed sitemap URLs in candidate: 0
- Canonical regressions: 126
- Page-level noindex regressions: 1
- Missing `og:url` regressions: 785
- Missing description regressions: 0
- URLs that became page-level indexable in candidate: 1
- URLs that stopped being page-level indexable in candidate: 9
- Preview HTML pages missing the global `X-Robots-Tag: noindex` header: 0
- Candidate sitemap URLs marked `noindex` in source: 1
- Candidate sitemap URLs canonicalized elsewhere in source: 126
- Candidate sitemap URLs that should be excluded by cookbook duplicate logic: 0
- Candidate markdown endpoint failures: 1

## Added Sitemap URLs

_None._


## Removed Sitemap URLs

_None._


## Canonical Regressions

| URL | Production canonical | Candidate canonical |
| --- | --- | --- |
| https://langfuse.com/changelog/2023-07-20-analytics-alpha | https://langfuse.com/docs/metrics/overview | (missing) |
| https://langfuse.com/changelog/2023-07-20-token-calculation | https://langfuse.com/docs/observability/features/token-and-cost-tracking | (missing) |
| https://langfuse.com/changelog/2023-07-31-human-in-the-loop-evaluation | https://langfuse.com/docs/evaluation/evaluation-methods/scores-via-ui | (missing) |
| https://langfuse.com/changelog/2023-08-31-track-version-and-releases | https://langfuse.com/docs/observability/features/releases-and-versioning | (missing) |
| https://langfuse.com/changelog/2023-09-01-token-costs-in-usd | https://langfuse.com/docs/observability/features/token-and-cost-tracking | (missing) |
| https://langfuse.com/changelog/2023-09-12-analytics-alpha-public-access | https://langfuse.com/docs/metrics/overview | (missing) |
| https://langfuse.com/changelog/2023-09-15-model-based-evaluation | https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge | (missing) |
| https://langfuse.com/changelog/2023-09-18-export-generations | https://langfuse.com/docs/api-and-data-platform/features/export-from-ui | (missing) |
| https://langfuse.com/changelog/2023-09-25-datasets | https://langfuse.com/docs/evaluation/experiments/datasets | (missing) |
| https://langfuse.com/changelog/2023-10-09-dashboards | https://langfuse.com/docs/metrics/overview | (missing) |
| https://langfuse.com/changelog/2023-10-25-openai-sdk-integration | https://langfuse.com/integrations/model-providers/openai-py | (missing) |
| https://langfuse.com/changelog/2023-10-31-simplified-self-hosting | https://langfuse.com/self-hosting/deployment/docker-compose | (missing) |
| https://langfuse.com/changelog/2023-11-03-sso-enforcement | https://langfuse.com/docs/administration/authentication-and-sso | (missing) |
| https://langfuse.com/changelog/2023-11-16-openai-sdk-version-1 | https://langfuse.com/integrations/model-providers/openai-py | (missing) |
| https://langfuse.com/changelog/2023-12-13-sessions | https://langfuse.com/docs/observability/features/sessions | (missing) |
| https://langfuse.com/changelog/2023-12-28-v2-sdks | https://langfuse.com/docs/observability/sdk/overview | (missing) |
| https://langfuse.com/changelog/2024-01-03-prompt-management | https://langfuse.com/docs/prompt-management/get-started | (missing) |
| https://langfuse.com/changelog/2024-01-16-trace-tagging | https://langfuse.com/docs/observability/features/tags | (missing) |
| https://langfuse.com/changelog/2024-01-29-custom-model-prices | https://langfuse.com/docs/observability/features/token-and-cost-tracking | (missing) |
| https://langfuse.com/changelog/2024-02-05-sdk-level-prompt-caching | https://langfuse.com/docs/prompt-management/features/caching | (missing) |
| https://langfuse.com/changelog/2024-02-19-metrics-api-endpoint | https://langfuse.com/docs/metrics/features/metrics-api | (missing) |
| https://langfuse.com/changelog/2024-02-20-prompt-config | https://langfuse.com/docs/prompt-management/features/config | (missing) |
| https://langfuse.com/changelog/2024-03-07-Claude3 | https://langfuse.com/docs/observability/features/token-and-cost-tracking | (missing) |
| https://langfuse.com/changelog/2024-03-24-python-decorator | https://langfuse.com/docs/observability/sdk/instrumentation | (missing) |
| https://langfuse.com/changelog/2024-04-09-openai-integration-linked-prompt-management | https://langfuse.com/docs/prompt-management/features/link-to-traces | (missing) |


## Page-Level Noindex Regressions

| URL | Production robots | Candidate robots | Candidate X-Robots-Tag |
| --- | --- | --- | --- |
| https://langfuse.com/find-us | noindex | (missing) | noindex |


## Missing og:url Regressions

| URL | Production og:url |
| --- | --- |
| https://langfuse.com | https://langfuse.com/ |
| https://langfuse.com/about | https://langfuse.com/about |
| https://langfuse.com/blog | https://langfuse.com/blog |
| https://langfuse.com/blog/2024-04-introducing-langfuse-2.0 | https://langfuse.com/blog/2024-04-introducing-langfuse-2.0 |
| https://langfuse.com/blog/2024-04-python-decorator | https://langfuse.com/blog/2024-04-python-decorator |
| https://langfuse.com/blog/2024-05-haystack-integration | https://langfuse.com/blog/2024-05-haystack-integration |
| https://langfuse.com/blog/2024-06-monitoring-llm-security | https://langfuse.com/blog/2024-06-monitoring-llm-security |
| https://langfuse.com/blog/2024-07-ai-agent-observability-with-langfuse | https://langfuse.com/blog/2024-07-ai-agent-observability-with-langfuse |
| https://langfuse.com/blog/2024-07-dify-langfuse-integration | https://langfuse.com/blog/2024-07-dify-langfuse-integration |
| https://langfuse.com/blog/2024-08-what-is-langchain | https://langfuse.com/blog/2024-08-what-is-langchain |
| https://langfuse.com/blog/2024-09-langfuse-proxy | https://langfuse.com/blog/2024-09-langfuse-proxy |
| https://langfuse.com/blog/2024-10-observability-in-multi-step-llm-systems | https://langfuse.com/blog/2024-10-observability-in-multi-step-llm-systems |
| https://langfuse.com/blog/2024-10-opentelemetry-for-llm-observability | https://langfuse.com/blog/2024-10-opentelemetry-for-llm-observability |
| https://langfuse.com/blog/2024-11-17-launch-week-2 | https://langfuse.com/blog/2024-11-17-launch-week-2 |
| https://langfuse.com/blog/2024-11-llm-product-management | https://langfuse.com/blog/2024-11-llm-product-management |
| https://langfuse.com/blog/2024-11-most-used-oss-llmops | https://langfuse.com/blog/2024-11-most-used-oss-llmops |
| https://langfuse.com/blog/2024-12-langfuse-v3-infrastructure-evolution | https://langfuse.com/blog/2024-12-langfuse-v3-infrastructure-evolution |
| https://langfuse.com/blog/2025-01-22-evaluating-voice-ai-agents | https://langfuse.com/blog/2025-01-22-evaluating-voice-ai-agents |
| https://langfuse.com/blog/2025-02-20-the-agent-deep-dive-open-deep-research | https://langfuse.com/blog/2025-02-20-the-agent-deep-dive-open-deep-research |
| https://langfuse.com/blog/2025-02-28-langfuse-february-update | https://langfuse.com/blog/2025-02-28-langfuse-february-update |
| https://langfuse.com/blog/2025-03-04-llm-evaluation-101-best-practices-and-challenges | https://langfuse.com/blog/2025-03-04-llm-evaluation-101-best-practices-and-challenges |
| https://langfuse.com/blog/2025-03-13-use-hugging-face-together-with-langfuse | https://langfuse.com/blog/2025-03-13-use-hugging-face-together-with-langfuse |
| https://langfuse.com/blog/2025-03-19-ai-agent-comparison | https://langfuse.com/blog/2025-03-19-ai-agent-comparison |
| https://langfuse.com/blog/2025-03-31-langfuse-march-update | https://langfuse.com/blog/2025-03-31-langfuse-march-update |
| https://langfuse.com/blog/2025-04-24-how-we-use-llms-to-scale-langfuse | https://langfuse.com/blog/2025-04-24-how-we-use-llms-to-scale-langfuse |


## Missing Description Regressions

_None._


## Page-Level Indexability Changes

### Became indexable in candidate

- https://langfuse.com/find-us


### Stopped being indexable in candidate

- https://langfuse.com/blog/2026-03-10-simplify-langfuse-for-scale
- https://langfuse.com/changelog/2026-03-10-simplify-for-scale
- https://langfuse.com/docs/observability/sdk/upgrade-path/js-v3-to-v4
- https://langfuse.com/docs/observability/sdk/upgrade-path/js-v4-to-v5
- https://langfuse.com/docs/observability/sdk/upgrade-path/python-v2-to-v3
- https://langfuse.com/docs/observability/sdk/upgrade-path/python-v3-to-v4
- https://langfuse.com/docs/v4
- https://langfuse.com/faq/all/explore-observations-in-v4
- https://langfuse.com/faq/all/observation-eval-not-executing


## Candidate-Only Checks

### Preview pages missing the global noindex header

_None._


### Candidate sitemap includes source-marked noindex routes

| URL | Expected behavior |
| --- | --- |
| https://langfuse.com/find-us | Exclude from sitemap and keep page-level noindex |


### Candidate sitemap includes routes canonicalized elsewhere

| URL | Expected canonical |
| --- | --- |
| https://langfuse.com/changelog/2023-07-20-analytics-alpha | https://langfuse.com/docs/metrics/overview |
| https://langfuse.com/changelog/2023-07-20-token-calculation | https://langfuse.com/docs/observability/features/token-and-cost-tracking |
| https://langfuse.com/changelog/2023-07-31-human-in-the-loop-evaluation | https://langfuse.com/docs/evaluation/evaluation-methods/scores-via-ui |
| https://langfuse.com/changelog/2023-08-31-track-version-and-releases | https://langfuse.com/docs/observability/features/releases-and-versioning |
| https://langfuse.com/changelog/2023-09-01-token-costs-in-usd | https://langfuse.com/docs/observability/features/token-and-cost-tracking |
| https://langfuse.com/changelog/2023-09-12-analytics-alpha-public-access | https://langfuse.com/docs/metrics/overview |
| https://langfuse.com/changelog/2023-09-15-model-based-evaluation | https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge |
| https://langfuse.com/changelog/2023-09-18-export-generations | https://langfuse.com/docs/api-and-data-platform/features/export-from-ui |
| https://langfuse.com/changelog/2023-09-25-datasets | https://langfuse.com/docs/evaluation/experiments/datasets |
| https://langfuse.com/changelog/2023-10-09-dashboards | https://langfuse.com/docs/metrics/overview |
| https://langfuse.com/changelog/2023-10-25-openai-sdk-integration | https://langfuse.com/integrations/model-providers/openai-py |
| https://langfuse.com/changelog/2023-10-31-simplified-self-hosting | https://langfuse.com/self-hosting/deployment/docker-compose |
| https://langfuse.com/changelog/2023-11-03-sso-enforcement | https://langfuse.com/docs/administration/authentication-and-sso |
| https://langfuse.com/changelog/2023-11-16-openai-sdk-version-1 | https://langfuse.com/integrations/model-providers/openai-py |
| https://langfuse.com/changelog/2023-12-13-sessions | https://langfuse.com/docs/observability/features/sessions |
| https://langfuse.com/changelog/2023-12-28-v2-sdks | https://langfuse.com/docs/observability/sdk/overview |
| https://langfuse.com/changelog/2024-01-03-prompt-management | https://langfuse.com/docs/prompt-management/get-started |
| https://langfuse.com/changelog/2024-01-16-trace-tagging | https://langfuse.com/docs/observability/features/tags |
| https://langfuse.com/changelog/2024-01-29-custom-model-prices | https://langfuse.com/docs/observability/features/token-and-cost-tracking |
| https://langfuse.com/changelog/2024-02-05-sdk-level-prompt-caching | https://langfuse.com/docs/prompt-management/features/caching |
| https://langfuse.com/changelog/2024-02-19-metrics-api-endpoint | https://langfuse.com/docs/metrics/features/metrics-api |
| https://langfuse.com/changelog/2024-02-20-prompt-config | https://langfuse.com/docs/prompt-management/features/config |
| https://langfuse.com/changelog/2024-03-07-Claude3 | https://langfuse.com/docs/observability/features/token-and-cost-tracking |
| https://langfuse.com/changelog/2024-03-24-python-decorator | https://langfuse.com/docs/observability/sdk/instrumentation |
| https://langfuse.com/changelog/2024-04-09-openai-integration-linked-prompt-management | https://langfuse.com/docs/prompt-management/features/link-to-traces |


### Candidate markdown endpoint failures

| Path | Status | Content-Type | X-Robots-Tag | Problems |
| --- | --- | --- | --- | --- |
| /find-us | 404 | text/html; charset=utf-8 | noindex | status-not-200, wrong-content-type |

