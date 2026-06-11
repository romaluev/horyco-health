#!/usr/bin/env node
/**
 * Аудит тенантной изоляции репозиториев.
 * Сканирует src/**\/*.repository.ts и для каждого публичного метода класса-репозитория
 * проверяет, что первый параметр — businessId. Исключения — см. ниже.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// ─────────────── конфигурация исключений ───────────────

/** Файлы, полностью освобождённые от аудита (бизнес-агностичные репозитории). */
const EXEMPT_FILES = new Set([
  'clients.repository.ts',
  'businesses.repository.ts',
  'business-members.repository.ts',
  'business-customers.repository.ts',
]);

/**
 * Методы, освобождённые везде: data-carry (businessId передаётся в объекте данных)
 * или соединение через order.
 */
const EXEMPT_METHODS_GLOBAL = new Set([
  'create',
  'save',
  'saveItems',
  'getItems',
  'createOrder', // данные несут businessId (аналог create)
]);

/** Исключения для конкретного файла: { filename → Set<methodName> } */
const EXEMPT_FILE_METHODS = {
  'balance.repository.ts': new Set(['findByIdempotencyKey', 'create']),
  'offers.repository.ts': new Set(['findSendingOffers', 'expireRecipientsPastTtl']),
};

/**
 * void-businessId аудит: методы, которые ДЕКЛАРИРУЮТ параметр businessId, но не используют его
 * в теле (анти-паттерн `void businessId;`). Записи здесь — временные изъятия для репозиториев,
 * до-тенантизация которых ведётся в других модулях/батчах. Удаляются, как только метод начнёт
 * реально скоупиться по businessId. { filename → Set<methodName> }
 */
const EXEMPT_UNUSED_BUSINESSID = {
  'combos.repository.ts': new Set(['saveSlot', 'saveOption', 'getComboGroupIds', 'setComboGroups']),
  'modifiers.repository.ts': new Set([
    'findModifiersByGroup',
    'findModifierById',
    'saveModifier',
    'deleteModifier',
    'getMenuItemGroupIds',
    'setMenuItemGroups',
    'getComboGroupIds',
  ]),
  'offers.repository.ts': new Set(['saveRecipients', 'clearRecipients', 'countRecipientsByStatus']),
};

// ─────────────── обход файлов ───────────────

const SRC_DIR = new URL('../src', import.meta.url).pathname;

function walk(dir) {
  const result = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      result.push(...walk(full));
    } else if (entry.endsWith('.repository.ts') && !entry.endsWith('.test.ts')) {
      result.push(full);
    }
  }
  return result;
}

// ─────────────── парсинг методов ───────────────

/**
 * Читает файл и возвращает [{name, sig, body, line}] для каждого
 * публичного метода класса (не static, не private, не protected, не constructor).
 * Поддерживает многострочные сигнатуры — читает до закрывающей ')'.
 * body — текст тела метода (от строки после сигнатуры до закрывающей '  }' на уровне класса);
 * используется для проверки фактического использования businessId.
 */
function extractMethods(src) {
  const lines = src.split('\n');
  const methods = [];
  // Сигнатура метода (с возможным async): начинается с ≥2 пробелов, не private/protected/static,
  // содержит '(' — класс-методы (не стрелки, не деструктуризации).
  const METHOD_RE = /^  (?:async )?([a-zA-Z][a-zA-Z0-9]*)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const m = METHOD_RE.exec(lines[i]);
    if (!m) continue;
    const name = m[1];
    if (name === 'constructor') continue;

    // Соберём сигнатуру до первой ')' на уровне глубины 0; запомним строку её окончания.
    let sig = '';
    let depth = 0;
    let done = false;
    let sigEndLine = i;
    for (let j = i; j < lines.length && !done; j++) {
      for (const ch of lines[j]) {
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) { done = true; break; }
        }
        sig += ch;
      }
      sigEndLine = j;
      if (!done) sig += '\n';
    }

    // Тело: от строки ПОСЛЕ сигнатуры до закрывающей скобки метода (ровно 2 пробела + '}').
    // Метод класса закрывается на отступе класса; вложенные блоки — глубже (≥4 пробелов).
    let bodyEndLine = sigEndLine;
    for (let j = sigEndLine + 1; j < lines.length; j++) {
      bodyEndLine = j;
      if (/^ {2}\}/.test(lines[j])) break;
    }
    const body = lines.slice(sigEndLine + 1, bodyEndLine).join('\n');

    methods.push({ name, sig, body, line: i + 1 });
  }
  return methods;
}

/** Сигнатура объявляет параметр с именем businessId? */
function declaresBusinessId(sig) {
  const start = sig.indexOf('(');
  if (start === -1) return false;
  return /\bbusinessId\b/.test(sig.slice(start + 1));
}

/**
 * Тело реально использует businessId? `void businessId;` (подавление линтера) НЕ считается
 * использованием — это и есть анти-паттерн, который мы ловим.
 */
function bodyUsesBusinessId(body) {
  const withoutVoid = body.replace(/void\s+businessId\s*;?/g, '');
  return /\bbusinessId\b/.test(withoutVoid);
}

/**
 * Проверяет, содержит ли параметрическая часть 'businessId' как первый параметр.
 * Параметрическая часть — всё после первой '(' в sig.
 */
function hasBusinessIdFirst(sig) {
  const start = sig.indexOf('(');
  if (start === -1) return false;
  const params = sig.slice(start + 1).trimStart();
  // Пустой список параметров.
  if (params.startsWith(')')) return false;
  // Первый параметр — до первого ',', ')', ':', пробела.
  const first = params.split(/[\s,:)]/)[0];
  return first === 'businessId';
}

// ─────────────── основной цикл ───────────────

const files = walk(SRC_DIR);
const violations = [];
let checkedCount = 0;

for (const absPath of files) {
  const fileName = absPath.split('/').pop();
  const relPath = relative(process.cwd(), absPath);

  if (EXEMPT_FILES.has(fileName)) continue;

  const src = readFileSync(absPath, 'utf8');
  const methods = extractMethods(src);
  const fileExempt = EXEMPT_FILE_METHODS[fileName] ?? new Set();
  const voidExempt = EXEMPT_UNUSED_BUSINESSID[fileName] ?? new Set();

  for (const { name, sig, body, line } of methods) {
    // Проверка №2: объявлен businessId, но тело его не использует (void businessId).
    if (declaresBusinessId(sig) && !bodyUsesBusinessId(body) && !voidExempt.has(name)) {
      violations.push(
        `${relPath}:${line}  → метод '${name}' — объявляет businessId, но не использует его (void businessId)`,
      );
    }

    // Проверка №1: businessId — первый параметр (тенантная сигнатура).
    if (EXEMPT_METHODS_GLOBAL.has(name)) continue;
    if (fileExempt.has(name)) continue;

    checkedCount++;
    if (!hasBusinessIdFirst(sig)) {
      violations.push(`${relPath}:${line}  → метод '${name}' — нет businessId первым параметром`);
    }
  }
}

if (violations.length > 0) {
  console.error('tenancy-audit: НАРУШЕНИЯ\n');
  for (const v of violations) console.error('  ' + v);
  console.error(`\nВсего нарушений: ${violations.length}`);
  process.exit(1);
} else {
  console.log(`tenancy-audit: OK (${checkedCount} методов проверено)`);
}
