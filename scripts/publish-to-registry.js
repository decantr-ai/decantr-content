import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REGISTRY_URL = process.env.REGISTRY_URL || 'https://decantr-registry.fly.dev/v1';
const API_KEY = process.env.REGISTRY_API_KEY;
const DRY_RUN = process.env.DRYRUN === 'true';

const CONTENT_TYPES = ['patterns', 'recipes', 'themes', 'blueprints', 'archetypes', 'shells'];

if (!API_KEY && !DRY_RUN) {
  console.error('REGISTRY_API_KEY is required');
  process.exit(1);
}

let published = 0;
let skipped = 0;
let failed = 0;

async function publishItem(type, content) {
  const endpoint = `${REGISTRY_URL}/admin/${type}/${content.id}`;

  if (DRY_RUN) {
    console.log(`[dry-run] Would publish ${type}/${content.id}`);
    return true;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(content)
    });

    if (res.ok) {
      console.log(`  Published ${type}/${content.id}`);
      return true;
    } else if (res.status === 409) {
      console.log(`  Skipped ${type}/${content.id} (version exists)`);
      return 'skip';
    } else {
      console.error(`  Failed ${type}/${content.id}: ${res.status}`);
      return false;
    }
  } catch (e) {
    console.error(`  Failed ${type}/${content.id}: ${e.message}`);
    return false;
  }
}

for (const type of CONTENT_TYPES) {
  const dir = join('official', type);
  if (!existsSync(dir)) continue;

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const content = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
    const result = await publishItem(type, content);

    if (result === true) published++;
    else if (result === 'skip') skipped++;
    else failed++;
  }
}

console.log(`\nPublished: ${published}, Skipped: ${skipped}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
