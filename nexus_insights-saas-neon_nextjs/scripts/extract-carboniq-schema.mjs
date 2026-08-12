#!/usr/bin/env node
// Extracts a validation-only JSON schema (id -> type/subtype/required/
// options/units/bounds/loopSource) from the real CARBONIQ_QUESTIONS source
// of truth in src/lib/carboniq/questions.js, so the Django backend
// (carbonless_backend/questionnaire/carboniq_validation.py) can validate
// every step's answer server-side without hand-duplicating ~160 question
// definitions in Python and drifting out of sync.
//
// questions.js imports countries via the Next.js "@/" alias, which plain
// Node ESM can't resolve, so this script copies both files into a scratch
// temp dir with that one import rewritten to a relative path, imports them
// from there, and cleans up afterwards.
//
// Usage:
//   node scripts/extract-carboniq-schema.mjs > ../carbonless_backend/questionnaire/data/carboniq_schema.json
//
// Regenerate whenever questions.js changes in a way that affects validation
// (new question, changed type/options/units/bounds/loopSource).
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const scratch = mkdtempSync(join(tmpdir(), 'carboniq-schema-'));

try {
  const questionsSrc = readFileSync(join(repoRoot, 'src/lib/carboniq/questions.js'), 'utf-8')
    .replace("@/lib/data/countries", "./countries.mjs");
  const countriesSrc = readFileSync(join(repoRoot, 'src/lib/data/countries.js'), 'utf-8');

  writeFileSync(join(scratch, 'countries.mjs'), countriesSrc);
  writeFileSync(join(scratch, 'questions.mjs'), questionsSrc);

  const { CARBONIQ_QUESTIONS } = await import(pathToFileURL(join(scratch, 'questions.mjs')));

  function extractField(f) {
    return {
      id: f.id,
      type: f.type,
      subtype: f.subtype || null,
      required: f.required !== false,
      numericOnly: !!f.numericOnly,
      exactLength: f.exactLength || null,
      maxLength: f.maxLength || null,
      options: Array.isArray(f.options) ? f.options.map(o => o.value) : null,
    };
  }

  function extractQuestion(q) {
    return {
      id: q.id,
      type: q.type,
      subtype: q.subtype || null,
      required: q.required !== false,
      numericOnly: !!q.numericOnly,
      exactLength: q.exactLength || null,
      maxLength: q.maxLength || null,
      minYear: q.minYear || null,
      maxYear: q.maxYear || null,
      options: Array.isArray(q.options) ? q.options.map(o => o.value) : null,
      units: q.units || null,
      repeatable: !!q.repeatable,
      loopSource: !!q.loopSource,
      fields: Array.isArray(q.fields) ? q.fields.map(extractField) : null,
    };
  }

  const schema = {};
  for (const q of CARBONIQ_QUESTIONS) {
    schema[q.id] = extractQuestion(q);
  }

  process.stdout.write(JSON.stringify(schema, null, 2) + '\n');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
