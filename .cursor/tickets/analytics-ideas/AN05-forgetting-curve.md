# AN05 — Forgetting curve per deck

**Repo root:** `flash-cards-app/` (i.e. `/Users/stefan/Desktop/projects/flash-cards-app/flash-cards-app`). Read `AGENTS.md` at that root first and follow its conventions. This ticket is fully self-contained — implement it using only this file and the live codebase.

## Goal

Aggregate a deck's review history into a fine-grained retention-vs-interval curve (many day-granular points, not the 4 coarse fixed buckets the codebase already has), so the shape of the forgetting curve is visible, not just a handful of averages.

## Background you can rely on (verified against the current codebase)

- `ReviewRecord` (`src/types/index.ts`): `response: ResponseType`, `answeredAt: Date`, `intervalAtReview?: number` (the card's scheduling interval, in days, immediately **before** that review was recorded; `undefined`/legacy documents default to `0` per existing convention).
- `countsAsKnown(response: ResponseType): boolean` is exported from `src/lib/study/insights.ts` (`'know'`/`'easy'` count as retained). You may **import** this (read-only) — do not edit `insights.ts`.
- The existing coarse version of this idea, `computeRetentionByIntervalBucket` in `src/lib/study/insights.ts`, uses exactly 4 fixed labeled buckets (`'1 day'`, `'2-7 days'`, `'8-21 days'`, `'22+ days'`) and returns a `RetentionBucket[]`. **Do not edit, replace, or call this function** — this ticket adds a parallel, finer-grained computation in a brand-new file instead. The two coexist; this ticket does not remove the coarse one.
- In this codebase, "topic" and "deck" are the same concept (`TopicMetrics`'s doc comment: "Per-topic (= per-deck) rollup"). This ticket therefore only needs one deck-scoped curve function — there is no separate cross-deck "topic" aggregation to build; that would be a different, out-of-scope feature.
- `listReviewsSince(deckId, since)` is exported from `src/lib/firestore/reviews.ts`; `assertDeckOwnership(deckId, ownerId)` is exported from `src/lib/firestore/decks.ts`; `getCurrentUserId()` is exported from `src/lib/auth.ts`.
- No charting library is installed in this repo (confirm via `package.json` — no recharts/chart.js/d3); every existing chart in `DeckInsights.tsx` is hand-built with absolutely/flexbox-positioned `<div>`s and Tailwind utility classes.

## Data-modeling decision (must be followed exactly)

- Bucket granularity: **1-day-wide buckets**, keyed by the exact integer value of `intervalAtReview` (after defaulting missing values to `0`, matching the existing convention), for values `0` through `FORGETTING_CURVE_MAX_INTERVAL_DAYS = 60` inclusive.
- All reviews with `intervalAtReview > 60` are folded into one final **overflow bucket** at `intervalDays: 61`, flagged with `isOverflow: true`, so the curve always has a bounded, finite shape regardless of how mature a deck's cards get.
- **Sparse output**: only buckets with at least one review are returned (buckets with zero reviews are omitted entirely, not padded with zero-filled entries) — this keeps the returned array small and lets the chart connect only real data points, avoiding a mostly-empty 62-point array for young decks. This is a deliberate simplification for this ticket; do not pad with zeros.
- Output is sorted ascending by `intervalDays`.
- A caller-supplied `bucketSizeDays` option (default `1`) allows coarser grouping (e.g. `7` for weekly buckets) by grouping `intervalAtReview` into `Math.floor(intervalAtReview / bucketSizeDays) * bucketSizeDays`-keyed buckets before the same 60-day-cap/overflow logic applies (the cap and overflow threshold are still expressed in days, e.g. with `bucketSizeDays: 7` the last non-overflow bucket key would be `56` covering `[56, 63)`, and the overflow bucket still represents everything past the cap). The shipped UI in this ticket always uses the default `bucketSizeDays: 1` — the parameter exists for testability/future flexibility, not for a UI control in this ticket.

## Exact new file(s) to create

### 1. `src/lib/study/forgettingCurve.ts` (pure, no `server-only`, no Firebase imports)

```ts
import type { ReviewRecord } from '@/types';
import { countsAsKnown } from './insights';

export const FORGETTING_CURVE_MAX_INTERVAL_DAYS = 60;
/** Sentinel intervalDays value representing "> FORGETTING_CURVE_MAX_INTERVAL_DAYS", see isOverflow. */
export const FORGETTING_CURVE_OVERFLOW_INTERVAL_DAYS = FORGETTING_CURVE_MAX_INTERVAL_DAYS + 1;

export interface ForgettingCurvePoint {
  /** The bucket's interval-days key (see ticket AN05 bucketing rules), or FORGETTING_CURVE_OVERFLOW_INTERVAL_DAYS when isOverflow. */
  intervalDays: number;
  /** True only for the single trailing bucket aggregating every review past FORGETTING_CURVE_MAX_INTERVAL_DAYS. */
  isOverflow: boolean;
  reviewCount: number;
  knowCount: number;
  retentionRate: number;
}

/**
 * Fine-grained retention-vs-interval curve for one deck's review history.
 * See ticket AN05 for the exact bucketing/overflow/sparse-output rules.
 */
export function computeForgettingCurve(
  reviews: ReviewRecord[],
  bucketSizeDays?: number,
): ForgettingCurvePoint[];
```

### 2. `src/lib/study/forgettingCurve.test.ts`

Vitest unit tests (see "Suggested tests" below), following the existing style of `src/lib/study/insights.test.ts`.

### 3. `src/lib/firestore/forgettingCurve.ts` (`import 'server-only'`)

```ts
import 'server-only';
import type { ForgettingCurvePoint } from '@/lib/study/forgettingCurve';

/** 60-day review-history window, matching the REVIEW_HISTORY_DAYS convention already used in src/lib/firestore/insights.ts. */
export async function getDeckForgettingCurve(deckId: string, ownerId: string, now?: Date): Promise<ForgettingCurvePoint[]>;
```

Implementation: `await assertDeckOwnership(deckId, ownerId)`, `since = (now ?? new Date()) - 60 days`, `const reviews = await listReviewsSince(deckId, since)`, `return computeForgettingCurve(reviews)` (default `bucketSizeDays`).

### 4. `src/lib/actions/forgettingCurve.ts` (`'use server'`)

```ts
'use server';

export async function getDeckForgettingCurveAction(deckId: string): Promise<ForgettingCurvePoint[]>;
```

Implementation: validate `deckId` with `z.string().min(1).parse(deckId)`, resolve `ownerId` via `getCurrentUserId()`, call `getDeckForgettingCurve(deckId, ownerId)`.

### 5. `src/components/analytics/ForgettingCurveChart.tsx` (`'use client'`)

```tsx
interface ForgettingCurveChartProps {
  deckId: string;
}
export default function ForgettingCurveChart({ deckId }: ForgettingCurveChartProps): JSX.Element;
```

- `useQuery({ queryKey: ['deckForgettingCurve', deckId], queryFn: () => getDeckForgettingCurveAction(deckId) })`.
- Renders a `<section>` titled "Forgetting curve" with a short caption ("Retention rate by interval length at time of review").
- Chart: a simple hand-built scatter using the same DIY approach as the rest of `DeckInsights.tsx` — a fixed-height (`CHART_HEIGHT`-style, e.g. 160px) relatively-positioned container; for each `ForgettingCurvePoint`, an absolutely-positioned dot/marker at `left: (point.intervalDays / maxIntervalDays) * 100%` and `bottom: point.retentionRate * 100%`, sized/colored by `reviewCount` (e.g. more reviews = larger or more opaque dot) and visually distinguished when `isOverflow` (e.g. a different color or a small "+" marker). On hover/tap, show a tooltip with `intervalDays` (or "60+ days" when `isOverflow`), `reviewCount`, and `Math.round(retentionRate * 100)}%`.
- Empty-state: if the array is empty, render a `<p className="text-sm text-muted">` message ("Not enough review history yet to plot a forgetting curve.").
- Must not crash if the query errors.
- Exact pixel-level chart styling is your judgment as long as it visually fits the existing hand-built chart idiom in `DeckInsights.tsx` (Tailwind utility classes, `bg-accent`/`text-danger`/`border-border` design tokens already used throughout that file).

## Exact, minimal touchpoint in existing files

**`src/components/DeckInsights.tsx`** — exactly two additive lines, nothing else in this file may change:
1. Add one new import line, placed immediately after the existing `import AccuracyTrendChart from '@/components/charts/AccuracyTrendChart';` line:
   ```ts
   import ForgettingCurveChart from '@/components/analytics/ForgettingCurveChart';
   ```
2. Add one new JSX line as the **very last child**, appended immediately after the existing `<LapseRateChart lapseRate={data.lapseRate} />` line and before the closing `</div>` of the top-level `<div className="space-y-10">`:
   ```tsx
   <ForgettingCurveChart deckId={deckId} />
   ```

If another ticket (AN01, AN02, AN03) has already appended its own line(s) in the same two spots, add yours immediately after theirs — do not reorder or remove anything already present. Do not touch `src/lib/study/analytics.ts`, `src/lib/study/insights.ts`, `src/lib/firestore/insights.ts`, `src/components/GlobalAnalytics.tsx`, or `src/types/index.ts`.

## Data-modeling decisions

(See "Data-modeling decision" section above for the full bucketing spec — repeated here for completeness per the ticket template.) No schema changes to Firestore or `src/types/index.ts`. `ForgettingCurvePoint` is a brand-new type defined and exported from `src/lib/study/forgettingCurve.ts`.

## UI integration point

`src/app/(app)/decks/[id]/insights/page.tsx` already renders `<DeckInsights deckId={deck.id} initialInsights={insights} />` — no route/page changes needed. The new forgetting-curve chart appears automatically once the `DeckInsights.tsx` touchpoint above lands.

## Explicit out-of-scope items

- No cross-deck ("all topics") forgetting curve — deck-scoped only, per the data-modeling decision above.
- No modification to, or removal of, the existing coarse `computeRetentionByIntervalBucket`/`RetentionByBucketChart` — both continue to exist unchanged alongside this new, finer-grained view.
- No curve-fitting/regression/smoothing (e.g. exponential decay fit) — raw bucketed retention rates only.
- No changes to `GlobalAnalytics.tsx`, `analytics.ts`, or `insights.ts`.

## Acceptance criteria (mechanically verifiable)

- [ ] `src/lib/study/forgettingCurve.ts`, `src/lib/study/forgettingCurve.test.ts`, `src/lib/firestore/forgettingCurve.ts`, `src/lib/actions/forgettingCurve.ts`, `src/components/analytics/ForgettingCurveChart.tsx` exist with the exported names/signatures specified above.
- [ ] `computeForgettingCurve`, `ForgettingCurvePoint`, `FORGETTING_CURVE_MAX_INTERVAL_DAYS`, `FORGETTING_CURVE_OVERFLOW_INTERVAL_DAYS` are exported from `src/lib/study/forgettingCurve.ts` with exactly those names.
- [ ] `git diff` shows changes to `src/components/DeckInsights.tsx` consisting only of one added import line and one added JSX line (plus, if AN01/AN02/AN03 landed first, their own equally-isolated lines already present) — no existing line modified.
- [ ] No changes anywhere to `src/lib/study/analytics.ts`, `src/lib/study/insights.ts` (including `computeRetentionByIntervalBucket`, which must remain byte-for-byte unchanged), `src/lib/firestore/insights.ts`, `src/components/GlobalAnalytics.tsx`, or `src/types/index.ts`.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npx vitest run src/lib/study/forgettingCurve.test.ts` passes.
- [ ] Existing tests are unaffected: `npx vitest run src/lib/study/insights.test.ts src/lib/study/analytics.test.ts` still pass unchanged.

## Suggested tests to add (`src/lib/study/forgettingCurve.test.ts`)

- Reviews with distinct `intervalAtReview` values (e.g. `0`, `1`, `5`, `20`) produce distinct sparse buckets, sorted ascending.
- Multiple reviews with the same `intervalAtReview` are aggregated into one bucket with correct `reviewCount`/`knowCount`/`retentionRate`.
- A review with `intervalAtReview: 75` (> 60) lands in the overflow bucket (`intervalDays: 61`, `isOverflow: true`); a review at exactly `60` does **not** overflow; a review at exactly `61` does.
- Multiple overflow-range reviews (e.g. `70` and `90`) are aggregated together into the single overflow bucket, not kept separate.
- A review missing `intervalAtReview` defaults to `0` (matches the existing `?? 0` convention used elsewhere, e.g. `computeRetentionByIntervalBucket`/`computeMatureLapseRateStats` in `src/lib/study/insights.ts`).
- Buckets with zero reviews are omitted from the output (sparse, not zero-padded) — verify the returned array length matches only the distinct populated buckets.
- `bucketSizeDays: 7` groups intervals into 7-day-wide buckets (e.g. `intervalAtReview: 8` and `intervalAtReview: 13` both fall in the bucket keyed `7`), with the overflow threshold still anchored at `FORGETTING_CURVE_MAX_INTERVAL_DAYS`.
- Empty `reviews` array returns `[]`.
