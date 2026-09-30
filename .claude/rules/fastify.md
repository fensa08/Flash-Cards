---
paths: ["src/**/routes/**", "src/**/plugins/**", "src/**/*.route.ts", "src/**/*.plugin.ts", "src/app.ts", "src/server.ts"]
---
# Fastify Rules

## Structure
- Build the app in `buildApp()` (returns the instance, no `listen`); `server.ts` starts it; tests use `app.inject()`
- Everything is a plugin: features, DB clients, auth. Use `fastify-plugin` (`fp`) only for plugins that must share decorators across scopes; otherwise keep them encapsulated
- Register order matters: config -> security -> decorators/DB -> routes -> error handler
- Share dependencies via `decorate`/`decorateRequest` with typed declaration merging (`declare module 'fastify'`); no module-level singletons
- Layers: route handler (thin) -> service -> repository

## Schemas & validation
- Define a JSON Schema (or Zod via type provider) for `body`, `querystring`, `params`, and `response` on every route
- Use a type provider (`@fastify/type-provider-typebox` or `fastify-type-provider-zod`) so handler types derive from schemas; no manual casts
- Response schemas strip unexpected fields and speed up serialization; always define them to avoid leaking data

## Errors & hooks
- Throw errors (`@fastify/sensible` `httpErrors`, or custom with `statusCode`); centralize in `setErrorHandler`
- Generic messages to clients, no stack traces; log details with the built-in pino logger (`request.log`), never secrets/PII
- Use hooks (`onRequest`, `preHandler`) for auth and cross-cutting logic; authorization + ownership checks on every route (no IDOR)
- Async handlers: return the value or `reply`; never mix `return` and `reply.send` incorrectly, and never use `async` with a `done` callback

## Security & practices
- `@fastify/helmet`, `@fastify/cors` with explicit origins, `@fastify/rate-limit` on auth/public routes, `bodyLimit` set
- Cookies: `HttpOnly`, `Secure`, `SameSite`
- Config validated at startup (`@fastify/env` or Zod); no scattered `process.env`
- Graceful shutdown via `app.close()` on `SIGTERM`
- Tests: `app.inject()`; mock at I/O boundaries only
