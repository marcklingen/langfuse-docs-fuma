# Chapter 3 Test Notes

Run the automated checker from the repo root:

```bash
python3 review/3-information-architecture-and-core-docs-ux/tests/check_docs_ux.py --base-url http://127.0.0.1:3333
```

The script writes a JSON artifact to:

- [`artifacts/check-results.json`](/Users/marcklingen/repos/github/marcklingen/langfuse-docs-fuma/review/3-information-architecture-and-core-docs-ux/artifacts/check-results.json)

The checker covers structure and internal link validation for:

- global top nav presence
- menu-switcher entries
- curated docs sidebar ordering
- breadcrumbs
- TOC anchor targets
- edit link
- contributors block on a contributor-backed sample page
- internal header/footer/sidebar/breadcrumb/TOC links
