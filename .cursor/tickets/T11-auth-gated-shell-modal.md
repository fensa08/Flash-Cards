# T11 — Auth-gated shell + blocking `LoginModal`

**Difficulty:** Medium-High
**Wave:** A (parallel with T09, T10 — built against T09's frozen `LoginForm` contract below, do not wait for T09 to literally finish)
**Model:** claude-sonnet-5-thinking-medium
**Files owned (only these):**
- `flash-cards-app/src/app/(app)/layout.tsx`
- `flash-cards-app/src/components/shell/AppShell.tsx`
- `flash-cards-app/src/components/auth/LoginModal.tsx` (new)
- `flash-cards-app/src/components/shell/Sidebar.tsx` (one small change only, see below)
- `flash-cards-app/src/components/account/AccountDashboard.tsx` (one small change only, see below)
- Colocated test files for any of the above you touch.

Do NOT touch `src/proxy.ts`, `src/app/login/page.tsx`, or `src/components/auth/LoginForm.tsx` — other tickets own those. Do NOT create any other new files.

## Frozen contract from T09 (sibling ticket, running in parallel — build against this, don't wait)
`@/components/auth/LoginForm` — default export, client component: `export default function LoginForm({ onSuccess }: { onSuccess?: () => void })`. Renders the full OAuth + email/password login UI (including its own "Don't have an account? Create one" link that internally navigates to `/register`). Calls `onSuccess?.()` after any successful sign-in (once the session cookie is set), before/without doing its own post-login navigation. Requires no other props. Read `flash-cards-app/src/app/login/page.tsx` (current, pre-T09 state) to see the actual OAuth+form UI/copy you're wrapping in a modal, since T09 is extracting that exact UI into `LoginForm` verbatim.

## Context
Read `flash-cards-app/src/app/(app)/layout.tsx` and `flash-cards-app/src/components/shell/AppShell.tsx` in full first. The layout already calls `getCurrentUserProfile()` in a `try/catch` that falls back to a blank `DisplayProfile` on failure — this already correctly handles being rendered for an unauthenticated request (which, after sibling ticket T10 lands, will now actually happen instead of being redirected away by `proxy.ts`).

## Tasks

### 1. `(app)/layout.tsx`
Track whether the `getCurrentUserProfile()` call succeeded or fell into the `catch`. Pass a new `isAuthenticated: boolean` prop to `<AppShell>` alongside the existing `profile` prop (`true` on success, `false` on catch).

### 2. `AppShell.tsx`
Accept a new required prop `isAuthenticated: boolean`. Behavior:
- If `isAuthenticated` is `true`: render exactly as today, no changes to markup/behavior.
- If `isAuthenticated` is `false`:
  - Wrap the existing full shell tree (the mobile header, sidebar, and `<main>{children}</main>`) in a container div that:
    - Visually dims it: `opacity-30` (adjust slightly if it reads too faint/strong against this app's `bg-background`, but stay in the 25-35% range so the platform is genuinely visible-but-clearly-inert, matching the request to "see the platform a little bit").
    - Makes it non-interactive: `pointer-events-none select-none`.
    - Sets the React `inert` attribute on that same wrapper (React 19 supports `inert` as a boolean DOM prop — e.g. `<div inert={true} ...>`), and `aria-hidden="true"`, so it's fully removed from the accessibility tree and un-tabbable while dimmed.
  - Render `<LoginModal />` (new component, see below) as a sibling AFTER that dimmed wrapper, positioned as a `fixed inset-0` overlay so it sits on top regardless of where in the DOM it is.

### 3. New `LoginModal.tsx`
A client component, default export, no required props. Structure:
- A `fixed inset-0 z-[100]` backdrop: `bg-black/40 backdrop-blur-sm`, centered flex container.
- A centered card (roughly mirror the visual style of the existing `/login` page's card — rounded-2xl, `bg-surface`, border, shadow, similar padding/width — read `flash-cards-app/src/app/login/page.tsx`'s outer card markup for the classes to reuse) containing `<LoginForm onSuccess={handleSuccess} />` from `@/components/auth/LoginForm`.
- `handleSuccess` calls `router.refresh()` only (import `useRouter` from `next/navigation`) — deliberately does NOT `router.push()` anywhere, since the point is to stay on the current page and let the server layout re-evaluate auth state, which flips `isAuthenticated` to `true` and makes the modal disappear on the next render.
- **No dismiss mechanism of any kind**: no close/X button, no `onClick` backdrop handler that closes it, no `Escape`-key listener. It is only ever removed by successfully authenticating (via the layout re-render) or by the user navigating to `/register` (which `LoginForm`'s internal link already handles by leaving this page entirely).
- A brief heading inside the card is fine (e.g. "Sign in to continue") above the `LoginForm`, but keep it minimal since `LoginForm` likely already has its own "Lumina Learn" / "Sign in to continue." heading per T09 — avoid duplicating; check what T09 keeps inside `LoginForm` vs. in the page chrome and only add a heading here if `LoginForm` doesn't already render one (use your judgement, prioritize not looking obviously duplicated — if in doubt, add a minimal wrapper heading here since you can't guarantee T09's exact boundary at the time you're implementing this in parallel).

### 4. `Sidebar.tsx` — one-line change
In `handleSignOut`, change `router.push('/login')` to `router.push('/')` (keep `router.refresh()` as-is, keep the rest of the function unchanged).

### 5. `AccountDashboard.tsx` — one-line change
In `handleLogout`, change `router.push('/login')` to `router.push('/')` (keep everything else unchanged).

## Acceptance criteria
- `npm run typecheck` / `npm run lint` pass.
- When `isAuthenticated` is `false`, `AppShell` renders both the dimmed/inert real shell AND `LoginModal` in the DOM; when `true`, it renders only the normal shell with no modal.
- The dimmed wrapper is confirmed non-interactive (pointer-events-none, inert, aria-hidden) — write a test asserting these attributes/classes are present when `isAuthenticated={false}`.
- `LoginModal` renders `LoginForm` and has no close/dismiss affordance anywhere in its markup (no button with an X icon, no backdrop click handler, no keydown listener) — write a test asserting a click on the backdrop does NOT remove the modal from the DOM (since it isn't a client-side "isOpen" state at all, this may simply be "the modal is unconditionally rendered by AppShell and has no internal open/close state" — confirm that's the actual design and test accordingly).
- `Sidebar.test.tsx` / `AccountDashboard.test.tsx` (existing files) updated if they assert on the old `router.push('/login')` behavior — update those assertions to `'/'` and confirm they still pass.

## Report back
Confirm the final `AppShell` prop signature, the `LoginModal` structure, and command output proving typecheck/lint/tests pass. Explicitly state what heading/copy decision you made in `LoginModal` re: potential duplication with `LoginForm`'s own heading (this will be checked/reconciled in the integration pass, T12).
