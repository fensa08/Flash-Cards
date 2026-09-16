# T04 — POST /api/auth/verify-email and POST /api/auth/resend-code

**Difficulty:** Medium
**Wave:** 2 (depends on T01 + T02 being merged first)
**Model:** claude-4.6-sonnet-medium-thinking
**Files owned (only these):**
- `flash-cards-app/src/app/api/auth/verify-email/route.ts` (new)
- `flash-cards-app/src/app/api/auth/resend-code/route.ts` (new)
- Colocated test files for both.

## Dependencies (already merged, treat as fixed contracts — do not modify)
From `@/lib/auth`: `PENDING_REG_COOKIE`, `verifyPendingRegCookieValue(value)`.
From `@/lib/server/emailVerification`: `verifyCode(uid, code)`, `resendCode(uid, email)`.
From `@/lib/server/users`: `getUserProfileByUid(uid)` (to get the email for resend).
Firebase Admin: `getAuth(adminApp)`.

## Tasks

### `POST /api/auth/verify-email`
1. Read `PENDING_REG_COOKIE` from the request cookies; run it through `verifyPendingRegCookieValue`. If `null`, return `401 { error: 'Registration session expired. Please register again.' }`.
2. Zod-validate body `{ code: string }` (expect 6 digits).
3. Call `verifyCode(uid, code)`:
   - `'ok'`: call `getAuth(adminApp).updateUser(uid, { emailVerified: true })`, then `getAuth(adminApp).createCustomToken(uid)`. Clear the pending-reg cookie (`maxAge: 0`). Return `200 { customToken }`.
   - `'expired'`: `400 { error: 'Code expired. Please request a new one.', code: 'expired' }`.
   - `'invalid'`: `400 { error: 'Incorrect code.', code: 'invalid' }`.
   - `'too_many_attempts'`: `429 { error: 'Too many incorrect attempts. Please request a new code.', code: 'too_many_attempts' }`.

### `POST /api/auth/resend-code`
1. Same cookie check as above (`401` if missing/invalid).
2. Look up the user's email via `getUserProfileByUid(uid)` (fall back to `getAuth(adminApp).getUser(uid).email` if the profile doc lookup fails, but the profile should exist by this point since T03 creates it before minting the code).
3. Call `resendCode(uid, email)`:
   - `{ ok: true }`: return `200 { success: true }`.
   - `{ ok: false, retryAfterMs }`: return `429 { error: 'Please wait before requesting another code.', retryAfterMs }`.

Use `logger` from `@/lib/logger` for warnings/errors, matching the pattern in `src/app/api/auth/session/route.ts`.

## Acceptance criteria
- `npm run typecheck` / `npm run lint` pass.
- Tests cover: missing/invalid pending-reg cookie -> 401 for both routes; correct code -> customToken + cookie cleared; expired/invalid/too-many-attempts codes -> correct status/body; resend within cooldown -> 429 with `retryAfterMs`; resend after cooldown -> 200.

## Report back
Exact request/response shapes implemented for both routes (for the register-page frontend ticket to consume) and confirm all acceptance criteria pass with command output.
