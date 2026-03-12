# Chapter 11 Manual Notes

## Baseline used

- Official Fumadocs docs were reviewed on 2026-03-11 before this chapter was executed.
- This chapter treats the current Fumadocs architecture docs as the baseline rather than the repository's migration notes.

## What this chapter does not prove

- It does not validate runtime rendering fidelity. That belongs to Chapter 6.
- It does not validate build or release behavior. That belongs to Chapter 12.
- It does not validate search quality. It only checks how search is wired architecturally.

## Review notes

- The repo uses Fumadocs for collection indexing and page-tree generation, but it still carries migration-era route registries, generated body loaders, and Nextra compatibility shims.
- The search experience appears to be intentionally replaced with an Inkeep-backed implementation rather than the documented Fumadocs search route. That is acceptable for Chapter 11 only if the replacement remains documented and low-risk.
