#!/usr/bin/env node

/**
 * Sync all content from this repo to the Decantr registry API.
 *
 * Usage:
 *   node scripts/sync-to-registry.js
 *
 * Environment variables:
 *   REGISTRY_URL     - API base URL (default: https://api.decantr.ai/v1)
 *   DECANTR_ADMIN_KEY - Admin key for the sync endpoint (required)
 */

import { readdirSync, readFileSync } from 'fs';

const REGISTRY_URL = process.env.REGISTRY_URL || 'https://api.decantr.ai/v1';
const ADMIN_KEY = process.env.DECANTR_ADMIN_KEY;

if (!ADMIN_KEY) {
  console.error('Error: DECANTR_ADMIN_KEY environment variable is required');
  process.exit(1);
}

// Map directory names (plural) to API type names (singular)
const TYPE_MAP = {
  patterns: 'pattern',
  recipes: 'recipe',
  themes: 'theme',
  blueprints: 'blueprint',
  archetypes: 'archetype',
  shells: 'shell',
};

let succeeded = 0;
let failed = 0;
let skipped = 0;
const failures = [];

for (const [dir, type] of Object.entries(TYPE_MAP)) {
  let files;
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch {
    console.log(`  Skip: ${dir}/ not found`);
    continue;
  }

  for (const file of files) {
    const path = `${dir}/${file}`;
    let item;
    try {
      item = JSON.parse(readFileSync(path, 'utf-8'));
    } catch (e) {
      console.error(`  FAIL ${path}: invalid JSON`);
      failed++;
      failures.push(path);
      continue;
    }

    const slug = item.id || item.slug;
    if (!slug) {
      console.error(`  FAIL ${path}: missing id or slug`);
      failed++;
      failures.push(path);
      continue;
    }

    try {
      const res = await fetch(`${REGISTRY_URL}/admin/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY,
        },
        body: JSON.stringify({ type, item }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`  FAIL ${path}: ${res.status} ${body}`);
        failed++;
        failures.push(path);
      } else {
        succeeded++;
        process.stdout.write('.');
      }
    } catch (e) {
      console.error(`  FAIL ${path}: ${e.message}`);
      failed++;
      failures.push(path);
    }
  }
}

console.log('');
console.log(`\nSync complete: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`);

if (failures.length > 0) {
  console.log('\nFailed items:');
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}
