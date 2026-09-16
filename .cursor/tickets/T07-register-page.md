# T07 — Build the /register page

**Difficulty:** Medium-High
**Wave:** 2 (depends on T01 being merged; built against frozen API contracts below)
**Model:** claude-sonnet-5-thinking-medium
**Files owned (only these):**
- `flash-cards-app/src/app/register/page.tsx` (new)
- Any colocated test file for it.

Do NOT touch any `src/app/api/**` route files, `src/lib/**`, or `src/app/login/**`.

## API contracts to build against (frozen, implemented by sibling tickets)
- `POST /api/auth/register` — body `{ fullName, email, username, password, confirmPassword, dailyStudyGoalMinutes, dailyTestingGoalMinutes }` -> `200 { success: true, email }` (sets an httpOnly pending-reg cookie automatically, nothing to store client-side) or `400/409` `{ error: string }`.
- `POST /api/auth/verify-email` — body `{ code: string }` -> `200 { customToken: string }` or `400/401/429 { error: string, code?: string }`.
- `POST /api/auth/resend-code` — no body -> `200 { success: true }` or `429 { error: string, retryAfterMs: number }`.
- `POST /api/auth/session` — body `{ idToken: string }` -> `200 { success: true }` (already exists, unchanged).
- Firebase client: `signInWithCustomToken(firebaseAuth, customToken)` from `firebase/auth`, `firebaseAuth` from `@/lib/firebase/client`.

## Tasks
Build a two-step client component page, visually consistent with `src/app/login/page.tsx` (reuse similar card/container styling, Tailwind classes, color tokens like `bg-surface`, `border-border`, `text-accent`, `bg-accent`, etc.).

### Step 1: Registration form
Fields: Full name, Email, Username, Password, Confirm password, Daily study goal (a `<select>` with options in minutes, e.g. 10/15/30/45/60), Daily testing goal (a `<select>`, e.g. number of cards per day: 10/20/30/50/100 — use your best judgement for reasonable options, matching the spirit of the existing Account page's "Daily study goal" mock at `src/components/account/AccountDashboard.tsx`).

Inline password requirements checklist shown live as the user types (min 8 chars, uppercase, lowercase, number, symbol — visually indicate which are met, e.g. green check vs grey), plus a "passwords match" indicator once confirm-password is non-empty. Disable submit until all client-side checks pass (still handle server 400s gracefully regardless).

On submit: `POST /api/auth/register`. On success, transition to Step 2 and store the `email` returned (for display: "We sent a code to {email}"). On error, show the server's `error` message inline (map 409 duplicate-username/email to clear messages).

### Step 2: Code verification
6-digit code input (single text/number input is fine, or 6 individual boxes — your choice, keep it simple and accessible), "Verify" button, and a "Resend code" button.

- "Resend code": on click, `POST /api/auth/resend-code`; on success, start/restart a 60-second countdown during which the button is disabled and shows "Resend in Ns"; on `429`, use the returned `retryAfterMs` to start the countdown instead (don't let the user hammer the endpoint). Show the countdown immediately after the initial successful registration too (the code is already sent as part of `/api/auth/register`), i.e. Step 2 should mount with the resend button already in its 60s-cooldown state.
- "Verify": on click, `POST /api/auth/verify-email` with `{ code }`. On `200`, call `signInWithCustomToken(firebaseAuth, customToken)`, then `getIdToken()`, then `POST /api/auth/session`, then `router.push('/')` + `router.refresh()`. On error, show the server's message (expired/invalid/too-many-attempts) and, for `too_many_attempts`, nudge the user to hit "Resend code".

### Misc
- Add a "Already have an account? Sign in" link back to `/login`.
- Handle loading/pending states on all buttons (disable while in-flight, similar to the existing login page's `pending`/`oauthPending` state pattern).

## Acceptance criteria
- `npm run typecheck` / `npm run lint` pass.
- Code review confirms: password requirement checklist logic is correct and matches the server-side policy described in T03 (min 8, upper, lower, digit, symbol); resend cooldown timer counts down and re-enables correctly; full happy path (register -> verify -> signed in) is wired correctly per the contracts above.

## Report back
Summary of the page's structure/flow and confirm typecheck/lint pass with command output.
