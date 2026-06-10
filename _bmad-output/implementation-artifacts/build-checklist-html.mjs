/**
 * Генерит интерактивный HTML-чек-лист из refactor-parity-checklist.md.
 *   node build-checklist-html.mjs
 * Открой refactor-parity-checklist.html в браузере: клик по пункту переключает 🔴↔🟢,
 * прогресс считается, состояние сохраняется в localStorage.
 */
import fs from 'fs';

const MD = new URL('./refactor-parity-checklist.md', import.meta.url);
const OUT = new URL('./refactor-parity-checklist.html', import.meta.url);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/_([^_]+)_/g, '<i>$1</i>');

const blocks = [];
let section = null;
for (const raw of fs.readFileSync(MD, 'utf8').split('\n')) {
  const h = raw.match(/^##\s+(.*)$/);
  if (h) {
    section = { title: h[1].trim(), items: [] };
    blocks.push(section);
    continue;
  }
  const it = raw.match(/^\s*-\s*\[([ xX])\]\s+(.*)$/);
  if (it && section) {
    const text = it[2].replace(/^(?:🟢|🔴|🟡)\s+/, '').trim();
    section.items.push({ done: it[1].toLowerCase() === 'x', html: inline(text) });
  }
}

const total = blocks.reduce((a, s) => a + s.items.length, 0);
const DATA = JSON.stringify(blocks);

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Чек-лист приёмки рефактора Eat&amp;fit</title>
<style>
  :root{--bg:#0f1115;--card:#1a1d23;--text:#e8e8ea;--hint:#9aa0a8;--line:#2a2e36;--green:#2ecc71}
  @media(prefers-color-scheme:light){:root{--bg:#f4f5f7;--card:#fff;--text:#1a1a1a;--hint:#6b7280;--line:#e5e7eb}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font:16px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}
  .wrap{max-width:860px;margin:0 auto;padding:20px 16px 80px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:var(--hint);font-size:13px;margin-bottom:16px}
  .bar{position:sticky;top:0;background:var(--bg);padding:10px 0;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;z-index:5}
  .track{flex:1;height:10px;background:var(--line);border-radius:6px;overflow:hidden}
  .fill{height:100%;background:var(--green);width:0;transition:width .25s}
  .count{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
  button{font:inherit;cursor:pointer;border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:8px;padding:6px 10px}
  h2{font-size:15px;color:var(--hint);text-transform:uppercase;letter-spacing:.04em;margin:22px 0 8px}
  .item{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:var(--card);border:1px solid var(--line);border-radius:10px;margin-bottom:8px;cursor:pointer;user-select:none}
  .item:hover{border-color:var(--hint)}
  .dot{font-size:15px;line-height:1.4;flex-shrink:0}
  .item.done .txt{color:var(--hint)}
  .txt{flex:1}
  code{background:rgba(127,127,127,.18);padding:1px 5px;border-radius:5px;font-size:13px}
</style></head><body><div class="wrap">
  <h1>Чек-лист приёмки рефактора Eat&amp;fit</h1>
  <div class="sub">Клик по пункту — переключает 🔴↔🟢. Прогресс сохраняется в этом браузере.</div>
  <div class="bar"><div class="track"><div class="fill" id="fill"></div></div>
    <span class="count" id="count">0 / 0</span>
    <button id="reset">Сбросить</button></div>
  <div id="list"></div>
</div><script>
const DATA = ${DATA};
const TOTAL = ${total};
const KEY = 'eatfit-checklist-v1';
const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
const list = document.getElementById('list');
DATA.forEach((sec, si) => {
  const h = document.createElement('h2'); h.textContent = sec.title; list.appendChild(h);
  sec.items.forEach((it, ii) => {
    const key = si + '#' + ii;
    const done = key in saved ? saved[key] : it.done;
    const row = document.createElement('div');
    row.className = 'item' + (done ? ' done' : '');
    row.dataset.key = key;
    row.innerHTML = '<span class="dot">' + (done ? '🟢' : '🔴') + '</span><span class="txt">' + it.html + '</span>';
    row.addEventListener('click', () => toggle(row));
    list.appendChild(row);
  });
});
function render(){
  let d = 0; document.querySelectorAll('.item.done').forEach(() => d++);
  document.getElementById('count').textContent = d + ' / ' + TOTAL;
  document.getElementById('fill').style.width = (TOTAL ? d/TOTAL*100 : 0) + '%';
}
function toggle(row){
  const on = !row.classList.contains('done');
  row.classList.toggle('done', on);
  row.querySelector('.dot').textContent = on ? '🟢' : '🔴';
  saved[row.dataset.key] = on;
  localStorage.setItem(KEY, JSON.stringify(saved));
  render();
}
document.getElementById('reset').addEventListener('click', () => { localStorage.removeItem(KEY); location.reload(); });
render();
</script></body></html>`;

fs.writeFileSync(OUT, html);
console.log('Создан refactor-parity-checklist.html (' + total + ' пунктов)');
