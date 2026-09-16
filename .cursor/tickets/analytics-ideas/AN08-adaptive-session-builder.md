# AN08 — Adaptive study session builder

**Repo root:** `flash-cards-app/` (i.e. `/Users/stefan/Desktop/projects/flash-cards-app/flash-cards-app`). Read `AGENTS.md` at that root first and follow its conventions. This ticket is fully self-contained — implement it using only this file and the live codebase.

## Goal

Build a cross-deck "adaptive session" that greedily assembles a time-budgeted, interleaved queue of the user's most-overdue cards from their weakest decks, and let the user actually study that queue end-to-end.

## Corrected premise (read this before implementing)

The originating brief for this feature claimed `computeCardDecayRisk` "only exists as an internal aggregation step in `analytics.ts` and is not exported/exposed per-card externally." **This is factually incorrect as of the current codebase** — verify it yourself: `src/lib/study/analytics.ts` already has:
```ts
export function computeCardDecayRisk(card: Card, now: Date): number { ... }
```
It is a top-level, already-exported, per-card function. This ticket's design below **imports and reuses it directly** (read-only import, no edit to `analytics.ts`) rather than treating this as a gap that needs filling. Do not re-implement decay-risk math anywhere in this ticket's new files.

## The locked algorithm (implement exactly as specified — do not redesign it)

1. Get the priority list of weakest/highest-decay decks: reuse `getGlobalAnalytics(ownerId, now)` (exported from `src/lib/firestore/analytics.ts`) and take its `.priorityList: PriorityItem[]` (already computed via `buildPriorityList`, already rank-ordered weakest-first, already capped at 5 by default). Do not call `buildPriorityList` yourself or re-derive `TopicMetrics` — just consume `getGlobalAnalytics`'s already-computed `priorityList` (and `topics`, if convenient for deck names) directly.
2. For each priority deck, in the rank order given by `priorityList`, pull its overdue/due cards via `getDueCards(deckId, ownerId, now)` (exported from `src/lib/firestore/cards.ts`; already returns cards ordered `dueAt` ascending, i.e. most-overdue-first, per its own doc comment). Then **re-sort each deck's due cards by `computeCardDecayRisk(card, now)` descending** (most decayed first) — `getDueCards`'s `dueAt`-ascending order is a reasonable proxy but is not identical to decay-risk order (decay risk is `overdueDays / interval_days`, which also depends on the card's interval, not just how long it's been overdue), so this explicit re-sort is required, not redundant.
3. Estimate seconds/card from historical average review duration: cluster **all** of the user's reviews (across every deck) via `clusterSessions` (exported from `src/lib/study/analytics.ts`) and derive `secondsPerCard = totalDurationMs / totalReviewCount / 1000` summed across every `StudySession`, **falling back to a flat default of 12 seconds/card** when there isn't enough history (fewer than a minimum review-count threshold — see `computeAverageSecondsPerCard` below for the exact threshold).
4. Greedily add cards deck-by-deck (weakest deck first, per the priority order from step 1) until the running time estimate (`cardsAdded * secondsPerCard`) reaches the requested time budget (default 20 minutes), **capping how many cards can come from any single deck** so the session isn't 100% one topic (cap = a fixed share of the total card budget, see `MAX_DECK_SHARE` below).
5. **Interleave** the picks across decks round-robin (one card from the current highest-priority deck with remaining capacity, then one from the next, cycling back to the top), rather than exhausting one deck's cards before moving to the next.
6. Return an ephemeral/virtual, non-persisted session queue (`SessionQueueItem[]`) — nothing about this queue is written to Firestore; it exists only for the duration of one study session, re-derived fresh each time the user requests a new adaptive session. `src/components/StudySession.tsx` is extended (additively) to accept this pre-resolved queue instead of always requiring a single `deckId`/`Deck` — see the exact interface change specified below.

## Background you can rely on (verified against the current codebase)

- `PriorityItem` (`src/types/index.ts`): `{ deckId, name, reason, reasonLabel }`.
- `Card` (`src/types/index.ts`): `id`, `deck_id`, `question`, `answer`, `weight`, `times_seen`, `created_at`, `ease_factor`, `interval_days`, `repetitions`, `due_at`.
- `getDueCards(deckId, ownerId, now?): Promise<Card[]>` is exported from `src/lib/firestore/cards.ts`.
- `listDecks(ownerId): Promise<Deck[]>` is exported from `src/lib/firestore/decks.ts`; `listAllReviews(deckId): Promise<ReviewRecord[]>` is exported from `src/lib/firestore/reviews.ts`.
- `clusterSessions(reviews: ReviewRecord[]): StudySession[]` and `computeCardDecayRisk(card, now)` are both exported from `src/lib/study/analytics.ts`. `StudySession` is `{ start: Date; end: Date; durationMs: number; reviewCount: number }`.
- `getCurrentUserId(): Promise<string>` is exported from `src/lib/auth.ts`.
- `submitAnswerAction(deckId, cardId, response)` is exported from `src/lib/actions.ts` — this is the existing per-card grading action, reused unchanged by the new multi-deck study flow (each card in a cross-deck queue still belongs to a specific `deckId`, so grading it is just calling this same action with that card's own `deckId`).
- `src/components/StudySession.tsx` (current, full contents relevant here):
  ```tsx
  interface StudySessionProps {
    deck: Deck;
  }
  export default function StudySession({ deck }: StudySessionProps) { ... }
  ```
  It currently: fetches the next due card via `getNextCardAction(deck.id, excludedIds)` (single-deck), submits answers via `submitAnswerAction(deck.id, currentCard.id, response)`, shows `deck.name` in the header and `deck.card_count` as the progress-bar denominator, and routes `onExit`/"Back to Decks" to `/testing/flashcards`.
- `src/app/(app)/decks/[id]/study/page.tsx` (existing, unchanged by this ticket) renders `<StudySession deck={deck} />` — a single, required `deck` prop, exactly as today.
- `src/components/DeckList.tsx` (existing) renders a top toolbar:
  ```tsx
  <div className="flex justify-end mb-4">
    <Link href="/analytics" className="text-sm font-medium text-body hover:text-accent transition-colors px-4 py-2 rounded-lg bg-surface border border-border">
      Analytics
    </Link>
  </div>
  ```

## Exact new file(s) to create

### 1. `src/lib/study/sessionBuilder.ts` (pure, no `server-only`, no Firebase imports)

```ts
import type { Card } from '@/types';
import type { StudySession } from './analytics';

export const DEFAULT_SECONDS_PER_CARD = 12;
/** Below this many total historical reviews, the estimate is considered too noisy — fall back to DEFAULT_SECONDS_PER_CARD. */
export const MIN_REVIEWS_FOR_ESTIMATE = 10;
/** No single deck may contribute more than this fraction of the total card budget. */
export const MAX_DECK_SHARE = 0.6;

/**
 * Average seconds/card across `sessions`, weighted by review count
 * (sum of all session durationMs / sum of all session reviewCount, in
 * seconds), or DEFAULT_SECONDS_PER_CARD if the total reviewCount across
 * all sessions is below MIN_REVIEWS_FOR_ESTIMATE.
 */
export function computeAverageSecondsPerCard(sessions: StudySession[]): number;

export interface SessionBuilderDeckInput {
  deckId: string;
  deckName: string;
  /** This deck's due cards, already sorted by decay risk descending (caller's responsibility — see ticket AN08 step 2). Rank order across the array of SessionBuilderDeckInput passed to buildAdaptiveSessionQueue must be priority order, weakest deck first. */
  dueCards: Card[];
}

export interface SessionQueueItem {
  card: Card;
  deckId: string;
  deckName: string;
}

export interface BuildSessionOptions {
  budgetSeconds: number;
  secondsPerCard: number;
}

/**
 * Implements algorithm steps 4-5 from ticket AN08:
 *   - totalBudgetCards = Math.floor(budgetSeconds / secondsPerCard); returns [] if <= 0.
 *   - maxPerDeck = Math.max(1, Math.ceil(totalBudgetCards * MAX_DECK_SHARE)).
 *   - For each deck (in the given priorityDecks order), take at most
 *     `maxPerDeck` cards from the front of its (already decay-sorted)
 *     dueCards as that deck's candidate pool.
 *   - Round-robin across decks in priorityDecks order: repeatedly loop over
 *     decks, popping one not-yet-used card from the front of each deck's
 *     remaining candidate pool per pass (skipping decks whose pool is
 *     exhausted), appending each popped card to the output queue, until
 *     either totalBudgetCards items have been added or every deck's pool
 *     is exhausted.
 */
export function buildAdaptiveSessionQueue(
  priorityDecks: SessionBuilderDeckInput[],
  options: BuildSessionOptions,
): SessionQueueItem[];
```

### 2. `src/lib/study/sessionBuilder.test.ts`

Vitest unit tests (see "Suggested tests" below), following the existing style of `src/lib/study/analytics.test.ts`/`insights.test.ts`.

### 3. `src/lib/firestore/sessionBuilder.ts` (`import 'server-only'`)

```ts
import 'server-only';
import type { SessionQueueItem } from '@/lib/study/sessionBuilder';

/**
 * Orchestrates algorithm steps 1-6 end-to-end for one user:
 *   1. const { priorityList } = await getGlobalAnalytics(ownerId, now);
 *   2. For each item in priorityList (in that exact order), fetch
 *      getDueCards(item.deckId, ownerId, now), then sort that array by
 *      computeCardDecayRisk(card, now) descending. Skip any priority deck
 *      whose due-card list is empty (but keep the relative order of the
 *      remaining decks).
 *   3. secondsPerCard: fetch listDecks(ownerId), Promise.all listAllReviews
 *      per deck, flatten, clusterSessions(allReviews), then
 *      computeAverageSecondsPerCard(sessions).
 *   4-6. Map the filtered priority decks + their sorted due cards into
 *      SessionBuilderDeckInput[] (deckName from priorityList's `.name`),
 *      then buildAdaptiveSessionQueue(priorityDecks, { budgetSeconds, secondsPerCard }).
 */
export async function buildAdaptiveSession(
  ownerId: string,
  now: Date,
  budgetSeconds: number,
): Promise<SessionQueueItem[]>;
```

### 4. `src/lib/actions/sessionBuilder.ts` (`'use server'`)

```ts
'use server';

export async function buildAdaptiveSessionAction(budgetMinutes?: number): Promise<SessionQueueItem[]>;
```

Implementation: validate `budgetMinutes` with `z.number().int().min(1).max(180).optional().parse(budgetMinutes)`, default to `20` when omitted, resolve `ownerId` via `getCurrentUserId()`, call `buildAdaptiveSession(ownerId, new Date(), (budgetMinutes ?? 20) * 60)`.

### 5. `src/components/study/AdaptiveSessionLauncher.tsx` (`'use client'`)

```tsx
export default function AdaptiveSessionLauncher(): JSX.Element;
```

A single button/link (styled consistently with the existing "Analytics" link in `DeckList.tsx`'s toolbar — reuse its exact className for visual consistency) that navigates to `/study/adaptive` (a plain `next/link` `<Link>`, no data fetching in this component — the target page does the fetching). Label it "Adaptive session".

### 6. `src/components/study/AdaptiveSessionRunner.tsx` (`'use client'`)

```tsx
export default function AdaptiveSessionRunner(): JSX.Element;
```

- `useQuery({ queryKey: ['adaptiveSession'], queryFn: () => buildAdaptiveSessionAction(20) })` (fixed 20-minute default budget for this ticket's shipped UI — no budget picker required, though `buildAdaptiveSessionAction` accepts a param for future flexibility).
- While loading: a spinner matching the existing idiom (`w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin`, as used in `StudySession.tsx`/`DeckInsights.tsx`).
- On error: an inline `text-danger` message.
- On success with a non-empty queue: render `<StudySession queue={data} />` (see the `StudySession.tsx` change below).
- On success with an **empty** queue (nothing due across any priority deck): a friendly empty state ("Nothing due right now — check back later!") with a link back to `/testing/flashcards`.

### 7. `src/app/(app)/study/adaptive/page.tsx` (new route)

```tsx
'use client';
export default function AdaptiveStudyPage(): JSX.Element {
  return <AdaptiveSessionRunner />;
}
```

(A thin client page is acceptable here since the data fetch happens via the Server Action + React Query inside `AdaptiveSessionRunner`, matching how `StudySession.tsx` itself is already a client component fetching via Server Actions rather than doing an SSR data fetch in its page — see `src/app/(app)/decks/[id]/study/page.tsx` for the precedent of a thin page wrapping a client data-fetching component, except that one does fetch the deck server-side; either approach — thin client page or a server page that does nothing but render the client component — is acceptable as long as `AdaptiveSessionRunner`'s own data fetching logic is unchanged from the spec above.)

## Exact, minimal touchpoint in existing files

### `src/components/StudySession.tsx` — additive prop/interface change only

Change the props interface from:
```ts
interface StudySessionProps {
  deck: Deck;
}
```
to:
```ts
interface StudySessionProps {
  deck?: Deck;
  /** When provided, plays this pre-resolved, possibly-cross-deck queue instead of fetching a single deck's due cards. Mutually exclusive with `deck` in practice (exactly one of the two is expected to be supplied by any given caller), but both are typed optional so existing single-deck callers (which always pass `deck`) do not need to change. */
  queue?: SessionQueueItem[];
}
```
Required behavior when `queue` is provided (all additive — must not change behavior for existing callers that only pass `deck`):
- Do **not** call `getNextCardAction`/`getDueCards` for a single deck. Instead, track a `currentIndex` into `queue` (starting at `0`) and derive `currentCard = queue[currentIndex]?.card ?? null`; the session is complete once `currentIndex >= queue.length`.
- `submitAnswerAction` is called with `queue[currentIndex].deckId` (not a single fixed `deck.id`) and `queue[currentIndex].card.id`; on success, advance `currentIndex` by 1 (the existing `excludedIds`/re-query logic used in single-deck mode is not needed in queue mode, since the queue is already a fixed, pre-resolved list — do not port that logic over).
- The header shows the **current queue item's** `deckName` (e.g. "Studying: {queue[currentIndex].deckName}") instead of a single fixed `deck.name`.
- The progress bar / "X reviewed of Y total" denominator becomes `queue.length` instead of `deck.card_count`.
- The "Reset weights" button (which calls `resetDeckWeightsAction(deck.id)`) is **not shown** in queue mode (there is no single deck to reset) — omit that button entirely when `queue` is provided.
- `onExit`/"Back to Decks" still routes to `/testing/flashcards` in both modes (no change needed there).
- When neither `deck` nor `queue` is provided (a caller bug), render a clear inline error rather than crashing (defensive only — no existing or new caller in this codebase should ever hit this branch).
- **The existing single-deck behavior (when only `deck` is passed and `queue` is `undefined`) must be provably unchanged** — this is the most important constraint on this file. Every existing line of logic that runs today when only `deck` is supplied must continue to run identically; the queue-mode logic must be additive branches (e.g. `if (queue) { ... } else { ...existing logic unchanged... }`), not a rewrite of the shared control flow.

### `src/components/DeckList.tsx` — exactly two additive lines, nothing else in this file may change

1. Add one new import line, placed immediately after the existing `import BulkImportModal from './BulkImportModal';` line:
   ```ts
   import AdaptiveSessionLauncher from '@/components/study/AdaptiveSessionLauncher';
   ```
2. Add one new JSX element inside the existing top toolbar `<div className="flex justify-end mb-4">`, immediately before the existing `<Link href="/analytics" ...>Analytics</Link>`:
   ```tsx
   <AdaptiveSessionLauncher />
   ```
   (Both elements now sit side-by-side inside the same flex container; do not change the container's className or remove the existing Analytics link.)

Do not touch any other line of `DeckList.tsx`. Do not touch `src/app/(app)/decks/[id]/study/page.tsx`, `src/lib/actions.ts`, `src/lib/firestore/cards.ts`, `src/lib/firestore/analytics.ts`, `src/lib/study/analytics.ts`, or `src/types/index.ts`.

## Data-modeling decisions

- No schema changes. No Firestore writes at all — the adaptive queue is fully ephemeral, recomputed fresh on every request. `SessionQueueItem`/`SessionBuilderDeckInput`/`BuildSessionOptions` are brand-new types defined and exported from `src/lib/study/sessionBuilder.ts` (not added to `src/types/index.ts`).
- Fixed constants (not user-configurable in this ticket's shipped UI): `DEFAULT_SECONDS_PER_CARD = 12`, `MIN_REVIEWS_FOR_ESTIMATE = 10`, `MAX_DECK_SHARE = 0.6`, default budget `20` minutes.

## UI integration point

- `src/components/DeckList.tsx`'s toolbar gains an "Adaptive session" launcher link (see touchpoint above), which navigates to the new `/study/adaptive` route.
- `/study/adaptive` (new page, file #7 above) is where the built queue is actually played, via the extended `StudySession` component.

## Explicit out-of-scope items

- No user-facing control for the time budget, `MAX_DECK_SHARE`, or `MIN_REVIEWS_FOR_ESTIMATE` — fixed defaults only.
- No persistence of adaptive-session history/results beyond the existing per-card `submitAnswerAction` review logging (which already happens identically to single-deck study — no new logging is added).
- No changes to `getDueCards`, `getGlobalAnalytics`, `buildPriorityList`, or `clusterSessions` themselves — all are consumed read-only.
- No change to the single-deck study route/behavior at `/decks/[id]/study` beyond the additive, backward-compatible `StudySession` prop change described above.
- No "resume an in-progress adaptive session after navigating away" support — closing/leaving the page discards the queue; reopening `/study/adaptive` builds a fresh one.

## Acceptance criteria (mechanically verifiable)

- [ ] `src/lib/study/sessionBuilder.ts`, `src/lib/study/sessionBuilder.test.ts`, `src/lib/firestore/sessionBuilder.ts`, `src/lib/actions/sessionBuilder.ts`, `src/components/study/AdaptiveSessionLauncher.tsx`, `src/components/study/AdaptiveSessionRunner.tsx`, `src/app/(app)/study/adaptive/page.tsx` exist with the exported names/signatures specified above.
- [ ] `buildAdaptiveSessionQueue`, `computeAverageSecondsPerCard`, `SessionQueueItem`, `SessionBuilderDeckInput`, `BuildSessionOptions`, `DEFAULT_SECONDS_PER_CARD`, `MIN_REVIEWS_FOR_ESTIMATE`, `MAX_DECK_SHARE` are exported from `src/lib/study/sessionBuilder.ts` with exactly those names.
- [ ] `git diff` on `src/components/DeckList.tsx` shows only one added import line and one added JSX element inside the existing toolbar `<div>` — no other line modified.
- [ ] `git diff` on `src/components/StudySession.tsx` shows only additive changes: the widened `StudySessionProps` type and new `if (queue) {...}` branches; every line of existing single-deck logic is still present and reachable when `queue` is `undefined`.
- [ ] No changes anywhere to `src/lib/firestore/cards.ts`, `src/lib/firestore/analytics.ts`, `src/lib/study/analytics.ts`, `src/lib/actions.ts`, `src/app/(app)/decks/[id]/study/page.tsx`, or `src/types/index.ts`.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npx vitest run src/lib/study/sessionBuilder.test.ts` passes.
- [ ] Existing tests are unaffected: `npx vitest run src/lib/study/analytics.test.ts src/lib/study/insights.test.ts` still pass unchanged.
- [ ] `buildAdaptiveSessionQueue` never returns more than `Math.floor(budgetSeconds / secondsPerCard)` items, and no single `deckId` contributes more than `Math.max(1, Math.ceil(totalBudgetCards * MAX_DECK_SHARE))` items to the result.
- [ ] `buildAdaptiveSessionQueue`'s output interleaves decks (verified by a test asserting the output is not simply each input deck's cards concatenated in blocks, when more than one deck has enough cards to matter).
- [ ] `<StudySession deck={someDeck} />` (no `queue` prop) compiles and behaves identically to before this ticket (same code path, same function calls) — verified by inspection/diff, since this repo has no existing automated test file for `StudySession.tsx` to run.

## Suggested tests to add (`src/lib/study/sessionBuilder.test.ts`)

- `computeAverageSecondsPerCard`: returns `DEFAULT_SECONDS_PER_CARD` when total reviewCount across sessions is below `MIN_REVIEWS_FOR_ESTIMATE`; returns the correctly weighted average (`totalDurationMs / totalReviewCount / 1000`) when at/above the threshold.
- `buildAdaptiveSessionQueue`: with a `budgetSeconds` too small for even one card (`secondsPerCard > budgetSeconds`), returns `[]`.
- `buildAdaptiveSessionQueue`: total returned items never exceeds `Math.floor(budgetSeconds / secondsPerCard)`.
- `buildAdaptiveSessionQueue`: with 3 decks each having far more due cards than the budget allows, no single deck contributes more than `maxPerDeck` items.
- `buildAdaptiveSessionQueue`: with 2 decks each having enough cards to fill the whole budget alone, the output alternates between the two decks (round-robin), rather than fully draining deck 1 before touching deck 2 — assert this directly (e.g. check that `output[0].deckId !== output[1].deckId` when both decks have candidates available).
- `buildAdaptiveSessionQueue`: a deck with an empty `dueCards` array contributes nothing and does not break the round-robin loop for the remaining decks.
- `buildAdaptiveSessionQueue`: priority order is respected — when the budget is smaller than the sum of all decks' `maxPerDeck` capacity, the higher-priority (earlier in `priorityDecks`) deck's cards are exhausted from its pool before the algorithm needs to skip it, but the round-robin still gives every deck a chance in each pass (i.e. verify the interleaving order matches the specified pop-one-per-deck-per-pass algorithm exactly, not a "fill deck 1 completely, then deck 2" greedy variant).
