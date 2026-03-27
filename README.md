# Decantr Content

Official content for the Decantr design intelligence registry.

## Structure

```
patterns/       — UI section components (hero, kpi-grid, chat-thread, etc.)
recipes/        — Visual decoration rules (carbon, glassmorphism, etc.)
themes/         — Color palettes and modes (carbon, luminarum, etc.)
blueprints/     — Complete app compositions (saas-dashboard, etc.)
archetypes/     — App-level templates (ai-chatbot, saas-dashboard, etc.)
shells/         — Page layout containers (sidebar-main, topbar-main, etc.)
```

## Publishing

Content is automatically published to the Decantr registry when pushed to `main`.

The CI/CD pipeline:
1. Validates all JSON files
2. Publishes each item to the registry via `POST /v1/admin/sync`

## Local Development

```bash
node validate.js    # Validate all content files
```

## Adding Content

1. Create a new JSON file in the appropriate directory
2. Ensure it has at minimum an `id` field
3. Push to `main` — CI/CD handles the rest
