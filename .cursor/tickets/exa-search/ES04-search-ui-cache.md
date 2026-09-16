# ES-04 — Search UI + client-side cache

**Difficulty:** Medium-High
**Wave:** 2 (depends on ES-02 types existing; parallel with ES-03 — do not edit ES-03 files)
**Model:** claude-sonnet-5-thinking-medium
**Files owned (only these):**
- `flash-cards-app/src/app/(app)/search/page.tsx`
- `flash-cards-app/src/components/search/SearchAgentPage.tsx` (new)
- `flash-cards-app/src/lib/search/cache.ts` (new)
- `flash-cards-app/src/lib/search/cache.test.ts` (new)
- optional: `flash-cards-app/src/components/search/SearchAgentPage.test.tsx` if you can test without a browser

Do NOT touch `src/lib/server/exa.ts`, `src/app/api/search/**`, `package.json`, `.env*`, or Firestore.

## Dependencies (frozen)

Import types from `@/lib/search/types` only (`SearchFilters`, `SearchResultItem`, `SearchSnapshot`, `SEARCH_TYPE_FILTERS`). **Never import** `@/lib/server/exa` from client code.

`POST /api/search` JSON (ES-03):

- Body: `{ query: string, filters: SearchFilters }`
- `200`: `{ results: SearchResultItem[], summary: string }`
- `400`/`429`/`500`: `{ error: string }`

`QueryProvider` already wraps the root layout (`src/components/QueryProvider.tsx`).

## Tasks

### 1. `src/lib/search/cache.ts` (client-safe)

- Storage key: `'fc:search:last'`
- Query key: `['exa-search'] as const`
- `readSearchSnapshot(): SearchSnapshot | null` — parse sessionStorage; return null on missing/invalid/SSR (`typeof window === 'undefined'`).
- `writeSearchSnapshot(snapshot: SearchSnapshot): void` — JSON stringify to sessionStorage; ignore SSR.
- `clearSearchSnapshot(): void` — optional helper for tests.

No Firestore. sessionStorage only (clears when the browser tab closes).

### 2. Thin page

`src/app/(app)/search/page.tsx` should only re-export/render `SearchAgentPage` from `@/components/search/SearchAgentPage`. Keep `'use client'` only in the component (page can be a server file that imports the client component).

### 3. `SearchAgentPage.tsx`

Keep the existing visual structure/classes from the current mock page (eyebrow “Search agent”, `EXA · LIVE`, headline, search bar, result cards, agent summary, filters).

Behavior:

- Default query placeholder text stays: `best practical explanations of rotary positional embeddings`. **Do not auto-search on load.**
- Default filter chips: Papers + Explainers **on**; Video, Forums, Last 2 years **off** (matches the mock). Toggling a chip does **not** refetch; filters apply on the next Search click.
- On mount: restore snapshot from React Query `['exa-search']`, else `readSearchSnapshot()`. If found, populate query, filters, results, summary. **Do not** call `/api/search`.
- On Search submit (non-empty trimmed query): `fetch('/api/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, filters }) })`. Loading state on the Search button (`Searching…`, disabled). On success, set results/summary, `queryClient.setQueryData(['exa-search'], snapshot)`, `writeSearchSnapshot(snapshot)`.
- Empty state (no snapshot, no results yet): keep the two-column layout; results area shows a short muted hint that they haven’t searched yet; agent summary body is a short placeholder like “Search to get a reading plan.” — not the hardcoded RoPE paragraph.
- Error: show the API `error` string near the form (danger/muted existing tokens).
- Zero results from a successful search: “No sources found” (or similar) instead of cards.
- Result title is `<a href={url} target="_blank" rel="noopener noreferrer">`. Omit score span if `score` is missing.
- **+ Add to course** and **Turn N sources into a chapter** still call `useNotImplemented().open()`. Chapter button label can use `results.length` (e.g. “Turn 3 sources into a chapter”) when results exist.
- Filters are `<button type="button">` chips, not inert spans. Active/inactive classes stay as in the mock.
- Disable Search when query is empty/whitespace or a search is in flight.

Do not write to Firebase.

### 4. Tests

`cache.test.ts`: write → read roundtrip; invalid JSON → null. Mock `sessionStorage` if needed (jsdom is available).

## Acceptance criteria

- `npm run typecheck` / `npm run lint` pass.
- Colocated cache tests pass.
- Mock RoPE hardcoded results are gone.
- Navigating away from `/search` and back (same JS session) still shows the last results without a new network call if the snapshot exists.
- CTAs remain Not Implemented.

## Report back

How restore order works (React Query vs sessionStorage) and test command output.
