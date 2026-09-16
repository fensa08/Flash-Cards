# AN01 — Card-level leech detection

**Repo root:** `flash-cards-app/` (i.e. `/Users/stefan/Desktop/projects/flash-cards-app/flash-cards-app`). Read `AGENTS.md` at that root first and follow its conventions. This ticket is fully self-contained — implement it using only this file and the live codebase.

## Goal

Identify individual flashcards that have repeatedly lapsed ("leeches": 3+ `dont_know` grades within a card's recent review history) and surface them as a new ranked list in the per-deck insights page.

## Background you can rely on (verified against the current codebase)

- `ReviewRecord` (`src/types/index.ts`) has `cardId?: string`, `response: ResponseType` (`'know' | 'uncertain' | 'dont_know' | 'easy'`), `answeredAt: Date`, `intervalAtReview?: number`, `wasOverdue?: boolean`.
- `Card` (`src/types/index.ts`) has `id`, `deck_id`, `question`, `answer`, `weight`, `times_seen`, `created_at`, `ease_factor`, `interval_days`, `repetitions`, `due_at`.
- `getDeckInsights(deckId, ownerId, now)` in `src/lib/firestore/insights.ts` already fetches a 60-day window of reviews via `listReviewsSince(deckId, since)` (from `src/lib/firestore/reviews.ts`) and the deck's cards via `listCards(deckId, ownerId)` (from `src/lib/firestore/cards.ts`). Both `listReviewsSince` and `listCards` are already-exported functions you may import and call directly — do not edit `insights.ts`, `reviews.ts`, or `cards.ts`.
- `assertDeckOwnership(deckId, ownerId)` is exported from `src/lib/firestore/decks.ts`.
- `getCurrentUserId()` is exported from `src/lib/auth.ts`.
- `src/components/DeckInsights.tsx` is a client component that renders a fixed sequence of `<section>`s (Accuracy trend, Retention, Backlog retention, Forecast, Ease factor, Maturity, Retention-by-bucket, Lapse rate) inside one top-level `<div className="space-y-10">`.

## Exact new file(s) to create

### 1. `src/lib/study/leeches.ts` (pure, no `server-only`, no Firebase imports)

```ts
import type { Card, ReviewRecord } from '@/types';

/** A card is a "leech" once it has accumulated this many `dont_know` grades within the review window passed to computeLeechCards. */
export const LEECH_THRESHOLD = 3;

export interface LeechCard {
  cardId: string;
  question: string;
  dontKnowCount: number;
  /** Total reviews (any grade) for this card within the window passed in. */
  totalReviews: number;
  /** ISO timestamp of the most recent review for this card within the window. */
  lastReviewedAt: string;
}

/**
 * Cards whose `dont_know` count within `reviews` meets or exceeds `threshold`.
 * - Reviews with no `cardId` are ignored (can't be attributed to a card).
 * - Reviews whose `cardId` does not match any card in `cards` are ignored
 *   (the card may have been deleted since the review was logged).
 * - Result is sorted by `dontKnowCount` descending, then by `lastReviewedAt`
 *   descending (most recently problematic first) as a tiebreaker.
 */
export function computeLeechCards(
  cards: Card[],
  reviews: ReviewRecord[],
  threshold?: number,
): LeechCard[];
```

Implementation requirements:
- Group `reviews` by `cardId` (skip reviews with no `cardId`).
- For each group, count `dontKnowCount` = number of reviews with `response === 'dont_know'`; `totalReviews` = group length; `lastReviewedAt` = the max `answeredAt` in the group, as `.toISOString()`.
- Look up each `cardId` in `cards` (match on `Card.id`); skip groups whose `cardId` has no matching card.
- Keep only groups where `dontKnowCount >= (threshold ?? LEECH_THRESHOLD)`.
- `question` comes from the matched `Card.question`.
- Sort as specified above.

### 2. `src/lib/study/leeches.test.ts`

Vitest unit tests (see "Suggested tests" below), following the existing style of `src/lib/study/insights.test.ts` (same repo, `describe`/`it`, a `day(offset)` helper for building `Date`s, `ReviewRecord[]`/`Card[]` literals built inline).

### 3. `src/lib/firestore/leeches.ts` (`import 'server-only'`)

```ts
import 'server-only';
import type { LeechCard } from '@/lib/study/leeches';

/** Matches the review-history window already used by getDeckInsights (src/lib/firestore/insights.ts). */
export async function getDeckLeeches(deckId: string, ownerId: string, now?: Date): Promise<LeechCard[]>;
```

Implementation: `await assertDeckOwnership(deckId, ownerId)`, compute `since = now - 60 days` (use `now = now ?? new Date()`, mirror the `60 * 24 * 60 * 60 * 1000` ms window used in `getDeckInsights`), fetch `listReviewsSince(deckId, since)` and `listCards(deckId, ownerId)` in parallel (`Promise.all`), then return `computeLeechCards(cards, reviews)`.

### 4. `src/lib/actions/leeches.ts` (`'use server'`)

```ts
'use server';

export async function getDeckLeechesAction(deckId: string): Promise<LeechCard[]>;
```

Implementation: validate `deckId` with `z.string().min(1).parse(deckId)` (see `zod` usage pattern in `src/lib/actions.ts`), resolve `ownerId` via `getCurrentUserId()`, call `getDeckLeeches(deckId, ownerId)`.

### 5. `src/components/analytics/LeechList.tsx` (`'use client'`)

```tsx
interface LeechListProps {
  deckId: string;
}
export default function LeechList({ deckId }: LeechListProps): JSX.Element;
```

- Uses `useQuery({ queryKey: ['deckLeeches', deckId], queryFn: () => getDeckLeechesAction(deckId) })` (same React Query pattern as `DeckInsights.tsx`).
- Renders a `<section>` titled "Leeches — cards that keep lapsing" (match the `<h3 className="text-lg font-semibold text-foreground">` heading style used by the other sections in `DeckInsights.tsx`).
- Empty state (query resolved, array empty): a `<p className="text-sm text-muted">` message, e.g. "No leeches yet — no card has lapsed 3+ times." (Do not block rendering on `isLoading`/`error` beyond a simple inline spinner/error message consistent with the rest of the file; this section must never crash the page if the query fails.)
- Non-empty state: a list (one row per `LeechCard`, ordered as returned by the API) showing `question` (truncate visually if needed), a badge with `dontKnowCount` (e.g. "3× don't know"), and `totalReviews`. Follow the visual idiom of `src/components/analytics/PriorityList.tsx` (rounded badge, `font-mono` index, `text-xs text-muted` secondary line) for consistency, but this is a new component — exact pixel styling is your judgment as long as it fits the existing design language (Tailwind utility classes matching the surrounding app, `rounded-2xl`/`rounded-xl`, `border-border`, `text-muted`, `text-danger` for the lapse badge given danger = failure semantics elsewhere in this file).

## Exact, minimal touchpoint in existing files

**`src/components/DeckInsights.tsx`** — exactly two additive lines, nothing else in this file may change:
1. Add one new import line, placed immediately after the existing `import AccuracyTrendChart from '@/components/charts/AccuracyTrendChart';` line:
   ```ts
   import LeechList from '@/components/analytics/LeechList';
   ```
2. Add one new JSX line as the **very last child**, appended immediately after the existing `<LapseRateChart lapseRate={data.lapseRate} />` line and before the closing `</div>` of the top-level `<div className="space-y-10">`:
   ```tsx
   <LeechList deckId={deckId} />
   ```

Do not reorder, reformat, or touch any other line of `DeckInsights.tsx`. Do not touch `src/lib/study/analytics.ts`, `src/lib/study/insights.ts`, `src/lib/firestore/insights.ts`, `src/components/GlobalAnalytics.tsx`, or `src/types/index.ts`.

## Data-modeling decisions

- No schema changes. `LeechCard` is a brand-new type defined and exported from `src/lib/study/leeches.ts` (not added to `src/types/index.ts`).
- Leech window = the same 60-day review-history window `getDeckInsights` already uses. This is a fixed decision, not configurable from the UI in this ticket.
- `LEECH_THRESHOLD = 3` is the default; the function accepts an optional override for testability but the shipped UI always uses the default (don't add a UI control to change it).

## UI integration point

`src/app/(app)/decks/[id]/insights/page.tsx` already renders `<DeckInsights deckId={deck.id} initialInsights={insights} />` — no route/page changes needed. The new leech list appears automatically at the bottom of that existing page once the `DeckInsights.tsx` touchpoint above lands.

## Explicit out-of-scope items

- No changes to the SM-2 scheduler (`src/lib/study/srs.ts`) or how leeches are scheduled/suspended — this ticket is read-only reporting, not scheduling behavior.
- No "suspend/bury this card" action — display only.
- No cross-deck leech rollup (e.g. a global "all your leeches" page) — deck-scoped only.
- No changes to `GlobalAnalytics.tsx`, `analytics.ts`, or `insights.ts`.

## Acceptance criteria (mechanically verifiable)

- [ ] `src/lib/study/leeches.ts`, `src/lib/study/leeches.test.ts`, `src/lib/firestore/leeches.ts`, `src/lib/actions/leeches.ts`, `src/components/analytics/LeechList.tsx` exist with the exported names/signatures specified above.
- [ ] `computeLeechCards`, `LeechCard`, `LEECH_THRESHOLD` are exported from `src/lib/study/leeches.ts` with exactly those names.
- [ ] `git diff` (or equivalent) shows changes to `src/components/DeckInsights.tsx` consisting of exactly one added import line and exactly one added JSX line, both at the end of their respective sections, with zero other lines modified.
- [ ] No changes anywhere to `src/lib/study/analytics.ts`, `src/lib/study/insights.ts`, `src/lib/firestore/insights.ts`, `src/components/GlobalAnalytics.tsx`, or `src/types/index.ts`.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npx vitest run src/lib/study/leeches.test.ts` passes.
- [ ] Existing tests are unaffected: `npx vitest run src/lib/study/insights.test.ts src/lib/study/analytics.test.ts` still pass unchanged.
- [ ] The insights page for a deck with no leeches renders the new section's empty state without throwing (manual/inspection check of the component logic — this app does not require you to run the dev server, but the empty-state branch must be present and type-correct).

## Suggested tests to add (`src/lib/study/leeches.test.ts`)

- Card with exactly `LEECH_THRESHOLD` (3) `dont_know` reviews is flagged; a card with 2 is not.
- Reviews without `cardId` are ignored and don't crash the grouping.
- A review whose `cardId` doesn't match any card in `cards` is excluded from the result (not silently attributed to the wrong card).
- Multiple leeches are sorted by `dontKnowCount` descending; ties broken by most-recent `lastReviewedAt` first.
- `totalReviews` counts all grades for the card (not just `dont_know`).
- Passing a custom `threshold` (e.g. `1`) changes which cards qualify.
- Empty `cards`/`reviews` input returns `[]`.
