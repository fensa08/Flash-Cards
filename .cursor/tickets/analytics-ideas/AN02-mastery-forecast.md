# AN02 — Predicted mastery date

**Repo root:** `flash-cards-app/` (i.e. `/Users/stefan/Desktop/projects/flash-cards-app/flash-cards-app`). Read `AGENTS.md` at that root first and follow its conventions. This ticket is fully self-contained — implement it using only this file and the live codebase.

## Goal

For each card (and rolled up per deck), extrapolate from its current SM-2 interval-growth trend to project the date it will cross the "mature" threshold (interval ≥ 21 days), handling cards with no growth trend or insufficient history gracefully.

## Background you can rely on (verified against the current codebase)

- `Card` (`src/types/index.ts`): `id`, `deck_id`, `question`, `answer`, `weight`, `times_seen`, `created_at`, `ease_factor`, `interval_days`, `repetitions`, `due_at` (ISO string).
- `MATURE_INTERVAL_DAYS = 21` is defined and exported from **two** places today: `src/lib/study/analytics.ts` (as a private, non-exported const — do not import it from there) and `src/lib/study/insights.ts` (`export const MATURE_INTERVAL_DAYS = 21;`). For this ticket, define your own local `MATURE_INTERVAL_DAYS = 21` constant inside the new file below rather than importing it, to keep this ticket's file fully decoupled from `insights.ts`/`analytics.ts` (no import needed, no coupling risk).
- SM-2 interval growth (`src/lib/study/srs.ts`, `growInterval`): for `repetitions >= 3`, the next interval is `Math.ceil(intervalDays * easeFactor)` (with a small floating-point-safety round to 6 decimals before ceiling, and a floor of 1). Reps 1 and 2 use fixed constants `I(1)=1`, `I(2)=6`, not the multiplicative formula. `ease_factor` never goes below `1.3` (`MIN_EASE_FACTOR`), so the multiplicative growth always eventually exceeds any finite threshold — a bounded simulation loop is safe (no possible infinite loop) once `repetitions >= 2`.
- `getDeckInsights` (`src/lib/firestore/insights.ts`) already exports a pattern you can mirror for fetching `listCards(deckId, ownerId)` from `src/lib/firestore/cards.ts` (exported, read-only import).
- `assertDeckOwnership(deckId, ownerId)` is exported from `src/lib/firestore/decks.ts`.
- `getCurrentUserId()` is exported from `src/lib/auth.ts`.

## Exact new file(s) to create

### 1. `src/lib/study/masteryForecast.ts` (pure, no `server-only`, no Firebase imports)

```ts
import type { Card } from '@/types';

/** Mirrors MATURE_INTERVAL_DAYS from src/lib/study/insights.ts — kept as a local constant here deliberately (see ticket AN02) rather than imported, to avoid coupling this file to insights.ts. */
export const MATURE_INTERVAL_DAYS = 21;

/** Safety cap on simulated future reviews, to bound the projection loop. In practice convergence happens in well under 20 iterations even from ease_factor at its 1.3 floor. */
export const MAX_SIMULATED_REVIEWS = 30;

export type MasteryForecastStatus = 'already_mature' | 'insufficient_history' | 'projected';

export interface CardMasteryForecast {
  cardId: string;
  status: MasteryForecastStatus;
  /** ISO date string of the projected review at which interval_days would first reach MATURE_INTERVAL_DAYS. Null unless status === 'projected'. */
  predictedMatureDate: string | null;
  /** Number of additional successful reviews simulated to reach maturity. Null unless status === 'projected'. */
  reviewsRemaining: number | null;
}

/**
 * Projects when a single card will reach MATURE_INTERVAL_DAYS, by repeatedly
 * applying the SM-2 multiplicative growth step (interval = ceil(interval * ease_factor))
 * starting from the card's current interval_days/due_at, assuming every future
 * review is a passing grade (this is an optimistic "if you keep passing it" projection,
 * not a prediction of actual future grades).
 *
 * Status rules (in this order):
 *   1. card.interval_days >= MATURE_INTERVAL_DAYS -> 'already_mature' (predictedMatureDate/reviewsRemaining both null).
 *   2. card.repetitions < 2 -> 'insufficient_history' (predictedMatureDate/reviewsRemaining both null).
 *      Rationale: SM-2's first two successful repetitions use fixed intervals
 *      (I(1)=1, I(2)=6), not the card's own ease_factor, so there is no
 *      established multiplicative growth trend to extrapolate yet.
 *   3. Otherwise, simulate forward from { interval: card.interval_days, dueAt: new Date(card.due_at) }:
 *      each step: interval = Math.ceil(interval * card.ease_factor); dueAt = dueAt + interval days; reviews += 1.
 *      Stop when interval >= MATURE_INTERVAL_DAYS (status 'projected', predictedMatureDate = dueAt.toISOString(), reviewsRemaining = reviews)
 *      or when reviews reaches MAX_SIMULATED_REVIEWS without reaching the threshold (status 'insufficient_history', defensive fallback that should not occur given ease_factor's 1.3 floor, but must be handled rather than looping forever).
 */
export function computeCardMasteryForecast(card: Card, now: Date): CardMasteryForecast;

export interface DeckMasteryForecast {
  totalCards: number;
  alreadyMatureCount: number;
  projectedCount: number;
  insufficientHistoryCount: number;
  /** Median predictedMatureDate (ISO date string) across cards with status 'projected'. Null if there are none. */
  medianPredictedMatureDate: string | null;
  /** Up to the 10 cards furthest from maturity among status === 'projected', sorted by predictedMatureDate descending (furthest-out first). Cards with 'insufficient_history' or 'already_mature' are excluded from this list. */
  furthestFromMastery: CardMasteryForecast[];
}

/** Aggregates computeCardMasteryForecast across every card in a deck. */
export function computeDeckMasteryForecast(cards: Card[], now: Date): DeckMasteryForecast;
```

Notes:
- `now` is currently unused by `computeCardMasteryForecast`'s math (the simulation is anchored on `card.due_at`, not `now`) — accept it as a parameter anyway for API symmetry with the rest of the codebase (e.g. `computeCardDecayRisk(card, now)` in `analytics.ts` takes `now` even though some of its branches don't use every field) and so a future ticket could add an "already overdue, projection may be stale" caveat without an API break. Do not use it to gate/change behavior in this ticket.
- Median calculation: convert each candidate `predictedMatureDate` to a timestamp (`Date.parse`), take the standard median (average the two middle values for an even count, matching the median helper already used in `src/lib/study/insights.ts`'s `computeMedianReviewsToMaturity` for precedent — you do not need to import that helper, just replicate the same median logic locally), then format back via `new Date(medianMs).toISOString()`.

### 2. `src/lib/study/masteryForecast.test.ts`

Vitest unit tests (see "Suggested tests" below), following the existing style of `src/lib/study/insights.test.ts`.

### 3. `src/lib/firestore/masteryForecast.ts` (`import 'server-only'`)

```ts
import 'server-only';
import type { DeckMasteryForecast } from '@/lib/study/masteryForecast';

export async function getDeckMasteryForecast(deckId: string, ownerId: string, now?: Date): Promise<DeckMasteryForecast>;
```

Implementation: `await assertDeckOwnership(deckId, ownerId)`, `const cards = await listCards(deckId, ownerId)`, `return computeDeckMasteryForecast(cards, now ?? new Date())`.

### 4. `src/lib/actions/masteryForecast.ts` (`'use server'`)

```ts
'use server';

export async function getDeckMasteryForecastAction(deckId: string): Promise<DeckMasteryForecast>;
```

Implementation: validate `deckId` with `z.string().min(1).parse(deckId)`, resolve `ownerId` via `getCurrentUserId()`, call `getDeckMasteryForecast(deckId, ownerId)`.

### 5. `src/components/analytics/MasteryForecast.tsx` (`'use client'`)

```tsx
interface MasteryForecastProps {
  deckId: string;
}
export default function MasteryForecast({ deckId }: MasteryForecastProps): JSX.Element;
```

- `useQuery({ queryKey: ['deckMasteryForecast', deckId], queryFn: () => getDeckMasteryForecastAction(deckId) })`.
- Renders a `<section>` titled "Predicted mastery" with a summary line (e.g. "`{alreadyMatureCount}` already mature · `{projectedCount}` on track · `{insufficientHistoryCount}` not enough history yet") and, if `medianPredictedMatureDate` is non-null, a highlighted stat showing the formatted median date (use a `date-fns`-free `Intl.DateTimeFormat` the same way `DeckInsights.tsx`'s `DAY_LABEL` formatter does: `new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })`).
- Below the summary, list `furthestFromMastery` (if non-empty) as rows showing each card's predicted date and `reviewsRemaining`; otherwise show a `<p className="text-sm text-muted">` empty-state message ("Not enough review history yet to project mastery dates.").
- Must not crash if the query errors or the deck has zero cards (`totalCards === 0`) — show an appropriate empty state in that case too.

## Exact, minimal touchpoint in existing files

**`src/components/DeckInsights.tsx`** — exactly two additive lines, nothing else in this file may change:
1. Add one new import line, placed immediately after the existing `import AccuracyTrendChart from '@/components/charts/AccuracyTrendChart';` line:
   ```ts
   import MasteryForecast from '@/components/analytics/MasteryForecast';
   ```
2. Add one new JSX line as the **very last child**, appended immediately after the existing `<LapseRateChart lapseRate={data.lapseRate} />` line and before the closing `</div>` of the top-level `<div className="space-y-10">`:
   ```tsx
   <MasteryForecast deckId={deckId} />
   ```

If another ticket (AN01, AN03, AN05) has already appended its own line(s) in the same two spots, add yours immediately after theirs (still before the closing `</div>` / among the trailing imports) — do not reorder or remove anything already present. Do not touch `src/lib/study/analytics.ts`, `src/lib/study/insights.ts`, `src/lib/firestore/insights.ts`, `src/components/GlobalAnalytics.tsx`, or `src/types/index.ts`.

## Data-modeling decisions

- No schema changes. `CardMasteryForecast`/`DeckMasteryForecast` are brand-new types defined and exported from `src/lib/study/masteryForecast.ts` (not added to `src/types/index.ts`).
- The projection is optimistic/deterministic (assumes every future review passes) — this is a stated simplification, not a bug. Do not attempt to model lapse probability in this ticket.
- `MATURE_INTERVAL_DAYS = 21` is a locally-defined constant matching the rest of the codebase's convention (see Background) — do not change its value.

## UI integration point

`src/app/(app)/decks/[id]/insights/page.tsx` already renders `<DeckInsights deckId={deck.id} initialInsights={insights} />` — no route/page changes needed. The new mastery-forecast section appears automatically once the `DeckInsights.tsx` touchpoint above lands.

## Explicit out-of-scope items

- No probabilistic/ML-based forecasting — pure deterministic extrapolation only, as specified.
- No per-card detail page or drill-down — the deck-level summary + top-10 list is the full UI scope.
- No changes to `GlobalAnalytics.tsx`, `analytics.ts`, or `insights.ts`.
- No UI control to change `MATURE_INTERVAL_DAYS` or `MAX_SIMULATED_REVIEWS`.

## Acceptance criteria (mechanically verifiable)

- [ ] `src/lib/study/masteryForecast.ts`, `src/lib/study/masteryForecast.test.ts`, `src/lib/firestore/masteryForecast.ts`, `src/lib/actions/masteryForecast.ts`, `src/components/analytics/MasteryForecast.tsx` exist with the exported names/signatures specified above.
- [ ] `computeCardMasteryForecast`, `computeDeckMasteryForecast`, `CardMasteryForecast`, `DeckMasteryForecast`, `MasteryForecastStatus`, `MATURE_INTERVAL_DAYS`, `MAX_SIMULATED_REVIEWS` are exported from `src/lib/study/masteryForecast.ts` with exactly those names.
- [ ] `git diff` shows changes to `src/components/DeckInsights.tsx` consisting only of one added import line and one added JSX line (plus, if AN01/AN03/AN05 landed first, their own equally-isolated lines already present) — no existing line modified.
- [ ] No changes anywhere to `src/lib/study/analytics.ts`, `src/lib/study/insights.ts`, `src/lib/firestore/insights.ts`, `src/components/GlobalAnalytics.tsx`, or `src/types/index.ts`.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npx vitest run src/lib/study/masteryForecast.test.ts` passes.
- [ ] Existing tests are unaffected: `npx vitest run src/lib/study/insights.test.ts src/lib/study/analytics.test.ts` still pass unchanged.
- [ ] The simulation loop in `computeCardMasteryForecast` is provably bounded (capped by `MAX_SIMULATED_REVIEWS`) — verified by a test that would otherwise infinite-loop without the cap.

## Suggested tests to add (`src/lib/study/masteryForecast.test.ts`)

- `interval_days >= 21` -> `status: 'already_mature'`, both date/reviewsRemaining null.
- `repetitions === 0` and `repetitions === 1` -> `status: 'insufficient_history'`.
- `repetitions === 2`, `interval_days: 6`, a known `ease_factor` (e.g. `1.3`) -> deterministic `status: 'projected'` with a hand-computed `predictedMatureDate` and `reviewsRemaining` (walk the math by hand in the test comment to make the expectation self-evident).
- A higher `ease_factor` (e.g. `2.5`) reaches maturity in fewer simulated reviews than a lower one, all else equal.
- The `MAX_SIMULATED_REVIEWS` cap is honored (construct a case, even if synthetic/unrealistic given real app invariants, that would not converge within the cap, and assert `status: 'insufficient_history'` rather than an infinite loop/hang).
- `computeDeckMasteryForecast` on an empty `cards` array returns all-zero counts and `medianPredictedMatureDate: null`.
- `computeDeckMasteryForecast` correctly counts a mix of already-mature/insufficient/projected cards and computes the median across only the `'projected'` subset.
- `furthestFromMastery` is capped at 10 entries and sorted furthest-out first.
