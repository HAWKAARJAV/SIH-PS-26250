# VYUHA progress

## Done
- Spec saved to `docs/SPEC.md` (verbatim master prompt, including the SIH26250 listing captured with the prompt).

## Next
- Phase 0: monorepo, tooling, CI, Sandstone & Ink tokens, app shell, `/dev/ui` gallery, health endpoints, compose, docs skeleton.

## Known issues
- Docker CLI is not installed on this machine. Compose files will be written and reviewed; local exit check is `pnpm dev` plus `/api/healthz` through the Next rewrite. Image build stays in CI.
