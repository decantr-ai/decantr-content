#!/usr/bin/env node

/**
 * Audit live official registry content for intelligence metadata coverage.
 *
 * Usage:
 *   node scripts/audit-content-intelligence.js
 *   node scripts/audit-content-intelligence.js --report-json=./content-intelligence-report.json
 *   node scripts/audit-content-intelligence.js --summary-markdown=./content-intelligence-summary.md
 *   node scripts/audit-content-intelligence.js --fail-on-missing
 *
 * Environment variables:
 *   REGISTRY_URL        - API base URL (default: https://api.decantr.ai/v1)
 *   CONTENT_NAMESPACE   - Namespace to audit (default: @official)
 *   FAIL_ON_MISSING     - Set to "true" to fail when official blueprints have no intelligence metadata
 */

import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { CONTENT_DIRECTORIES, DIRECTORY_TO_CONTENT_TYPE } from './content-contract.js';

const args = process.argv.slice(2);
const REGISTRY_URL = process.env.REGISTRY_URL || 'https://api.decantr.ai/v1';
const CONTENT_NAMESPACE = process.env.CONTENT_NAMESPACE || '@official';
const REPORT_PATH =
  args.find((arg) => arg.startsWith('--report-json='))?.slice('--report-json='.length) || null;
const SUMMARY_PATH =
  args.find((arg) => arg.startsWith('--summary-markdown='))?.slice('--summary-markdown='.length) || null;
const FAIL_ON_MISSING =
  args.includes('--fail-on-missing') || process.env.FAIL_ON_MISSING === 'true';

function ensureParentDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function countRepoItems() {
  const repoCounts = {};

  for (const dir of CONTENT_DIRECTORIES) {
    try {
      repoCounts[DIRECTORY_TO_CONTENT_TYPE[dir]] = readdirSync(dir).filter((file) => file.endsWith('.json')).length;
    } catch {
      repoCounts[DIRECTORY_TO_CONTENT_TYPE[dir]] = 0;
    }
  }

  return repoCounts;
}

async function fetchLiveItems(directory) {
  const items = [];
  let offset = 0;

  while (true) {
    const url = `${REGISTRY_URL}/${directory}?namespace=${encodeURIComponent(CONTENT_NAMESPACE)}&limit=100&offset=${offset}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to list ${directory}: ${response.status} ${await response.text()}`);
    }

    const body = await response.json();
    const batch = Array.isArray(body.items) ? body.items : [];
    items.push(...batch);

    if (batch.length < 100) {
      break;
    }

    offset += batch.length;
  }

  return items;
}

function average(values) {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 100) / 100;
}

function toTypeStats(type, repoCount, liveItems) {
  const intelligenceItems = liveItems.filter((item) => item.intelligence);
  const qualityScores = intelligenceItems
    .map((item) => item.intelligence?.quality_score)
    .filter((value) => typeof value === 'number');
  const confidenceScores = intelligenceItems
    .map((item) => item.intelligence?.confidence_score)
    .filter((value) => typeof value === 'number');

  return {
    repo: repoCount,
    live: liveItems.length,
    withIntelligence: intelligenceItems.length,
    recommended: intelligenceItems.filter((item) => item.intelligence?.recommended).length,
    smokeGreen: intelligenceItems.filter((item) => item.intelligence?.verification_status === 'smoke-green').length,
    buildGreen: intelligenceItems.filter((item) => item.intelligence?.verification_status === 'build-green').length,
    highConfidence: intelligenceItems.filter((item) => item.intelligence?.benchmark_confidence === 'high').length,
    averageQuality: average(qualityScores),
    averageConfidence: average(confidenceScores),
  };
}

function buildMarkdownSummary(report) {
  const lines = [
    '# Content Intelligence Audit',
    '',
    `- Audited at: ${report.auditedAt}`,
    `- Registry: ${report.registryUrl}`,
    `- Namespace: ${report.namespace}`,
    '',
    '| Type | Repo | Live | With Intelligence | Recommended | Smoke Green | Build Green | High Confidence | Avg Quality | Avg Confidence |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const [type, stats] of Object.entries(report.byType)) {
    lines.push(
      `| ${type} | ${stats.repo} | ${stats.live} | ${stats.withIntelligence} | ${stats.recommended} | ${stats.smokeGreen} | ${stats.buildGreen} | ${stats.highConfidence} | ${stats.averageQuality ?? '—'} | ${stats.averageConfidence ?? '—'} |`,
    );
  }

  lines.push('');
  lines.push(
    `- Totals: repo ${report.totals.repo}, live ${report.totals.live}, intelligence ${report.totals.withIntelligence}, recommended ${report.totals.recommended}, smoke green ${report.totals.smokeGreen}, build green ${report.totals.buildGreen}`,
  );

  if (report.blueprintsMissingIntelligence.length > 0) {
    lines.push('');
    lines.push('## Blueprints Missing Intelligence');
    for (const slug of report.blueprintsMissingIntelligence) {
      lines.push(`- ${slug}`);
    }
  }

  if (report.topRecommendations.length > 0) {
    lines.push('');
    lines.push('## Top Recommended Blueprints');
    for (const item of report.topRecommendations) {
      lines.push(
        `- ${item.slug} — quality ${item.qualityScore ?? '—'}, confidence ${item.confidenceScore ?? '—'}, verification ${item.verificationStatus ?? 'unknown'}`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const repoCounts = countRepoItems();
  const byType = {};
  const failures = [];
  const allLiveItems = [];

  for (const dir of CONTENT_DIRECTORIES) {
    const type = DIRECTORY_TO_CONTENT_TYPE[dir];
    try {
      const liveItems = await fetchLiveItems(dir);
      byType[type] = toTypeStats(type, repoCounts[type] || 0, liveItems);
      allLiveItems.push(...liveItems.map((item) => ({ ...item, type })));
    } catch (error) {
      failures.push(`${type}: ${error.message}`);
      byType[type] = toTypeStats(type, repoCounts[type] || 0, []);
    }
  }

  const blueprintItems = allLiveItems.filter((item) => item.type === 'blueprint');
  const blueprintsMissingIntelligence = blueprintItems
    .filter((item) => !item.intelligence)
    .map((item) => item.slug)
    .sort((left, right) => left.localeCompare(right));

  const topRecommendations = blueprintItems
    .filter((item) => item.intelligence?.recommended)
    .map((item) => ({
      slug: item.slug,
      qualityScore: item.intelligence?.quality_score ?? null,
      confidenceScore: item.intelligence?.confidence_score ?? null,
      verificationStatus: item.intelligence?.verification_status ?? null,
    }))
    .sort((left, right) => {
      const qualityDelta = (right.qualityScore ?? -1) - (left.qualityScore ?? -1);
      if (qualityDelta !== 0) return qualityDelta;
      return left.slug.localeCompare(right.slug);
    })
    .slice(0, 10);

  const totals = Object.values(byType).reduce(
    (acc, stats) => ({
      repo: acc.repo + stats.repo,
      live: acc.live + stats.live,
      withIntelligence: acc.withIntelligence + stats.withIntelligence,
      recommended: acc.recommended + stats.recommended,
      smokeGreen: acc.smokeGreen + stats.smokeGreen,
      buildGreen: acc.buildGreen + stats.buildGreen,
      highConfidence: acc.highConfidence + stats.highConfidence,
    }),
    {
      repo: 0,
      live: 0,
      withIntelligence: 0,
      recommended: 0,
      smokeGreen: 0,
      buildGreen: 0,
      highConfidence: 0,
    },
  );

  const report = {
    auditedAt: new Date().toISOString(),
    registryUrl: REGISTRY_URL,
    namespace: CONTENT_NAMESPACE,
    byType,
    totals,
    blueprintsMissingIntelligence,
    topRecommendations,
    failures,
  };

  if (REPORT_PATH) {
    ensureParentDir(REPORT_PATH);
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  }

  const summaryMarkdown = buildMarkdownSummary(report);
  if (SUMMARY_PATH) {
    ensureParentDir(SUMMARY_PATH);
    writeFileSync(SUMMARY_PATH, summaryMarkdown);
  }

  console.log(summaryMarkdown.trimEnd());

  if (FAIL_ON_MISSING && blueprintsMissingIntelligence.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
