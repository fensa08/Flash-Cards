# Design system re-theme — ticket breakdown

Source plan: re-theme `flash-cards-app` from the placeholder dark indigo/slate theme to the
"Lumina Learn" design system found in `design/*.dc.html` (light mode = `Learning App Minimal.dc.html`,
dark mode = `Learning App.dc.html`). Full token/pattern details are in the plan; this file exists so
an orchestrator can spawn execution agents per ticket with minimal shared context.

All paths are relative to `flash-cards-app/`.

## Dependency graph

```
WAVE 0 (sequential, blocking everything)
  T1 Foundation: tokens + fonts

WAVE 1 (parallel, depends only on T1)
  T2 Shared primitives (StatTile + primitive conventions doc)
  T3 App shell + Sidebar nav

WAVE 2 (fully parallel, depends on T1+T2+T3, NO file overlap between tickets)
  T4 Dashboard + home
  T5 Decks & Study (core flashcard flow)
  T6 Courses
  T7 Learning
  T8 Testing
  T9 Analytics & Insights
  T10 Mentor + Chat/Ask
  T11 Auth & misc pages

WAVE 3 (sequential, depends on ALL of wave 2)
  T12 Cleanup sweep
```

Orchestrator note: T2 and T3 touch disjoint files and can run concurrently. Every ticket in WAVE 2
was checked for import/file overlap (e.g. `testing/flashcards` reuses `DeckList` from T5, not a
separate implementation — so T8 must NOT restyle `DeckList.tsx`, only its own testing-specific files).

---

## T1 — Foundation: design tokens + fonts
**Depends on:** nothing. **Blocks:** everything else.

**Files:**
- `src/app/layout.tsx`
- `src/app/globals.css`

**Scope:**
- Replace `Geist`/`Geist_Mono` (`next/font/google`) with `Inter`, `JetBrains_Mono`, and
  `Cormorant_Garamond`, each bound to a CSS variable (`--font-inter`, `--font-mono`, `--font-serif`).
- In `globals.css`, define full token set as CSS variables under `:root` (light) and under the
  existing `@media (prefers-color-scheme: dark)` block (dark), then expose them via `@theme inline`
  (same pattern already used for `--color-background`/`--color-foreground`) so Tailwind utilities
  like `bg-background`, `text-foreground`, `bg-accent`, `text-accent`, `border-border`, `bg-surface`,
  `text-danger` etc. become available.

  Light values: bg `#faf9f7`, panel `#f3f2ef`, foreground `#16151a`, body `#4a4843`, muted `#6b6862`,
  accent `#3f7a5f` (hover `#356b52`, deep `#2f6b50`/`#27523e`), surface `#ffffff`,
  border `rgba(0,0,0,.055)`–`rgba(0,0,0,.11)`, danger `#b8474a`/`#8f3134`.

  Dark values: bg `#0d0d0f`, panel `#13131a`, foreground `#f0eee8`, muted `#9b9890`/`#6b6860`,
  accent (primary/amber) `#e8a945` (hover `#f0c85a`, deep `#c97c2a`), accent-secondary (purple)
  `#9b7fe8` (deep `#6b4fc4`, tint `#b8a0f0`) for streak/avatar/voice-orb accents, surface = translucent
  white overlay, border `rgba(255,255,255,.08)`–`rgba(255,255,255,.14)`.
- Add global resets from the mockups: scrollbar styling, `a` color/hover, and the mentor-orb keyframes
  (`orbPulse`, `ringOut`, `bar`, `drift`) needed later by T10.
- Update `viewport.themeColor` in `layout.tsx` to `#faf9f7`.

**Acceptance:** `npm run build` succeeds; a plain page renders with the new background/foreground
colors and Inter font with no visual change to logic/behavior.

---

## T2 — Shared primitives
**Depends on:** T1. **Blocks:** T4–T11 (they should reuse these patterns, but don't literally import
new code, so this can run in parallel with T3).

**Files:**
- `src/components/StatTile.tsx`

**Scope:**
- Restyle `StatTile` to the mockup's stat-card look: `rounded-2xl bg-surface border border-border
  shadow-sm` container, muted label, big number in `font-mono` (JetBrains Mono) with optional
  smaller unit, optional hint text, optional thin (`h-1 rounded-full bg-black/10`) progress bar fill
  in accent color. Keep the existing prop API (`label`, `value`, `unit`, `hint`) unchanged — do not
  add new required props, since callers across T4/T6/T9 depend on the current signature.
- Write down (as a short comment block or just consistent class usage — no new file needed) the
  reusable utility patterns other tickets should copy:
  - Card: `rounded-2xl bg-surface border border-border shadow-sm`
  - Primary button: `rounded-lg bg-accent text-white font-semibold hover:bg-accent-hover`
  - Secondary button: `rounded-lg bg-surface border border-border hover:border-accent/50`
  - Pill/badge: `rounded-full text-xs px-3 py-1.5`, tinted accent or neutral
  - Progress bar: `h-1 rounded-full bg-black/10` track + accent fill

**Acceptance:** `StatTile` renders correctly wherever it's already used (dashboard, analytics)
without prop changes; visually matches mockup stat cards.

---

## T3 — App shell + Sidebar navigation
**Depends on:** T1. **Blocks:** nothing directly (all pages render inside it, but don't need to wait).

**Files:**
- `src/components/shell/Sidebar.tsx`
- `src/components/shell/AppShell.tsx`

**Scope:**
- Rebuild `Sidebar` to match the mockup aside: logo mark + "Flash Cards" wordmark (remove the
  "Aletheia"/Λ placeholder branding), nav items with icon + label + right-aligned meta, active state
  = subtle tinted background (`bg-black/5` light / equivalent dark), a study-streak widget if real
  data is available (do not fabricate numbers — omit the widget if there's no backing data source),
  and a user/profile footer row. Keep existing `handleSignOut` logic and `usePathname`/`isActive`
  logic untouched — this is a styling-only pass.
- `AppShell.tsx`: update background/overflow classes to new tokens (likely minimal change).

**Acceptance:** Nav still navigates correctly, active-route highlighting still works, sign-out still
works; visuals match the mockup sidebar in both light/dark.

---

## T4 — Dashboard + home
**Depends on:** T1, T2, T3.

**Files:**
- `src/app/(app)/page.tsx`
- `src/components/home/QuickAskBar.tsx`

**Scope:** Restyle to match the mockup's "Overview" screen: greeting header, "this week at a
glance" stat-tile row (reuse T2's `StatTile`), "recently accessed" card grid, "favorites" card grid.
Swap all `slate-`/`indigo-`/`purple-` classes for the new tokens.

---

## T5 — Decks & Study (core flashcard flow)
**Depends on:** T1, T2, T3.

**Files:**
- `src/components/DeckCard.tsx`
- `src/components/DeckList.tsx`
- `src/components/FlashCard.tsx`
- `src/components/StudySession.tsx`
- `src/components/BulkImportModal.tsx`
- `src/components/DeckInsights.tsx`

**Scope:** This is the highest-priority visual surface. Match the mockup's flashcard flip-card
(`rounded-[18px] bg-surface border`, centered prompt/answer text) and the Again/Hard/Good/Easy
button row (red-tinted Again, neutral Hard, accent-tinted Good/Easy). Restyle deck cards/list/modal/
insights to the card + button primitives from T2. Swap all `slate-`/`indigo-`/`purple-`/`rose-`
classes. Do not change any study-scheduling logic, only presentation.

**Note:** `testing/flashcards/page.tsx` imports `DeckList` from here — do not duplicate that
component under `testing/`.

---

## T6 — Courses
**Depends on:** T1, T2, T3.

**Files:**
- `src/components/courses/CourseList.tsx`
- `src/components/courses/CourseDetail.tsx`
- `src/components/courses/ModulesView.tsx`
- `src/components/courses/RoadmapView.tsx`
- `src/components/courses/ResearchPanel.tsx`
- `src/components/courses/MindMapView.tsx` + `MindMapView.css`
- `src/app/(app)/courses/page.tsx`
- `src/app/(app)/courses/[id]/page.tsx`
- `src/app/(app)/courses/[id]/instructor/page.tsx`

**Scope:** Match the mockup's Course Builder screen (drop-zone upload state, generate+research
state with source list, browse/search materials grid) and use its tab-pill pattern for the
Drop/Generate/Browse sub-nav. `MindMapView.css` has hardcoded hex colors — update them to the new
palette (don't hardcode literals; use the same hex values now defined as CSS vars in T1 if the CSS
file can reference `var(--color-...)`, otherwise mirror the token values directly).

---

## T7 — Learning
**Depends on:** T1, T2, T3.

**Files:**
- `src/components/learning/MaterialsHub.tsx`
- `src/components/learning/MaterialPreview.tsx`
- `src/app/(app)/learning/page.tsx`
- `src/app/(app)/learning/materials/[id]/page.tsx`

**Scope:** Match the mockup's "Learning" reader screen: left chapter-progress rail, main article
column with serif-free but generous line-height body text, highlighted "why it matters" callout
box, code/formula block styling, "sourced from" citation pills, and the inline "ask the mentor"
prompt bar at the bottom.

---

## T8 — Testing
**Depends on:** T1, T2, T3.

**Files:**
- `src/components/testing/QuizList.tsx`
- `src/components/testing/QuizRunner.tsx`
- `src/components/testing/AiTesterRunner.tsx`
- `src/components/testing/TestingSchedule.tsx`
- `src/app/(app)/testing/page.tsx`
- `src/app/(app)/testing/quizzes/page.tsx`
- `src/app/(app)/testing/quizzes/[id]/page.tsx`
- `src/app/(app)/testing/ai-tester/page.tsx`
- `src/app/(app)/testing/ai-tester/[quizId]/page.tsx`
- `src/app/(app)/testing/schedule/page.tsx`
- `src/app/(app)/testing/tutor/page.tsx`

**Scope:** Match the mockup's mode-picker cards (Flashcards / Four-choice quiz / AI Tutor), the MCQ
screen (progress bar, answer choices with correct/incorrect tint states, explanation callout), and
the AI Tutor chat bubbles (left = tinted accent bubble, right = solid accent bubble).

**Note:** Do NOT touch `DeckList.tsx`/`FlashCard.tsx`/`StudySession.tsx` — those belong to T5 even
though `testing/flashcards/page.tsx` renders them.

---

## T9 — Analytics & Insights
**Depends on:** T1, T2, T3.

**Files:**
- `src/components/GlobalAnalytics.tsx`
- `src/components/analytics/PriorityList.tsx`
- `src/components/analytics/SessionConsistency.tsx`
- `src/components/analytics/TopicBreakdown.tsx`
- `src/components/charts/AccuracyTrendChart.tsx`
- `src/components/insights/OverallAnalyticsDashboard.tsx`
- `src/app/(app)/analytics/page.tsx`
- `src/app/(app)/decks/[id]/insights/page.tsx` (page wrapper only — `DeckInsights.tsx` itself is T5)

**Scope:** Match the mockup's Insights screen: stat-tile row (reuse T2), accuracy-trend SVG
sparkline (accent-colored polyline over faint gridlines), coverage-map segmented bar + legend,
consistency heatmap grid, "topics strongest to weakest" bar list, and the priority-list card with
decay badges (danger-tinted "High decay" pill, neutral "Medium"/"Untested" pills).

---

## T10 — Mentor + Chat/Ask
**Depends on:** T1, T2, T3.

**Files:**
- `src/components/mentor/VoiceOrb.tsx`
- `src/components/mentor/useVoiceSession.ts` (styling-adjacent constants only, e.g. colors passed
  into the orb — do not touch the voice/session logic itself)
- `src/components/chat/ChatPanel.tsx`
- `src/app/(app)/mentor/page.tsx`
- `src/app/(app)/ask/page.tsx`

**Scope:** Match the mockup's voice-mode screen: centered pulsing orb using the `orbPulse`/
`ringOut`/`bar` keyframes added in T1, listening waveform bars, status label, transcript bubble
pair, and the pill row of context chips. Use the dark-mode purple secondary accent for the orb glow
per the dark mockup, sage green in light mode.

---

## T11 — Auth & misc pages
**Depends on:** T1.

**Files:**
- `src/app/login/page.tsx`
- `src/app/offline/page.tsx`

**Scope:** Simple background/card restyle to the new tokens — these are outside the app shell so
they don't depend on T3. Can start as soon as T1 lands.

---

## T12 — Cleanup sweep
**Depends on:** T4, T5, T6, T7, T8, T9, T10, T11 (all of wave 2).

**Scope:**
- `grep -rn "slate-\|indigo-\|purple-\|rose-" src/` and fix any stragglers.
- Remove unused `Geist`/`Geist_Mono` references and leftover "Aletheia" branding strings anywhere
  they still appear (e.g. `manifest.ts`, metadata).
- Run `npm run lint` and `npm run build`; fix any unused-import/type errors surfaced by the sweep.

**Acceptance:** Clean grep, clean lint, clean build.
