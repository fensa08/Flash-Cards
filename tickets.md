# Tickets

Generated from [`flash-cards-app/ROADMAP.md`](flash-cards-app/ROADMAP.md) and
[`system-design-prep/ROADMAP.md`](system-design-prep/ROADMAP.md). Each ticket is scoped
so it can be picked up independently by an agent (or a human). The **Key** column tells
you whether it's safe to run concurrently with other in-flight tickets.

This file is a plain task breakdown, not an execution log — it does not replace or
duplicate `flash-cards-app/.agent-workflow/roadmap.md` (which tracks TASK-001..017,
the modernization/KPI queue). Nothing here should be merged into that file.

## Key

| Symbol | Meaning |
|---|---|
| 🟢 **PARALLEL** | No unmet dependencies. Start immediately; safe to run alongside any other 🟢 ticket right now. |
| 🔵 **UNLOCKS** | Foundational — other tickets are blocked on this. Prioritize finishing it fast; it gates how much parallel work is possible. |
| 🟡 **BLOCKED** | Has unmet dependencies (see `Depends on`). Do not start until those are done/merged. |
| ⚪ **OPTIONAL** | Stretch/polish. Fine to skip or deprioritize under time pressure. |

"Wave" = a batch of tickets that can all be started together given prior waves are done.

---

## Part 1 — flash-cards-app (`flash-cards-app/ROADMAP.md`)

### Dependency graph

```
Wave 1 (start now, parallel):        FC-01 🔵   FC-06 🟢   FC-08 🟢 ⚪   FC-09 🟢   FC-10 🟢   FC-11 🟢   FC-12 🟢   FC-13 🟢 ⚪
                                        │
Wave 2 (after FC-01 merged):      FC-02 🟢  FC-03 🟢  FC-04 🟢  FC-05 🟢  FC-07 🟢 ⚪
```

### FC-01 — Chat infrastructure (streaming API + reusable chat UI)
**Key:** 🔵 UNLOCKS · Wave 1 · Tier A
**Depends on:** —

Build one streaming chat API route + one reusable chat UI (message list + input) using
the installed `ai` SDK (v7.0.95, wired to Vercel AI Gateway via `src/lib/ai/models.ts`).
No persistence for v1 — client-state-only conversation, per the roadmap's hackathon
scope.

- **Consult the `ai-sdk` skill before implementing** — v7's streaming/chat APIs differ
  from older versions.
- Design reference: chat bubble layout in `../design/Learning App Minimal.dc.html`
  lines 408-421 (AI Tutor chat inside the Testing hub tab).
- Every downstream chat ticket (FC-02, FC-03, FC-04, FC-05, FC-07) reuses this
  component with a different system prompt and/or entry point — build once, expose a
  clean prop/config surface (system prompt, entry point, mode label) so those tickets
  don't need to touch this component's internals.
- **Blocks:** FC-02, FC-03, FC-04, FC-05, FC-07. Land and merge this first / fastest —
  it's the critical path for the whole Tier B/C wave.

### FC-02 — AI Tutor mode
**Key:** 🟢 PARALLEL (once FC-01 lands) · Wave 2 · Tier B
**Depends on:** FC-01

Socratic, explain-on-demand mode. Hooks into existing lesson content via an "Explain
this" / "Simplify" affordance.

- Design reference: lesson reader lines 290-342, chat 408-421.
- Own its own system-prompt/entry-point file(s); don't edit FC-01's shared chat
  component internals — only consume its public interface — to avoid merge conflicts
  with FC-03/FC-04/FC-05 landing at the same time.

### FC-03 — AI Instructor mode
**Key:** 🟢 PARALLEL (once FC-01 lands) · Wave 2 · Tier B
**Depends on:** FC-01

Structured, lecture-style walkthrough persona for a course module. Same chat
component/route as the Tutor, different system prompt (and maybe a mode toggle in
the UI).

- Same file-isolation note as FC-02 — own prompt/entry-point files only.

### FC-04 — General AI chatbot
**Key:** 🟢 PARALLEL (once FC-01 lands) · Wave 2 · Tier B
**Depends on:** FC-01

Ambient assistant entry point on the home/overview page, no specific course context
required — general Q&A over whatever materials/courses exist.

- Design reference: "Ask the search agent" input bar, lines 78-164.
- Same file-isolation note as FC-02/FC-03.

### FC-05 — AI Tester (conversational adaptive testing)
**Key:** 🟢 PARALLEL (once FC-01 lands) · Wave 2 · Tier C
**Depends on:** FC-01

One question at a time, probing follow-ups on wrong answers, ends with a score
persisted the same way a quiz attempt is today.

- Extend the `submitQuizAttemptAction` pattern in `src/lib/actions/testing.ts`.
- Design reference: Testing hub mode picker, lines 344-423.
- Touches `src/lib/actions/testing.ts` — if FC-06 also lands in the same window,
  double-check for overlapping edits in that file (FC-06 is UI-only over existing
  forecast data, so overlap risk is low, but flag it in review).

### FC-06 — Pre-generated testing schedule
**Key:** 🟢 PARALLEL · Wave 1 · Tier C
**Depends on:** —

Calendar/list view merging the existing due-card forecast (`ForecastDay[]`, already
computed for the analytics forecast chart) with quiz-retake suggestions — a 7-14 day
"what to review/retest and when" look-ahead.

- Mostly new UI on top of existing forecast data; no chat dependency at all — safe to
  build fully independently, even before FC-01 lands.
- No design mockup covers this specifically; call it out as net-new when building.

### FC-07 — AI Mentor voice mode
**Key:** 🟢 PARALLEL (once FC-01 lands) · Wave 2 · Tier D · ⚪ OPTIONAL
**Depends on:** FC-01

Orb + waveform UI, voice input/output.

- Design reference: lines 479-506.
- Explicit stretch goal — skip first if time-pressured; only pick up if the Wave 2
  agents finish FC-02–FC-05 with time to spare.

### FC-08 — Upgrade MindMapView to interactive graph canvas
**Key:** 🟢 PARALLEL · Wave 1 · Tier D · ⚪ OPTIONAL
**Depends on:** —

Replace `MindMapView`'s current nested-list rendering with an interactive graph
canvas.

- Fully independent of the chat work (FC-01–FC-07) and of FC-06 — different files
  entirely (`MindMapView.tsx`). Safe to run in any wave.
- Polish item — only if time remains.

### FC-09 — Favorites & Pinning System
**Key:** 🟢 PARALLEL · Wave 2 · Tier D
**Depends on:** —

Persist user-pinned favorites on the Overview dashboard shelf (supporting courses,
materials, flashcard decks, and research papers).

- Add Firestore schema for pinned favorites (`user_favorites` collection or array on
  user profile with `{ id, entityType, title, progress, total, targetHref }`).
- Implement "+ Pin something" picker modal allowing users to search and select any
  existing course, deck, note, or research paper to pin.
- Implement "Manage" dialog for reordering, renaming, or removing pinned favorites.
- Visual reference: Favorites shelf in Overview mockup (4 cards wide, 3 pinned cards
  + 1 dashed "+ Pin something" slot).

### FC-10 — Cross-Entity Unified Recent Activity Feed
**Key:** 🟢 PARALLEL · Wave 2 · Tier C
**Depends on:** —

Unify recent interaction history across all core entities into a normalized activity stream
shown in the Overview "Recently accessed" list.

- Track and aggregate events from:
  1. Notes reader (reading progress, chapters read, source documents).
  2. Flashcard decks (SRS study sessions completed, due cards remaining).
  3. AI Mentor (voice/audio conversation sessions completed, summaries generated).
  4. Quizzes (completed attempts, scores, and accuracy percentages).
- Expose server action `getRecentActivityAction(limit = 10)` returning uniform
  `RecentActivityItem` objects (`type: 'NOTES' | 'FLASHCARDS' | 'MENTOR' | 'QUIZ'`,
  title, progress text, progress percentage, relative timestamp).
- Wire deep links for each row directly to the corresponding viewer/session.

### FC-11 — Overview Timeframe Selector & Multi-Window Analytics
**Key:** 🟢 PARALLEL · Wave 2 · Tier C
**Depends on:** —

Implement the "Last 7 days" timeframe filter on the Overview "This week at a glance" panel.

- Support selecting time windows: `7d` (Last 7 days), `14d` (Last 14 days), `30d` (Last 30 days),
  and `all` (All time).
- Dynamically aggregate:
  1. Retention sparkline curve and delta (+X pts relative to previous window).
  2. Daily cards reviewed bar chart across the selected window.
  3. Study time bar chart and session count.
  4. Due today queue donut completion gauge.
- Update `getOverallAnalyticsAction` to accept `{ timeframe: '7d' | '14d' | '30d' | 'all' }`.

### FC-12 — Weak Topic Remediation Study Flow
**Key:** 🟢 PARALLEL · Wave 2 · Tier B
**Depends on:** —

Identify lowest-mastery topics dynamically and enable targeted remediation sessions.

- Compute weak spots from SRS ratings (cards rated "Again" or "Hard") and quiz question
  accuracy per topic tag.
- Display top 3 weakest topics with their mistake/difficulty frequency score (e.g.
  `Backpropagation 34`, `Bayes rule 41`, `Attention masks 52`).
- Clicking "Review these 18 cards →" launches a filtered study session containing only
  cards belonging to the identified weak topics.
- Clicking an individual weak topic tag opens a focused drill-down modal or launches
  a dedicated mini-quiz on that topic.

### FC-13 — Study Tips & Spaced Repetition Best Practices Hub
**Key:** 🟢 PARALLEL · Wave 2 · Tier D · ⚪ OPTIONAL
**Depends on:** —

Implement the `/tips` route linked in the sidebar navigation.

- Provide evidence-based study guidance: active recall vs. passive review, optimal
  SM-2 spacing intervals, interleaving concepts, and managing cognitive load.
- Include quick interactive cards and best-practice checklists for students preparing
  for exams or technical interviews.

---

## Part 2 — system-design-prep (`system-design-prep/ROADMAP.md`)

This roadmap is a personal study plan, not application code. The tickets below
reframe each phase as a content-production task (study notes + cheat-sheet +
flashcard-ready Q&A + mock-question bank per phase) so multiple agents can research
and draft materials concurrently. A human still has to do the actual studying/mock
practice, but the material prep can be parallelized.

### Dependency graph

```
Wave 1 (start now, parallel):   SD-01 🟢  SD-02 🟢  SD-03 🟢  SD-04 🟢  SD-05 🟢  SD-07 🟢
                                    │         │         │         │         │
                                    └─────────┴────┬────┴─────────┘
                                                    ▼
Wave 2 (after all Wave 1 done):               SD-06 🟡
```

Each phase's topic list, priority (🔴/🟡/⚪), depth (📖/⚖️/🛠️/🔬), and "go deep" flag
(🟦/🟨/⬜) come straight from the roadmap's tables — preserve them in the output so
the study-time allocation signal isn't lost.

### SD-01 — Phase 1 materials: Foundations & Vocabulary
**Key:** 🟢 PARALLEL · Wave 1
**Depends on:** —

Produce a study-note doc + condensed cheat-sheet + flashcard Q&A pairs for: the
system-design-interview meta-approach (🔴🛠️🟦), Performance vs Scalability (🔴⚖️🟨),
Latency vs Throughput (🔴⚖️🟨), CAP Theorem (🔴🛠️🟦), Consistency Patterns (🔴⚖️🟨),
Availability Patterns (🟡⚖️🟨), Availability in Numbers/the 9s (⚪📖⬜).

- Include the roadmap's 4 mock questions for this phase as a ready-to-use drill set.

### SD-02 — Phase 2 materials: Core Building Blocks
**Key:** 🟢 PARALLEL · Wave 1
**Depends on:** —

Same output format as SD-01, for: SQL vs NoSQL (🔴🛠️🟦), DB scaling — Replication &
Sharding (🔴🛠️🟦), Federation/Denormalization/SQL Tuning (🟡⚖️🟨), NoSQL types (🟡📖⬜),
Load Balancers (🔴⚖️🟨), Horizontal Scaling (🔴🔬🟦), Caching strategies (🔴🛠️🟦),
Caching types (🟡📖⬜), CDN Push vs Pull (🟡📖⬜), DNS (⚪📖⬜).

- Include the roadmap's 6 mock questions for this phase.
- For Horizontal Scaling specifically, prompt for real EC2/infra anecdotes per the
  roadmap's note that this is a "cheap Deep investment" given existing experience.

### SD-03 — Phase 3 materials: Communication, Async, Services
**Key:** 🟢 PARALLEL · Wave 1
**Depends on:** —

Same output format, for: Communication protocols REST/gRPC/GraphQL/RPC (🔴⚖️🟨),
HTTP vs TCP vs UDP (🟡📖⬜), Asynchronism/queues/back pressure (🔴🔬🟦), Idempotent
Operations (🔴🛠️🟦), Microservices & Service Discovery (🟡⚖️🟨), Background Jobs (⚪📖⬜).

- Include the roadmap's 6 mock questions.
- Flag Asynchronism and the multi-agent task-queue mock question as a strength area
  to lean into (per roadmap note tying it to orchestrator experience).

### SD-04 — Phase 4 materials: Reliability, Antipatterns, Monitoring
**Key:** 🟢 PARALLEL · Wave 1
**Depends on:** —

Same output format, for: Circuit Breaker/Retry/Bulkhead (🔴🛠️🟦), Performance
Antipatterns — Noisy Neighbor/Retry Storm/Chatty I/O/No Caching/N+1 (🟡⚖️🟨),
Queue-Based Load Leveling & Throttling (🟡⚖️🟨), Health Endpoint Monitoring (🟡🔬🟦),
Monitoring categories (⚪📖⬜), Leader Election (🟡⚖️🟨), Compensating
Transaction/Saga (🟡🛠️🟨).

- Include the roadmap's 6 mock questions.
- Health Endpoint Monitoring: prompt for a real incident-response anecdote (SSH/
  CloudTrail incident referenced in the roadmap) — coordinate with SD-07 so the story
  isn't drafted twice.

### SD-05 — Phase 5 materials: Applied Patterns
**Key:** 🟢 PARALLEL · Wave 1
**Depends on:** —

Same output format, for: CQRS & Event Sourcing (🟡🛠️🟨), Strangler Fig/Sidecar/
Anti-Corruption Layer (⚪📖⬜), API Gateway patterns (⚪📖⬜), Materialized View/Index
Table/Cache-Aside (⚪📖⬜), Messaging patterns — Pub/Sub/Competing Consumers/Priority
Queue/Claim Check/Choreography (🟡⚖️🟨), Federated Identity/Gatekeeper/Valet Key
(🟡🔬🟦), Deployment Stamps/Geodes (⚪📖⬜).

- Include the roadmap's 6 mock questions.
- Federated Identity/Valet Key: explicitly called out in the roadmap as "don't skip" —
  tie to eIDAS/EUDI Wallet background as a differentiator.

### SD-06 — Phase 6 synthesis pack: mock interviews + math drills
**Key:** 🟡 BLOCKED · Wave 2
**Depends on:** SD-01, SD-02, SD-03, SD-04, SD-05

No new topic material — this ticket assembles/cross-references everything the Wave 1
tickets produced. It can't start meaningfully until those exist, since the roadmap
explicitly scopes Phase 6 as pure application of Phases 1-5.

- Compile the 4 full 45-minute mock design problems: multi-agent task orchestration
  w/ shared memory + failure recovery; digital identity verification service;
  real-time notification/alerting system at scale; distributed rate limiter.
- Compile a back-of-envelope math drill set (QPS/storage/bandwidth estimation).
- Build a CAP-trade-offs-and-failure-modes narration checklist to run after each mock.
- Pull in SD-07's output as the production-story bank to slot into answers.

### SD-07 — Production story bank
**Key:** 🟢 PARALLEL · Wave 1
**Depends on:** —

Independent of topic content — draft the 2-3 real production stories the roadmap
calls out (SSH/CloudTrail incident, sharding/scaling decisions on metadexa-api) as
reusable, interview-ready narratives (situation/action/result format), tagged with
which topics/phases each story can support as evidence.

- Feeds into SD-04 (Health Endpoint Monitoring) and SD-06 (synthesis pack) but has no
  dependency itself — safe to start immediately, in fact worth doing early since it's
  referenced by two other tickets.
