# AN03 — Study-time-of-day heatmap

**Repo root:** `flash-cards-app/` (i.e. `/Users/stefan/Desktop/projects/flash-cards-app/flash-cards-app`). Read `AGENTS.md` at that root first and follow its conventions. This ticket is fully self-contained — implement it using only this file and the live codebase.

## Goal

Bucket the user's existing cross-deck review history by hour-of-day (0–23) to show a heatmap of when they study most and most accurately, on the global analytics dashboard.

## Background you can rely on (verified against the current codebase)

- `ReviewRecord` (`src/types/index.ts`): `cardId?`, `response: ResponseType`, `answeredAt: Date`, `intervalAtReview?`, `wasOverdue?`.
- `countsAsKnown(response: ResponseType): boolean` is exported from `src/lib/study/insights.ts` — treats `'know'` and `'easy'` as a successful recall. You may **import** this (read-only) — do not edit `insights.ts`.
- `listDecks(ownerId)` is exported from `src/lib/firestore/decks.ts`; `listAllReviews(deckId)` is exported from `src/lib/firestore/reviews.ts` (returns every review ever logged for that deck). Both are safe read-only imports.
- All existing date-bucketing/formatting in this codebase is explicitly pinned to **UTC** to avoid SSR/client hydration mismatches (see `toDateKey` in `src/lib/study/insights.ts`, and the `timeZone: 'UTC'` option used throughout `DeckInsights.tsx`/`SessionConsistency.tsx`'s `Intl.DateTimeFormat` calls). Follow the same convention here: bucket by `date.getUTCHours()`, not local time. This is a known, intentional limitation (the heatmap reflects UTC hour-of-day, not the user's local hour-of-day) — do not attempt to fix this by adding timezone/locale detection; that's future work, out of scope for this ticket.
- `src/components/analytics/SessionConsistency.tsx` is the closest existing visual precedent to imitate: a client component that takes pre-computed bucketed data plus a stable `now: Date` anchor prop (to avoid hydration mismatches — **do not** default to `new Date()` inside the client component itself), renders a grid of shaded cells with a hover tooltip, using only Tailwind utility classes (no charting library is installed in this repo — confirm via `package.json`, there is no recharts/chart.js/d3 dependency).
- `src/components/GlobalAnalytics.tsx` renders `<SessionConsistency sessionsByDate={data.sessionsByDate} now={new Date(data.generatedAt)} />` inside a `grid lg:grid-cols-2` alongside `<AccuracyTrendChart .../>`, followed by a second `grid lg:grid-cols-2` row, all inside one top-level `<div className="space-y-10">`.

## Exact new file(s) to create

### 1. `src/lib/study/timeOfDay.ts` (pure, no `server-only`, no Firebase imports)

```ts
import type { ReviewRecord } from '@/types';
import { countsAsKnown } from './insights';

export interface HourBucket {
  /** 0-23, UTC hour-of-day (see ticket AN03 for why UTC). */
  hour: number;
  reviewCount: number;
  knowCount: number;
  /** knowCount / reviewCount, or 0 when reviewCount is 0. */
  accuracyRate: number;
}

/** Always returns exactly 24 entries, one per hour, ordered 0..23, even for hours with zero reviews. */
export function computeReviewsByHourOfDay(reviews: ReviewRecord[]): HourBucket[];
```

Implementation: initialize 24 buckets (`hour: 0..23`, all counts 0), for each review increment `reviewCount` (and `knowCount` if `countsAsKnown(review.response)`) in the bucket for `review.answeredAt.getUTCHours()`, then compute `accuracyRate` per bucket at the end (`reviewCount > 0 ? knowCount / reviewCount : 0`).

### 2. `src/lib/study/timeOfDay.test.ts`

Vitest unit tests (see "Suggested tests" below), following the existing style of `src/lib/study/insights.test.ts`.

### 3. `src/lib/firestore/timeOfDay.ts` (`import 'server-only'`)

```ts
import 'server-only';
import type { HourBucket } from '@/lib/study/timeOfDay';

/** Cross-deck (global) hour-of-day heatmap across all of the user's review history, all-time. */
export async function getGlobalTimeOfDayHeatmap(ownerId: string): Promise<HourBucket[]>;
```

Implementation: `const decks = await listDecks(ownerId)`, `const perDeck = await Promise.all(decks.map((d) => listAllReviews(d.id)))`, flatten into `allReviews`, `return computeReviewsByHourOfDay(allReviews)`.

### 4. `src/lib/actions/timeOfDay.ts` (`'use server'`)

```ts
'use server';

export async function getTimeOfDayHeatmapAction(): Promise<HourBucket[]>;
```

Implementation: resolve `ownerId` via `getCurrentUserId()` (from `src/lib/auth.ts`), call `getGlobalTimeOfDayHeatmap(ownerId)`. No input to validate (no parameters).

### 5. `src/components/analytics/TimeOfDayHeatmap.tsx` (`'use client'`)

```tsx
export default function TimeOfDayHeatmap(): JSX.Element;
```

- No props needed (global, not deck-scoped) — `useQuery({ queryKey: ['timeOfDayHeatmap'], queryFn: getTimeOfDayHeatmapAction })`.
- Renders a `<section>` (match `SessionConsistency.tsx`'s outer wrapper: `className="rounded-2xl bg-surface border border-border shadow-sm p-6"`) titled "Study time of day" (`text-[10.5px] font-semibold uppercase tracking-wide text-muted`, matching `SessionConsistency.tsx`'s heading style).
- Renders 24 cells in a row (`flex flex-wrap gap-1` or a 24-column grid), one per hour, shaded by `reviewCount` relative to the max across all 24 buckets (mirror `SessionConsistency.tsx`'s `cellClassFor` idea: 4 shade tiers based on relative volume, e.g. 0 / low / medium / high using the same `bg-accent/[.NN]` utility pattern already used there).
- On hover, show a tooltip with the formatted hour (e.g. "14:00 UTC"), `reviewCount`, and `Math.round(accuracyRate * 100)}%` accuracy — mirror the absolute-positioned tooltip pattern already used in `SessionConsistency.tsx` (`useState<number | null>` for the hovered index, `onMouseEnter`/`onMouseLeave`).
- Empty state: if every bucket has `reviewCount === 0`, show a `<p className="text-sm text-muted">` message ("No study sessions logged yet.") instead of (or in addition to, your judgment) the empty grid.
- Must not crash if the query errors.

## Exact, minimal touchpoint in existing files

**`src/components/GlobalAnalytics.tsx`** — exactly two additive lines, nothing else in this file may change:
1. Add one new import line, placed immediately after the existing `import PriorityList from '@/components/analytics/PriorityList';` line:
   ```ts
   import TimeOfDayHeatmap from '@/components/analytics/TimeOfDayHeatmap';
   ```
2. Add one new JSX line as the **very last child**, appended immediately after the existing closing `</div>` of the second `grid lg:grid-cols-2 gap-6 items-start` block and before the closing `</div>` of the top-level `<div className="space-y-10">`:
   ```tsx
   <TimeOfDayHeatmap />
   ```

Do not reorder, reformat, or touch any other line of `GlobalAnalytics.tsx`. Do not touch `src/lib/study/analytics.ts`, `src/lib/study/insights.ts`, `src/lib/firestore/analytics.ts`, `src/components/DeckInsights.tsx`, or `src/types/index.ts`.

## Data-modeling decisions

- No schema changes. `HourBucket` is a brand-new type defined and exported from `src/lib/study/timeOfDay.ts` (not added to `src/types/index.ts`).
- Bucketing is by UTC hour-of-day, all-time (no rolling window) — a fixed decision for this ticket, not user-configurable.
- Day-of-week bucketing ("optionally") is explicitly **not** included in this ticket's scope — see Out-of-scope below — to keep the shipped surface area small and unambiguous; only the hour-of-day heatmap is required.

## UI integration point

`src/app/(app)/analytics` and `src/app/(app)/insights` currently render the pre-existing placeholder `InsightsDashboard` component, **not** `GlobalAnalytics.tsx` — `GlobalAnalytics.tsx` is not wired to any route today (confirmed: no page in `src/app` imports it). This ticket does **not** change that wiring — do not touch any file under `src/app/`, and do not touch `InsightsDashboard.tsx`/`OverviewDashboard.tsx`. Your new heatmap section becomes visible once `GlobalAnalytics.tsx` itself is wired up (a separate, future concern, out of scope here) or via any test/story that renders `GlobalAnalytics` directly. This is intentional and matches the required touchpoint above exactly — do not attempt to also wire `GlobalAnalytics.tsx` into a route as part of this ticket.

## Explicit out-of-scope items

- Day-of-week bucketing/cross-tabulation (hour × weekday) — hour-of-day only.
- Any timezone/locale-awareness beyond UTC.
- Wiring `GlobalAnalytics.tsx` into an actual page route (it is not wired today; not this ticket's job to fix).
- Any change to `InsightsDashboard.tsx` or `OverviewDashboard.tsx` (the current fake/placeholder dashboards).

## Acceptance criteria (mechanically verifiable)

- [ ] `src/lib/study/timeOfDay.ts`, `src/lib/study/timeOfDay.test.ts`, `src/lib/firestore/timeOfDay.ts`, `src/lib/actions/timeOfDay.ts`, `src/components/analytics/TimeOfDayHeatmap.tsx` exist with the exported names/signatures specified above.
- [ ] `computeReviewsByHourOfDay` and `HourBucket` are exported from `src/lib/study/timeOfDay.ts` with exactly those names.
- [ ] `computeReviewsByHourOfDay([])` returns an array of length 24, all-zero.
- [ ] `git diff` shows changes to `src/components/GlobalAnalytics.tsx` consisting only of one added import line and one added JSX line — no existing line modified.
- [ ] No changes anywhere to `src/lib/study/analytics.ts`, `src/lib/study/insights.ts`, `src/lib/firestore/analytics.ts`, `src/components/DeckInsights.tsx`, `src/types/index.ts`, or anything under `src/app/`.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npx vitest run src/lib/study/timeOfDay.test.ts` passes.
- [ ] Existing tests are unaffected: `npx vitest run src/lib/study/insights.test.ts src/lib/study/analytics.test.ts` still pass unchanged.

## Suggested tests to add (`src/lib/study/timeOfDay.test.ts`)

- Always returns 24 entries for `hour: 0..23` in order, even with empty input.
- A review at `2026-08-28T00:00:00.000Z` lands in `hour: 0`; a review at `2026-08-28T23:59:59.000Z` lands in `hour: 23` (UTC boundary correctness).
- `reviewCount`/`knowCount`/`accuracyRate` are computed correctly for a bucket with a mix of `know`, `easy`, `uncertain`, `dont_know` responses (only `know`/`easy` count toward `knowCount`, matching `countsAsKnown`).
- A bucket with 0 reviews has `accuracyRate: 0` (not `NaN`).
- Reviews spread across multiple distinct hours populate multiple distinct buckets independently.
