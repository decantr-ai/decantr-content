# Contributing to decantr-content

Thanks for helping grow the Decantr design intelligence registry.

This repo is the source of truth for `@official` namespace content. Every JSON file here is the input that the AI reads when scaffolding a Decantr-powered project — small wording or schema changes meaningfully change what gets generated.

## Quick start

```bash
git clone https://github.com/decantr-ai/decantr-content.git
cd decantr-content
npm install
npm run validate
```

`npm run validate` runs offline and requires no credentials. It is the same check CI runs on every PR.

## Content types

| Directory | Purpose | Schema |
|-----------|---------|--------|
| `patterns/` | UI sections (hero, kpi-grid, chat-thread, etc.) | `schemas/pattern.v2.json` |
| `themes/` | Color palettes, modes, treatments, decorators | `schemas/theme.v1.json` |
| `blueprints/` | Complete app compositions | `schemas/blueprint.v1.json` |
| `archetypes/` | App-level templates (ai-chatbot, saas-dashboard, etc.) | `schemas/archetype.v2.json` |
| `shells/` | Page layout containers (sidebar-main, topbar-main, etc.) | `schemas/shell.v1.json` |

## File rules

- **One item per file.** Filename is `<id>.json` in kebab-case.
- **`id` field must equal the filename** (without `.json`). It becomes the slug in the registry.
- **`$schema` must point at the canonical URL** for the content type (see `schemas/`).
- **`version` is semver** (`"1.0.0"`).
- **No comments.** JSON does not allow them.

## Quality bars

CI passes on schema validity, but the validator also emits warnings. Items that ship should not just be valid — they should be useful. Aim for:

| Type | What "good" looks like |
|------|------------------------|
| `patterns` | Has `visual_brief` (1-3 sentences describing the visual intent) AND `components` array AND non-trivial preset descriptions. Patterns with 3+ components should also include a `composition` expression. |
| `blueprints` | Has a `personality` narrative of 100+ characters AND a `voice` block (tone, CTA verbs, avoid words, empty-state copy) AND `suggested_themes`. |
| `themes` | Has a 5+ color semantic palette AND a `decorators` block AND `decorator_definitions` (structured data: name, description, intent, suggested CSS properties). |
| `archetypes` | Has a `role` field (`primary` / `gateway` / `public` / `auxiliary`), `pages` with valid `default_layout`, and `page_briefs` describing each page. |
| `shells` | Has `internal_layout` with semantic spatial specs per region. |

## Adding content

1. Pick the right directory and copy the closest existing file as a starting point — schemas are easier to mimic than to read cold.
2. Edit the JSON. Keep ids unique, run `npm run validate` until clean.
3. Open a PR. The CI workflow (`Audit Registry Drift`) will diff your changes against the live registry and post a summary comment.
4. A maintainer reviews and merges. The `Publish to Registry` workflow auto-syncs `main` to `api.decantr.ai`.

## Editing existing content

- **Bump `version`** when changing semantics (preset shape, component list, layout). Cosmetic edits to `description` or `visual_brief` do not need a bump.
- **Do not rename ids.** Renaming an `id` is a breaking change for every project that references it. Add a new file with the new id and deprecate the old one if needed.
- **Do not delete `@official` content** without a maintainer-approved migration path — generated projects in the wild may reference it.

## Auditing your changes

Two read-only audit scripts run without credentials:

```bash
npm run registry:audit -- --report-json=./registry-drift-report.json
node scripts/audit-content-intelligence.js --report-json=./content-intelligence-report.json
```

These compare the local repo against `api.decantr.ai` and surface what would change when your PR lands.

## What not to PR

- New top-level directories or new content types — those require a schema change in `decantr-monorepo` first.
- Edits to `schemas/` directly. Those are vendored from `decantr-monorepo` via `npm run schemas:sync`.
- Changes to `validate.js` that loosen the contract — tighten freely, loosen only with a maintainer-led discussion.

## Code of conduct

Be kind. Reviews focus on the content, not the contributor.

## License

By contributing, you agree your contributions are licensed under the [MIT License](./LICENSE).
