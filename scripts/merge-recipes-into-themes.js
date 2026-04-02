#!/usr/bin/env node
/**
 * merge-recipes-into-themes.js
 *
 * For each recipe that has a paired theme (same filename), merge the recipe's
 * visual data into the theme JSON using the field mapping defined in the
 * recipe-removal plan.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const RECIPES_DIR = join(import.meta.dirname, '..', 'recipes');
const THEMES_DIR = join(import.meta.dirname, '..', 'themes');

// Fields to skip (metadata, not visual data)
const SKIP_FIELDS = new Set([
  'id', 'name', 'type', 'slug', 'namespace', 'version', 'visibility',
  'status', '$schema', 'schema_version', 'decantr_compat', 'description',
  'style', 'mode', 'dependencies', 'source', 'tags',
  'created_at', 'updated_at', 'published_at', 'owner_name', 'owner_username',
]);

// Recipe field → theme field name mapping
const FIELD_MAP = {
  decorators: 'decorators',
  spatial_hints: 'spatial',
  animation: 'motion',
  visual_effects: 'effects',
  treatment_overrides: 'treatments',
  compositions: 'compositions',
  radius_hints: 'radius',
  pattern_preferences: 'pattern_preferences',
  shell: 'shell',
  card_styles: 'card_styles',
};

function mergeMotion(themeMotionHints, recipeAnimation) {
  // recipe animation takes precedence for entrance, durations, timing, micro
  // theme motion_hints provides preference, reduce_motion_default → reduce_motion
  const merged = {};

  // Start with theme motion_hints (if any)
  if (themeMotionHints) {
    if (themeMotionHints.preference != null) {
      merged.preference = themeMotionHints.preference;
    }
    if (themeMotionHints.reduce_motion_default != null) {
      merged.reduce_motion = themeMotionHints.reduce_motion_default;
    }
    // Copy any other fields from motion_hints
    for (const [k, v] of Object.entries(themeMotionHints)) {
      if (k !== 'preference' && k !== 'reduce_motion_default') {
        merged[k] = v;
      }
    }
  }

  // Overlay recipe animation (takes precedence)
  if (recipeAnimation) {
    Object.assign(merged, recipeAnimation);
  }

  return merged;
}

function mergeRecipeIntoTheme(themePath, recipePath) {
  const theme = JSON.parse(readFileSync(themePath, 'utf-8'));
  const recipe = JSON.parse(readFileSync(recipePath, 'utf-8'));

  // 1. Merge mapped recipe fields into theme
  for (const [recipeField, themeField] of Object.entries(FIELD_MAP)) {
    if (recipe[recipeField] == null) continue;

    if (recipeField === 'animation') {
      // Special handling: merge with existing motion_hints
      theme[themeField] = mergeMotion(theme.motion_hints, recipe[recipeField]);
    } else {
      theme[themeField] = recipe[recipeField];
    }
  }

  // 2. If theme has motion_hints but recipe has no animation, still rename it
  if (theme.motion_hints && !recipe.animation) {
    theme.motion = mergeMotion(theme.motion_hints, null);
  }

  // 3. Rename typography_hints → typography
  if (theme.typography_hints) {
    // If recipe also had typography data, we'd merge. Recipes don't have
    // typography currently but handle it defensively.
    theme.typography = { ...theme.typography_hints, ...(recipe.typography || {}) };
  }

  // 4. Clean up old field names
  delete theme.motion_hints;
  delete theme.typography_hints;

  return theme;
}

// Main
const recipeFiles = readdirSync(RECIPES_DIR).filter(f => f.endsWith('.json'));
const themeFiles = new Set(readdirSync(THEMES_DIR).filter(f => f.endsWith('.json')));

let merged = 0;
let skipped = 0;

for (const recipeFile of recipeFiles) {
  if (themeFiles.has(recipeFile)) {
    const themePath = join(THEMES_DIR, recipeFile);
    const recipePath = join(RECIPES_DIR, recipeFile);
    const result = mergeRecipeIntoTheme(themePath, recipePath);
    writeFileSync(themePath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
    console.log(`  merged: ${recipeFile}`);
    merged++;
  } else {
    console.log(`  skipped (no paired theme): ${recipeFile}`);
    skipped++;
  }
}

console.log(`\nDone. Merged: ${merged}, Skipped: ${skipped}`);
