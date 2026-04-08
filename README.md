# Decantr Content

Official content for the Decantr design intelligence registry. This repo is the source of truth for all `@official` namespace content served by `api.decantr.ai`.

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
2. **Sync** — `node scripts/sync-to-registry.js` upserts each item to the registry via `POST /v1/admin/sync`

The sync uses `(namespace, type, slug)` as the upsert key. Existing items are updated in-place; new items are created. All items are published under the `@official` namespace with `status: published`.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DECANTR_ADMIN_KEY` | Admin key matching the `DECANTR_ADMIN_KEY` env var on the API server |

### Optional GitHub Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REGISTRY_URL` | `https://api.decantr.ai/v1` | API base URL |

## Local Development

```bash
node validate.js                          # Validate all content files
DECANTR_ADMIN_KEY=xxx node scripts/sync-to-registry.js  # Manual sync to registry
```

## Adding Content

1. Create a new JSON file in the appropriate directory
2. Every item must have an `id` field (used as the slug)
3. Open a PR — CI validates the JSON
4. Merge to `main` — CI syncs to the live registry

## Content Schema

Each content type has specific required fields. All items should include:
- `id` — unique identifier (used as slug in the registry)
- `version` — semver version string
- `name` — human-readable name
- `description` — brief description

Themes include DNA-inference hints (`typography_hints`, `motion_hints`, `radius_hints`) used by the CLI to generate v3 essence defaults during `decantr init`.

Legacy note:
- recipe metadata has been folded into themes and treatment-related fields
- `recipe` is no longer an active top-level registry content type
