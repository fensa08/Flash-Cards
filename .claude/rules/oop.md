# OOP Principles & Best Practices

## Core principles
- Encapsulation: keep fields private; expose behavior, not raw state
- Abstraction: expose the minimal public interface; hide implementation details
- Polymorphism: use interfaces instead of type checks (`instanceof` / switch on type)
- Inheritance: shallow hierarchies (max 2 levels); prefer composition

- S: one reason to change per class
- O: extend behavior via new classes, not by editing stable ones
- L: subtypes must be substitutable without breaking callers
- I: small, focused interfaces; no forced unused methods
- D: depend on abstractions; inject dependencies

## Design
- Favor immutability for value objects; make invalid states unrepresentable
- Tell, don't ask: avoid getter chains (Law of Demeter)
- Avoid god classes, anemic models with logic scattered elsewhere, and static/global mutable state
- Use patterns (Factory, Strategy, Repository, Adapter) only when they remove real duplication or coupling, never preemptively
- Prefer simple functions for stateless logic; don't force everything into a class
- Validate at the boundary; keep domain objects always valid

## Practices
- Name classes as nouns and methods as verbs; names reveal intent
- Constructors do assignment only; no I/O or heavy work
- Favor small, testable units; mock at boundaries only
- Don't refactor unrelated code while making a change
- Follow DRY after the third repetition, not the first (avoid premature abstraction)

Notes
- Keep it short. Everything in CLAUDE.md costs tokens every session. Only the 5 short lines belong there.
- Path-scope the rules file if your codebase mixes styles. Use frontmatter like paths: ["src/**/*.ts"] so it loads only for matching files.
- Language-specific tweaks: if you use TypeScript, Java, Python, or Solidity, I can tailor this. For example, in TypeScript, prefer interfaces and type-safe DI, and in Solidity, composition and modifiers matter more than deep inheritance.
- Broken reference: your CLAUDE.md links @.claude/rules/security.md, but the file in your template repo is named security-rules.md. Fix one of them so it actually loads.
