import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const monorepoRoot = process.env.DECANTR_MONOREPO_DIR
  ? resolve(process.env.DECANTR_MONOREPO_DIR)
  : resolve(repoRoot, '..', 'decantr-monorepo');
const registrySchemaDir = join(monorepoRoot, 'packages', 'registry', 'schema');
const targetDir = join(repoRoot, 'schemas');

if (!existsSync(registrySchemaDir)) {
  console.error(`Registry schema source not found: ${registrySchemaDir}`);
  console.error('Set DECANTR_MONOREPO_DIR to a Decantr monorepo checkout and try again.');
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

for (const file of readdirSync(registrySchemaDir).filter(name => name.endsWith('.json'))) {
  copyFileSync(join(registrySchemaDir, file), join(targetDir, file));
}

console.log(`Synced registry schemas from ${registrySchemaDir}`);
