---
paths: ["src/**/*.module.ts", "src/**/*.controller.ts", "src/**/*.service.ts", "src/**/*.guard.ts", "src/**/*.pipe.ts", "src/**/*.dto.ts"]
---
# NestJS Rules

## Structure
- One feature per module (`users/`: module, controller, service, dto, entities); no cross-feature imports of internals, export only what other modules need
- Controller: thin; parse -> call service -> return. Service: business logic. Repository/provider: data access
- Wire via Nest DI (constructor injection); never `new` a provider manually, never use `ModuleRef.get` as a service locator
- Depend on abstractions for swappable things via custom providers + injection tokens (`@Inject(USER_REPO)`)
- Avoid circular module dependencies; if needed, extract a shared module (avoid `forwardRef` as a first resort)

## Validation & types
- DTOs are classes with `class-validator`/`class-transformer` (or Zod pipe if already in project); global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- Never trust `@Body()`/`@Query()`/`@Param()` without a DTO or pipe
- Separate DTOs from persistence entities; never return entities directly (leaks fields); map to response DTOs
- Use `ParseUUIDPipe`/`ParseIntPipe` for params

## Cross-cutting
- Auth: guards (authentication) + role/ownership checks (authorization) on every route; check resource ownership in the service (no IDOR)
- Logging/transform/timeouts: interceptors; error mapping: exception filters
- Throw Nest `HttpException` subclasses (`NotFoundException`, etc.) from services; domain errors get a filter that maps them
- Generic error messages to clients; no stack traces in responses
- Config: `@nestjs/config` with schema validation at startup; inject `ConfigService`, never read `process.env` in services

## Practices
- Async: always `await`; no floating promises
- Request-scoped providers only when necessary (performance cost)
- Use `Logger` from Nest, not `console.log`; never log secrets or PII
- Test: `Test.createTestingModule` with mocked providers for unit tests; e2e with `supertest`
- Rate limit auth/public endpoints (`@nestjs/throttler`); enable `helmet`, CORS with explicit origins
