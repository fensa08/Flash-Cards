# T05 — POST /api/auth/resolve-identifier

**Difficulty:** Low
**Wave:** 2 (depends on T02 being merged first)
**Model:** claude-4.5-haiku-thinking
**Files owned (only this):**
- `flash-cards-app/src/app/api/auth/resolve-identifier/route.ts` (new)
- Colocated test file.

## Dependencies (already merged, treat as fixed contract — do not modify)
From `@/lib/server/users`: `resolveIdentifierToEmail(identifier)`.

## Tasks
1. Zod-validate body `{ identifier: string (min 1) }`.
2. Call `resolveIdentifierToEmail(identifier)`.
3. If it returns a string, return `200 { email: <that string> }`.
4. If it returns `null`, return `404 { error: 'No account found for that email or username.' }`.
5. This route is unauthenticated by design (it's used pre-login on the login page) — do not add any session checks. Keep it simple; no rate limiting needed for this ticket (out of scope).

## Acceptance criteria
- `npm run typecheck` / `npm run lint` pass.
- Tests cover: email-shaped identifier passthrough, known username -> resolved email, unknown identifier -> 404, malformed body -> 400.

## Report back
Exact request/response shape implemented (for the login-page frontend ticket) and confirm all acceptance criteria pass with command output.
