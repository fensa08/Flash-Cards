# ES-02 — `exa-js` + server client + shared DTOs + unit tests

**Difficulty:** Medium
**Wave:** 1 (no file overlap with ES-01; parallel)
**Model:** claude-4.6-sonnet-medium-thinking
**Files owned (only these):**
- `flash-cards-app/package.json` (add `exa-js` only)
- `flash-cards-app/package-lock.json` (from `npm install`)
- `flash-cards-app/src/lib/search/types.ts` (new)
- `flash-cards-app/src/lib/server/exa.ts` (new)
- `flash-cards-app/src/lib/server/exa.test.ts` (new)

Do NOT touch `.env.example`, `DEPLOYMENT.md`, `.env.local`, `src/app/**`, or any React component.

## Context

- App root: `flash-cards-app/` (Next 16.3.3, Vitest, `import 'server-only'` on server modules).
- Mirror env-at-call-time like `src/lib/server/email.ts`.
- Official SDK: `exa-js`. `new Exa(apiKey)` then `exa.search(query, options)`.
- Client UI must import types from `@/lib/search/types` — **not** from `exa.ts` (`server-only` would break the client).
- ES-03 will call `searchSources`. ES-04 will import types + later POST `/api/search`. Freeze names/shapes exactly as specified.

## Tasks

### 1. Install `exa-js`

From `flash-cards-app/`: `npm install exa-js` (current stable). Do not add other deps.

### 2. `src/lib/search/types.ts` (no `server-only`)

Export exactly:

```ts
export const SEARCH_TYPE_FILTERS = ['papers', 'explainers', 'video', 'forums'] as const;
export type SearchTypeFilter = (typeof SEARCH_TYPE_FILTERS)[number];

export interface SearchFilters {
  types: SearchTypeFilter[];
  lastTwoYears: boolean;
}

export interface SearchResultItem {
  rank: string; // '01', '02', ... zero-padded to 2
  title: string;
  url: string;
  snippet: string;
  score?: string; // e.g. '0.94'; omit when unknown
  sourceLabel: string; // hostname
  meta: string; // published year and/or author; '' if nothing
  highlighted: boolean;
}

export interface SearchSnapshot {
  query: string;
  filters: SearchFilters;
  results: SearchResultItem[];
  summary: string;
}
```

### 3. `src/lib/server/exa.ts` (`import 'server-only'`)

Export exactly:

- `buildExaSearchOptions(filters: SearchFilters): Record<string, unknown>` (or a typed options object). Rules:
  - Always include `type: 'auto'`, `numResults: 8`, `contents: { highlights: true }`.
  - Always include `outputSchema: { type: 'text', description: '2–4 sentence study reading plan: what to read first, what to skip, and why.' }`.
  - Base `systemPrompt`: `'Prefer primary sources and clear explainers. Avoid duplicate tutorial reposts.'`
  - `lastTwoYears === true` → `startPublishedDate` ISO timestamp of now minus 2 years.
  - Type chips:
    - **None or more than one** of papers/explainers/video/forums selected → no `category`, no `includeDomains`. If any are selected, append a short preference sentence to `systemPrompt` listing those kinds.
    - **Papers only** → `category: 'publication'`
    - **Video only** → `includeDomains: ['youtube.com', 'youtu.be', 'vimeo.com']`
    - **Forums only** → `includeDomains: ['reddit.com', 'stackoverflow.com', 'news.ycombinator.com']`
    - **Explainers only** → no domains/category; append a systemPrompt bias toward tutorials, visual explainers, and engineering blogs.
- `mapExaResults(raw: { results?: unknown[]; output?: { content?: unknown } }): { results: SearchResultItem[]; summary: string }`
  - Rank `01`…; first item `highlighted: true`, rest false.
  - `url` from result `url`; `title` from `title` or hostname fallback.
  - `snippet`: first string in `highlights`, else `summary`, else `''`.
  - `score`: first `highlightScores` number formatted to 2 decimal places; omit if missing.
  - `sourceLabel`: hostname from `url` (strip `www.`).
  - `meta`: year from `publishedDate` if present, plus author if present, joined with ` · `.
  - `summary`: `output.content` if it is a string, else `''`.
- `searchSources(query: string, filters: SearchFilters): Promise<{ results: SearchResultItem[]; summary: string }>`
  - Read `process.env.EXA_API_KEY` at call time. If missing, throw `new Error('EXA_API_KEY environment variable is not set')`.
  - `new Exa(apiKey)`, `search(query, buildExaSearchOptions(filters))`, then `mapExaResults`.
  - Do not log the API key.

Do not persist anything to Firestore.

### 4. `src/lib/server/exa.test.ts`

Mock `exa-js` (do not hit the network). Cover:

- `buildExaSearchOptions`: lastTwoYears sets `startPublishedDate`; papers-only sets `category: 'publication'`; video-only sets the three YouTube/Vimeo domains; forums-only sets the three forum domains; papers+explainers (multi) sets neither `category` nor `includeDomains`; empty types + lastTwoYears false is unrestricted besides defaults.
- `mapExaResults`: hostname, highlight snippet, missing score omitted, rank padding, first highlighted, summary from `output.content`.
- `searchSources` throws when `EXA_API_KEY` is unset.

Follow existing Vitest style (`src/lib/server/email.test.ts`, `src/lib/profile.test.ts`).

## Acceptance criteria

- `npm run typecheck` and `npm run lint` pass.
- `npx vitest run src/lib/server/exa.test.ts` passes.
- Exported names/shapes match this ticket exactly (ES-03/ES-04 depend on them).
- No API key in source or tests.

## Report back

Paste the exported TypeScript signatures and confirm test command output. Note the installed `exa-js` version.
