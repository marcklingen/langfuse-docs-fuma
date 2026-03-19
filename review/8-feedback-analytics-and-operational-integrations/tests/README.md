# Chapter 8 Test Notes

Run the automated checker from the repo root:

```bash
node review/8-feedback-analytics-and-operational-integrations/tests/run-feedback-analytics-review.mjs \
  --output review/8-feedback-analytics-and-operational-integrations/artifacts/review-report.json
```

The script writes a JSON artifact to:

- [`artifacts/review-report.json`](../artifacts/review-report.json)

The checker covers:

- legacy-vs-migrated analytics parity checks
- preview-vs-production analytics shell inspection
- controlled local feedback webhook forwarding
- controlled local MCP and docs-search analytics probes
- environment variable coverage for active integrations
