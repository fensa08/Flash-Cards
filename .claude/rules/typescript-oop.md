# TypeScript / Node OOP Rules

## When to use what
- Class: holds state + behavior, or is a swappable service (repository, client, use case)
- Plain function/module: stateless logic, utilities, transforms
- `interface`: contracts between layers and for DI; `type`: unions, mapped and utility types
- Discriminated unions instead of class hierarchies for variants

## Encapsulation
- `private`/`#field` for internal state; `readonly` by default
- Expose behavior, not mutable fields; return copies or readonly types
- No public setters unless required; constructors assign only (no I/O, no async work)
- Use static factory methods (`Foo.create()`) for async or validated construction

## SOLID in practice
- S: one responsibility per class/file; split when a class mixes I/O, business logic, and formatting
- O: extend via new implementations of an interface, not edits to stable code or long `switch` chains
- L: subclasses must not narrow inputs or throw new error types
- I: small interfaces (`UserReader`, `UserWriter`), not one large `IUserService`
- D: depend on interfaces; wire dependencies at the composition root (`main.ts`), with manual constructor injection by default; add a DI container only with approval

## Inheritance
- Max 2 levels; prefer composition and interfaces
- Avoid abstract base classes unless sharing real implementation
- Never extend built-ins (`Array`, `Error` aside) for convenience; custom errors extend `Error` with a `name` and a `cause`

## Types & safety
- Validate external input at the boundary (Zod or similar, if already in the project); trust types only after validation
- Make invalid states unrepresentable (branded types, unions, `as const`)
- Avoid non-null assertions (`!`) and type casts (`as`); fix the types instead

## Async & errors
- Always `await` or return promises; no floating promises (enable `@typescript-eslint/no-floating-promises`)
- Throw typed errors in domain code; handle them at the boundary (HTTP/CLI layer)
- No swallowed errors; no `catch (e) {}`
- Use `Promise.all` for independent work; never `await` in loops unless sequential by design

## Node specifics
- No global mutable state or module-level singletons holding state; inject instead
- Config from env vars read once in a config module, validated at startup
- Use `async`/`await` with `AbortSignal` for cancelable I/O where relevant
- Keep HTTP handlers thin: parse -> call service -> map result

## Testing & design hygiene
- Design for testability: injected dependencies, pure functions where possible; mock only at boundaries (I/O, network, time)
- Design patterns (Strategy, Factory, Adapter, Repository) only to remove real coupling or duplication
- DRY after the third repetition, not the first
- Don't refactor unrelated code during a change

Notes
- paths: frontmatter scopes the rules to matching files, so it doesn't consume tokens when you work elsewhere. Adjust the globs to your structure.
- Lint enforces these better than prose. Turn on strict, @typescript-eslint/no-floating-promises, no-explicit-any, and no-non-null-assertion, and add a hook or CI step to run them. Claude follows rules more reliably when violations fail the build.
- Frameworks: if you use NestJS, it already uses classes and DI heavily, so drop the "no DI container" line. If you use Express/Fastify, keep the functional handler style.
