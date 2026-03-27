# Decantr Content

Official content for the Decantr registry.

## Structure

```
official/
├── patterns/      # UI section components
├── recipes/       # Visual decoration rules
├── themes/        # Color palettes and modes
├── blueprints/    # Complete app compositions
├── archetypes/    # App-level templates
└── shells/        # Page layout containers
```

## Commands

```bash
npm run validate        # Validate all JSON schemas
npm run publish:dry-run # Preview what would be published
npm run publish         # Publish to registry (requires REGISTRY_API_KEY)
```

## Publishing

Content is automatically published to the registry when merged to `main` via GitHub Actions.
