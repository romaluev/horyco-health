#!/usr/bin/env node
/**
 * Parse Eat&fit технологические карты from a .docx into seed/eatfit-menu/menu.json + photos/.
 *
 * Usage:
 *   node apps/api/scripts/parse-menu-docx.mjs [path/to/menu.docx]
 *
 * Default docx: ~/Downloads/menu.docx
 */

import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(__dirname, 'seed', 'eatfit-menu');
const PHOTOS_DIR = join(SEED_DIR, 'photos');

const PHOTO_SLUGS = [
  '01-bbq-kuritsa',
  '02-kuritsa-karri',
  '03-govyazhy-farsh-pesto',
  '04-lazanya-govyadina',
  '05-spagetti-tomatnyj',
  '06-kuritsa-shampinony',
  '07-tajskaya-kuritsa',
  '08-govyadina-teriyaki',
];

const DEFAULT_DOCX = join(homedir(), 'Downloads', 'menu.docx');
const PLACEHOLDER_PRICE = 50000;
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

function extractText(docxPath) {
  if (process.platform === 'darwin') {
    try {
      return execFileSync('textutil', ['-convert', 'txt', '-stdout', docxPath], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      // fall through
    }
  }
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('word/document.xml not found in docx');
  const xml = entry.getData().toString('utf8');
  return xml
    .replace(/<w:tab[^/]*\/>/g, '\t')
    .replace(/<w:br[^/]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function parseNutrition(lines) {
  const keys = {
    Калории: 'calories',
    Белки: 'protein',
    Углеводы: 'carbs',
    Жиры: 'fat',
  };
  const nutrition = { calories: null, protein: null, fat: null, carbs: null };
  for (let i = 0; i < lines.length; i++) {
    const key = keys[lines[i]];
    if (key && i + 1 < lines.length) {
      const m = lines[i + 1].match(/([\d.]+)/);
      if (m) nutrition[key] = parseFloat(m[1]);
    }
  }
  return nutrition;
}

function parseIngredients(lines) {
  const ingredients = [];
  let inSection = false;
  let i = 0;
  while (i < lines.length) {
    if (lines[i].includes('1. СОСТАВ И ГРАММОВКА')) {
      inSection = true;
      i++;
      continue;
    }
    if (inSection && lines[i].startsWith('2. ТЕХНОЛОГИЧЕСКИЙ')) break;
    if (!inSection) {
      i++;
      continue;
    }
    const l = lines[i];
    if (
      ['Ингредиент', 'На порцию', 'На 100 г', 'ОСНОВА', 'СПЕЦИИ И ДОБАВКИ'].includes(l) ||
      l.endsWith('СЕЙТАН') ||
      l.endsWith('СОУС') ||
      l.endsWith('КАРРИ') ||
      l.includes('по вкусу') ||
      l === '—'
    ) {
      i++;
      continue;
    }
    if (i + 1 < lines.length) {
      const g = lines[i + 1];
      const gm = g.match(/^~?([\d.]+)\s*г/);
      const ml = g.match(/^~?([\d.]+)\s*мл/);
      if ((gm || ml) && !/^~?[\d.]+/.test(l)) {
        const grams = gm ? parseFloat(gm[1]) : parseFloat(ml[1]);
        ingredients.push({ nameRu: l, nameUz: l, grams });
        i += 2;
        continue;
      }
    }
    i++;
  }
  return ingredients;
}

function parseAllergens(lines) {
  let containsRu = null;
  let mayContainRu = null;
  for (const l of lines) {
    if (l.startsWith('Содержит:')) {
      const val = l.replace('Содержит:', '').trim().replace(/\.$/, '');
      if (val && val.toLowerCase() !== 'нет') containsRu = val;
    }
    if (l.startsWith('Может содержать')) {
      mayContainRu = l
        .replace('Может содержать следы:', '')
        .replace('Может содержать:', '')
        .trim()
        .replace(/\.$/, '');
    }
  }
  return {
    containsRu,
    containsUz: containsRu,
    mayContainRu,
    mayContainUz: mayContainRu,
  };
}

function parseDishes(text) {
  const parts = text.split(/\nТЕХНОЛОГИЧЕСКАЯ КАРТА\n/);
  if (parts[0].startsWith('ТЕХНОЛОГИЧЕСКАЯ КАРТА')) {
    parts[0] = parts[0].replace(/^ТЕХНОЛОГИЧЕСКАЯ КАРТА\n/, '');
  }

  const dishes = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    const nameRu = lines[0];

    let weightGrams = null;
    for (const l of lines.slice(0, 6)) {
      const m = l.match(/Выход:\s*(\d+)\s*г/);
      if (m) weightGrams = parseInt(m[1], 10);
    }

    let descriptionRu = '';
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === 'Краткое описание' && lines[i + 1]) {
        descriptionRu = lines[i + 1];
        break;
      }
    }

    dishes.push({
      category: 'main',
      nameRu,
      nameUz: nameRu,
      descriptionRu,
      descriptionUz: descriptionRu,
      price: PLACEHOLDER_PRICE,
      isActive: true,
      days: ALL_DAYS,
      weightGrams,
      price2: null,
      weightGrams2: null,
      orderDeadline: null,
      nutrition: parseNutrition(lines),
      nutrition2: null,
      ingredients: parseIngredients(lines),
      allergens: parseAllergens(lines),
    });
  }
  return dishes;
}

function extractPhotos(docxPath) {
  const zip = new AdmZip(docxPath);
  const media = zip
    .getEntries()
    .filter((e) => e.entryName.startsWith('word/media/image') && !e.isDirectory)
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));

  if (media.length < PHOTO_SLUGS.length) {
    throw new Error(`Expected ${PHOTO_SLUGS.length} images, found ${media.length}`);
  }

  mkdirSync(PHOTOS_DIR, { recursive: true });
  const photoFiles = [];
  for (let i = 0; i < PHOTO_SLUGS.length; i++) {
    const ext = media[i].entryName.split('.').pop() || 'jpg';
    const filename = `${PHOTO_SLUGS[i]}.${ext}`;
    writeFileSync(join(PHOTOS_DIR, filename), media[i].getData());
    photoFiles.push(filename);
  }
  return photoFiles;
}

function main() {
  const docxPath = resolve(process.argv[2] ?? DEFAULT_DOCX);
  if (!existsSync(docxPath)) {
    console.error(`Docx not found: ${docxPath}`);
    process.exit(1);
  }

  console.log(`Parsing ${docxPath}…`);
  const text = extractText(docxPath);
  const dishes = parseDishes(text);
  if (dishes.length !== PHOTO_SLUGS.length) {
    throw new Error(`Expected ${PHOTO_SLUGS.length} dishes, parsed ${dishes.length}`);
  }

  const photoFiles = extractPhotos(docxPath);
  for (let i = 0; i < dishes.length; i++) {
    dishes[i].photoFile = photoFiles[i];
  }

  mkdirSync(SEED_DIR, { recursive: true });
  const outPath = join(SEED_DIR, 'menu.json');
  writeFileSync(outPath, JSON.stringify({ businessId: 'c12704d8-0e0d-4226-94b9-e84d43cb76dc', items: dishes }, null, 2));

  console.log(`Wrote ${dishes.length} dishes → ${outPath}`);
  console.log(`Photos → ${PHOTOS_DIR}/`);
  for (const d of dishes) {
    console.log(`  • ${d.nameRu} (${d.ingredients.length} ingredients, ${d.photoFile})`);
  }
}

main();
