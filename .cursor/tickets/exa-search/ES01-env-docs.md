# ES-01 — Env docs + local `EXA_API_KEY` slot

**Difficulty:** Low
**Wave:** 1 (no dependencies; parallel with ES-02)
**Model:** claude-4.5-haiku-thinking
**Files owned (only these):**
- `flash-cards-app/.env.example`
- `flash-cards-app/DEPLOYMENT.md`
- `flash-cards-app/.env.local` (gitignored — never stage this file)

Do NOT touch `package.json`, `src/**`, or any other env vars' comments/values.

## Context

Search will call Exa from the server using `EXA_API_KEY`. The SDK install and client live in ES-02. This ticket only documents the variable and ensures a local slot exists.

The key is a **server-only secret**. Never put it in `NEXT_PUBLIC_*`, source, tests, or git.

## Tasks

1. In `.env.example`, after the Resend block, add:

```
# Exa (server-only secret — never expose to the client): neural web search for /search.
EXA_API_KEY=
```

2. In `DEPLOYMENT.md`, add an "Exa search (server-only — keep secret)" subsection under Environment variables, matching the Resend/Firebase Admin table style. One row: `EXA_API_KEY` — Exa API key used by `POST /api/search`. Note that it must be set in the Vercel dashboard for Preview and Production.

3. If `flash-cards-app/.env.local` exists, append `EXA_API_KEY=<value>` only if that key is not already present. The implementer prompt will supply the real value. If `.env.local` does not exist, create it with just that line. **Do not `git add` `.env.local`.**

4. Leave the stale `SITE_PASSWORD` row in `DEPLOYMENT.md` alone (owned by other work).

## Acceptance criteria

- `.env.example` contains `EXA_API_KEY=` and a server-only comment. No real secret.
- `DEPLOYMENT.md` documents `EXA_API_KEY` as a Vercel/server secret.
- `.env.local` has `EXA_API_KEY` set; `git status` does not stage `.env.local`.
- `npm run lint` / `npm run typecheck` still pass (no code changes).

## Report back

Confirm the three files and that `.env.local` is untracked/ignored. Do not print the API key value in the report.
