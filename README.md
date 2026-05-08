# Decantr Content

Official content for the Decantr design intelligence registry. This repo is the source of truth for all `@official` namespace content served by `api.decantr.ai`.

This content enriches registry-backed blueprint, archetype, pattern, theme, and shell flows. It is not required for brownfield attach or contract-only Decantr adoption: those CLI paths can run from local project analysis and generated contract files without connecting to the official registry. Offline blueprint/theme enrichment can point the CLI at a local checkout of this repo with `DECANTR_CONTENT_DIR=/path/to/decantr-content` or use an equivalent local cache/custom content source.

## Structure

```
patterns/       — UI section components (hero, kpi-grid, chat-thread, etc.)
themes/         — Color palettes, modes, treatment metadata, and DNA-inference hints
blueprints/     — Complete app compositions (saas-dashboard, etc.)
archetypes/     — App-level templates (ai-chatbot, saas-dashboard, etc.)
shells/         — Page layout containers (sidebar-main, topbar-main, etc.)
```

## Publishing

Changes are validated in CI and published by Decantr maintainers after they land on `main`.

CI checks every content file with `node validate.js`. Public contributors do not need registry credentials to validate or propose content changes.

## Local Development

For contributors (no credentials required):

```bash
npm install
npm run validate                                                                 # validate every JSON file against the schemas
npm run registry:audit -- --report-json=./registry-drift-report.json             # read-only diff against the live registry
node scripts/audit-content-intelligence.js --report-json=./content-intelligence-report.json
```

External contributors can verify their changes with `npm run validate` and the read-only audit scripts. Registry publishing is handled by Decantr maintainers.

## Auditing Live Registry Drift

Use the audit script when you want to compare this repo with the live `@official` namespace before release:

```bash
node scripts/audit-registry-drift.js
node scripts/audit-registry-drift.js --report-json=./registry-drift-report.json --summary-markdown=./registry-drift-summary.md
```

What it reports:
- `missing live` — content present in this repo but missing from the live registry
- `extra live` — content still published live but no longer present in this repo
- `changed` — content whose live JSON or version does not match the repo source of truth
- `failures` — fetch or comparison errors during the audit

The audit is read-only and does not require registry credentials for public `@official` content.

## Auditing Content Intelligence Coverage

Use the intelligence audit when you want a read-only coverage report for quality, confidence, provenance, recommendation, and verification metadata attached to live `@official` content:

```bash
node scripts/audit-content-intelligence.js
node scripts/audit-content-intelligence.js --report-json=./content-intelligence-report.json --summary-markdown=./content-intelligence-summary.md
```

This audit is also read-only and does not require registry credentials for public `@official` content.

## Adding Content

1. Create a new JSON file in the appropriate directory
2. Every item must have an `id` field (used as the slug)
3. Open a PR — CI validates the JSON
4. Merge to `main` — maintainers publish the update to the live registry

PRs and scheduled checks can also run the drift audit workflow to surface live-vs-repo mismatches without mutating the registry.

## Content Schema

Each content type has specific required fields. All items should include:
- `id` — unique identifier (used as slug in the registry)
- `version` — semver version string
- `name` — human-readable name
- `description` — brief description

This repo keeps vendored copies of the canonical registry schemas in [`schemas/`](./schemas):
- `schemas/pattern.v2.json`
- `schemas/theme.v1.json`
- `schemas/blueprint.v1.json`
- `schemas/archetype.v2.json`
- `schemas/shell.v1.json`

`validate.js` enforces both the expected `$schema` URL and the local schema contract for each content type.

Themes include DNA-inference hints (`typography_hints`, `motion_hints`, `radius_hints`) used by the CLI to generate v3 essence defaults during `decantr init`.

Legacy note:
- recipe metadata has been folded into themes and treatment-related fields
- `recipe` is no longer an active top-level registry content type

## License

This repository is licensed under the MIT License. See [LICENSE](./LICENSE).
