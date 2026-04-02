#!/usr/bin/env node

/**
 * Migrate all blueprints:
 * - Rename theme.style → theme.id
 * - Delete theme.recipe
 * - Delete dependencies.recipes
 * - Delete dependencies.styles (redundant — theme id is the reference now)
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';

const dir = 'blueprints';
const files = readdirSync(dir).filter(f => f.endsWith('.json'));
let migrated = 0;

for (const file of files) {
  const path = `${dir}/${file}`;
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  let changed = false;

  // Rename theme.style → theme.id
  if (data.theme && 'style' in data.theme) {
    data.theme.id = data.theme.style;
    delete data.theme.style;
    changed = true;
  }

  // Delete theme.recipe
  if (data.theme && 'recipe' in data.theme) {
    delete data.theme.recipe;
    changed = true;
  }

  // Delete dependencies.recipes
  if (data.dependencies && 'recipes' in data.dependencies) {
    delete data.dependencies.recipes;
    changed = true;
  }

  // Delete dependencies.styles
  if (data.dependencies && 'styles' in data.dependencies) {
    delete data.dependencies.styles;
    changed = true;
  }

  if (changed) {
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    console.log(`  Migrated: ${file}`);
    migrated++;
  } else {
    console.log(`  Skipped (no changes): ${file}`);
  }
}

console.log(`\nMigrated ${migrated} of ${files.length} blueprints`);
