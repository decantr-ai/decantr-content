import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CONTENT_TYPES = ['patterns', 'recipes', 'themes', 'blueprints', 'archetypes', 'shells'];
const REQUIRED_FIELDS = {
  patterns: ['id', 'name', 'description'],
  recipes: ['id', 'name'],
  themes: ['id', 'name', 'seed'],
  blueprints: ['id', 'name', 'compose'],
  archetypes: ['id', 'name', 'pages'],
  shells: ['id', 'name']
};

let errors = 0;
let validated = 0;

for (const type of CONTENT_TYPES) {
  const dir = join('official', type);
  if (!existsSync(dir)) continue;

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const path = join(dir, file);
    try {
      const content = JSON.parse(readFileSync(path, 'utf-8'));

      // Check required fields
      const required = REQUIRED_FIELDS[type] || ['id'];
      for (const field of required) {
        if (!content[field]) {
          console.error(`  ${path}: missing required field "${field}"`);
          errors++;
        }
      }

      // Check id matches filename
      const expectedId = file.replace('.json', '');
      if (content.id && content.id !== expectedId && type !== 'shells') {
        console.warn(`  ${path}: id "${content.id}" doesn't match filename "${expectedId}"`);
      }

      validated++;
    } catch (e) {
      console.error(`  ${path}: invalid JSON - ${e.message}`);
      errors++;
    }
  }
}

console.log(`\nValidated ${validated} files, ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
