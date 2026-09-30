---
paths: ["src/**/routes/**", "src/**/controllers/**", "src/**/middleware/**", "src/**/*.routes.ts", "src/app.ts", "src/server.ts"]
---
# Express Rules

## Structure
- Separate `app.ts` (builds the app, no `listen`) from `server.ts` (starts it), so tests import the app
- Layers: routes -> controllers (thin) -> services (logic) -> repositories (data). No business logic in handlers
- Wire dependencies at the composition root (factory functions or constructor injection); no module-level mutable singletons
- One router per feature, mounted under a versioned prefix (`/api/v1/...`)

## Validation & errors
- Validate `req.body/query/params` at the boundary with a schema (Zod/Joi) in middleware; never use raw request data
- Async handlers: wrap with an `asyncHandler` (or use Express 5 native promise support) so rejections reach the error handler
- One central error-handling middleware (last `app.use`); throw typed errors (`HttpError` with status), map them there
- Generic messages to clients, no stack traces; log details server-side without secrets/PII
- Always return after sending a response; never send twice

## Security
- `helmet`, explicit CORS origins, `express.json({ limit })` body limits, rate limiting on auth/public routes
- Authentication middleware + per-route authorization; check resource ownership in services (no IDOR)
- Cookies: `HttpOnly`, `Secure`, `SameSite`
- Disable `x-powered-by`; set `trust proxy` correctly behind a proxy

## Practices
- Config read once in a validated config module; no `process.env` scattered in code
- Use `pino`/structured logging with request IDs, not `console.log`
- Graceful shutdown: handle `SIGTERM`, close server and DB connections
- Test with `supertest` against the exported `app`; mock at I/O boundaries only
- Keep middleware small, single-purpose, and order-aware (security -> parsing -> auth -> routes -> error handler)
