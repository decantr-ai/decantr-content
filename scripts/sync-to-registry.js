#!/usr/bin/env node

/**
 * Sync all content from this repo to the Decantr registry API.
 * Uses concurrent requests (batches of 20) for speed.
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
const CONCURRENCY = 20;

if (!ADMIN_KEY) {
  console.error('Error: DECANTR_ADMIN_KEY environment variable is required');
  process.exit(1);
}

const TYPE_MAP = {
  patterns: 'pattern',
  themes: 'theme',
  blueprints: 'blueprint',
  archetypes: 'archetype',
  shells: 'shell',
};

// Collect all items first
const items = [];
for (const [dir, type] of Object.entries(TYPE_MAP)) {
  let files;
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch {
    continue;
  }
  for (const file of files) {
    const path = `${dir}/${file}`;
    try {
      const item = JSON.parse(readFileSync(path, 'utf-8'));
      const slug = item.id || item.slug;
      if (!slug) {
        console.error(`  SKIP ${path}: missing id or slug`);
        continue;
      }
      items.push({ path, type, item });
    } catch {
      console.error(`  SKIP ${path}: invalid JSON`);
    }
  }
}

console.log(`Syncing ${items.length} items to ${REGISTRY_URL} (concurrency: ${CONCURRENCY})`);

let succeeded = 0;
let failed = 0;
const failures = [];

async function syncItem({ path, type, item }) {
  try {
    const res = await fetch(`${REGISTRY_URL}/admin/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
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

// Process in batches of CONCURRENCY
for (let i = 0; i < items.length; i += CONCURRENCY) {
  const batch = items.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(syncItem));
}

console.log(`\n\nSync complete: ${succeeded} succeeded, ${failed} failed (of ${items.length} total)`);

if (failures.length > 0) {
  console.log('\nFailed items:');
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}
