#!/usr/bin/env node
/**
 * Parse EATFIT tech-card PDF into seed/eatfit-menu/menu.json + photos/.
 *
 * Usage:
 *   node apps/api/scripts/parse-menu-pdf.mjs [path/to/file.pdf]
 *
 * Default PDF: ~/Downloads/EATFIT_all_techcards_combined_full_nutrients.pdf
 *
 * Requires: pip3 install pypdf Pillow
 */

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const SEED_DIR = join(__dirname, 'seed', 'eatfit-menu');
const PY_SCRIPT = join(__dirname, 'lib', 'parse_menu_pdf.py');

const DEFAULT_PDF = join(
  homedir(),
  'Downloads',
  'EATFIT_all_techcards_combined_full_nutrients.pdf',
);

loadEnv({ path: join(REPO_ROOT, '.env') });

const pdfPath = resolve(process.argv[2] ?? DEFAULT_PDF);

if (!existsSync(pdfPath)) {
  console.error(`PDF not found: ${pdfPath}`);
  process.exit(1);
}

if (!existsSync(PY_SCRIPT)) {
  console.error(`Parser script missing: ${PY_SCRIPT}`);
  process.exit(1);
}

const price = process.env.MENU_SEED_PRICE;
const env = price ? { ...process.env, MENU_SEED_PRICE: price } : process.env;

try {
  execFileSync('python3', [PY_SCRIPT, pdfPath, SEED_DIR], {
    stdio: 'inherit',
    env,
  });
} catch (err) {
  console.error('\nParser failed. Install deps: pip3 install pypdf Pillow pymupdf');
  process.exit(1);
}
