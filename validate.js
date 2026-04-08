import { readdirSync, readFileSync } from 'fs';

const types = ['patterns', 'themes', 'blueprints', 'archetypes', 'shells'];
let errors = 0;
let warnings = 0;
let total = 0;

function fail(msg) {
  console.error(`  FAIL ${msg}`);
  errors++;
}

function warn(msg) {
  console.log(`  WARN ${msg}`);
  warnings++;
}

for (const type of types) {
  let files;
  try {
    files = readdirSync(type).filter(f => f.endsWith('.json'));
  } catch {
    console.log(`  Warning: directory ${type}/ not found`);
    continue;
  }

  for (const file of files) {
    total++;
    try {
      const content = JSON.parse(readFileSync(`${type}/${file}`, 'utf-8'));

      // --- ERROR checks (fail the build) ---

      if (!content.id && !content.slug) fail(`${type}/${file}: missing id or slug`);
      if (type === 'archetypes') {
        const validRoles = ['primary', 'gateway', 'public', 'auxiliary'];
        if (!content.role || !validRoles.includes(content.role)) {
          fail(`${type}/${file}: missing or invalid role (must be one of: ${validRoles.join(', ')})`);
        }

        if (content.suggested_theme !== undefined) {
          const suggestedTheme = content.suggested_theme;

          if (!suggestedTheme || typeof suggestedTheme !== 'object' || Array.isArray(suggestedTheme)) {
            fail(`${type}/${file}: suggested_theme must be an object`);
          } else {
            if (Object.hasOwn(suggestedTheme, 'styles')) {
              fail(`${type}/${file}: suggested_theme.styles is legacy; use suggested_theme.ids`);
            }
            if (Object.hasOwn(suggestedTheme, 'id')) {
              fail(`${type}/${file}: suggested_theme.id is legacy; use suggested_theme.ids`);
            }
            if (Object.hasOwn(suggestedTheme, 'mode')) {
              fail(`${type}/${file}: suggested_theme.mode is legacy; use suggested_theme.modes`);
            }
            if (Object.hasOwn(suggestedTheme, 'shape')) {
              fail(`${type}/${file}: suggested_theme.shape is legacy; use suggested_theme.shapes`);
            }

            for (const [key, value] of Object.entries(suggestedTheme)) {
              if (!['ids', 'modes', 'shapes'].includes(key)) {
                fail(`${type}/${file}: suggested_theme.${key} is not supported`);
                continue;
              }
              if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim().length === 0)) {
                fail(`${type}/${file}: suggested_theme.${key} must be an array of non-empty strings`);
              }
            }
          }
        }
      }
      if (type === 'blueprints' && content.routes) {
        const composeIds = (content.compose || []).map(e => typeof e === 'string' ? e : e.archetype);
        for (const [path, route] of Object.entries(content.routes)) {
          if (route.archetype && !composeIds.includes(route.archetype)) {
            fail(`${type}/${file}: route "${path}" references archetype "${route.archetype}" not in compose`);
          }
        }
      }

      // --- Quality gate WARNINGS (do not fail the build) ---

      if (type === 'patterns') {
        if (!content.visual_brief && !content.layout_hints) {
          warn(`${type}/${file}: missing both visual_brief and layout_hints`);
        }
        if (!content.components || !Array.isArray(content.components) || content.components.length === 0) {
          warn(`${type}/${file}: missing or empty components array`);
        }
        if (content.presets) {
          for (const [presetName, preset] of Object.entries(content.presets)) {
            if (preset.description && preset.description.length < 30) {
              warn(`${type}/${file}: preset "${presetName}" description shorter than 30 chars`);
            }
          }
        }
      }

      if (type === 'blueprints') {
        if (content.personality === undefined || content.personality === null) {
          warn(`${type}/${file}: missing personality`);
        } else if (Array.isArray(content.personality) && content.personality.length === 0) {
          warn(`${type}/${file}: personality is empty array`);
        } else if (typeof content.personality === 'string' && content.personality.length === 0) {
          warn(`${type}/${file}: personality is empty`);
        } else if (typeof content.personality === 'string' && content.personality.length < 100) {
          warn(`${type}/${file}: personality shorter than 100 chars`);
        }
      }

      if (type === 'themes') {
        if (content.palette) {
          const semanticColors = Object.keys(content.palette);
          if (semanticColors.length < 5) {
            warn(`${type}/${file}: palette has fewer than 5 semantic colors (${semanticColors.length})`);
          }
        }
        if (!content.decorators) {
          warn(`${type}/${file}: no decorators defined`);
        } else {
          for (const [name, desc] of Object.entries(content.decorators)) {
            if (typeof desc === 'string' && desc.length < 20) {
              warn(`${type}/${file}: decorator "${name}" description shorter than 20 chars`);
            }
          }
        }
      }

    } catch (e) {
      fail(`${type}/${file}: invalid JSON - ${e.message}`);
    }
  }
}

console.log(`\nValidated ${total} files: ${errors} errors, ${warnings} quality warnings`);
process.exit(errors > 0 ? 1 : 0);
