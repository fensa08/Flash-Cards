# CLAUDE.md — Workspace Root

This directory is a **planning/orchestration wrapper**, not an npm project itself (no root `package.json`). It contains the real product as a nested repo, plus design references and roadmap docs.

## Workspace layout

- **`flash-cards-app/`** — the actual product, "Lumina Learn" (Next.js + Firebase). This is a **separate git repository** with its own remote — it's tracked here as a plain gitlink (no `.gitmodules`, so it is not a properly registered git submodule). Nearly all code changes happen here. See `flash-cards-app/CLAUDE.md` for stack, architecture, and conventions.
- **`design/`** — static HTML/JS "Lumina Learn" design mockups. Visual reference only — never import this as application code.
- **`ui-mockups/kiln/`** — additional UI mockups, same rule as above.
- **`system-design-prep/`** — an unrelated personal study repo (distributed systems / DB internals notes). Not part of the flash-cards product; ignore for product work.
- **`.agents/skills/`** — bundled Claude/Higgsfield skill definitions (tooling config, not product code).

## Planning docs at root

- `tickets.md` — current feature ticket breakdown (`FC-01`..`FC-13`), using a wave/dependency key: 🟢 PARALLEL, 🔵 UNLOCKS, 🟡 BLOCKED, ⚪ OPTIONAL. Treat this as the source of truth for feature work.
- `MODERNIZATION_PLAN.md` — history of the stack rebuild (from an earlier Vite+Express+MySQL MVP and a dropped Electron scaffold to the current Next.js+Firebase app).
- `design-system-tickets.md`, `kpi-idea.md` — supporting planning docs.
- `.cursor/tickets/` — an older ticket set (`T01..T12`, `ES01..ES05`, `AN01..AN08`). Likely superseded by root `tickets.md` — don't treat both as equally current without checking.
- `flash-cards-app/.agent-workflow/roadmap.md` (`TASK-001..017`) — a **separate** autonomous-task/modernization roadmap. Do not merge or conflate this ticket numbering with root `tickets.md`'s `FC-xx` numbering — they track different work streams.

## Hygiene notes

- `firebase-debug.log`, `node_modules/`, `.DS_Store` at root are build/debug artifacts, not source. Root `.gitignore` is minimal — don't assume everything generated is already ignored; check before committing.
