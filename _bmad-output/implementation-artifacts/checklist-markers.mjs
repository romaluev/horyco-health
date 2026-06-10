/**
 * Переключатель цветовых маркеров в чек-листе приёмки.
 *
 *   node checklist-markers.mjs apply   # 🟢 для [x], 🔴 для [ ] (пересинхрон по текущему состоянию)
 *   node checklist-markers.mjs clear   # убрать все маркеры
 *   node checklist-markers.mjs         # = apply
 *
 * Работает идемпотентно: сперва снимает существующий маркер у пункта, потом ставит нужный,
 * поэтому после ручной отметки [ ]→[x] достаточно прогнать `apply` — 🔴 сменится на 🟢.
 */
import fs from 'fs';

const FILE = new URL('./refactor-parity-checklist.md', import.meta.url);
const mode = (process.argv[2] || 'apply').toLowerCase();
if (!['apply', 'clear'].includes(mode)) {
  console.error('Режим: apply | clear');
  process.exit(1);
}

let done = 0;
let todo = 0;

const lines = fs.readFileSync(FILE, 'utf8').split('\n').map((line) => {
  const m = line.match(/^(\s*-\s*\[([ xX])\]\s)/);
  if (!m) return line;
  // Снять текущий маркер (если есть)
  let stripped = line.replace(/^(\s*-\s*\[[ xX]\]\s)(?:🟢|🔴|🟡)\s/, '$1');
  if (mode === 'clear') return stripped;
  const checked = m[2].toLowerCase() === 'x';
  if (checked) done++; else todo++;
  return stripped.replace(/^(\s*-\s*\[[ xX]\]\s)/, `$1${checked ? '🟢' : '🔴'} `);
});

fs.writeFileSync(FILE, lines.join('\n'));
console.log(mode === 'clear' ? 'Маркеры убраны.' : `Готово: 🟢 ${done} / 🔴 ${todo}`);
