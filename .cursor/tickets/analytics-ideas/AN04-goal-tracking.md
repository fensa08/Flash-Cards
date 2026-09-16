# AN04 — Goal tracking

**Repo root:** `flash-cards-app/` (i.e. `/Users/stefan/Desktop/projects/flash-cards-app/flash-cards-app`). Read `AGENTS.md` at that root first and follow its conventions. This ticket is fully self-contained — implement it using only this file and the live codebase.

## Goal

Let a signed-in user set a daily and/or weekly study goal (by study time or review count), and show their progress and a goal-adherence streak against it on the Account page.

## Background you can rely on (verified against the current codebase)

- There is **no persisted user-preferences/settings document anywhere in this codebase today**. `src/lib/profile.ts`'s `DisplayProfile` is derived live from the Firebase auth user only, with no Firestore-backed fields. This ticket introduces the first such document.
- `getCurrentUserId(): Promise<string>` and `getCurrentUserProfile()` are exported from `src/lib/auth.ts`.
- `adminDb` (a `firebase-admin` Firestore instance) is exported from `src/lib/firebase-admin.ts` — see any file under `src/lib/firestore/` for the exact import (`import { adminDb } from '@/lib/firebase-admin';`) and usage pattern (`adminDb.collection('...').doc('...')`).
- `listDecks(ownerId)` (from `src/lib/firestore/decks.ts`), `listAllReviews(deckId)` (from `src/lib/firestore/reviews.ts`), `clusterSessions(reviews)` and `computeStudyTimeMs(sessions, since?)` (both from `src/lib/study/analytics.ts`) are all already-exported, safe read-only imports for computing "how much has the user studied" without duplicating logic. `countsAsKnown` and `toDateKey` are exported from `src/lib/study/insights.ts`.
- `ReviewRecord` has `answeredAt: Date`; `clusterSessions` returns `StudySession[]` with `{ start: Date; end: Date; durationMs: number; reviewCount: number }`.
- `src/components/account/AccountDashboard.tsx` is a real (non-placeholder) client component rendering several cards, including a "DETAILS" card that currently has a **hardcoded, non-functional** "Daily study goal" control:
  ```tsx
  <div>
    <label className="mb-1.5 block text-[11.5px] font-medium text-[#6b6862]">
      Daily study goal
    </label>
    <button
      type="button"
      onClick={() => triggerTemplateModal('Daily Study Goal')}
      className="flex w-full items-center justify-between rounded-[10px] border border-[rgba(0,0,0,0.11)] bg-white px-3.5 py-2 text-[13px] text-[#16151a] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-black/25 cursor-pointer text-left"
    >
      <span>30 minutes</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  </div>
  ```
  This block is the exact and only piece of `AccountDashboard.tsx` this ticket may change.

## Data-modeling decision (must be followed exactly)

- New Firestore top-level collection: **`userGoals`**. **One document per user, keyed by `ownerId` as the document ID** (`adminDb.collection('userGoals').doc(ownerId)`) — this is the simplest viable option and avoids any query/index needs.
- Document fields (all top-level, flat):
  ```
  {
    dailyMetric: 'study_time_minutes' | 'review_count' | null,
    dailyTarget: number | null,
    weeklyMetric: 'study_time_minutes' | 'review_count' | null,
    weeklyTarget: number | null,
    updatedAt: Timestamp,
  }
  ```
  A `null` metric/target pair means "no goal configured for that period." Daily and weekly are independent — either, both, or neither may be set.
- New types, appended **at the very end** of `src/types/index.ts`, under a new section comment unique to this ticket:
  ```ts
  // ---------------------------------------------------------------------------
  // Goal tracking (AN04)
  // ---------------------------------------------------------------------------

  export type GoalMetric = 'study_time_minutes' | 'review_count';
  export type GoalPeriod = 'daily' | 'weekly';

  export interface StudyGoal {
    period: GoalPeriod;
    metric: GoalMetric;
    target: number;
  }

  export interface UserGoals {
    daily: StudyGoal | null;
    weekly: StudyGoal | null;
    updatedAt: string;
  }

  export interface GoalProgress {
    goal: StudyGoal;
    /** Current value for the metric within the active period (e.g. minutes studied today, or reviews done today). */
    currentValue: number;
    targetValue: number;
    /** Math.round((currentValue / targetValue) * 100); NOT clamped to 100 — a value over 100 means the goal was exceeded, and the UI is responsible for clamping any progress-bar width visually. */
    progressPct: number;
    met: boolean;
    /** Consecutive periods (days for 'daily', weeks for 'weekly') ending at the most recent fully-or-currently-elapsed period in which the goal was met. See computeGoalStreak in src/lib/study/goalProgress.ts for the exact algorithm. */
    streakCount: number;
  }
  ```
  **Do not** modify, rename, or reorder any existing interface/type in `src/types/index.ts`. Only append the block above at the end of the file.

## Exact new file(s) to create

### 1. `src/lib/study/goalProgress.ts` (pure, no `server-only`, no Firebase imports)

```ts
import type { GoalProgress, ReviewRecord, StudyGoal } from '@/types';
import type { StudySession } from './analytics';
import { computeStudyTimeMs } from './analytics';
import { countsAsKnown, toDateKey } from './insights';

/**
 * currentValue for 'study_time_minutes': computeStudyTimeMs(sessions, periodStart) / 60000, rounded down (Math.floor).
 * currentValue for 'review_count': count of `reviews` with answeredAt >= periodStart.
 * periodStart for 'daily': start of `now`'s UTC day (00:00:00.000 UTC).
 * periodStart for 'weekly': 7 days before `now` (rolling window, matching the existing convention in
 *   src/lib/firestore/analytics.ts's getGlobalAnalytics, which computes `weekStart = now - 7 * MS_PER_DAY`).
 */
export function computeGoalProgress(
  goal: StudyGoal,
  reviews: ReviewRecord[],
  sessions: StudySession[],
  now: Date,
): GoalProgress;

/**
 * Consecutive-period streak of goal attainment, ending at "now"'s period, mirroring
 * computeStreak's tolerance in src/lib/study/insights.ts: if the *current* period
 * (today, or this week) has not yet met the goal, that alone does not break the
 * streak — check it first; if unmet, start counting from the *previous* period
 * instead (the current period isn't "over" yet, so an in-progress miss shouldn't
 * zero out the streak). If the previous period is also unmet, the streak is 0.
 *
 * Algorithm:
 *   1. Build the ordered list of period boundaries going backward from `now`
 *      ('daily': one per calendar UTC day; 'weekly': one per rolling 7-day window,
 *      each `periodIndex` further back subtracting periodIndex * 7 days from `now`).
 *   2. For periodIndex = 0 (current period), compute computeGoalProgress anchored
 *      at that period's start; if `met`, count it and continue to periodIndex = 1;
 *      if not met, DO NOT count it, but still continue checking periodIndex = 1
 *      onward as the starting point (i.e. periodIndex 0 never breaks the streak,
 *      it's simply skipped over when unmet).
 *   3. From periodIndex = 1 onward (or 0 if it was met), keep counting consecutive
 *      met periods, incrementing streakCount for each met period, until the first
 *      unmet period is hit (which stops the count, matching computeStreak's
 *      "breaks on a gap" behavior) or 365 periods have been checked (safety cap).
 */
export function computeGoalStreak(
  goal: StudyGoal,
  reviews: ReviewRecord[],
  sessions: StudySession[],
  now: Date,
): number;
```

`computeGoalProgress` must attach the resulting `streakCount` by calling `computeGoalStreak` internally (i.e. `computeGoalProgress` is the single public entry point consumers use; it returns the full `GoalProgress` object including `streakCount`, computed via `computeGoalStreak`).

### 2. `src/lib/study/goalProgress.test.ts`

Vitest unit tests (see "Suggested tests" below), following the existing style of `src/lib/study/insights.test.ts`.

### 3. `src/lib/firestore/goals.ts` (`import 'server-only'`)

```ts
import 'server-only';
import type { GoalMetric, GoalPeriod, UserGoals } from '@/types';

export async function getUserGoals(ownerId: string): Promise<UserGoals | null>;

/** Upserts exactly one period's goal (leaving the other period untouched), or clears it when `goal` is null. */
export async function setUserGoal(
  ownerId: string,
  period: GoalPeriod,
  goal: { metric: GoalMetric; target: number } | null,
): Promise<UserGoals>;
```

Implementation:
- Collection/doc: `adminDb.collection('userGoals').doc(ownerId)`.
- `getUserGoals`: read the doc; if it doesn't exist, return `null`. Otherwise map Firestore fields (`dailyMetric`, `dailyTarget`, `weeklyMetric`, `weeklyTarget`, `updatedAt`) to the `UserGoals` shape (`daily`/`weekly` as `StudyGoal | null`, `updatedAt` as ISO string; treat a `Timestamp`-typed `updatedAt` via `.toDate().toISOString()`, matching the `Timestamp` handling pattern used throughout `src/lib/firestore/*.ts`).
- `setUserGoal`: use `.set({ ... }, { merge: true })` so setting/clearing one period never touches the other. When `goal` is `null`, write `{ [period + 'Metric']: null, [period + 'Target']: null, updatedAt: FieldValue.serverTimestamp() }`; when non-null, write `{ [period + 'Metric']: goal.metric, [period + 'Target']: goal.target, updatedAt: FieldValue.serverTimestamp() }`. After writing, re-read and return via `getUserGoals` (never return `null` from `setUserGoal` — construct the `UserGoals` object directly from the write inputs plus a fresh read if you prefer, but the returned value must reflect the just-written state).

### 4. `src/lib/firestore/goals.integration.test.ts`

Firestore-emulator integration test (see "Suggested tests" below), following the existing style of `src/lib/firestore/insights.integration.test.ts` (`// @vitest-environment node` pragma at the top, `beforeEach` clearing the relevant collection, `adminDb` import).

### 5. `src/lib/actions/goals.ts` (`'use server'`)

```ts
'use server';

export async function getUserGoalsAction(): Promise<UserGoals | null>;
export async function setDailyGoalAction(metric: GoalMetric, target: number): Promise<UserGoals>;
export async function setWeeklyGoalAction(metric: GoalMetric, target: number): Promise<UserGoals>;
export async function clearGoalAction(period: GoalPeriod): Promise<UserGoals>;
export async function getGoalProgressAction(): Promise<{ daily: GoalProgress | null; weekly: GoalProgress | null }>;
```

Implementation notes:
- Validate `metric` with `z.enum(['study_time_minutes', 'review_count'])`, `target` with `z.number().int().min(1)`, `period` with `z.enum(['daily', 'weekly'])` (see the `zod` validation pattern already used throughout `src/lib/actions.ts` and `src/lib/actions/testing.ts`).
- `getGoalProgressAction`: resolve `ownerId`, `const goals = await getUserGoals(ownerId)`; if `goals` is `null`, return `{ daily: null, weekly: null }` immediately (no need to fetch review data). Otherwise fetch `listDecks(ownerId)`, then `Promise.all(decks.map((d) => listAllReviews(d.id)))`, flatten into `allReviews`, `const sessions = clusterSessions(allReviews)`, `const now = new Date()`, then compute `goals.daily ? computeGoalProgress(goals.daily, allReviews, sessions, now) : null` and the equivalent for `weekly`.

### 6. `src/components/account/GoalSettings.tsx` (`'use client'`)

```tsx
export default function GoalSettings(): JSX.Element;
```

- `useQuery` for `getUserGoalsAction` (`queryKey: ['userGoals']`) and a second `useQuery` for `getGoalProgressAction` (`queryKey: ['goalProgress']`), plus `useMutation`s wrapping `setDailyGoalAction`/`setWeeklyGoalAction`/`clearGoalAction` that invalidate both query keys on success (`useQueryClient` from `@tanstack/react-query`, matching the pattern in `src/components/DeckList.tsx`).
- Renders in place of the current static "30 minutes" button: a compact form (metric select: Study time / Review count; numeric target input; Save button) for the daily goal, and an equivalent one for weekly, plus, when progress data is available, the current progress (`{currentValue}/{targetValue}`, `{progressPct}%`, and `{streakCount}`-period streak) for whichever period(s) have a goal configured.
- Must render a sensible "No goal set — set one below" default state when `getUserGoalsAction` resolves to `null`.
- Styling: match the existing `AccountDashboard.tsx` visual language (the same rounded input/button classes already used elsewhere in that file, e.g. `rounded-[10px] border border-[rgba(0,0,0,0.11)] bg-white px-3.5 py-2 text-[13px]`) — reuse those exact utility classes for consistency rather than inventing a new visual style.

## Exact, minimal touchpoint in existing files

**`src/components/account/AccountDashboard.tsx`** — replace **only** the "Daily study goal" `<div>` block quoted verbatim in Background above with:
```tsx
<GoalSettings />
```
and add exactly one new import line near the other local imports:
```ts
import GoalSettings from '@/components/account/GoalSettings';
```
Do not touch any other card, button, state (`preferences`, `modalOpen`, `activeFeature`, etc.), or line in this file. In particular, do not remove or alter `TemplateAlertModal`, `triggerTemplateModal`, or any other card's `triggerTemplateModal(...)` wiring.

**`src/types/index.ts`** — append only the new section block specified in "Data-modeling decision" above, at the very end of the file. Do not touch anything else in this file.

## UI integration point

`src/app/(app)/account/page.tsx` already renders `<AccountDashboard profile={profile} />` — no route/page changes needed. `GoalSettings` appears automatically inside the existing DETAILS card once the touchpoint above lands.

## Explicit out-of-scope items

- No push notifications/reminders when a goal is met or missed.
- No historical goal-progress chart (e.g. a 30-day bar chart of daily attainment) — current-period progress + streak count only.
- No support for multiple simultaneous goals within the same period (e.g. two daily goals) — exactly one optional daily goal and one optional weekly goal, as modeled.
- No editing/backfilling goals for past dates.
- No changes to `InsightsDashboard.tsx` or `OverviewDashboard.tsx`.

## Acceptance criteria (mechanically verifiable)

- [ ] `src/lib/study/goalProgress.ts`, `src/lib/study/goalProgress.test.ts`, `src/lib/firestore/goals.ts`, `src/lib/firestore/goals.integration.test.ts`, `src/lib/actions/goals.ts`, `src/components/account/GoalSettings.tsx` exist with the exported names/signatures specified above.
- [ ] `GoalMetric`, `GoalPeriod`, `StudyGoal`, `UserGoals`, `GoalProgress` are appended at the end of `src/types/index.ts` exactly as specified, with no existing type in that file modified, renamed, or reordered.
- [ ] `git diff` on `src/components/account/AccountDashboard.tsx` shows only the "Daily study goal" block replaced by `<GoalSettings />` plus one new import line — every other card/line unchanged.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npx vitest run src/lib/study/goalProgress.test.ts` passes.
- [ ] `npm run test:integration -- goals.integration.test.ts` (or the equivalent emulator-backed invocation matching `package.json`'s `test:integration` script) passes.
- [ ] Existing tests are unaffected: `npx vitest run src/lib/study/insights.test.ts src/lib/study/analytics.test.ts` and `src/components/account/AccountDashboard.test.tsx` (if it exists and still compiles against the new file) still pass.
- [ ] Setting a goal, then clearing it via `clearGoalAction`, results in `getUserGoalsAction()` reporting that period back as `null` while leaving the other period's goal (if any) untouched.

## Suggested tests to add

`src/lib/study/goalProgress.test.ts` (pure, no emulator):
- `computeGoalProgress` for `review_count` daily goal: correctly counts only today's reviews (UTC), ignores earlier days.
- `computeGoalProgress` for `study_time_minutes` weekly goal: correctly sums `computeStudyTimeMs` over the trailing 7-day window.
- `progressPct` exceeds 100 when `currentValue > targetValue` (not clamped).
- `met` is `true` iff `currentValue >= targetValue`.
- `computeGoalStreak`: a goal met every day for the last 5 days (streak 5); a goal met for 3 days, then a gap, then met again today (streak includes only the trailing run); a goal not yet met today but met every day before that (today doesn't break the streak, matching the docblock's rule); a goal never met (streak 0).

`src/lib/firestore/goals.integration.test.ts` (emulator, `@vitest-environment node`, clears `userGoals` collection in `beforeEach`):
- `getUserGoals` returns `null` for a user with no document.
- `setUserGoal(ownerId, 'daily', {...})` then `getUserGoals(ownerId)` round-trips the daily goal, with `weekly: null`.
- Setting `daily` then separately setting `weekly` preserves both (merge behavior, not overwrite).
- `setUserGoal(ownerId, 'daily', null)` clears only the daily goal, leaving weekly intact.
