# T08 — Integration & verification pass

**Difficulty:** Medium
**Wave:** 3 (runs solo, after all of T01–T07 are merged)
**Model:** claude-4.6-sonnet-medium-thinking
**Files owned:** whatever needs small fixes across the repo to make everything consistent — this ticket is explicitly allowed to touch any file if it's fixing an integration mismatch (e.g. a route path typo, a response-shape mismatch between a frontend ticket and its backend ticket, a cookie name mismatch).

## Tasks
1. Run, in order, and fix any failures: `npm run lint`, `npm run typecheck`, `npm run test`.
2. Grep the whole `src/` tree for any leftover references to the removed legacy password gate: `SITE_PASSWORD`, `SESSION_COOKIE`, `ATTEMPTS_COOKIE`, `LEGACY_OWNER_ID`, `/api/login`. Fix or flag anything found.
3. Manually trace both new flows by reading the code end-to-end (no live server needed, just careful review) and confirm exact request/response shape agreement between:
   - `src/app/login/page.tsx` <-> `/api/auth/resolve-identifier` <-> `/api/auth/session`.
   - `src/app/register/page.tsx` <-> `/api/auth/register` <-> `/api/auth/verify-email` <-> `/api/auth/resend-code` <-> `/api/auth/session`.
   Fix any drift (field name typos, status code mismatches, cookie name mismatches, etc.) directly.
4. Confirm `.env.example` has `RESEND_API_KEY` and `EMAIL_FROM` and no longer has `SITE_PASSWORD`.
5. Confirm `firestore.rules` still correctly denies all client access (should be unchanged, but verify no ticket accidentally weakened it).
6. Double check `src/proxy.ts` matcher config still makes sense (no more `api/login` exclusion, `/login` and `/register` are both publicly reachable without a session, `/api/health` still excluded).

## Acceptance criteria
- `npm run lint`, `npm run typecheck`, `npm run test` all pass cleanly.
- No leftover legacy-gate references.
- Both auth flows are internally consistent end-to-end per the trace above.

## Report back
A final summary of what (if anything) needed fixing, and full command output proving lint/typecheck/test all pass.
