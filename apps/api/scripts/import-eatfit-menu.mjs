#!/usr/bin/env node
/**
 * Import Eat&fit menu seed into Postgres (idempotent).
 *
 * Usage (from repo root):
 *   npm run menu:import
 *   npm run menu:import -- --dry-run
 *   npm run menu:import -- --force
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const SEED_DIR = join(__dirname, 'seed', 'eatfit-menu');
const MENU_JSON = join(SEED_DIR, 'menu.json');
const PHOTOS_DIR = join(SEED_DIR, 'photos');

const BUSINESS_ID = 'c12704d8-0e0d-4226-94b9-e84d43cb76dc';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');

loadEnv({ path: join(REPO_ROOT, '.env') });

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
  return val;
}

function jsonOrNull(obj) {
  if (!obj) return null;
  const allNull =
    typeof obj === 'object' &&
    Object.values(obj).every((v) => v == null || v === '');
  if (allNull) return null;
  return JSON.stringify(obj);
}

async function main() {
  if (!existsSync(MENU_JSON)) {
    console.error(`Seed not found: ${MENU_JSON}\nRun: node apps/api/scripts/parse-menu-docx.mjs`);
    process.exit(1);
  }

  const seed = JSON.parse(readFileSync(MENU_JSON, 'utf8'));
  const items = seed.items ?? seed;
  const businessId = seed.businessId ?? BUSINESS_ID;

  const client = new Client({ connectionString: requireEnv('DATABASE_URL') });
  await client.connect();

  try {
    const biz = await client.query('SELECT id, slug, name FROM businesses WHERE id = $1', [businessId]);
    if (!biz.rows.length) {
      throw new Error(`Business ${businessId} not found`);
    }
    console.log(`Importing ${items.length} dishes → ${biz.rows[0].name} (${biz.rows[0].slug})`);
    if (dryRun) console.log('(dry-run — no writes)');

    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const existing = await client.query(
        `SELECT id, deleted_at FROM menu_items WHERE business_id = $1 AND name_ru = $2`,
        [businessId, item.nameRu],
      );

      if (existing.rows.length && !force) {
        const row = existing.rows[0];
        if (!row.deleted_at) {
          console.log(`  skip: ${item.nameRu} (already exists)`);
          skipped++;
          continue;
        }
      }

      let photoData = null;
      let photoMime = null;
      if (item.photoFile) {
        const photoPath = join(PHOTOS_DIR, item.photoFile);
        if (!existsSync(photoPath)) {
          throw new Error(`Photo missing: ${photoPath}`);
        }
        photoData = readFileSync(photoPath);
        const ext = item.photoFile.split('.').pop()?.toLowerCase();
        photoMime =
          ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      }

      if (dryRun) {
        console.log(`  would insert: ${item.nameRu} (photo: ${photoData ? photoMime : 'none'})`);
        inserted++;
        continue;
      }

      if (existing.rows.length && force) {
        await client.query(
          `UPDATE menu_items SET deleted_at = NOW() WHERE business_id = $1 AND name_ru = $2 AND deleted_at IS NULL`,
          [businessId, item.nameRu],
        );
      }

      await client.query(
        `INSERT INTO menu_items (
          business_id, category, name_ru, name_uz, description_ru, description_uz,
          price, photo_file_id, photo_url, photo_data, photo_mime,
          weight_grams, price2, weight_grams2, order_deadline,
          ingredients, allergens, nutrition, nutrition2,
          is_active, days
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, NULL, NULL, $8, $9,
          $10, $11, $12, $13,
          $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb,
          $18, $19
        )`,
        [
          businessId,
          item.category,
          item.nameRu,
          item.nameUz,
          item.descriptionRu || null,
          item.descriptionUz || null,
          item.price,
          photoData,
          photoMime,
          item.weightGrams ?? null,
          item.price2 ?? null,
          item.weightGrams2 ?? null,
          item.orderDeadline ?? null,
          jsonOrNull(item.ingredients),
          jsonOrNull(item.allergens),
          jsonOrNull(item.nutrition),
          jsonOrNull(item.nutrition2),
          item.isActive ?? true,
          item.days ?? [],
        ],
      );

      console.log(`  inserted: ${item.nameRu}`);
      inserted++;
    }

    console.log(`\nDone: ${inserted} inserted, ${skipped} skipped`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
