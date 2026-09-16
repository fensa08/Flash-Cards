# T02 — Server-side user/username data layer + OTP + Resend email

**Difficulty:** High
**Wave:** 1 (no dependencies on other tickets; only *imports* `sign`/`timingSafeEqualStr` from `src/lib/auth.ts`, which already exist there today — do not wait for T01)
**Model:** claude-sonnet-5-thinking-medium
**Files owned (only these):**
- `flash-cards-app/src/lib/server/users.ts` (new)
- `flash-cards-app/src/lib/server/emailVerification.ts` (new)
- `flash-cards-app/src/lib/server/email.ts` (new)
- `flash-cards-app/package.json` (add one dependency)
- `flash-cards-app/.env.example` (add/remove specific lines only, see below)
- Any new test files for the above (e.g. `*.test.ts` colocated, following the existing repo convention seen in `src/lib/profile.test.ts`)

Do NOT touch `src/lib/auth.ts`, `src/proxy.ts`, or any `src/app/**` route/page files — other tickets own those.

## Context
- Firestore is accessed exclusively via the Admin SDK (`adminDb` from `@/lib/firebase-admin`); `firestore.rules` denies all client access, so no rules changes are needed.
- `src/lib/auth.ts` exports (after T01, but already exist as private helpers today — you can inline-reimplement equivalent minimal HMAC helpers if T01 hasn't landed yet, OR just import from `@/lib/auth` assuming `sign`/`timingSafeEqualStr` are exported — they will be by the time integration happens) an HMAC `sign(value: string): string` (`crypto.createHmac('sha256', SITE_PASSWORD-derived-secret)`) — actually after T01 the secret comes from a generic `getSecret()`-less scheme; just import `sign` and `timingSafeEqualStr` from `@/lib/auth` and trust they exist with those exact signatures.
- No email-sending integration exists yet in this repo.

## Tasks

### 1. `src/lib/server/users.ts` (server-only; add `import 'server-only';` at top)
Firestore collections:
- `users/{uid}`: `{ fullName: string, username: string, usernameLower: string, email: string, dailyStudyGoalMinutes: number, dailyTestingGoalMinutes: number, createdAt: FirebaseFirestore.Timestamp }`
- `usernames/{usernameLower}`: `{ uid: string }` — uniqueness index.

Export:
- `isUsernameAvailable(usernameLower: string): Promise<boolean>`
- `createUserProfile(params: { uid: string; fullName: string; username: string; email: string; dailyStudyGoalMinutes: number; dailyTestingGoalMinutes: number }): Promise<void>` — runs a Firestore **transaction** that reads `usernames/{usernameLower}`, throws a distinguishable error (e.g. `class UsernameTakenError extends Error`) if it already exists, otherwise writes both `usernames/{usernameLower}` and `users/{uid}` atomically.
- `deleteUserProfile(uid: string, usernameLower: string): Promise<void>` — deletes both docs (used to roll back if a later step in registration fails, or to clean up a stale/expired unverified registration).
- `getUserProfileByUid(uid: string): Promise<UserProfile | null>`
- `resolveIdentifierToEmail(identifier: string): Promise<string | null>` — if `identifier` matches a basic email regex, return it lowercased as-is (don't verify it exists — that's Firebase Auth's job downstream); otherwise look up `usernames/{identifier.toLowerCase()}`, then `users/{uid}`, and return its `email`, or `null` if not found.

### 2. `src/lib/server/emailVerification.ts` (server-only)
Firestore collection `emailVerifications/{uid}`: `{ codeHash: string, expiresAt: number (epoch ms), lastSentAt: number (epoch ms), attempts: number }`.

Export:
- `generateCode(): string` — random 6-digit numeric string, zero-padded (e.g. `"042817"`), using `crypto.randomInt(0, 1_000_000)`.
- `createOrRefreshCode(uid: string, email: string): Promise<void>` — generates a code, hashes it with `sign()` from `@/lib/auth`, writes `{ codeHash, expiresAt: Date.now() + 10*60*1000, lastSentAt: Date.now(), attempts: 0 }` to `emailVerifications/{uid}`, then calls `sendVerificationCodeEmail(email, code)`.
- `resendCode(uid: string, email: string): Promise<{ ok: true } | { ok: false; retryAfterMs: number }>` — reads the doc; if `Date.now() - lastSentAt < 60_000`, returns `{ ok: false, retryAfterMs: 60_000 - (Date.now() - lastSentAt) }` without sending; otherwise calls `createOrRefreshCode` again and returns `{ ok: true }`.
- `verifyCode(uid: string, code: string): Promise<'ok' | 'expired' | 'invalid' | 'too_many_attempts'>` — reads the doc (returns `'invalid'` if missing); if `attempts >= 5` returns `'too_many_attempts'`; if `Date.now() > expiresAt` returns `'expired'`; compares `sign(code)` against `codeHash` with `timingSafeEqualStr`; on mismatch increments `attempts` and returns `'invalid'`; on match deletes the doc and returns `'ok'`.
- `deleteVerification(uid: string): Promise<void>`

### 3. `src/lib/server/email.ts` (server-only)
- Add `resend` to `flash-cards-app/package.json` dependencies (check npm for the current stable version, e.g. `^4.0.0` — use whatever `npm view resend version` reports).
- Export `sendVerificationCodeEmail(to: string, code: string): Promise<void>` using the `Resend` client, reading `RESEND_API_KEY` from env (throw a clear error if missing) and `EMAIL_FROM` as the from-address. Simple plain-text-and-HTML email: subject "Your Lumina Learn verification code", body shows the 6-digit code prominently and states it expires in 10 minutes.

### 4. `.env.example`
Add these two new lines (in a sensible place, with a one-line comment): `RESEND_API_KEY=` and `EMAIL_FROM=`. Also remove the existing `SITE_PASSWORD=` line and its comment (T01 is removing all code that reads it; this ticket owns the env file so please delete that block too to keep things consistent).

## Acceptance criteria
- `npm install` succeeds with the new dependency.
- `npm run typecheck` and `npm run lint` pass.
- Unit tests (mocking `adminDb`/Firestore where reasonable, or using the Firestore emulator per existing integration-test conventions) cover: username collision -> `UsernameTakenError`, `resolveIdentifierToEmail` for both email-shaped and username-shaped input, OTP generation is 6 digits, `verifyCode` correctly returns `'expired'`, `'invalid'`, `'too_many_attempts'`, `'ok'`, and `resendCode` enforces the 60s cooldown.
- All exported function names/signatures match exactly what's specified above — three other tickets depend on this exact interface.

## Report back
State: the final exported interface of all three new files (so the orchestrator can hand it to dependent tickets verbatim), and confirm all acceptance criteria pass with command output.
