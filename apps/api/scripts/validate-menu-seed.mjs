#!/usr/bin/env node
/**
 * Validate menu.json + DB parity and field completeness.
 *
 * Usage:
 *   node apps/api/scripts/validate-menu-seed.mjs
 *   node apps/api/scripts/validate-menu-seed.mjs --json-only
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const MENU_JSON = join(__dirname, 'seed', 'eatfit-menu', 'menu.json');
const PHOTOS_DIR = join(__dirname, 'seed', 'eatfit-menu', 'photos');
const BUSINESS_ID = 'c12704d8-0e0d-4226-94b9-e84d43cb76dc';

const jsonOnly = process.argv.includes('--json-only');
loadEnv({ path: join(REPO_ROOT, '.env') });

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function warn(msg) {
  console.warn(`WARN: ${msg}`);
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

function auditSeedItem(item) {
  const issues = [];
  if (!item.nameRu?.trim()) issues.push('empty nameRu');
  if (!item.photoFile) issues.push('no photoFile');
  else if (!existsSync(join(PHOTOS_DIR, item.photoFile))) issues.push(`photo missing: ${item.photoFile}`);
  if (!item.descriptionRu?.trim()) issues.push('no description');
  if (!item.weightGrams || item.weightGrams <= 0) issues.push('no weightGrams');
  if (!item.nutrition || item.nutrition.calories == null) issues.push('no summary nutrition');
  if (!item.nutritionDetail) issues.push('no nutritionDetail');
  if (item.nutritionDetail) {
    for (const side of ['perPortion', 'per100g']) {
      const block = item.nutritionDetail[side];
      if (!block) issues.push(`nutritionDetail.${side} missing`);
      else {
        for (const k of ['calories', 'protein', 'fat', 'carbs']) {
          if (block[k] == null) issues.push(`nutritionDetail.${side}.${k} null`);
        }
      }
    }
  }
  if (!item.storageHandling?.storageRu?.trim()) issues.push('no storage');
  if (!item.storageHandling?.reheatRu?.trim()) issues.push('no reheat');
  if (!item.allergens?.containsRu && !item.allergens?.mayContainRu) issues.push('no allergens');
  if (!item.ingredients?.length || item.ingredients.length < 3) issues.push(`ingredients=${item.ingredients?.length ?? 0}`);
  if (!item.instructions?.length || item.instructions.length < 2) issues.push(`instructions=${item.instructions?.length ?? 0}`);
  for (const step of item.instructions ?? []) {
    if (!step.textRu?.trim() || step.textRu.trim().length < 8) issues.push('short instruction step');
  }
  if (!item.price || item.price <= 0) issues.push('no price');
  if (!item.days?.length) issues.push('no days');
  return issues;
}

async function main() {
  if (!existsSync(MENU_JSON)) {
    fail(`menu.json not found: ${MENU_JSON}`);
    return;
  }

  const seed = JSON.parse(readFileSync(MENU_JSON, 'utf8'));
  const items = seed.items ?? [];
  if (items.length !== 36) {
    warn(`expected 36 dishes, got ${items.length}`);
  }

  const jsonIssues = [];
  const names = new Set();
  for (const item of items) {
    if (names.has(item.nameRu)) jsonIssues.push({ name: item.nameRu, issues: ['duplicate name'] });
    names.add(item.nameRu);
    const issues = auditSeedItem(item);
    if (issues.length) jsonIssues.push({ name: item.nameRu, issues });
  }

  if (jsonIssues.length) {
    fail(`${jsonIssues.length} menu.json issue(s)`);
    for (const row of jsonIssues) console.error(`  ${row.name}: ${row.issues.join(', ')}`);
  } else {
    ok(`menu.json — ${items.length} items, all fields present, photos on disk`);
  }

  const photoHashes = new Map();
  for (const item of items) {
    if (!item.photoFile) continue;
    const buf = readFileSync(join(PHOTOS_DIR, item.photoFile));
    const hash = buf.length + ':' + buf.slice(0, 32).toString('hex');
    if (!photoHashes.has(hash)) photoHashes.set(hash, []);
    photoHashes.get(hash).push(item.nameRu);
  }
  const dupPhotos = [...photoHashes.values()].filter((names) => names.length > 1);
  if (dupPhotos.length) {
    fail(`${dupPhotos.length} duplicate photo(s) across dishes`);
    for (const names of dupPhotos) console.error(`  same photo: ${names.join(' | ')}`);
  } else {
    ok('photos — unique per dish');
  }

  if (jsonOnly) return;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    fail('DATABASE_URL missing');
    return;
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const dbItems = await client.query(
      `SELECT name_ru, weight_grams, price, photo_mime IS NOT NULL AS has_photo,
              description_ru, ingredients, instructions, nutrition, nutrition_detail,
              storage_handling, allergens, days
       FROM menu_items
       WHERE business_id = $1 AND deleted_at IS NULL
       ORDER BY name_ru`,
      [BUSINESS_ID],
    );

    const dbNames = new Set(dbItems.rows.map((r) => r.name_ru));
    const seedNames = new Set(items.map((i) => i.nameRu));

    const onlySeed = [...seedNames].filter((n) => !dbNames.has(n));
    const onlyDb = [...dbNames].filter((n) => !seedNames.has(n));
    if (onlySeed.length) fail(`in seed but not DB: ${onlySeed.join('; ')}`);
    if (onlyDb.length) fail(`in DB but not seed: ${onlyDb.join('; ')}`);
    if (!onlySeed.length && !onlyDb.length) ok(`DB ↔ seed name parity (${dbItems.rows.length} items)`);

    const dbIssues = [];
    for (const item of items) {
      const row = dbItems.rows.find((r) => r.name_ru === item.nameRu);
      if (!row) continue;
      const issues = [];
      if (!row.has_photo) issues.push('no photo in DB');
      if (!row.description_ru) issues.push('no description in DB');
      if (!row.weight_grams) issues.push('no weight in DB');
      if (!row.nutrition) issues.push('no nutrition in DB');
      if (!row.nutrition_detail) issues.push('no nutrition_detail in DB');
      if (!row.storage_handling) issues.push('no storage_handling in DB');
      if (!row.allergens) issues.push('no allergens in DB');
      const ingN = row.ingredients?.length ?? 0;
      const instN = row.instructions?.length ?? 0;
      if (ingN < 3) issues.push(`ingredients=${ingN}`);
      if (instN < 2) issues.push(`instructions=${instN}`);
      if (!row.days?.length) issues.push('days empty');
      if (issues.length) dbIssues.push({ name: item.nameRu, issues });
    }

    if (dbIssues.length) {
      fail(`${dbIssues.length} DB row issue(s)`);
      for (const row of dbIssues) console.error(`  ${row.name}: ${row.issues.join(', ')}`);
    } else {
      ok('DB rows — all seeded fields present');
    }

    const [{ n: modGroups }] = (
      await client.query(`SELECT count(*)::int AS n FROM modifier_groups WHERE business_id = $1`, [BUSINESS_ID])
    ).rows;
    const [{ n: modifiers }] = (await client.query(`SELECT count(*)::int AS n FROM modifiers`)).rows;
    const [{ n: links }] = (await client.query(`SELECT count(*)::int AS n FROM menu_item_modifier_groups`)).rows;
    const [{ n: combos }] = (
      await client.query(`SELECT count(*)::int AS n FROM combos WHERE business_id = $1`, [BUSINESS_ID])
    ).rows;

    console.log(`INFO: modifier_groups=${modGroups}, modifiers=${modifiers}, menu_item_links=${links}, combos=${combos}`);
    if (links > 0) {
      const linked = await client.query(
        `SELECT mi.name_ru, mg.name_ru AS group_name
         FROM menu_item_modifier_groups mig
         JOIN menu_items mi ON mi.id = mig.menu_item_id
         JOIN modifier_groups mg ON mg.id = mig.modifier_group_id
         WHERE mi.business_id = $1 AND mi.deleted_at IS NULL
         ORDER BY mi.name_ru`,
        [BUSINESS_ID],
      );
      for (const r of linked.rows) console.log(`  linked: ${r.name_ru} → ${r.group_name}`);
    } else {
      ok('no modifier groups linked to menu items (PDF seed does not attach modifiers)');
    }
  } finally {
    await client.end();
  }

  if (!process.exitCode) ok('validation passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
