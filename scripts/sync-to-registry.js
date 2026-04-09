#!/usr/bin/env node

/**
 * Sync all content from this repo to the Decantr registry API.
 * Uses concurrent requests (batches of 20) for speed.
 *
 * Usage:
 *   node scripts/sync-to-registry.js
 *   node scripts/sync-to-registry.js --dry-run
 *   node scripts/sync-to-registry.js --report-json=./sync-report.json
 *
 * Environment variables:
 *   REGISTRY_URL     - API base URL (default: https://api.decantr.ai/v1)
 *   DECANTR_ADMIN_KEY - Admin key for the sync endpoint (required)
 *   PRUNE_MISSING    - Set to "false" to skip deleting stale @official items (default: true)
 *   DRY_RUN          - Set to "true" to report actions without mutating the registry
 *   SYNC_REPORT_PATH - Write a JSON report to this path
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { CONTENT_DIRECTORIES, DIRECTORY_TO_CONTENT_TYPE } from './content-contract.js';

const args = process.argv.slice(2);
const REGISTRY_URL = process.env.REGISTRY_URL || 'https://api.decantr.ai/v1';
const ADMIN_KEY = process.env.DECANTR_ADMIN_KEY;
const CONCURRENCY = 20;
const SHOULD_PRUNE = process.env.PRUNE_MISSING !== 'false';
const IS_DRY_RUN = args.includes('--dry-run') || process.env.DRY_RUN === 'true';
const REPORT_PATH = process.env.SYNC_REPORT_PATH
  || args.find(arg => arg.startsWith('--report-json='))?.slice('--report-json='.length)
  || null;

if (!ADMIN_KEY) {
  console.error('Error: DECANTR_ADMIN_KEY environment variable is required');
  process.exit(1);
}

// Collect all items first
const items = [];
const repoSlugsByType = new Map();
const statsByType = new Map();

function ensureTypeStats(type) {
  if (!statsByType.has(type)) {
    statsByType.set(type, {
      repo: 0,
      synced: 0,
      pruned: 0,
    });
  }
  return statsByType.get(type);
}

for (const dir of CONTENT_DIRECTORIES) {
  const type = DIRECTORY_TO_CONTENT_TYPE[dir];
  let files;
  const slugs = new Set();
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch {
    repoSlugsByType.set(type, slugs);
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
      slugs.add(slug);
      items.push({ path, type, item });
      ensureTypeStats(type).repo += 1;
    } catch {
      console.error(`  SKIP ${path}: invalid JSON`);
    }
  }
  repoSlugsByType.set(type, slugs);
}

console.log(`${IS_DRY_RUN ? 'Dry-run sync' : 'Syncing'} ${items.length} items to ${REGISTRY_URL} (concurrency: ${CONCURRENCY})`);

let succeeded = 0;
let failed = 0;
const failures = [];
const plannedPrunes = [];

async function syncItem({ path, type, item }) {
  if (IS_DRY_RUN) {
    succeeded++;
    ensureTypeStats(type).synced += 1;
    process.stdout.write('.');
    return;
  }

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
      ensureTypeStats(type).synced += 1;
      process.stdout.write('.');
    }
  } catch (e) {
    console.error(`  FAIL ${path}: ${e.message}`);
    failed++;
    failures.push(path);
  }
}

async function fetchOfficialSlugs(dir) {
  const slugs = new Set();
  let offset = 0;

  while (true) {
    const res = await fetch(`${REGISTRY_URL}/${dir}?namespace=%40official&limit=100&offset=${offset}`);
    if (!res.ok) {
      throw new Error(`Failed to list ${dir}: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    const batch = Array.isArray(body.items) ? body.items : [];
    for (const item of batch) {
      if (item?.slug) {
        slugs.add(item.slug);
      }
    }

    if (batch.length < 100) break;
    offset += batch.length;
  }

  return slugs;
}

async function pruneMissingContent() {
  let pruned = 0;

  for (const dir of CONTENT_DIRECTORIES) {
    const type = DIRECTORY_TO_CONTENT_TYPE[dir];
    const repoSlugs = repoSlugsByType.get(type) || new Set();
    let liveSlugs;
    try {
      liveSlugs = await fetchOfficialSlugs(dir);
    } catch (error) {
      const message = `prune:${type}: ${error.message}`;
      console.error(`  FAIL ${message}`);
      failed++;
      failures.push(message);
      continue;
    }

    for (const slug of liveSlugs) {
      if (repoSlugs.has(slug)) continue;
      plannedPrunes.push(`${type}/${slug}`);

      if (IS_DRY_RUN) {
        pruned++;
        ensureTypeStats(type).pruned += 1;
        process.stdout.write('x');
        continue;
      }

      const res = await fetch(
        `${REGISTRY_URL}/admin/content/${type}/%40official/${encodeURIComponent(slug)}`,
        {
          method: 'DELETE',
          headers: { 'X-Admin-Key': ADMIN_KEY },
        }
      );

      if (!res.ok) {
        const body = await res.text();
        console.error(`  FAIL prune ${type}/${slug}: ${res.status} ${body}`);
        failed++;
        failures.push(`prune:${type}/${slug}`);
        continue;
      }

      pruned++;
      ensureTypeStats(type).pruned += 1;
      process.stdout.write('x');
    }
  }

  return pruned;
}

// Process in batches of CONCURRENCY
for (let i = 0; i < items.length; i += CONCURRENCY) {
  const batch = items.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(syncItem));
}

let pruned = 0;
if (SHOULD_PRUNE) {
  console.log(`\n${IS_DRY_RUN ? 'Planning prune for' : 'Pruning'} stale @official content...`);
  pruned = await pruneMissingContent();
}

const report = {
  dryRun: IS_DRY_RUN,
  pruneMissing: SHOULD_PRUNE,
  registryUrl: REGISTRY_URL,
  totals: {
    repoItems: items.length,
    synced: succeeded,
    pruned,
    failed,
  },
  byType: Object.fromEntries(statsByType),
  plannedPrunes,
  failures,
};

if (REPORT_PATH) {
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  console.log(`Report written to ${REPORT_PATH}`);
}

console.log(`\n\nSync complete: ${succeeded} ${IS_DRY_RUN ? 'planned' : 'synced'}, ${pruned} ${IS_DRY_RUN ? 'planned prune(s)' : 'pruned'}, ${failed} failed (of ${items.length} repo items)`);

if (failures.length > 0) {
  console.log('\nFailed items:');
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}
