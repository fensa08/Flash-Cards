# T09 — Extract shared `LoginForm` component

**Difficulty:** Low-Medium
**Wave:** A (parallel with T10, T11)
**Model:** claude-4.6-sonnet-medium-thinking
**Files owned (only these):**
- `flash-cards-app/src/components/auth/LoginForm.tsx` (new)
- `flash-cards-app/src/app/login/page.tsx` (modified)
- Any colocated test file for the new component.

Do NOT touch `src/proxy.ts`, `src/app/(app)/**`, `src/components/shell/**`, `src/components/account/**` — other tickets own those.

## Context
`flash-cards-app/src/app/login/page.tsx` currently contains, inline: Google/Microsoft `signInWithPopup` OAuth buttons + handler, and an email-or-username + password form that chains `POST /api/auth/resolve-identifier` -> `signInWithEmailAndPassword` -> `POST /api/auth/session` -> `router.push('/'); router.refresh()`, plus a "Don't have an account? Create one" link to `/register`. Read the current file in full first.

## Tasks
1. Create `src/components/auth/LoginForm.tsx`: a client component that contains ALL of the existing OAuth + email/password logic and JSX from `login/page.tsx` (the card's inner content: OAuth buttons, divider, email/username + password fields, error display, the "Create one" register link), extracted verbatim (do not change any behavior, copy, or styling).
   - Signature: `export default function LoginForm({ onSuccess }: { onSuccess?: () => void }) { ... }`.
   - On every successful sign-in path (both the OAuth `handleOAuthSignIn` success branch AND the email/password `handleSubmit` success branch, i.e. right after the `POST /api/auth/session` call succeeds), call `onSuccess?.()` in addition to whatever the caller does next.
   - Do NOT hardcode `router.push('/')` / `router.refresh()` inside `LoginForm` itself for the success path — that navigation decision belongs to the caller via `onSuccess`. (The "Create one" register link's `router.push('/register')` stays inside `LoginForm` as-is, since that's not part of the "success" contract — it's a navigation-away action available regardless of whether login succeeds.)
2. Update `src/app/login/page.tsx`: keep the outer page chrome (the full-screen centered layout, the surrounding `<main>`/card container, "Lumina Learn" / "Sign in to continue." heading if those live outside the form specifically — use your judgement on exactly where the extraction boundary is, but the end result must look and behave pixel-identical to today when visiting `/login` directly), and render `<LoginForm onSuccess={() => { router.push('/'); router.refresh(); }} />` for the interactive part.
3. The exact exported contract other tickets depend on: `LoginForm` is the default export of `@/components/auth/LoginForm`, takes a single optional prop `onSuccess?: () => void`, and requires no other props. It manages its own state (identifiers, password, pending flags, errors) internally.

## Acceptance criteria
- `npm run typecheck` / `npm run lint` pass.
- Visiting `/login` directly behaves exactly as it did before this change: OAuth buttons work, email/username+password flow works (including the 403 "please verify your email" and 404 "no account found" error paths), successful login redirects to `/` and refreshes.
- `LoginForm` has zero required props beyond the optional `onSuccess`, and calling it with no props at all must not throw (no default navigation happens on success if `onSuccess` is omitted — that's fine, it just won't navigate).
- Tests (existing or new) confirm `onSuccess` fires exactly once per successful sign-in path (OAuth and email/password), and does NOT fire on any error path.

## Report back
Confirm the final `LoginForm` prop signature (verbatim), how the extraction boundary was drawn in `login/page.tsx`, and command output proving typecheck/lint/tests pass.
