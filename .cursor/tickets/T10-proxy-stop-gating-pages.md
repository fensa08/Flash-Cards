# T10 — Stop gating `(app)` pages in proxy

**Difficulty:** Low-Medium (security-sensitive: read carefully)
**Wave:** A (parallel with T09, T11)
**Model:** claude-4.6-sonnet-medium-thinking
**Files owned (only these):**
- `flash-cards-app/src/proxy.ts`
- `flash-cards-app/src/proxy.test.ts`

Do NOT touch any `src/app/**` or `src/components/**` files — other tickets own those.

## Context
Read `flash-cards-app/src/proxy.ts` in full first. As of the just-completed auth-overhaul work, it already has a `PUBLIC_PATHS` set (or equivalent) covering `/login`, `/register`, `/api/health`, and the 5 `/api/auth/*` bootstrap routes (`register`, `verify-email`, `resend-code`, `resolve-identifier`, `session`), which short-circuit to `NextResponse.next()`. For every other path, it currently: checks the `FIREBASE_SESSION_COOKIE`; if valid, `NextResponse.next()`; if invalid/missing, then for `/api/*` paths returns `401`, and for any OTHER (page) path, **redirects to `/login`**.

## Task
Remove the redirect-to-`/login` behavior for page requests **entirely**. The new behavior:
- For any `/api/*` path NOT in the public-paths allowlist: unchanged — still return `401 { error: 'Unauthorized' }` when the session cookie is missing/invalid. This is the actual data-protection boundary and must not weaken.
- For any page path (i.e. does not start with `/api/`) that isn't already in the public-paths allowlist: instead of redirecting to `/login`, just call `NextResponse.next()` regardless of whether the session cookie is valid. The `(app)` route group's layout (a different ticket, T11) is responsible for rendering an appropriate "you're not signed in" UI on top of the page itself — proxy's job is now ONLY to gate `/api/*` data access, not to gate page rendering.
- `/api/health` stays exempt as today (checked first, unconditionally).
- Do not change the matcher `config` export's exclusions for static assets (`_next/static`, `_next/image`, icons, manifest, `sw.js`, `offline`) — those stay as-is.

Effectively, after this change, the only remaining "deny" branch in the whole function should be the `/api/*` 401 branch; there should be no more `NextResponse.redirect(...)` call for unauthenticated page requests.

## Test updates (`proxy.test.ts`)
- Remove/replace any test asserting that an unauthenticated request to a protected PAGE path (e.g. `/`, `/testing`, some non-public page) results in a redirect to `/login`.
- Add a test asserting that an unauthenticated request to a protected PAGE path (e.g. `/`) now results in `NextResponse.next()` (i.e. the proxy lets it through — assert on whatever the existing test suite's convention is for detecting "next() was called", matching how other passing-through cases are already asserted elsewhere in this file).
- Keep/verify: unauthenticated request to a protected API path (e.g. `/api/decks` or whatever protected API route exists in this test file already) still returns `401`.
- Keep/verify: all public paths (`/login`, `/register`, the 5 `/api/auth/*` routes, `/api/health`) still pass through regardless of auth state — these tests should already exist from the prior ticket; just confirm they still pass, don't duplicate them.
- Keep/verify: a request WITH a valid `FIREBASE_SESSION_COOKIE` still passes through for any page/API path (no regression to the authenticated path).

## Acceptance criteria
- `npm run typecheck` / `npm run lint` pass.
- `npx vitest run src/proxy.test.ts` passes.
- Read the final file back and confirm there is no remaining `NextResponse.redirect` call tied to an unauthenticated page request.
- Confirm `/api/*` protection is completely unchanged in strength (still 401s exactly the same set of routes as before this ticket).

## Report back
The final full contents of the `proxy` function (or a diff), and command output proving typecheck/lint/tests pass.
