# AN07 — Export/report generation (weekly digest)

**Repo root:** `flash-cards-app/` (i.e. `/Users/stefan/Desktop/projects/flash-cards-app/flash-cards-app`). Read `AGENTS.md` at that root first and follow its conventions. This ticket is fully self-contained — implement it using only this file and the live codebase.

## Goal

Let a user manually generate a shareable Markdown summary ("weekly digest") of their overall learning activity, viewable in-app and downloadable as a `.md` file, sourced from the existing `getOverallAnalytics`/`getGlobalAnalytics` aggregations.

## Background you can rely on (verified against the current codebase)

- `getOverallAnalytics(ownerId, now?): Promise<OverallAnalytics>` is exported from `src/lib/firestore/overallAnalytics.ts`. `OverallAnalytics` (`src/types/index.ts`) has: `deckCount`, `cardCount`, `courseCount`, `materialCount`, `quizCount`, `totalReviews`, `streakDays`, `overallRetentionRate` (0-1), `retention: DailyRetention[]`, `forecast: ForecastDay[]`, `quizStats: { totalAttempts, averageScorePct, recentAttempts: [...] }`, `deckBreakdown: [{ deckId, deckName, cardCount, dueCount }]`.
- `getGlobalAnalytics(ownerId, now?): Promise<GlobalAnalytics>` is exported from `src/lib/firestore/analytics.ts`. `GlobalAnalytics` has: `generatedAt`, `overallMastery` (0-1), `studyTimeWeekMs`, `studyTimeAllMs`, `currentStreak`, `longestStreak`, `dueToday: { total, remaining, completed }`, `topics: TopicMetrics[]`, `accuracyTrend`, `sessionsByDate`, `priorityList: PriorityItem[]`.
- Both are already-exported, read-only-safe functions — this ticket calls them, it does not modify them.
- `getCurrentUserId(): Promise<string>` is exported from `src/lib/auth.ts`.
- `src/components/account/AccountDashboard.tsx` is a real (non-placeholder) client component with a "YOUR DATA" card containing a currently-non-functional "Export data" button:
  ```tsx
  <button
    type="button"
    onClick={() => triggerTemplateModal('Export Data')}
    className="rounded-[10px] border border-[rgba(0,0,0,0.12)] bg-white px-3.5 py-2 text-[12.5px] font-medium text-[#16151a] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:bg-black/5 cursor-pointer"
  >
    Export data
  </button>
  ```
  This button is the exact and only piece of `AccountDashboard.tsx` this ticket may change. The adjacent "Delete account" button, `TemplateAlertModal`, and everything else in that card/file must remain untouched.

## Exact new file(s) to create

### 1. `src/lib/reports/weeklyDigest.ts` (pure, no `server-only`, no Firebase imports)

```ts
import type { GlobalAnalytics, OverallAnalytics } from '@/types';

/**
 * Renders a self-contained Markdown document summarizing a user's overall
 * learning activity, sourced entirely from already-computed OverallAnalytics
 * and GlobalAnalytics data (no additional Firestore reads happen in this
 * function — it is a pure formatter).
 */
export function generateWeeklyDigestMarkdown(
  overall: OverallAnalytics,
  global: GlobalAnalytics,
  now: Date,
): string;
```

Implementation requirements (exact content structure — a reviewing agent will check for these sections/labels verbatim):
- A top-level heading: `# Weekly Study Digest — {formatted now date}` (format `now` as `YYYY-MM-DD` via a UTC-safe helper, e.g. `now.toISOString().slice(0, 10)`, matching the `toDateKey` convention used elsewhere in this codebase).
- A `## Summary` section as a Markdown bullet list including at minimum: current streak (`global.currentStreak` days, longest `global.longestStreak`), overall mastery (`Math.round(global.overallMastery * 100)}%`), study time this week (format `global.studyTimeWeekMs` as `Xh Ym`, reusing the same hour/minute formatting logic already inlined in `src/components/GlobalAnalytics.tsx`'s `formatDuration` — reimplement an equivalent local helper in this new file rather than importing a client component's internal function), due today (`global.dueToday.completed`/`global.dueToday.total`), total reviews (`overall.totalReviews`), and overall retention rate (`Math.round(overall.overallRetentionRate * 100)}%`).
- A `## Topics` section: a Markdown table with columns `Topic | Mastery | Decay risk | Coverage | 14-day accuracy`, one row per `global.topics` entry (percentages rounded, `decayRisk` shown as a plain number rounded to 2 decimals since it's not a percentage).
- A `## This week's priorities` section: a Markdown numbered list from `global.priorityList` (`reasonLabel` per item), or the literal text `_Nothing flagged — nice work._` if the array is empty.
- A `## Quiz performance` section: `overall.quizStats.totalAttempts` attempts, `overall.quizStats.averageScorePct}%` average score, and a Markdown table of `overall.quizStats.recentAttempts` (`Quiz | Score | Date`), or `_No quiz attempts yet._` if `totalAttempts === 0`.
- A `## Decks` section: a Markdown table of `overall.deckBreakdown` (`Deck | Cards | Due now`).
- Must not throw on an all-zero/empty `OverallAnalytics`/`GlobalAnalytics` (e.g. a brand-new account with zero decks) — every section must degrade to an empty-state message rather than rendering a broken/empty table.

### 2. `src/lib/reports/weeklyDigest.test.ts`

Vitest unit tests (see "Suggested tests" below), following the existing style of `src/lib/study/insights.test.ts` (construct hand-built `OverallAnalytics`/`GlobalAnalytics` fixtures inline; assert on `.toContain(...)` / `.toMatch(...)` against the returned Markdown string rather than exact full-string equality, since exact formatting is an implementation detail — tests should check for the presence of key numbers/labels).

### 3. `src/lib/actions/reports.ts` (`'use server'`)

```ts
'use server';

export interface WeeklyDigestResult {
  markdown: string;
  generatedAt: string;
}

export async function generateWeeklyDigestAction(): Promise<WeeklyDigestResult>;
```

Implementation: resolve `ownerId` via `getCurrentUserId()`, `const now = new Date()`, `const [overall, global] = await Promise.all([getOverallAnalytics(ownerId, now), getGlobalAnalytics(ownerId, now)])`, `return { markdown: generateWeeklyDigestMarkdown(overall, global, now), generatedAt: now.toISOString() }`.

### 4. `src/components/account/ExportReportButton.tsx` (`'use client'`)

```tsx
export default function ExportReportButton(): JSX.Element;
```

- `useMutation({ mutationFn: generateWeeklyDigestAction })`, triggered by a button styled identically to the current "Export data" button (reuse its exact className) so the visual change is invisible until clicked.
- On success, show the generated Markdown in an inline preview (a `<pre>`/`<textarea readOnly>` block, or a simple modal — your judgment, but it must actually display the full `markdown` string somewhere in the DOM) plus a "Download .md" button that triggers a client-side download using a `Blob` (`new Blob([markdown], { type: 'text/markdown' })`) and a temporary `<a download="weekly-digest-{date}.md">` click, with no server-side file storage and no network request beyond the one Server Action call.
- Show a loading state while the mutation is pending, and an inline error message (matching the `text-danger` idiom used elsewhere in this codebase, e.g. `DeckInsights.tsx`'s error rendering) if it fails.

## Exact, minimal touchpoint in existing files

**`src/components/account/AccountDashboard.tsx`** — replace **only** the "Export data" `<button>` quoted verbatim in Background above with:
```tsx
<ExportReportButton />
```
and add exactly one new import line near the other local imports:
```ts
import ExportReportButton from '@/components/account/ExportReportButton';
```
Do not touch the adjacent "Delete account" button, `TemplateAlertModal`, the `preferences` state, or any other card/line in this file. If AN04 has already edited this file (replacing the "Daily study goal" block with `<GoalSettings />`), your diff must apply cleanly on top of that — the two changes are in different cards/blocks and do not overlap.

## Data-modeling decisions

None — this ticket reads existing aggregation functions and writes nothing to Firestore. No new types are added to `src/types/index.ts` (`WeeklyDigestResult` lives in `src/lib/actions/reports.ts`).

## UI integration point

`src/app/(app)/account/page.tsx` already renders `<AccountDashboard profile={profile} />` — no route/page changes needed. `ExportReportButton` appears automatically in place of the existing "Export data" button once the touchpoint above lands.

## Explicit out-of-scope items (flagged as future work, not part of this ticket)

- **No email delivery** of any kind (no Resend/SMTP integration for this report, even though `resend` is already a dependency used elsewhere in this codebase for auth emails — do not touch `src/lib/server/email.ts` or add a new email path here).
- **No cron/scheduling** — the digest is generated only on manual button click, never automatically on a schedule.
- **No PDF generation** — Markdown only (a plain-text/`.md` download). HTML export is also out of scope for this ticket.
- No persistence of generated digests (no "digest history" list) — each click generates a fresh, ephemeral digest that is not saved anywhere.
- No changes to `getOverallAnalytics`, `getGlobalAnalytics`, `InsightsDashboard.tsx`, or `OverviewDashboard.tsx`.

## Acceptance criteria (mechanically verifiable)

- [ ] `src/lib/reports/weeklyDigest.ts`, `src/lib/reports/weeklyDigest.test.ts`, `src/lib/actions/reports.ts`, `src/components/account/ExportReportButton.tsx` exist with the exported names/signatures specified above.
- [ ] `generateWeeklyDigestMarkdown` is exported from `src/lib/reports/weeklyDigest.ts` with exactly that name.
- [ ] `git diff` on `src/components/account/AccountDashboard.tsx` shows only the "Export data" button replaced by `<ExportReportButton />` plus one new import line — every other card/line unchanged.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npx vitest run src/lib/reports/weeklyDigest.test.ts` passes.
- [ ] The generated Markdown for an all-empty `OverallAnalytics`/`GlobalAnalytics` fixture (zero decks/quizzes/topics) does not throw and includes the documented empty-state fallback text for each section that would otherwise be empty.
- [ ] No email-sending code, cron/scheduling code, or PDF-generation dependency is introduced anywhere in this diff.
- [ ] Existing tests are unaffected: `npx vitest run src/lib/firestore/insights.integration.test.ts` (or any other pre-existing test touching `overallAnalytics`/`analytics`) still passes unchanged, since neither underlying aggregation function was modified.

## Suggested tests to add (`src/lib/reports/weeklyDigest.test.ts`)

- A fully-populated fixture produces a Markdown string containing the current streak number, overall mastery percentage, and study-time formatting.
- The `## Topics` table contains one row per topic in `global.topics`, with correctly rounded percentages.
- An empty `topics: []` array still produces a well-formed `## Topics` section (either an empty table or an explicit "no topics yet" message — your choice, but it must not throw or emit a malformed table).
- `quizStats.totalAttempts === 0` produces the `_No quiz attempts yet._` fallback, not an empty/broken table.
- `priorityList: []` produces the `_Nothing flagged — nice work._` fallback.
- The date in the top-level heading matches `now` formatted as `YYYY-MM-DD` (UTC), for a fixed `now` passed into the test.
