# Orchestration plan — Exa search section

5 tickets derived from the approved Exa search plan. Grouped into 3 waves by file-ownership (tickets within a wave touch disjoint files, so they can run as parallel agents on the same working tree).

Tests for mapper/filters live in ES-02; tests for the HTTP route live in ES-03. UI persistence is owned by ES-04 (same files as the search page — not a separate ticket).

| Ticket | Title | Difficulty | Parallelizable | Model | Wave | Depends on |
|---|---|---|---|---|---|---|
| ES-01 | Env docs + local `EXA_API_KEY` slot | Low | Yes (Wave 1) | claude-4.5-haiku-thinking | 1 | — | DONE |
| ES-02 | `exa-js` + server client + DTO + unit tests | Medium | Yes (Wave 1) | claude-4.6-sonnet-medium-thinking | 1 | — | DONE |
| ES-03 | `POST /api/search` + route tests | Medium | Yes (Wave 2) | claude-4.6-sonnet-medium-thinking | 2 | ES-02 | DONE |
| ES-04 | Search UI + client cache | Medium-High | Yes (Wave 2) | claude-sonnet-5-thinking-medium | 2 | ES-02 (types + JSON contract; does not wait on ES-03 files) | DONE |
| ES-05 | Integration & verification pass | Low-Medium | No | claude-4.5-haiku-thinking | 3 | ES-01–ES-04 | DONE |

## Parallelization rationale

- **Wave 1 (ES-01, ES-02):** disjoint files. ES-01 owns `.env.example`, `DEPLOYMENT.md`, and gitignored `.env.local`. ES-02 owns `package.json` / lockfile, `src/lib/search/types.ts`, and `src/lib/server/exa.ts` (+ tests). Neither edits the search page or API route.
- **Wave 2 (ES-03, ES-04):** disjoint files, both consume the **frozen contract** in ES-02 (`SearchFilters`, `SearchResultItem`, `SearchSnapshot`, `searchSources`). ES-03 owns `src/app/api/search/` only. ES-04 owns the search page + `src/components/search/` + `src/lib/search/cache.ts`. ES-04 talks to `/api/search` via the JSON contract below — it must not import `src/lib/server/exa.ts` (`server-only`).
- **Wave 3 (ES-05):** sequential. Reconciles drift, runs lint/typecheck/tests, smoke-checks the page still matches the mock.

## Frozen JSON contract (ES-03 ↔ ES-04)

`POST /api/search`

Request:

```json
{ "query": "string (trimmed, min 1)", "filters": { "types": ["papers"|"explainers"|"video"|"forums"], "lastTwoYears": false } }
```

Success `200`:

```json
{ "results": [ { "rank": "01", "title": "...", "url": "https://...", "snippet": "...", "score": "0.94", "sourceLabel": "arxiv.org", "meta": "2021", "highlighted": true } ], "summary": "..." }
```

`score` may be omitted. `summary` may be `""` if Exa returns no synthesis.

Errors: `400 { "error": "..." }` invalid body; `500 { "error": "..." }` missing key / unexpected; `429 { "error": "..." }` rate limit. Never echo the API key.

## Execution protocol (per ticket)

1. Spawn an implementer with the ticket's model and full ticket content as the prompt.
2. When it finishes, spawn a reviewer (cheaper independent model) with the diff + acceptance criteria. Reviewer runs lint/typecheck/relevant tests.
3. If the reviewer pushes back, resume the implementer with that feedback and repeat step 2.
4. If no pushback, mark the ticket done and continue.

Reviewer models: ES-01/ES-05 → composer-2.5-fast; ES-02/ES-03/ES-04 → claude-4.5-haiku-thinking.
