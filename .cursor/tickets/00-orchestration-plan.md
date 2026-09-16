# Orchestration plan — Auth overhaul

8 tickets derived from the approved plan, grouped into 3 waves by file-ownership and dependency analysis (tickets within a wave touch disjoint files, so they can run as truly parallel agents on the same working tree without conflicts).

| Ticket | Title | Difficulty | Model | Wave | Depends on |
|---|---|---|---|---|---|
| T01 | Core auth cleanup, pending-reg cookie, 1-day sessions | Medium | claude-4.6-sonnet-medium-thinking | 1 | — |
| T02 | Server data layer (users/usernames/OTP) + Resend email | High | claude-sonnet-5-thinking-medium | 1 | — |
| T03 | POST /api/auth/register | High | claude-opus-5-thinking-high | 2 | T01, T02 |
| T04 | POST /api/auth/verify-email + resend-code | Medium | claude-4.6-sonnet-medium-thinking | 2 | T01, T02 |
| T05 | POST /api/auth/resolve-identifier | Low | claude-4.5-haiku-thinking | 2 | T02 |
| T06 | Login page rewrite | Medium | claude-4.6-sonnet-medium-thinking | 2 | T01 |
| T07 | Register page (new) | Medium-High | claude-sonnet-5-thinking-medium | 2 | T01 |
| T08 | Integration & verification pass | Medium | claude-4.6-sonnet-medium-thinking | 3 | T01–T07 |

## Parallelization rationale
- **Wave 1 (T01, T02):** disjoint files (`src/lib/auth.ts` + `src/proxy.ts` + session route vs. new `src/lib/server/*` + `package.json` + `.env.example`). T02 only *imports* from `auth.ts`, doesn't edit it.
- **Wave 2 (T03, T04, T05, T06, T07):** five disjoint new files (3 backend routes, 2 frontend pages). All five are specified against interface contracts frozen in T01/T02's tickets, so they can start together immediately once Wave 1 lands, without waiting on each other.
- **Wave 3 (T08):** inherently sequential/integrative — reconciles any drift between the five Wave-2 tickets and runs the full lint/typecheck/test suite.

## Execution protocol (per ticket)
1. Spawn an implementer subagent with the ticket's model and full ticket content as the prompt.
2. When it finishes, spawn a reviewer subagent (different, independent pass) with the diff/changed files + the ticket's acceptance criteria, asking it to verify correctness, contract compliance, and run lint/typecheck/tests itself.
3. If the reviewer pushes back, resume the implementer with the reviewer's feedback and repeat step 2.
4. Once approved, mark the ticket done in this plan and move on.
