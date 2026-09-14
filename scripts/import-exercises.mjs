#!/usr/bin/env node

/*
 * Import an exercise export into the app's category folders.
 *
 * Supported input: JSON, CSV/TSV, or saved HTML. JSON/CSV should expose at
 * least a name/title column. The importer accepts common provider field names
 * and keeps provider-specific fields in a small, stable app schema.
 *
 * Usage:
 *   npm run import:exercises -- ./downloads/muscle-and-strength.json
 *   npm run import:exercises -- ./downloads/exercises.csv ./src/data/exercise-library/imported
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { EXERCISE_CATEGORIES } from '../src/data/exercise-library/categories.js';
import { exerciseSlug, normalizeExercise } from '../src/data/exercise-library/schema.js';

const SOURCE = 'muscle-and-strength';
const defaultOutput = path.resolve('src/data/exercise-library/imported');

const field = (row, ...names) => {
  const keys = Object.keys(row);
  const wanted = names.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const key = keys.find((candidate) => wanted.includes(candidate.toLowerCase().replace(/[^a-z0-9]/g, '')));
  return key ? row[key] : undefined;
};

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  const text = String(value).trim();
  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('"') && text.endsWith('"'))) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* Fall through to delimiter parsing. */ }
  }
  return text.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
}

function parseDelimited(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map((header, index) => header || `column_${index + 1}`);
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function textFromHtml(value) {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

function parseHtml(html) {
  const rows = [];
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const pageCategory = textFromHtml(heading ?? '').replace(/\s+exercises?$/i, '').trim() || null;
  const matches = html.matchAll(/<a\b[^>]*href=["']([^"']*\/exercises\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const match of matches) {
    const sourceUrl = new URL(match[1], 'https://www.muscleandstrength.com').href.split('#')[0];
    const name = textFromHtml(match[2]);
    const sourceSlug = sourceUrl.split('/exercises/')[1]?.split(/[?#/]/)[0];
    if (!sourceSlug || !name || ['chest', 'abs', 'shoulders', 'biceps', 'exercises'].includes(sourceSlug)) continue;
    rows.push({ name, sourceUrl, sourceCategory: pageCategory ?? sourceSlug });
  }
  return rows;
}

function parseInput(text, extension) {
  if (extension === '.html' || extension === '.htm' || /<html[\s>]/i.test(text)) return parseHtml(text);
  if (extension === '.csv' || extension === '.tsv') return parseDelimited(text, extension === '.tsv' ? '\t' : ',');
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : parsed.exercises ?? parsed.items ?? parsed.results ?? parsed.data ?? [];
  if (!Array.isArray(rows)) throw new Error('JSON must be an array or contain exercises, items, results, or data as an array.');
  return rows;
}

function normalizeRow(row, index) {
  const sourceId = field(row, 'sourceId', 'source_id', 'exerciseId', 'exercise_id', 'id', 'slug');
  const sourceUrl = field(row, 'sourceUrl', 'source_url', 'url', 'link', 'href');
  const sourceCategory = field(row, 'sourceCategory', 'source_category', 'muscleGroup', 'muscle_group', 'bodyPart', 'body_part', 'category', 'muscle');
  const raw = {
    ...row,
    name: field(row, 'name', 'title', 'exercise', 'exerciseName', 'exercise_name') ?? row.name,
    sourceId,
    sourceUrl,
    sourceCategory,
    category: field(row, 'folder', 'appCategory'),
    categories: parseList(field(row, 'categories', 'folders')),
    primaryMuscles: parseList(field(row, 'primaryMuscles', 'primary_muscles', 'targetMuscles', 'target_muscles', 'muscles', 'targetMuscle', 'target_muscle')),
    secondaryMuscles: parseList(field(row, 'secondaryMuscles', 'secondary_muscles')),
    aliases: parseList(field(row, 'aliases', 'alternateNames', 'alternate_names')),
    equipment: field(row, 'equipment', 'equipmentRequired', 'equipment_required'),
    type: field(row, 'type', 'exerciseType', 'exercise_type'),
    mechanics: field(row, 'mechanics', 'mechanic'),
    difficulty: field(row, 'difficulty', 'experience', 'experienceLevel', 'experience_level')
  };
  return normalizeExercise(raw, { source: SOURCE, id: `ms:${exerciseSlug(sourceId || raw.name || `exercise-${index + 1}`)}` });
}

function dedupe(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.sourceUrl || `${row.source}:${row.name.toLowerCase()}`;
    if (!row.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const js = (value) => JSON.stringify(value, null, 2);

async function writeCatalogue(rows, output) {
  await mkdir(output, { recursive: true });
  const byCategory = new Map(EXERCISE_CATEGORIES.map((category) => [category.id, []]));
  for (const row of rows) (byCategory.get(row.category) ?? byCategory.get('other')).push(row);

  const imports = [];
  for (const category of EXERCISE_CATEGORIES) {
    const filename = `${category.id}.js`;
    const variable = category.id.replace(/-/g, '_');
    await writeFile(path.join(output, filename), `// Generated by npm run import:exercises. Do not edit by hand.\nexport default ${js(byCategory.get(category.id))};\n`);
    imports.push(`import ${variable} from './${filename}';`);
  }
  const countByCategory = Object.fromEntries(EXERCISE_CATEGORIES.map((category) => [category.id, byCategory.get(category.id).length]));
  const manifest = { source: SOURCE, importedAt: new Date().toISOString(), count: rows.length, categories: countByCategory };
  await writeFile(path.join(output, 'index.js'), [
    '// Generated by npm run import:exercises. Do not edit by hand.',
    ...imports,
    `export const IMPORTED_EXERCISES = Object.freeze([${EXERCISE_CATEGORIES.map((category) => category.id.replace(/-/g, '_')).join(', ')}].flat());`,
    `export const IMPORT_MANIFEST = ${js(manifest)};`,
    ''
  ].join('\n'));
  await writeFile(path.join(output, 'manifest.json'), `${js(manifest)}\n`);
}

const [inputArgument, outputArgument] = process.argv.slice(2);
if (!inputArgument) {
  console.error('Usage: npm run import:exercises -- <export.json|export.csv|saved-page.html> [output-directory]');
  process.exitCode = 1;
} else {
  try {
    const input = path.resolve(inputArgument);
    const output = path.resolve(outputArgument ?? defaultOutput);
    const text = await readFile(input, 'utf8');
    const rows = dedupe(parseInput(text, path.extname(input).toLowerCase()).map(normalizeRow));
    if (!rows.length) throw new Error('No exercises were found. Check the download format or provide a JSON/CSV export with a name column.');
    await writeCatalogue(rows, output);
    console.log(`Imported ${rows.length} exercises into ${output}`);
  } catch (error) {
    console.error(`Exercise import failed: ${error.message}`);
    process.exitCode = 1;
  }
}
