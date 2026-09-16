# T03 — POST /api/auth/register

**Difficulty:** High
**Wave:** 2 (depends on T01 + T02 being merged first)
**Model:** claude-opus-5-thinking-high
**Files owned (only this):**
- `flash-cards-app/src/app/api/auth/register/route.ts` (new)
- Colocated test file, e.g. `route.test.ts`, following the pattern of other API route tests in this repo.

## Dependencies (already merged, treat as fixed contracts — do not modify)
From `@/lib/auth`: `PENDING_REG_COOKIE`, `PENDING_REG_MAX_AGE_MS`, `createPendingRegCookieValue(uid)`.
From `@/lib/server/users`: `isUsernameAvailable`, `createUserProfile`, `deleteUserProfile`, `UsernameTakenError`.
From `@/lib/server/emailVerification`: `createOrRefreshCode(uid, email)`.
Firebase Admin: `getAuth(adminApp)` from `firebase-admin/auth`, `adminApp` from `@/lib/firebase-admin`.

## Tasks
Implement `POST /api/auth/register`:
1. Zod schema for the body: `{ fullName: string (min 1), email: string (email), username: string (3-20 chars, alphanumeric + underscore, e.g. `/^[a-zA-Z0-9_]{3,20}$/`), password: string, confirmPassword: string, dailyStudyGoalMinutes: number (positive int), dailyTestingGoalMinutes: number (positive int) }`.
2. Password policy (server-side, in addition to zod): min 8 chars, at least one uppercase, one lowercase, one digit, one special/symbol character. Return `400` with a clear field-level error if it fails, or if `password !== confirmPassword`.
3. Normalize `usernameLower = username.toLowerCase()`.
4. Check `isUsernameAvailable(usernameLower)` — if taken, return `409 { error: 'Username is already taken' }`.
5. Attempt `getAuth(adminApp).createUser({ email, password, displayName: fullName, emailVerified: false })`.
   - If it throws with `error.code === 'auth/email-already-exists'`: look up the existing user via `getAuth(adminApp).getUserByEmail(email)`. If `existingUser.emailVerified` is `true`, return `409 { error: 'An account with this email already exists' }`. If `false` (an abandoned/incomplete prior registration): delete the stale Firebase Auth user (`getAuth(adminApp).deleteUser(existingUser.uid)`) and also best-effort delete any stale `users/{uid}`/`usernames/{...}` docs for that uid (look up profile by uid via `getUserProfileByUid`, then `deleteUserProfile` if found), then retry `createUser` once with the same params. If it fails again, return `500`.
6. On successful `createUser`, call `createUserProfile({ uid, fullName, username, email, dailyStudyGoalMinutes, dailyTestingGoalMinutes })`.
   - If this throws `UsernameTakenError` (race condition), roll back by deleting the just-created Firebase Auth user (`getAuth(adminApp).deleteUser(uid)`) and return `409 { error: 'Username is already taken' }`.
7. Call `createOrRefreshCode(uid, email)` to generate and email the verification code. If email sending throws, still proceed (log a warning via `@/lib/logger`) rather than failing registration — the user can use "resend code" — but return a response noting `emailSendFailed: true` isn't required; just don't 500 the whole request for an email provider hiccup. Use best judgement and document your choice in the PR description / final report.
8. On success, set the `PENDING_REG_COOKIE` (httpOnly, secure in prod, sameSite lax, path `/`, `maxAge: PENDING_REG_MAX_AGE_MS / 1000`) to `createPendingRegCookieValue(uid)`, and return `200 { success: true, email }` (do NOT return the uid or any token in the body — it's only in the signed cookie).
9. Use `logger` from `@/lib/logger` for warnings, matching the style in `src/app/api/login/route.ts` (now deleted, but check git history / `src/app/api/auth/session/route.ts` for the pattern) and `src/app/api/auth/session/route.ts`.

## Acceptance criteria
- `npm run typecheck` / `npm run lint` pass.
- Tests cover: happy path (cookie set, 200), weak password rejected (400), password/confirm mismatch (400), duplicate verified email (409), duplicate username (409), abandoned unverified registration retry succeeds, username-reservation race rolls back the Auth user.
- No route in this file touches any file outside `src/app/api/auth/register/`.

## Report back
Exact request/response shapes implemented (for the register-page frontend ticket to consume) and confirm all acceptance criteria pass with command output.
