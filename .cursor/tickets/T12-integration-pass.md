# T12 — Integration & verification pass (modal login overlay)

**Difficulty:** Medium
**Wave:** B (runs solo, after T09, T10, T11 are all approved)
**Model:** claude-4.6-sonnet-medium-thinking
**Files owned:** whatever needs small fixes to make everything consistent — allowed to touch any file to fix an integration mismatch, but keep changes minimal and targeted.

## Tasks
1. Run, in order, and fix any failures: `npm run lint`, `npm run typecheck`, `npm run test` (from within `flash-cards-app/`).
2. Read `flash-cards-app/src/components/auth/LoginForm.tsx`, `flash-cards-app/src/app/login/page.tsx`, `flash-cards-app/src/components/auth/LoginModal.tsx`, and `flash-cards-app/src/components/shell/AppShell.tsx` together and resolve the heading-duplication question T11 flagged: if both `LoginForm` and `LoginModal` (or the `/login` page and `LoginModal`) render a redundant "Sign in" / "Lumina Learn" heading stacked on top of each other, remove the duplicate so there's exactly one clear heading in each context (the standalone `/login` page, and the modal).
3. Manually trace, by reading code (a live server isn't required, but use it if convenient):
   - Unauthenticated visit to `/`: `proxy.ts` lets it through -> `(app)/layout.tsx` catches the profile-lookup failure -> `AppShell` renders the dimmed/inert `OverviewDashboard` behind a `LoginModal` -> signing in (either method) -> `router.refresh()` -> layout re-runs, `isAuthenticated` becomes `true` -> modal gone, full interactive dashboard.
   - Unauthenticated deep link to a non-root `(app)` page (e.g. `/testing` or `/decks/...` if it exists) shows the same pattern (dimmed page + modal) rather than a redirect or a crash — since `(app)/layout.tsx` wraps every page in the group, this should already work by construction; verify it actually does (check there's no other page-level code under `(app)` calling `getCurrentUserId`/`getCurrentUserProfile` WITHOUT the same try/catch fallback pattern used in `layout.tsx` and `account/page.tsx` — grep for it).
   - Clicking "Create account" inside the modal navigates to `/register` (full page, not a modal) — confirm `LoginForm`'s internal link/navigation actually leaves the dimmed page rather than trying to render `/register`'s content inside the modal somehow.
   - Logging out from an authenticated session (`Sidebar`'s and `AccountDashboard`'s sign-out) now lands back on `/` and immediately shows the modal (since `isAuthenticated` will be `false` right after).
   - Direct navigation to `/login` (e.g. a bookmark) still works as a standalone full-page login, independent of the modal flow.
4. Confirm `src/proxy.test.ts` and any new `AppShell`/`Sidebar`/`AccountDashboard`/`LoginModal` tests all still pass together (no cross-ticket regressions).
5. Double-check accessibility: the dimmed/inert wrapper in `AppShell` should genuinely be unreachable by keyboard (Tab) and screen readers while the modal is showing — read the actual JSX to confirm `inert`/`aria-hidden` landed on the right wrapping element (not just on some inner element that leaves outer interactive elements still reachable).

## Acceptance criteria
- `npm run lint`, `npm run typecheck`, `npm run test` all pass cleanly.
- No duplicated/orphaned UI text (headings) between `LoginForm`, `LoginModal`, and `/login`'s page chrome.
- All five traced flows above behave as described.

## Report back
A final summary of what (if anything) needed fixing, and full command output proving lint/typecheck/test all pass.
