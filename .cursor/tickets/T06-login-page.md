# T06 — Rewrite the login page

**Difficulty:** Medium
**Wave:** 2 (depends on T01 being merged; built against frozen API contracts below, does not need to wait for T05 to literally finish first — but integration ticket T08 will fix any drift)
**Model:** claude-4.6-sonnet-medium-thinking
**Files owned (only this):**
- `flash-cards-app/src/app/login/page.tsx`
- Any colocated test file for it, if one is added.

Do NOT touch any `src/app/api/**` route files, `src/lib/**`, or `src/app/register/**`.

## API contracts to build against (frozen, implemented by sibling tickets)
- `POST /api/auth/resolve-identifier` — body `{ identifier: string }` -> `200 { email: string }` or `404 { error: string }`.
- `POST /api/auth/session` — body `{ idToken: string }` -> `200 { success: true }` or `401 { error: string }` (unchanged from today, already exists).

## Tasks
Keep the existing Google/Microsoft `signInWithPopup` buttons and their behavior exactly as-is (do not modify `handleOAuthSignIn`, the provider setup, or the icon components).

Replace the current password-only form (the `handleSubmit` function and its `<form>` posting to `/api/login`) with a new email-or-username + password form:
1. Two inputs: "Email or username" (text) and "Password" (password), plus a submit button "Sign in".
2. On submit:
   - `POST /api/auth/resolve-identifier` with `{ identifier: <email-or-username field value> }`.
   - If `404`, show error "No account found for that email or username."
   - If `200`, take the returned `email` and call `signInWithEmailAndPassword(firebaseAuth, email, password)` from `firebase/auth` (already imported as a pattern via `firebaseAuth` from `@/lib/firebase/client`).
   - On success, `getIdToken()` from the resulting user, `POST /api/auth/session` with `{ idToken }`.
   - If that 403s (email not verified — the session route rejects unverified accounts), show error "Please verify your email before signing in." with a link/hint to check their inbox.
   - On any Firebase auth error (wrong password, etc.), show a generic "Incorrect email/username or password." (do not leak which part was wrong).
   - On full success: `router.push('/')` and `router.refresh()`, same as the OAuth path today.
3. Add a "Don't have an account? Create one" link/button below the form, navigating to `/register` (use `next/link` or `router.push('/register')`).
4. Remove all now-dead code related to the old `/api/login` flow: the `password` state used for the old form (rename/reuse as needed for the new form), the `attemptsRemaining`/lockout-specific error message branches (`response.status === 429 && data.lockedUntil`) — the new email/password flow relies on Firebase's own rate limiting, so drop that branch entirely.
5. Preserve the overall visual structure/classNames style of the page (the card, spacing, "or use the site password" divider text should become something like "or sign in with email" instead, keeping the same visual divider).

## Acceptance criteria
- `npm run typecheck` / `npm run lint` pass.
- Manual/code review confirms: Google/Microsoft buttons untouched in behavior; new form correctly chains resolve-identifier -> signInWithEmailAndPassword -> session; error states are user-friendly and don't leak account existence beyond what resolve-identifier already reveals; register link present and correct.

## Report back
Screenshot-free summary of the new page structure/flow and confirm typecheck/lint pass with command output.
