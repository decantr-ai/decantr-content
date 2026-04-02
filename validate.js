import { readdirSync, readFileSync } from 'fs';

const types = ['patterns', 'themes', 'blueprints', 'archetypes', 'shells'];
let errors = 0;
let total = 0;

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
    } catch (e) {
      console.error(`  FAIL ${type}/${file}: invalid JSON - ${e.message}`);
      errors++;
    }
  }
}

console.log(`\nValidated ${total} files, ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
