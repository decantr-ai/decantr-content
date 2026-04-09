#!/usr/bin/env node

/**
 * Audit live official registry content for intelligence metadata coverage.
 *
 * Usage:
 *   node scripts/audit-content-intelligence.js
 *   node scripts/audit-content-intelligence.js --report-json=./content-intelligence-report.json
 *   node scripts/audit-content-intelligence.js --summary-markdown=./content-intelligence-summary.md
 *   node scripts/audit-content-intelligence.js --fail-on-missing
 *   node scripts/audit-content-intelligence.js --fail-on-filter-mismatch
 *
 * Environment variables:
 *   REGISTRY_URL        - API base URL (default: https://api.decantr.ai/v1)
 *   CONTENT_NAMESPACE   - Namespace to audit (default: @official)
 *   FAIL_ON_MISSING     - Set to "true" to fail when official blueprints have no intelligence metadata
 *   FAIL_ON_FILTER_MISMATCH - Set to "true" to fail when the hosted recommended filter disagrees with metadata counts
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
const FAIL_ON_FILTER_MISMATCH =
  args.includes('--fail-on-filter-mismatch') || process.env.FAIL_ON_FILTER_MISMATCH === 'true';

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

async function fetchLiveItems(directory, options = {}) {
  const { recommendedOnly = false } = options;
  const items = [];
  let offset = 0;

  while (true) {
    const searchParams = new URLSearchParams({
      namespace: CONTENT_NAMESPACE,
      limit: '100',
      offset: String(offset),
    });

    if (recommendedOnly) {
      searchParams.set('recommended', 'true');
    }

    const url = `${REGISTRY_URL}/${directory}?${searchParams}`;
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

function toTypeStats(type, repoCount, liveItems, recommendedItems) {
  const intelligenceItems = liveItems.filter((item) => item.intelligence);
  const qualityScores = intelligenceItems
    .map((item) => item.intelligence?.quality_score)
    .filter((value) => typeof value === 'number');
  const confidenceScores = intelligenceItems
    .map((item) => item.intelligence?.confidence_score)
    .filter((value) => typeof value === 'number');
  const recommended = intelligenceItems.filter((item) => item.intelligence?.recommended).length;
  const authored = intelligenceItems.filter((item) => item.intelligence?.source === 'authored').length;
  const benchmark = intelligenceItems.filter((item) => item.intelligence?.source === 'benchmark').length;
  const hybrid = intelligenceItems.filter((item) => item.intelligence?.source === 'hybrid').length;
  const missingSource = intelligenceItems.filter((item) => !item.intelligence?.source).length;

  return {
    repo: repoCount,
    live: liveItems.length,
    withIntelligence: intelligenceItems.length,
    authored,
    benchmark,
    hybrid,
    missingSource,
    recommended,
    recommendedViaFilter: recommendedItems.length,
    recommendedFilterMismatch: recommendedItems.length - recommended,
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
    '| Type | Repo | Live | With Intelligence | Authored | Benchmark | Hybrid | Recommended | Recommended API | Smoke Green | Build Green | High Confidence | Avg Quality | Avg Confidence |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const [type, stats] of Object.entries(report.byType)) {
    lines.push(
      `| ${type} | ${stats.repo} | ${stats.live} | ${stats.withIntelligence} | ${stats.authored} | ${stats.benchmark} | ${stats.hybrid} | ${stats.recommended} | ${stats.recommendedViaFilter} | ${stats.smokeGreen} | ${stats.buildGreen} | ${stats.highConfidence} | ${stats.averageQuality ?? '—'} | ${stats.averageConfidence ?? '—'} |`,
    );
  }

  lines.push('');
  lines.push(
    `- Totals: repo ${report.totals.repo}, live ${report.totals.live}, intelligence ${report.totals.withIntelligence}, authored ${report.totals.authored}, benchmark ${report.totals.benchmark}, hybrid ${report.totals.hybrid}, recommended ${report.totals.recommended}, recommended API ${report.totals.recommendedViaFilter}, smoke green ${report.totals.smokeGreen}, build green ${report.totals.buildGreen}`,
  );

  if (report.recommendedFilterMismatches.length > 0) {
    lines.push('');
    lines.push('## Recommended Filter Mismatches');
    for (const mismatch of report.recommendedFilterMismatches) {
      lines.push(`- ${mismatch.type} — metadata ${mismatch.recommended}, API filter ${mismatch.recommendedViaFilter}`);
    }
  }

  if (report.missingSourceByType.length > 0) {
    lines.push('');
    lines.push('## Intelligence Missing Source');
    for (const item of report.missingSourceByType) {
      lines.push(`- ${item.type} — ${item.missingSource} live items expose intelligence metadata without a provenance source`);
    }
  }

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
        `- ${item.slug} — source ${item.source ?? 'unknown'}, quality ${item.qualityScore ?? '—'}, confidence ${item.confidenceScore ?? '—'}, verification ${item.verificationStatus ?? 'unknown'}`,
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
      const recommendedItems = await fetchLiveItems(dir, { recommendedOnly: true });
      byType[type] = toTypeStats(type, repoCounts[type] || 0, liveItems, recommendedItems);
      allLiveItems.push(...liveItems.map((item) => ({ ...item, type })));
    } catch (error) {
      failures.push(`${type}: ${error.message}`);
      byType[type] = toTypeStats(type, repoCounts[type] || 0, [], []);
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
      source: item.intelligence?.source ?? null,
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

  const recommendedFilterMismatches = Object.entries(byType)
    .filter(([, stats]) => stats.recommended !== stats.recommendedViaFilter)
    .map(([type, stats]) => ({
      type,
      recommended: stats.recommended,
      recommendedViaFilter: stats.recommendedViaFilter,
    }));
  const missingSourceByType = Object.entries(byType)
    .filter(([, stats]) => stats.missingSource > 0)
    .map(([type, stats]) => ({
      type,
      missingSource: stats.missingSource,
    }));

  const totals = Object.values(byType).reduce(
    (acc, stats) => ({
      repo: acc.repo + stats.repo,
      live: acc.live + stats.live,
      withIntelligence: acc.withIntelligence + stats.withIntelligence,
      authored: acc.authored + stats.authored,
      benchmark: acc.benchmark + stats.benchmark,
      hybrid: acc.hybrid + stats.hybrid,
      missingSource: acc.missingSource + stats.missingSource,
      recommended: acc.recommended + stats.recommended,
      recommendedViaFilter: acc.recommendedViaFilter + stats.recommendedViaFilter,
      smokeGreen: acc.smokeGreen + stats.smokeGreen,
      buildGreen: acc.buildGreen + stats.buildGreen,
      highConfidence: acc.highConfidence + stats.highConfidence,
    }),
    {
      repo: 0,
      live: 0,
      withIntelligence: 0,
      authored: 0,
      benchmark: 0,
      hybrid: 0,
      missingSource: 0,
      recommended: 0,
      recommendedViaFilter: 0,
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
    recommendedFilterMismatches,
    missingSourceByType,
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

  if (FAIL_ON_FILTER_MISMATCH && recommendedFilterMismatches.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
