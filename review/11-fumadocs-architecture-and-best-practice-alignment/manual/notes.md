# Manual Review Notes

## Environment

- Target: repository source tree
- Reviewer: Codex
- Date: 2026-03-19

## Official baseline used

- Fumadocs' Next.js guide describes the core baseline as:
  - `source.config.ts` for collections
  - `next.config.mjs` wrapped with `createMDX()`
  - `lib/source.ts` built from `loader(...)`
  - `app/layout.tsx` wrapping the app in `RootProvider`
  - shared layout options extracted so docs layouts do not drift
- Fumadocs' collections and loader docs treat collection definitions and loader-backed page trees as the primary source of truth for docs navigation.

## Repo-specific interpretation

- This repo intentionally goes beyond the minimal Fumadocs example because it serves many content sections, not just `/docs`.
- A custom search stack is intentional here: Inkeep-backed search and AI surfaces replace the default documented Fumadocs search route.
- The main architecture risk is therefore not "does Fumadocs exist", but whether migration-era custom layers now exceed what is still justified.

## Manual conclusions

- Core Fumadocs wiring is present and recognizable.
- Content collections are loader-backed rather than filesystem-read at request time.
- The largest deviations are:
  - runtime page-tree rewrite helpers in `lib/source.ts`
  - a custom section registry for many content families
  - stale `nextra` alias configuration that points to files no longer present
  - a `shortTitle` convention implemented in runtime helpers but not declared in `source.config.ts`
- Audit outcome:
  - 5 pass
  - 3 warn
  - 2 fail
