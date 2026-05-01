# Decantr Content

Official content for the Decantr design intelligence registry. This repo is the source of truth for all `@official` namespace content served by `api.decantr.ai`.

This content enriches registry-backed blueprint, archetype, pattern, theme, and shell flows. It is not required for brownfield attach or contract-only Decantr adoption: those CLI paths can run from local project analysis and generated contract files without connecting to the official registry. Offline blueprint/theme enrichment should point the CLI at this repo with `DECANTR_CONTENT_DIR=/path/to/decantr-content` or use an equivalent local cache/custom content source.

## Structure

```
patterns/       — UI section components (hero, kpi-grid, chat-thread, etc.)
themes/         — Color palettes, modes, treatment metadata, and DNA-inference hints
blueprints/     — Complete app compositions (saas-dashboard, etc.)
archetypes/     — App-level templates (ai-chatbot, saas-dashboard, etc.)
shells/         — Page layout containers (sidebar-main, topbar-main, etc.)
```

## How Publishing Works

This repo auto-publishes to the live registry on every push to `main`:

1. **Validate** — `node validate.js` checks all JSON files for valid structure
2. **Sync** — `node scripts/sync-to-registry.js` reconciles the registry via `POST /v1/admin/sync` and prunes stale `@official` entries via `DELETE /v1/admin/content/:type/:namespace/:slug`

The sync uses `(namespace, type, slug)` as the upsert key. Existing items are updated in-place, new items are created, and missing `@official` items are deleted unless `PRUNE_MISSING=false` is set. All items are published under the `@official` namespace with `status: published`.

Supporting audit workflows also run from GitHub Actions:

- `publish.yml` validates on every push to `main` and supports manual dry-run syncs
- `registry-drift.yml` audits live `@official` drift on pull requests, on a weekly schedule, and via manual dispatch
- `content-intelligence.yml` audits live intelligence coverage on pull requests, on a weekly schedule, and via manual dispatch

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DECANTR_ADMIN_KEY` | Admin key matching the `DECANTR_ADMIN_KEY` env var on the API server |

### Optional GitHub Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REGISTRY_URL` | `https://api.decantr.ai/v1` | API base URL |

## Local Development

For contributors (no credentials required):

```bash
npm install
npm run validate                                                                 # validate every JSON file against the schemas
npm run registry:audit -- --report-json=./registry-drift-report.json             # read-only diff against the live registry
node scripts/audit-content-intelligence.js --report-json=./content-intelligence-report.json
```

For maintainers only (requires an admin key for `api.decantr.ai`):

```bash
DECANTR_ADMIN_KEY=xxx npm run registry:sync
DECANTR_ADMIN_KEY=xxx node scripts/sync-to-registry.js --dry-run --report-json=./sync-report.json
npm run schemas:sync                                                             # requires a sibling decantr-monorepo checkout
```

External contributors can verify their changes with `npm run validate` and the read-only audit scripts; the admin sync runs automatically in CI on merge to `main`. To run your own registry instance, see [How Publishing Works](#how-publishing-works) and provision your own `DECANTR_ADMIN_KEY` for the API server.

## Auditing Live Registry Drift

Use the audit script when you want to compare this repo with the live `@official` namespace before publishing or pruning:

```bash
node scripts/audit-registry-drift.js
node scripts/audit-registry-drift.js --report-json=./registry-drift-report.json --summary-markdown=./registry-drift-summary.md
REGISTRY_URL=https://staging-api.decantr.ai/v1 node scripts/audit-registry-drift.js --fail-on-drift
```

What it reports:
- `missing live` — content present in this repo but missing from the live registry
- `extra live` — content still published live but no longer present in this repo
- `changed` — content whose live JSON or version does not match the repo source of truth
- `failures` — fetch or comparison errors during the audit

The audit is read-only and does not require an admin key for public `@official` content.

## Auditing Content Intelligence Coverage

Registry "intelligence metadata" is a per-item bundle of quality, confidence, provenance (`authored` / `benchmark` / `hybrid`), and verification signals attached to live `@official` content. The hosted API can filter and summarize on those fields. This audit cross-checks coverage and catches drift between the per-item metadata and the hosted summary endpoint.

Use it when you want to measure how much of the live `@official` corpus carries that metadata, how it is sourced, and whether the hosted recommended filter agrees with the underlying scores:

```bash
node scripts/audit-content-intelligence.js
node scripts/audit-content-intelligence.js --report-json=./content-intelligence-report.json --summary-markdown=./content-intelligence-summary.md
REGISTRY_URL=https://staging-api.decantr.ai/v1 node scripts/audit-content-intelligence.js --fail-on-missing
REGISTRY_URL=https://staging-api.decantr.ai/v1 node scripts/audit-content-intelligence.js --fail-on-filter-mismatch
REGISTRY_URL=https://staging-api.decantr.ai/v1 node scripts/audit-content-intelligence.js --fail-on-source-filter-mismatch
REGISTRY_URL=https://staging-api.decantr.ai/v1 node scripts/audit-content-intelligence.js --fail-on-summary-mismatch
```

What it reports:
- `with intelligence` — live items that expose registry intelligence metadata
- `authored` / `benchmark` / `hybrid` — provenance split for that intelligence metadata
- `recommended` — live items currently marked as recommended references
- `recommended API` — live items returned by the hosted `?recommended=true` filter
- `smoke green` / `build green` — benchmark-backed verification coverage
- `avg quality` / `avg confidence` — average scores for items that already have intelligence data
- `blueprints missing intelligence` — official blueprint slugs still missing that metadata entirely
- `intelligence missing source` — content types where live intelligence metadata is present but does not yet declare `authored`, `benchmark`, or `hybrid` provenance
- `recommended filter mismatches` — content types where live metadata counts disagree with the hosted recommended filter
- `source filter mismatches` — content types where hosted `?intelligence_source=authored|benchmark|hybrid` results disagree with the underlying metadata counts
- `hosted summary mismatches` — places where the hosted `/v1/intelligence/summary` rollup disagrees with a full live crawl of public content

This audit is also read-only and does not require an admin key for public `@official` content.

## Adding Content

1. Create a new JSON file in the appropriate directory
2. Every item must have an `id` field (used as the slug)
3. Open a PR — CI validates the JSON
4. Merge to `main` — CI syncs to the live registry

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

Refresh the vendored schema copies from the canonical monorepo package exports with:

```bash
npm run schemas:sync
```

By default the script looks for a sibling checkout at `../decantr-monorepo`. Override with `DECANTR_MONOREPO_DIR=/path/to/decantr-monorepo` when needed.

Themes include DNA-inference hints (`typography_hints`, `motion_hints`, `radius_hints`) used by the CLI to generate v3 essence defaults during `decantr init`.

Legacy note:
- recipe metadata has been folded into themes and treatment-related fields
- `recipe` is no longer an active top-level registry content type

## License

This repository is licensed under the MIT License. See [LICENSE](./LICENSE).
