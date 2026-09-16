# ES-05 — Integration & verification pass

**Difficulty:** Low-Medium
**Wave:** 3 (after ES-01–ES-04)
**Model:** claude-4.5-haiku-thinking
**Files owned:** any file from ES-01–ES-04 **only if** needed to fix drift (types mismatch, missing export, lint). Do not add features (no Add-to-course, no Firestore, no Exa on the Research tab).

## Tasks

1. Read ES-01–ES-04 tickets and the landed files. Confirm:
   - Client never imports `@/lib/server/exa` or `exa-js`.
   - `EXA_API_KEY` is not in git-tracked files (grep the repo; `.env.example` may have an empty assignment).
   - `POST /api/search` body/response matches `SearchFilters` / `SearchResultItem`.
   - Search page restore: sessionStorage key `fc:search:last`, query key `['exa-search']`, no auto-search on load.
   - Add to course / Turn into chapter still use `useNotImplemented`.
2. Run from `flash-cards-app/`: `npm run lint`, `npm run typecheck`, `npm test` (or at least `exa.test.ts`, `route.test.ts`, `cache.test.ts`). Fix failures caused by this feature.
3. If ES-03 and ES-04 drifted (field names, filter shape), make the smallest fix so they agree with the frozen contract in `00-orchestration-plan.md`.

## Acceptance criteria

- lint, typecheck, and the new unit tests pass.
- No API key committed.
- Short written trace of the request path: page → `/api/search` → `searchSources` → Exa.

## Report back

Command output and any drift you had to fix (file + why). If nothing to fix, say so.
