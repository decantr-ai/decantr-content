#!/usr/bin/env node

/**
 * Remove dependencies.recipes from all archetypes and patterns.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';

const dirs = ['archetypes', 'patterns'];
let updated = 0;
let total = 0;

for (const dir of dirs) {
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    total++;
    const path = `${dir}/${file}`;
    const data = JSON.parse(readFileSync(path, 'utf-8'));

    if (data.dependencies && 'recipes' in data.dependencies) {
      delete data.dependencies.recipes;
      writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
      console.log(`  Cleaned: ${path}`);
      updated++;
    }
  }
}

console.log(`\nUpdated ${updated} of ${total} files`);
