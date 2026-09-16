# Orchestration plan — Analytics ideas (8 independent tickets)

Repo root for all tickets: `flash-cards-app/` (i.e. `/Users/stefan/Desktop/projects/flash-cards-app/flash-cards-app`). Every path in every ticket is relative to that root unless stated otherwise. **Read `flash-cards-app/AGENTS.md` first** and follow it.

Each ticket below (`AN01`–`AN08`) is **fully self-contained**: an execution agent should be able to read exactly one ticket file plus the live codebase and implement it correctly with zero other context. Each ticket is likewise reviewable in isolation by a separate reviewing agent using only that ticket + the diff it produced.

| Ticket | Title | New files (own) | Touches shared/existing files? |
|---|---|---|---|
| AN01 | Card-level leech detection | `src/lib/study/leeches.ts`, `src/lib/study/leeches.test.ts`, `src/lib/firestore/leeches.ts`, `src/lib/actions/leeches.ts`, `src/components/analytics/LeechList.tsx` | `src/components/DeckInsights.tsx` (1 import line + 1 JSX line, appended at the end only) |
| AN02 | Predicted mastery date | `src/lib/study/masteryForecast.ts`, `src/lib/study/masteryForecast.test.ts`, `src/lib/firestore/masteryForecast.ts`, `src/lib/actions/masteryForecast.ts`, `src/components/analytics/MasteryForecast.tsx` | `src/components/DeckInsights.tsx` (1 import line + 1 JSX line, appended at the end only) |
| AN03 | Study-time-of-day heatmap | `src/lib/study/timeOfDay.ts`, `src/lib/study/timeOfDay.test.ts`, `src/lib/firestore/timeOfDay.ts`, `src/lib/actions/timeOfDay.ts`, `src/components/analytics/TimeOfDayHeatmap.tsx` | `src/components/GlobalAnalytics.tsx` (1 import line + 1 JSX line, appended at the end only) |
| AN04 | Goal tracking | `src/lib/study/goalProgress.ts`, `src/lib/study/goalProgress.test.ts`, `src/lib/firestore/goals.ts`, `src/lib/firestore/goals.integration.test.ts`, `src/lib/actions/goals.ts`, `src/components/account/GoalSettings.tsx` | `src/types/index.ts` (new interfaces appended at end of file only), `src/components/account/AccountDashboard.tsx` (replace exactly the existing "Daily study goal" block, nothing else) |
| AN05 | Forgetting curve per deck | `src/lib/study/forgettingCurve.ts`, `src/lib/study/forgettingCurve.test.ts`, `src/lib/firestore/forgettingCurve.ts`, `src/lib/actions/forgettingCurve.ts`, `src/components/analytics/ForgettingCurveChart.tsx` | `src/components/DeckInsights.tsx` (1 import line + 1 JSX line, appended at the end only) |
| AN06 | Cross-source correlation (quiz vs. flashcards) | `src/lib/study/correlation.ts`, `src/lib/study/correlation.test.ts`, `src/lib/firestore/quizDeckLinks.ts`, `src/lib/firestore/correlation.ts`, `src/lib/actions/correlation.ts`, `src/components/testing/QuizDeckCorrelation.tsx`, `src/app/(app)/testing/quizzes/[id]/correlation/page.tsx` | `src/types/index.ts` (new interfaces appended at end of file only) |
| AN07 | Export/report generation (weekly digest) | `src/lib/reports/weeklyDigest.ts`, `src/lib/reports/weeklyDigest.test.ts`, `src/lib/actions/reports.ts`, `src/components/account/ExportReportButton.tsx` | `src/components/account/AccountDashboard.tsx` (replace exactly the existing "Export data" button, nothing else) |
| AN08 | Adaptive study session builder | `src/lib/study/sessionBuilder.ts`, `src/lib/study/sessionBuilder.test.ts`, `src/lib/firestore/sessionBuilder.ts`, `src/lib/actions/sessionBuilder.ts`, `src/components/study/AdaptiveSessionLauncher.tsx`, `src/components/study/AdaptiveSessionRunner.tsx`, `src/app/(app)/study/adaptive/page.tsx` | `src/components/StudySession.tsx` (additive prop change only, see AN08), `src/components/DeckList.tsx` (1 import line + 1 JSX element in the existing top-right toolbar, appended only) |

## Why these are safely parallelizable

All 8 tickets were deliberately scoped so that **each ticket's actual computation logic lives in a brand-new file that no other ticket touches**. AN01, AN02, AN03, AN05 all originally wanted to extend `src/lib/study/analytics.ts` / `src/lib/study/insights.ts` / `src/components/DeckInsights.tsx` / `src/components/GlobalAnalytics.tsx` — instead, **every one of those four tickets is restricted to** (a) a brand-new pure-logic file under `src/lib/study/`, (b) a brand-new Firestore data-fetching file under `src/lib/firestore/`, (c) a brand-new Server Action file under `src/lib/actions/`, (d) a brand-new presentational component under `src/components/analytics/`, and (e) **exactly one isolated, additive touchpoint** in the existing dashboard component (one new import line + one new JSX element, both appended at the very end — never inserted between or replacing existing lines, never editing existing sections). This identical convention is repeated verbatim in AN01/AN02/AN03/AN05's ticket files so four independent agents converge on compatible, non-conflicting diffs.

These four tickets **may freely import (read-only) existing named exports** from `src/lib/study/analytics.ts` and `src/lib/study/insights.ts` (e.g. `clusterSessions`, `countsAsKnown`, `computeCardDecayRisk`) — importing an existing export is not an edit and creates no merge conflict. They must **never add, remove, or modify** anything inside those two files.

AN04 (goal tracking) and AN06 (quiz-deck correlation) both need new shared types in `src/types/index.ts`. Each ticket is restricted to **appending brand-new interfaces in a new, uniquely-named section comment block at the very end of the file** (after the existing `TestingSchedule` section) — never editing, renaming, or reordering any existing interface or field. Both tickets append to the same end-of-file location, so combining their two diffs is a trivial text merge (both additions land one after the other), not a logical conflict.

## Known additional shared-file collision (beyond what's called out per-ticket)

Two pairs of tickets touch the same existing file at **different, non-overlapping locations** — flagged here so whoever integrates them applies both diffs to the same file without surprise:
- **AN04** and **AN07** both edit `src/components/account/AccountDashboard.tsx` — AN04 replaces only the "Daily study goal" input block (inside the DETAILS card); AN07 replaces only the "Export data" button (inside the YOUR DATA card). These are different blocks in different cards; apply both diffs to get the final file.
- No other file is touched by more than one ticket.

## Corrected premise vs. the original task brief (AN08)

The original task brief for the adaptive session builder states that `computeCardDecayRisk` "currently only exists as an internal aggregation step in `analytics.ts` and is not exported/exposed per-card externally." **This is not accurate as of the current codebase**: `computeCardDecayRisk(card: Card, now: Date): number` in `src/lib/study/analytics.ts` is already a top-level `export function`, usable per-card by any caller today. AN08's ticket file below reflects the corrected premise: it directly imports and reuses `computeCardDecayRisk` (read-only import, no edit) rather than treating this as a gap to fill.

## Dependency / ordering note

**None of the 8 tickets depend on each other.** Every ticket's new files, types, and touchpoints are mutually exclusive by construction (see table above), so all 8 can be implemented by 8 fully independent agents running concurrently in the same working tree, in any order, and merged in any order. The only two tickets that touch the same file (AN04 + AN07, both in `AccountDashboard.tsx`, at disjoint blocks) can also run fully in parallel — resolving their combined diff is a mechanical merge, not a rework.

## Execution protocol (per ticket)

1. Spawn an implementer subagent with the ticket's full file content as its only prompt (plus the repo).
2. Spawn an independent reviewer subagent with the diff + that ticket's Acceptance Criteria checklist, asking it to mechanically verify every item (including "no edits outside the specified files") and to run the suggested tests plus `npm run lint` / `npm run typecheck`.
3. If the reviewer finds gaps, resume the implementer with the specific feedback and re-review.
4. Once all 8 are approved, run the full `npm run test` suite once (and `npm run test:integration` for AN04's Firestore-emulator test) to confirm no cross-ticket regression, then integrate.
