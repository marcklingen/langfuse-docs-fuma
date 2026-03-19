# Chapter 7 Findings

## Findings

No preview regressions were detected in the Chapter 7 automated run on 2026-03-19.

## Non-blocking observations

- The preview emitted explicit canonical tags on the representative docs, FAQ, blog, and guide pages, while the raw production HTML for the same routes did not expose canonical tags in the same way.
- The preview aligned `og:url` with canonical overrides on the sampled changelog pages. Production still exposed route URLs for some canonical-override changelog pages.
- The preview emitted a valid `og:video` URL for `/changelog/2025-01-22-track-changes-between-prompt-versions`, while production currently exposed a malformed value by prefixing `https://langfuse.com` to the absolute video URL.
- No JSON-LD scripts were present on either preview or production for the representative sample set, so this chapter verified preservation of the current absence of structured data rather than validating specific schema types.

## Severity scale

- `P1`: launch blocker or metadata/social-sharing regression with high external impact
- `P2`: significant but non-blocking metadata regression
- `P3`: minor metadata inconsistency or polish issue
