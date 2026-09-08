# Flash Cards — Modernization Plan (Next.js + Firebase)

Prepared for handoff to a coding agent. Written against the actual repo state as of 2026-08-27.

## 0. Current state (ground truth)

### `Flash-Cards/` — the real app (MVP, functional)
- **Frontend**: React 18.2, TypeScript, Vite 5, Tailwind CSS 3, plain `fetch` API client (`src/api/client.ts`). No router (single view, conditional rendering), no state library (local `useState`/props only).
- **Backend**: Node.js, Express 4, TypeScript, `mysql2/promise`, raw parameterized SQL (no ORM/query builder), `dotenv` for config. Runs on port 3001, dev via `tsx watch`.
- **Database**: MySQL, two tables (`decks`, `cards`), schema created imperatively in code (`initializeDatabase()` in `db.ts`) with an ad hoc column-backfill hack — there is no migration system.
- **Features implemented**: deck CRUD, card CRUD, bulk import (plain text or `question :: answer`, or JSON via `scripts/import.mjs`), bulk delete, a weighted-random "spaced repetition" study session, a health-check endpoint that reports DB connectivity.
- **No auth** — single implicit user, no login, no multi-tenancy.
- **No tests, no CI, no linting enforced in CI, no Docker, no deployment config.**
- **No ORM** — hand-written SQL strings scattered across three route files.

There was previously also a `flash-cards-desktop/` Electron scaffold in this working directory — **the user has decided to drop the desktop app entirely.** It is out of scope for this plan; the target is a single web app. If the directory still exists in the repo, delete it as part of Phase 1 cleanup rather than maintaining it alongside the new build.

### Target direction (decided)
The user has decided the rebuild direction:
- **Frontend + backend: Next.js** (single codebase, App Router, Route Handlers/Server Actions instead of a separate Express service).
- **Storage: Firebase** (Firestore for data, Firebase Auth if/when multi-user is needed, Firebase Hosting or Vercel for deployment).
- **Platform: web only** — no desktop app.
- **Everything else** (feature scope, difficulty triage, phased rollout, spaced-repetition upgrade) stays as previously planned, adjusted below for the new stack.

This is a bigger architectural swap than the original "bump versions in place" plan — MySQL/Express are being replaced outright, not upgraded. Treat Phase 2 (data layer) as a rewrite, not a migration.

---

## 1. Target tech stack

| Layer | Current | Target | Why |
|---|---|---|---|
| Frontend + backend framework | React 18 + Vite 5 (frontend) / Express 4 (backend), two separate processes | **Next.js 15 (App Router), single deployable** | One codebase, one deploy target, Route Handlers replace Express routes, Server Components/Server Actions replace the manual `fetch` API client for a lot of read paths |
| Routing | none (conditional render) | Next.js file-based App Router (`/`, `/decks/[id]`, `/decks/[id]/study`) | Deep-linkable deck/study URLs, browser back button works, comes for free with the framework |
| Data fetching/cache | raw `fetch` + manual `useState` loading flags | Server Components for initial loads + TanStack Query (or `useSWR`) for client-side mutations/refetch (study session interactions, bulk import progress) | Removes hand-rolled loading/error/refetch logic; Server Components remove the need for a fetch layer entirely on first paint |
| Backend runtime | Express 4, standalone Node process | Next.js Route Handlers (`app/api/**/route.ts`) + Server Actions for mutations | No separate backend process/deploy; still has a real request/response layer for anything Firestore security rules shouldn't handle directly |
| Database | MySQL (local, unmanaged), raw SQL | **Firestore** (NoSQL document store) | User-decided. Eliminates local MySQL setup entirely, gets free real-time listeners and offline persistence for the web app |
| Data access layer | hand-written SQL strings | Firebase Admin SDK (server-side, in Route Handlers/Server Actions) + typed converter functions; **do not** call client Firestore SDK directly from server code | Keeps a single, auditable write path instead of scattering Firestore calls; converters give back the type safety the old raw-SQL layer lacked |
| Auth | none | Firebase Authentication (email/password + optionally Google sign-in) — only build if multi-user is a real goal | Firebase Auth is now a near-zero incremental cost since Firebase is already the storage layer — this changes the calculus vs. the original plan (see §3, revised) |
| Styling | Tailwind 3 | Tailwind 4 | Match desktop shell, faster builds (Oxide engine), simpler CSS-first config |
| Testing | none | Vitest (unit) + Firebase Emulator Suite (Firestore rules + Route Handler integration tests) + Playwright (E2E) | Zero coverage today is the biggest risk for a full rewrite — emulator tests are non-negotiable given Firestore security rules are the new attack surface |
| CI | none | GitHub Actions: lint, typecheck, unit test, emulator-backed integration test on every PR | Required before any agent-driven work — nothing else catches regressions or rule misconfigurations |
| Package manager | npm | pnpm (or keep npm — low priority) | Faster installs; not worth churn unless already touching lockfiles |
| Deployment | none configured | Vercel (native Next.js fit) or Firebase Hosting with Next.js support (`experimentalWebFrameworks`/App Hosting) | Pick one now — see §3 decision list; don't stand up both |

---

## 2. Feature inventory, sorted by upgrade difficulty

### LOW difficulty (mechanical, low risk, good first phase for an agent)

| Feature/Task | What it involves | Needs second eye? |
|---|---|---|
| Scaffold Next.js 15 app (App Router, TS, Tailwind 4) | `create-next-app`, wire up Tailwind 4 CSS-first config | No |
| Port static UI components (`FlashCard`, `DeckCard`, layout) into Next.js components | Mostly copy-paste with import path fixes; these are presentational and framework-agnostic already | No |
| Add ESLint/Prettier + pre-commit hook | Next.js ships ESLint config already; extend it | No |
| Add `.env.example` documenting Firebase config vars (`NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_ADMIN_*` service account) | Document required env vars for both client SDK and Admin SDK | No |
| Structured logging (pino or Next.js built-in) in Route Handlers | Swap `console.log`/`console.error` calls | No |
| Request validation (Zod) on all Route Handlers / Server Actions | Replace manual `if (!name) ...` checks with schema validation | No |
| Health check route (`/api/health`) reporting Firestore reachability | Small Admin SDK ping | No |

### MID difficulty (real design decisions, moderate blast radius)

| Feature/Task | What it involves | Needs second eye? |
|---|---|---|
| Design the Firestore data model | Decide: `decks` top-level collection, `cards` as a subcollection per deck **or** top-level `cards` with a `deckId` field (subcollection is the better fit here — study queries are always deck-scoped, and it avoids composite-index churn); denormalize `card_count` onto the deck doc and keep it in sync via a transaction or a Cloud Function | **Yes — mandatory.** NoSQL modeling mistakes are expensive to unwind later (unlike a relational schema, there's no cheap `ALTER TABLE`). Get this reviewed before writing any app code against it. |
| Write Firestore Security Rules | Even single-user, rules need to at minimum lock the database to authenticated/known access instead of Firestore's default-open or default-locked test-mode rules | **Yes — mandatory.** This is the new equivalent of SQL injection risk: a misconfigured rule can expose or corrupt all data to anyone with the Firebase config (which is public in client bundles by design). |
| Implement Route Handlers for deck/card CRUD + bulk import/delete against Firestore via Admin SDK | Rewrite `routes/decks.ts`, `routes/cards.ts` logic as `app/api/decks/route.ts` etc., or as Server Actions | No, once the data model (above) is settled |
| Introduce TanStack Query (or SWR) for client-driven mutations | Study session responses, bulk import submission — anything that needs optimistic UI or polling | No, mechanical once pattern is set |
| Add automated tests (Vitest + Firebase Emulator Suite) | Emulator-backed tests for Route Handlers and security rules; unit tests for the weighted-random/spaced-repetition selection logic | **Yes** — tests must assert on both the scheduling logic AND that security rules actually block cross-deck/cross-user access, not just happy-path CRUD |
| Add CI pipeline running the emulator suite | GitHub Actions job spins up `firebase emulators:exec` for tests | No |
| Improve study algorithm (real spaced repetition, e.g. SM-2/Leitner) | Current "weight" system is a naive linear weighting, not real spaced repetition — replace `weight`/`times_seen` fields with `easeFactor`/`intervalDays`/`dueAt` on each card doc, add a Firestore query for "cards due today" | **Yes** — this changes the core learning-science logic the app is named after; needs review against a reference SM-2 implementation, plus attention to Firestore query limits (range/inequality filters on `dueAt` need a matching index) |
| Bulk import UX/robustness (CSV, dedup, per-row error reporting) | Extend `scripts/import.mjs` and the import UI; Firestore batched writes have a 500-op limit, so large imports need chunking | No, but chunking logic should be unit tested |

### HIGH difficulty (architectural, cross-cutting, or speculative — scope carefully)

| Feature/Task | What it involves | Needs second eye? |
|---|---|---|
| Multi-user auth (Firebase Auth, per-user decks) | Add `ownerId` field to deck docs, scope all Firestore queries + security rules by `request.auth.uid`, add sign-in UI, migrate any existing single-tenant data to a default user | **Yes — mandatory, own phase, explicit sign-off before starting.** Note: this is now *cheaper* than in the MySQL plan since Firebase Auth + Firestore rules are built for exactly this pattern — but the security-rules review is still non-negotiable, since a scoping mistake here means one user reading another user's cards. |
| Real-time sync across multiple browser tabs/sessions for the same user | Firestore's `onSnapshot` listeners give this almost for free — but conflict resolution still needs thought for simultaneous edits from two open tabs | **Yes** — even with Firestore doing the heavy lifting, "two tabs mark the same card 'know' at once" needs an explicit merge rule (Firestore's last-write-wins default may not be what you want for weight/interval fields) |
| Spaced-repetition analytics/insights (retention graphs, streaks, forecasted review load) | New aggregation queries (Firestore aggregation queries or a scheduled Cloud Function that pre-computes stats), new UI | No extra review beyond normal correctness review; low priority — nice-to-have, not core |
| Offline-first PWA for the web app | Next.js PWA plugin/service worker + Firestore's own offline persistence (the two need to be coordinated, not layered naively) | **Yes** — sync-conflict logic, plus making sure the service worker cache and Firestore's IndexedDB cache don't fight each other |

---

## 3. Decisions the user needs to make before an agent starts

1. **Is this staying single-user, or becoming multi-user?** Now cheaper with Firebase Auth than it was with a hand-rolled auth system, but still its own phase with a security-rules review.
2. **Deployment target: Vercel or Firebase Hosting?** Both support Next.js App Router well. Vercel has the more mature/native Next.js integration; Firebase Hosting keeps everything (hosting + Firestore + Auth) under one provider/billing account. Pick one before Phase 1 scaffolding.
3. **How rigorous should the spaced-repetition algorithm be?** Keep the simple weighted-random approach (cheap, "good enough") vs. implement SM-2/Leitner properly (more work, but the app's raison d'être).

---

## 4. Recommended phased plan

### Phase 0 — Safety net (do this before anything else touches code)
1. Set up the Firebase Emulator Suite locally and in CI from day one — before writing app code against real Firestore, so every subsequent feature has a fast, free, offline-capable test target.
2. Write Vitest unit tests for the weighted-selection logic (port the existing logic's *intent* forward as a spec, even though the implementation is being rewritten).
3. Add GitHub Actions CI: install, lint, typecheck, unit test, emulator-backed integration test on every push/PR.
4. Get the decisions in §3 answered.

*Effort: LOW. Risk if skipped: the Firestore rules and data model (the two riskiest new pieces) get built without a test harness.*

### Phase 1 — Scaffold the new stack
1. `create-next-app` (App Router, TS, Tailwind 4) as the new single codebase — likely replacing `Flash-Cards/frontend` and `Flash-Cards/backend` with one `app/` (or a fresh top-level directory; decide whether to retire the `Flash-Cards/` naming or keep it). Delete `flash-cards-desktop/` if it still exists — the desktop app is out of scope.
2. Set up Firebase project, Firestore in the console, Admin SDK service account (server-only secret) and Web SDK config (public, client-side).
3. Port presentational components (`FlashCard`, `DeckCard`) with minimal changes.
4. Wire up Zod validation and pino/structured logging conventions for Route Handlers.

*Effort: LOW–MID. This is greenfield scaffolding, not a migration, so risk is mostly "wasted setup time," not "broke prod."*

### Phase 2 — Data layer (Firestore data model + security rules + CRUD)
1. Design and get sign-off on the Firestore data model (decks + cards subcollections, denormalized `card_count`).
2. Write and test Security Rules against the emulator (deny-by-default, explicit allow rules).
3. Implement Route Handlers/Server Actions for deck CRUD, card CRUD, bulk import (chunked for the 500-op batch limit), bulk delete.

*Effort: MID, highest correctness/security risk in the plan. Data model and rules both need a second eye before Phase 3 starts building UI against them — a rework here is expensive.*

### Phase 3 — Frontend integration
1. Build out the App Router routes (`/`, `/decks/[id]`, `/decks/[id]/study`) using Server Components for initial data and TanStack Query/Server Actions for mutations.
2. Wire the study session flow (see §5) against the new Firestore-backed Route Handlers.

*Effort: MID. Needs second eye on navigation/back-button behavior and on Server Component vs. client-state boundaries (a common source of subtle Next.js App Router bugs).*

### Phase 4 — Core feature upgrade: real spaced repetition
1. Replace the linear weight system with SM-2 (or simplified Leitner boxes) — add `easeFactor`, `intervalDays`, `dueAt` fields to card documents via a one-time backfill script (Admin SDK batch write).
2. Rewrite the "next card" selection logic around "cards due today" (Firestore query with a `dueAt <= now` filter, composite index on `deckId` + `dueAt`).
3. Test thoroughly against simulated multi-day study sessions using the emulator's ability to fast-forward via manually written timestamps.

*Effort: MID–HIGH. This is the feature most worth getting right — it's the entire value proposition of the app. Second eye required on algorithm correctness and on the Firestore composite index needed for the due-cards query.*

### Phase 5 — Scope-dependent (only if §3 decisions call for it)
- Multi-user auth via Firebase Auth, if decided — add `ownerId` scoping to rules and queries.
- Offline-first PWA for the web app, if decided.

*Effort: HIGH. Do not start until Phase 0–2 are done and §3 is answered — building auth or offline support on top of an unreviewed data model/rules set compounds risk.*

---

## 5. Study session flow (target behavior on the new stack)

1. User selects a deck → Server Component (or Route Handler, if client-driven) queries the `cards` subcollection under that deck, excluding cards already marked "know" this session (tracked in client state, passed as excluded IDs — same pattern as before, no server-side session state needed for this).
2. Weighted-random selection: fetched cards weighted by their `weight` field (Phase 1–3) or filtered by `dueAt <= now` (Phase 4, once real spaced repetition lands) — selection logic runs in a Route Handler/Server Action, not client-side, to keep it in one auditable place.
3. User answers "I Know" / "Not Sure" / "Don't Know" → Server Action or Route Handler updates the card document: `know` → excluded from this session's rotation (weight/interval unaffected until Phase 4 changes this to "schedule far in the future" instead), `uncertain` → weight +1 (or shorter interval), `dont_know` → weight +3 (or interval reset). Increments `timesSeen`.
4. Repeat until no cards remain / no cards due.
5. "Reset deck" resets all weights to 1 (or, post-Phase 4, resets all `dueAt` to now) — implemented as a chunked batch write across the deck's cards subcollection.

This preserves the original app's actual behavior in Phases 1–3, then upgrades it to real day-to-day spaced repetition in Phase 4, exactly as in the original plan — only the storage/query mechanics change (Firestore queries instead of SQL).

## 6. Bulk import flow (target behavior on the new stack)

1. UI submits `{ deckId, questions: (string | {question, answer})[] }` to a Route Handler or Server Action.
2. Handler normalizes each item (trim, drop empty questions), verifies the deck exists, then writes in **batches of ≤500** (Firestore's hard limit per batched write) using the Admin SDK's `WriteBatch`.
3. Same low-priority MID-difficulty improvement as before applies: per-row error reporting instead of all-or-nothing, now with the added nuance that a batch failure needs to report which chunk failed, not just "import failed."

---

## 7. Summary of what needs a second (human) reviewer, not just an agent's own verification

- **Firestore data model design** (NoSQL modeling mistakes are expensive to unwind — no cheap schema migration escape hatch)
- **Firestore Security Rules** (the new equivalent of the old plan's "SQL injection risk" — a misconfigured rule can expose all data, since the client Firebase config is public by design)
- Spaced-repetition algorithm rewrite (core product correctness)
- Multi-user auth design via Firebase Auth, if undertaken (still security-critical even though Firebase makes the plumbing easier)
- Deployment target choice (Vercel vs. Firebase Hosting) — not risky, but worth confirming once rather than drifting into supporting both
- Next.js App Router data-fetching boundaries (Server Component vs. Server Action vs. client-side TanStack Query) — easy to get subtly wrong in ways that don't error, just produce stale or over-fetched data
- Offline sync/conflict resolution, if the web app goes offline-first as a PWA (subtle correctness bugs, even with Firestore doing most of the heavy lifting)

Everything else in the LOW and most of the MID tier is safe for an agent to execute autonomously against Phase 0's test suite (emulator + Vitest), with normal PR review.
