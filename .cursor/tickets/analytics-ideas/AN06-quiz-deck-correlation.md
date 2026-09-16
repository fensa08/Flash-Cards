# AN06 — Cross-source correlation (quiz score vs. flashcard review)

**Repo root:** `flash-cards-app/` (i.e. `/Users/stefan/Desktop/projects/flash-cards-app/flash-cards-app`). Read `AGENTS.md` at that root first and follow its conventions. This ticket is fully self-contained — implement it using only this file and the live codebase.

## Goal

Show whether a user's flashcard review activity on a topic correlates with their quiz performance on related material, by letting the user manually link a quiz to a deck and then visualizing quiz-attempt scores alongside that deck's recent review accuracy.

## Background you can rely on (verified against the current codebase)

- `Quiz` (`src/types/index.ts`): `id`, `title`, `sourceType: 'material' | 'course'`, `sourceId`, `questions`, `createdAt`. **Quizzes have no relationship to flashcard decks today** — `sourceId` points at a `Material` or `Course`, never a `Deck`.
- `QuizAttempt` (`src/types/index.ts`): `id`, `quizId`, `answers`, `score`, `total`, `completedAt` (ISO string).
- `Deck` (`src/types/index.ts`): `id`, `name`, `created_at`, `card_count`. No link field to any quiz/material/course.
- `getQuiz(quizId, ownerId): Promise<Quiz | null>` is exported from `src/lib/firestore/quizzes.ts` — it already verifies ownership (returns `null` if the quiz doesn't exist or isn't owned by `ownerId`). `listAttemptsForQuiz(quizId, ownerId): Promise<QuizAttempt[]>` is also exported from the same file and also verifies ownership internally.
- `assertDeckOwnership(deckId, ownerId): Promise<void>` is exported from `src/lib/firestore/decks.ts` (throws if the deck doesn't exist or isn't owned by `ownerId`).
- `listAllReviews(deckId): Promise<ReviewRecord[]>` is exported from `src/lib/firestore/reviews.ts` (all-time review history for a deck).
- `countsAsKnown(response: ResponseType): boolean` is exported from `src/lib/study/insights.ts` — safe read-only import.
- `getCurrentUserId(): Promise<string>` is exported from `src/lib/auth.ts`.

## Data-modeling decision (must be followed exactly — this is the load-bearing decision for this ticket)

**Do not add any field to the existing `Quiz`, `Deck`, or `QuizAttempt` interfaces or their Firestore documents.** Instead, introduce a brand-new, wholly independent link record:

- New Firestore top-level collection: **`quizDeckLinks`**. **One document per quiz, keyed by `quizId` as the document ID** (`adminDb.collection('quizDeckLinks').doc(quizId)`). Keying by `quizId` enforces "at most one linked deck per quiz" for this v1 (a deck may be linked from multiple quizzes; a quiz may link to at most one deck).
- Document fields:
  ```
  {
    deckId: string,
    ownerId: string,
    createdAt: Timestamp,
  }
  ```
- New type, appended **at the very end** of `src/types/index.ts`, under a new section comment unique to this ticket:
  ```ts
  // ---------------------------------------------------------------------------
  // Quiz <-> deck correlation link (AN06)
  // ---------------------------------------------------------------------------

  export interface QuizDeckLink {
    quizId: string;
    deckId: string;
    createdAt: string;
  }
  ```
  **Do not** modify, rename, or reorder any existing interface/type in `src/types/index.ts` (in particular, do not touch `Quiz`, `Deck`, or `QuizAttempt`). Only append the block above at the end of the file (if AN04's ticket already appended its own section first, add this section immediately after it — both are additive, order between them doesn't matter).

This approach is deliberately the simplest one that cannot break any existing `Quiz`/`OverallAnalytics` consumer: nothing about the shape of `Quiz`, `getOverallAnalytics`, or any existing quiz UI changes. The link is purely additive and only read/written by this ticket's own new files.

## Exact new file(s) to create

### 1. `src/lib/study/correlation.ts` (pure, no `server-only`, no Firebase imports)

```ts
import type { QuizAttempt, ReviewRecord } from '@/types';
import { countsAsKnown } from './insights';

export interface QuizDeckCorrelationPoint {
  /** The quiz attempt's completedAt, as an ISO string (copied through unchanged). */
  attemptCompletedAt: string;
  quizScorePct: number;
  /**
   * Flashcard review accuracy (countsAsKnown ratio) for the linked deck's
   * reviews with `answeredAt` in the 7-day window immediately BEFORE this
   * attempt's `completedAt` (i.e. `[completedAt - 7d, completedAt)`).
   * Null if there were zero such reviews (nothing to correlate against for
   * that attempt).
   */
  deckAccuracyPct7dBefore: number | null;
}

export interface QuizDeckCorrelation {
  points: QuizDeckCorrelationPoint[];
  /**
   * Pearson correlation coefficient between quizScorePct and
   * deckAccuracyPct7dBefore, computed only across points where
   * deckAccuracyPct7dBefore is non-null. Null if fewer than 2 such points
   * exist (correlation is undefined/meaningless below 2 points).
   */
  correlationCoefficient: number | null;
}

/**
 * `attempts` should be every QuizAttempt for one quiz (any order); `reviews`
 * should be every ReviewRecord for that quiz's linked deck (any order).
 * Points are returned sorted ascending by attemptCompletedAt.
 */
export function computeQuizDeckCorrelation(
  attempts: QuizAttempt[],
  reviews: ReviewRecord[],
): QuizDeckCorrelation;
```

Implementation requirements:
- `quizScorePct = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0`.
- For each attempt, filter `reviews` to `answeredAt >= (completedAt - 7 days) && answeredAt < completedAt`; if that filtered set is empty, `deckAccuracyPct7dBefore: null`; otherwise `knownCount / filteredCount` (via `countsAsKnown`), as a value in `[0, 1]` (not a rounded percentage — keep it as a 0-1 ratio for numerical correlation, distinct from `quizScorePct`'s 0-100 scale; document this asymmetry explicitly in a code comment since it's intentional and easy to get wrong).
- Pearson correlation formula, over the non-null-paired subset `{(x_i, y_i)}` where `x_i = quizScorePct`, `y_i = deckAccuracyPct7dBefore`:
  ```
  r = Σ((x_i - x̄)(y_i - ȳ)) / sqrt(Σ(x_i - x̄)² * Σ(y_i - ȳ)²)
  ```
  Return `null` if fewer than 2 non-null pairs, or if either denominator sum is `0` (no variance — correlation undefined, not `NaN`/`Infinity`).

### 2. `src/lib/study/correlation.test.ts`

Vitest unit tests (see "Suggested tests" below), following the existing style of `src/lib/study/insights.test.ts`.

### 3. `src/lib/firestore/quizDeckLinks.ts` (`import 'server-only'`)

```ts
import 'server-only';
import type { QuizDeckLink } from '@/types';

export async function getQuizDeckLink(quizId: string, ownerId: string): Promise<QuizDeckLink | null>;
export async function setQuizDeckLink(quizId: string, deckId: string, ownerId: string): Promise<QuizDeckLink>;
```

Implementation:
- `getQuizDeckLink`: `const quiz = await getQuiz(quizId, ownerId); if (!quiz) throw new Error('Quiz not found');` then read `adminDb.collection('quizDeckLinks').doc(quizId)`; return `null` if it doesn't exist or its `ownerId` field doesn't match (defense in depth even though the doc ID is quiz-scoped); otherwise map to `QuizDeckLink`.
- `setQuizDeckLink`: verify quiz ownership via `getQuiz(quizId, ownerId)` (throw `'Quiz not found'` if null) **and** deck ownership via `assertDeckOwnership(deckId, ownerId)` (from `src/lib/firestore/decks.ts`) before writing; then `.set({ deckId, ownerId, createdAt: FieldValue.serverTimestamp() })` (full overwrite is fine since the doc is keyed 1:1 by quizId — no merge needed); read back and return the `QuizDeckLink`.

### 4. `src/lib/firestore/correlation.ts` (`import 'server-only'`)

```ts
import 'server-only';
import type { QuizDeckCorrelation } from '@/lib/study/correlation';

/** Returns null if the quiz has no linked deck yet (caller should prompt to link one). */
export async function getQuizDeckCorrelation(quizId: string, ownerId: string): Promise<QuizDeckCorrelation | null>;
```

Implementation: `const link = await getQuizDeckLink(quizId, ownerId); if (!link) return null;` then `Promise.all([listAttemptsForQuiz(quizId, ownerId), listAllReviews(link.deckId)])`, then `return computeQuizDeckCorrelation(attempts, reviews)`.

### 5. `src/lib/actions/correlation.ts` (`'use server'`)

```ts
'use server';

export async function getQuizDeckLinkAction(quizId: string): Promise<QuizDeckLink | null>;
export async function setQuizDeckLinkAction(quizId: string, deckId: string): Promise<QuizDeckLink>;
export async function getQuizDeckCorrelationAction(quizId: string): Promise<QuizDeckCorrelation | null>;
```

Implementation: validate string params with `z.string().min(1).parse(...)` (matching the pattern in `src/lib/actions.ts`), resolve `ownerId` via `getCurrentUserId()`, delegate to the corresponding firestore functions above.

### 6. `src/components/testing/QuizDeckCorrelation.tsx` (`'use client'`)

```tsx
interface QuizDeckCorrelationProps {
  quizId: string;
  quiz: Quiz; // for the title/back-link only
  decks: Deck[]; // for the deck-picker when no link exists yet — fetched by the page (see route below) via the existing getDecks() action from src/lib/actions.ts
}
export default function QuizDeckCorrelation(props: QuizDeckCorrelationProps): JSX.Element;
```

- `useQuery` for `getQuizDeckLinkAction(quizId)` (`queryKey: ['quizDeckLink', quizId]`).
- If no link exists: render a simple deck picker (`<select>` populated from `decks`, plus a "Link deck" button) wired to a `useMutation` calling `setQuizDeckLinkAction(quizId, deckId)`, invalidating `['quizDeckLink', quizId]` and `['quizDeckCorrelation', quizId]` on success.
- If a link exists: `useQuery` for `getQuizDeckCorrelationAction(quizId)` (`queryKey: ['quizDeckCorrelation', quizId]`); render the `correlationCoefficient` as a headline stat (e.g. "Correlation: 0.62" or "Not enough data yet" when `null`), plus a list/simple scatter of `points` (attempt date, quiz score %, deck accuracy % — format the 0-1 ratio as a rounded percentage for display only, per the asymmetry noted in `correlation.ts`). Follow the general visual idiom already used in `src/components/testing/QuizRunner.tsx` (`rounded-2xl bg-surface border border-border shadow-sm p-5`-style cards) for consistency, since this component lives in the same `src/components/testing/` directory.
- Must not crash if either query errors or a quiz has zero attempts (`points: []`, `correlationCoefficient: null`).

### 7. `src/app/(app)/testing/quizzes/[id]/correlation/page.tsx` (new route, Server Component)

```tsx
export const dynamic = 'force-dynamic';
export default async function QuizCorrelationPage({ params }: { params: Promise<{ id: string }> }): Promise<JSX.Element>;
```

Implementation: mirror `src/app/(app)/testing/quizzes/[id]/page.tsx`'s pattern — `const { id } = await params;`, `const quiz = await getQuizAction(id)` (from `src/lib/actions/testing.ts`, already exported, read-only import), `if (!quiz) notFound();`, `const decks = await getDecks()` (from `src/lib/actions.ts`, already exported, read-only import), then render `<QuizDeckCorrelation quizId={id} quiz={quiz} decks={decks} />`. Include a simple `<Link href={\`/testing/quizzes/${id}\`}>← Back to quiz</Link>` at the top, matching the back-link idiom already used in `QuizRunner.tsx`.

## Exact, minimal touchpoint in existing files

**None.** This ticket touches zero lines of any pre-existing file except the additive, append-only block in `src/types/index.ts` specified above. In particular, do **not** edit `src/components/testing/QuizRunner.tsx`, `src/components/testing/QuizList.tsx`, or `src/app/(app)/testing/quizzes/[id]/page.tsx` — the new correlation view is reachable only via its own new route (`/testing/quizzes/[id]/correlation`), navigated to directly (no in-app link is added from the existing quiz pages in this ticket; see Out-of-scope).

## UI integration point

The new route `src/app/(app)/testing/quizzes/[id]/correlation/page.tsx` (see file #7 above) is the entire UI integration surface for this ticket.

## Explicit out-of-scope items

- No automatic quiz-to-deck matching heuristic (e.g. inferring a link from a shared `courseId`/title similarity) — manual linking via the deck picker only, as specified.
- No support for linking a quiz to more than one deck, or a many-to-many relationship — one optional deck per quiz, enforced by the `quizId`-keyed document.
- No in-app navigation link added from the existing quiz list/detail pages to the new correlation page (the route exists and is reachable by URL; wiring a nav link from `QuizList.tsx`/`QuizRunner.tsx` is explicitly deferred to avoid touching those shared files in this ticket).
- No statistical significance testing beyond the raw Pearson coefficient (e.g. no p-value/confidence interval).
- No changes to `getOverallAnalytics`, `OverallAnalyticsDashboard.tsx`, or any existing quiz scoring/attempt logic.

## Acceptance criteria (mechanically verifiable)

- [ ] `src/lib/study/correlation.ts`, `src/lib/study/correlation.test.ts`, `src/lib/firestore/quizDeckLinks.ts`, `src/lib/firestore/correlation.ts`, `src/lib/actions/correlation.ts`, `src/components/testing/QuizDeckCorrelation.tsx`, `src/app/(app)/testing/quizzes/[id]/correlation/page.tsx` exist with the exported names/signatures specified above.
- [ ] `computeQuizDeckCorrelation`, `QuizDeckCorrelationPoint`, `QuizDeckCorrelation` are exported from `src/lib/study/correlation.ts` with exactly those names.
- [ ] `QuizDeckLink` is appended at the end of `src/types/index.ts` exactly as specified, with no existing type (especially `Quiz`, `Deck`, `QuizAttempt`) modified, renamed, or reordered.
- [ ] `git diff` shows zero changes to any pre-existing file other than `src/types/index.ts` (append-only).
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npx vitest run src/lib/study/correlation.test.ts` passes.
- [ ] Existing tests are unaffected: `npx vitest run src/lib/study/insights.test.ts` and any existing quiz-related tests still pass unchanged.
- [ ] `setQuizDeckLink` rejects (throws) when called with a `deckId` not owned by `ownerId`, and when called with a `quizId` not owned by `ownerId`.
- [ ] `getQuizDeckCorrelation` returns `null` (not an error) for a quiz with no link yet.

## Suggested tests to add (`src/lib/study/correlation.test.ts`)

- An attempt with reviews in the preceding 7-day window computes the correct `deckAccuracyPct7dBefore` ratio (mixed `know`/`dont_know` responses).
- An attempt with zero reviews in that window yields `deckAccuracyPct7dBefore: null`.
- Reviews outside the 7-day window (either before the window start or on/after `completedAt`) are excluded.
- `quizScorePct` handles `total: 0` without dividing by zero (returns `0`).
- `correlationCoefficient` is `null` when fewer than 2 non-null-paired points exist.
- `correlationCoefficient` is `null` (not `NaN`) when all `quizScorePct` values are identical (zero variance).
- A hand-constructed dataset with a clear positive relationship (higher deck accuracy paired with higher quiz scores) yields a `correlationCoefficient` close to `1` (assert within a tolerance, e.g. `> 0.9`).
- `points` are sorted ascending by `attemptCompletedAt` even when `attempts` is passed in unsorted.
