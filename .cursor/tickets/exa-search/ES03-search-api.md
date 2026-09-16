# ES-03 — POST `/api/search`

**Difficulty:** Medium
**Wave:** 2 (depends on ES-02 being merged first)
**Model:** claude-4.6-sonnet-medium-thinking
**Files owned (only these):**
- `flash-cards-app/src/app/api/search/route.ts` (new)
- `flash-cards-app/src/app/api/search/route.test.ts` (new)

Do NOT touch `src/lib/server/exa.ts`, `src/lib/search/types.ts`, `package.json`, or any page/component.

## Dependencies (treat as frozen — import, do not modify)

From `@/lib/search/types`: `SearchFilters`, `SEARCH_TYPE_FILTERS`.
From `@/lib/server/exa`: `searchSources(query, filters)`.
From `@/lib/logger`: `logger` (warn/error), same style as `src/app/api/chat/route.ts`.

Auth: `src/proxy.ts` already returns 401 JSON for unauthenticated `/api/*`. Do **not** call `getCurrentUserId` unless you have a strong reason — keep this route as thin as chat.

## Tasks

Implement `POST` in `src/app/api/search/route.ts`:

1. `export const maxDuration = 30;`
2. Zod body:

```ts
{
  query: z.string().trim().min(1),
  filters: z.object({
    types: z.array(z.enum(['papers', 'explainers', 'video', 'forums'])),
    lastTwoYears: z.boolean(),
  }),
}
```

3. On parse failure: `400 { error: 'Invalid request body' }` (optionally `details` from zod flatten). Log a warn.
4. Call `searchSources(parsed.query, parsed.filters)`.
5. Success: `200 { results, summary }` matching ES-02's return value.
6. Error mapping (never include the API key in logs or JSON):
   - thrown message `EXA_API_KEY environment variable is not set` → `500 { error: 'Search is not configured' }`
   - HTTP/status 429 or message indicating rate limit → `429 { error: 'Too many search requests. Try again shortly.' }`
   - 401/402 from Exa → `500 { error: 'Search provider rejected the request' }`
   - anything else → `500 { error: 'Search failed' }` + `logger.error`
7. No Firestore. No GET handler required.

## Tests (`route.test.ts`)

Pattern: `src/app/api/auth/resend-code/route.test.ts` (vi.mock deps, `NextRequest`).

Mock `@/lib/server/exa` `searchSources`. Cover:

- 400 empty/missing query
- 200 mapped `{ results, summary }`
- 500 when `searchSources` throws the missing-key Error
- 429 when `searchSources` throws an error that looks like rate-limit
- invalid filters body → 400

## Acceptance criteria

- `npm run typecheck` / `npm run lint` pass.
- `npx vitest run src/app/api/search/route.test.ts` passes.
- Request/response JSON matches the orchestration frozen contract.
- File ownership respected.

## Report back

Exact request/response shapes and test command output.
