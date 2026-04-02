import { readdirSync, readFileSync } from 'fs';

const types = ['patterns', 'themes', 'blueprints', 'archetypes', 'shells'];
let errors = 0;
let warnings = 0;
let total = 0;

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

      if (!content.id && !content.slug) {
        console.error(`  FAIL ${type}/${file}: missing id or slug`);
        errors++;
      }
      if (type === 'archetypes') {
        const validRoles = ['primary', 'gateway', 'public', 'auxiliary'];
        if (!content.role || !validRoles.includes(content.role)) {
          console.error(`  FAIL ${type}/${file}: missing or invalid role (must be one of: ${validRoles.join(', ')})`);
          errors++;
        }
      }
      if (type === 'blueprints' && content.routes) {
        const composeIds = (content.compose || []).map(e => typeof e === 'string' ? e : e.archetype);
        for (const [path, route] of Object.entries(content.routes)) {
          if (route.archetype && !composeIds.includes(route.archetype)) {
            console.error(`  FAIL ${type}/${file}: route "${path}" references archetype "${route.archetype}" not in compose`);
            errors++;
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
      console.error(`  FAIL ${type}/${file}: invalid JSON - ${e.message}`);
      errors++;
    }
  }
}

console.log(`\nValidated ${total} files: ${errors} errors, ${warnings} quality warnings`);
process.exit(errors > 0 ? 1 : 0);
