# T01 — Core auth cleanup, pending-reg cookie helper, 1-day sessions

**Difficulty:** Medium
**Wave:** 1 (no dependencies)
**Model:** claude-4.6-sonnet-medium-thinking
**Files owned (only these):**
- `flash-cards-app/src/lib/auth.ts`
- `flash-cards-app/src/proxy.ts`
- `flash-cards-app/src/proxy.test.ts`
- `flash-cards-app/src/app/api/auth/session/route.ts`
- Delete: `flash-cards-app/src/app/api/login/` (route + test)

Do NOT touch `.env.example`, `package.json`, or anything under `src/lib/server/`, `src/app/register/`, `src/app/login/page.tsx`, `src/app/api/auth/register|verify-email|resend-code|resolve-identifier` — other tickets own those.

## Tasks
1. In `src/lib/auth.ts`:
   - Change `FIREBASE_SESSION_MAX_AGE_MS` from 14 days to `24 * 60 * 60 * 1000` (1 day).
   - Remove the legacy shared-password gate entirely: `SESSION_COOKIE`, `ATTEMPTS_COOKIE`, `MAX_ATTEMPTS`, `LOCKOUT_MS`, `LEGACY_OWNER_ID`, `Attempts` interface, `getSecret()`, `verifyPassword()`, `createSessionCookieValue()`, `isSessionValid()`, `encodeAttempts()`, `decodeAttempts()`.
   - **Export** (add the `export` keyword — currently private) the HMAC helpers `sign(value: string): string` and `timingSafeEqualStr(a: string, b: string): boolean`. They must keep their exact current signatures/behavior — other tickets (server-side data layer, register/verify API routes) import these to sign/verify OTP codes and a new "pending registration" cookie.
   - Add a new **pending-registration cookie** contract used by the not-yet-built `/api/auth/register` and `/api/auth/verify-email` routes:
     ```ts
     export const PENDING_REG_COOKIE = 'fc_pending_reg';
     export const PENDING_REG_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

     export function createPendingRegCookieValue(uid: string): string {
       // base64url(uid).signature, same scheme as the old encodeAttempts,
       // i.e. `${encoded}.${sign(encoded)}`
     }

     export function verifyPendingRegCookieValue(value: string | undefined): string | null {
       // returns uid if signature valid, else null. No expiry encoded in the
       // value itself — the cookie's own maxAge enforces the 15 min window.
     }
     ```
   - Simplify `getCurrentUserId()` and `getCurrentUserProfile()`: remove the legacy-cookie fallback branch entirely. Only check `FIREBASE_SESSION_COOKIE`; throw `new Error('Unauthenticated')` if missing/invalid. Keep the `CurrentUserProfile` interface's `isLegacy` field but it will now always be `false` (do NOT remove the field — `src/lib/profile.ts`, `AccountDashboard.tsx`, and `Sidebar.tsx` consume it and are out of scope for this ticket).
2. In `src/proxy.ts`: remove the legacy cookie check branch (`isSessionValid(...)` / `SESSION_COOKIE`). Only the `FIREBASE_SESSION_COOKIE` check + redirect-to-`/login` / 401-for-`/api/*` logic remains. Remove `'login|api/login'` → just `'login'` in the matcher's negative lookahead (drop the now-nonexistent `api/login` exclusion, keep `login` for the page itself).
3. Delete `src/app/api/login/route.ts` and its test file (find via `find src/app/api/login`).
4. In `src/app/api/auth/session/route.ts`: remove the `SESSION_COOKIE` clear in the `DELETE` handler (import only `FIREBASE_SESSION_COOKIE` from `@/lib/auth` going forward). Update the `maxAge` comment near `FIREBASE_SESSION_MAX_AGE_MS` usage if it references "14 days".
5. Update `src/proxy.test.ts`: remove test cases exercising the legacy `SESSION_COOKIE` / `fc_session` path; keep/adjust the Firebase-cookie test cases.

## Acceptance criteria
- `npm run typecheck` and `npm run lint` pass.
- `npx vitest run src/proxy.test.ts` (and any auth-related unit tests you touch) pass.
- No remaining references to `SITE_PASSWORD`, `SESSION_COOKIE`, `ATTEMPTS_COOKIE`, `LEGACY_OWNER_ID`, `verifyPassword`, `isSessionValid` anywhere in `src/` (grep to confirm) — except a possible mention in comments explaining the change, which is fine.
- `sign`, `timingSafeEqualStr`, `PENDING_REG_COOKIE`, `PENDING_REG_MAX_AGE_MS`, `createPendingRegCookieValue`, `verifyPendingRegCookieValue` are exported from `src/lib/auth.ts` with exactly those names.
- Google/Microsoft OAuth login flow (`/api/auth/session` POST) is unchanged in behavior apart from the 1-day cookie lifetime.

## Report back
State: files changed, the final export list of `src/lib/auth.ts`, and confirm all acceptance criteria pass with command output.
