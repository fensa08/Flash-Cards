---
paths: ["app/**", "src/app/**", "pages/**", "src/pages/**", "middleware.ts", "src/middleware.ts", "next.config.*"]
---
# Next.js Rules (App Router)

Check the project's Next.js version before relying on version-specific behavior (caching defaults, async request APIs).

## Server vs Client
- Components are Server Components by default; add `'use client'` only for state, effects, event handlers, or browser APIs, and push it as far down the tree as possible
- Fetch data in Server Components (or server functions), not in `useEffect`; pass serializable props down to client components
- Never import server-only code (DB, secrets) into client components; mark such modules with `import 'server-only'`
- Only `NEXT_PUBLIC_*` env vars reach the browser; never put secrets in them

## Data & mutations
- Server Actions / Route Handlers are public endpoints: validate input with a schema (Zod), authenticate, and authorize (check resource ownership) in every one
- Keep data access in a server-only data layer (`lib/data/*`); components and actions call it, never the DB directly
- Mutations: Server Actions + `revalidatePath`/`revalidateTag`; return typed results, not thrown strings
- In recent versions `params`, `searchParams`, `cookies()`, and `headers()` are async; `await` them
- Be explicit about caching (`cache`, `revalidate`, `dynamic`) instead of relying on defaults, and confirm defaults for the installed version

## Structure
- Use the file conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`
- Colocate feature code (components, actions, types) near its route; share via `components/` and `lib/`
- Use `loading.tsx`/`<Suspense>` to stream slow sections; `error.tsx` boundaries for failures
- Route Handlers: thin, parse -> service -> `NextResponse`; generic error messages, no stack traces

## Practices
- `next/image`, `next/font`, `next/link`; set `metadata`/`generateMetadata` per page
- Auth checks belong in the data layer/actions, not only in `middleware`, which is not sufficient on its own
- Middleware stays light (redirects, auth gating, headers); no heavy work or DB calls
- Security headers via `next.config` or middleware; Secure/HttpOnly/SameSite cookies
- Types: no `any`; derive props from schemas; use `satisfies` for config objects
- Tests: unit-test the data layer and pure logic; component tests with Testing Library; e2e with Playwright for critical flows
