// Finds Korean UI text that has no entry in locales/catalogs.json.
//   node scripts/check-i18n-coverage.cjs          report missing keys, exit 1 if any outside the pending list
//   node scripts/check-i18n-coverage.cjs --keys   print missing keys only (for building new TSV rows)
//
// What it checks:
//   * HTML pages: every text node and placeholder/aria-label/title/alt attribute.
//   * JS modules: every string literal with Hangul. Literals that contain markup are split into text nodes
//     and attributes, so the keys match what the DOM translator will look up at runtime.
//   * holidays-data.js: each distinct holiday name.
// Template literals with ${...} cannot be matched against a key; they are reported as "interpolated" and must
// go through t('... {name} ...', {name}) instead.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const {JSDOM} = require(path.join(root, 'node_modules/jsdom'));

// Pages whose text is legal wording. Machine translation is not acceptable there; they stay Korean until reviewed.
const PENDING_REVIEW = new Set(['privacy.html', 'terms.html', 'licenses.html']);
// Modules that never reach the screen or are covered elsewhere.
// firebase-environment.js only throws developer configuration errors, never user-facing text.
const SKIP_JS = new Set(['holidays-data.js', 'firebase-environment.js']);
const ATTRIBUTES = ['placeholder', 'aria-label', 'title', 'alt'];
const hangul = /[가-힣]/;
const normalize = text => String(text).replace(/\s+/g, ' ').trim();
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalogs.json'), 'utf8')).en;
const known = text => Object.hasOwn(catalog, normalize(text));

const missing = new Map();   // file -> Set(key)
const interpolated = new Map();
const add = (map, file, text) => {
  const key = normalize(text);
  if (!key || !hangul.test(key)) return;
  if (!map.has(file)) map.set(file, new Set());
  map.get(file).add(key);
};

function checkFragment(file, html, {holder = missing} = {}) {
  const doc = new JSDOM(`<body>${html}</body>`).window.document;
  const walker = doc.createTreeWalker(doc.body, 5);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === 3) {
      if (node.parentElement.closest('script,style,[data-i18n-ignore]')) continue;
      for (const part of node.nodeValue.split(/\u0000+/)) if (hangul.test(part) && !known(part)) add(holder, file, part);
    } else {
      if (node.closest('[data-i18n-ignore]')) continue;
      for (const name of ATTRIBUTES) {
        const value = node.getAttribute?.(name);
        for (const part of String(value || '').split(/\u0000+/)) if (hangul.test(part) && !known(part)) add(holder, file, part);
      }
    }
  }
}

for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
  checkFragment(file, fs.readFileSync(path.join(root, file), 'utf8').replace(/<head>[\s\S]*?<\/head>/, match => match.replace(/<script[\s\S]*?<\/script>/g, '')));
}

// Minimal JavaScript tokenizer: yields every string literal, including ones nested inside ${...} of template literals,
// and ignores comments and regular expression literals.
function scanJS(file, source) {
  let i = 0;
  const n = source.length;
  let previous = '';
  const regexStarts = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
  function handle(body, quote, start) {
    if (!hangul.test(body)) return;
    const text = body.replace(/\\n/g, ' ').replace(/\\(['"`$\\])/g, '$1');
    const asKey = /\b(?:t|tr)\($/.test(source.slice(Math.max(0, start - 4), start));
    const dynamic = text.includes('\u0000');
    if (asKey) {
      if (dynamic) add(interpolated, file, text.replace(/\u0000/g, '${…}'));
      else if (!known(text)) add(missing, file, text);
    } else if (/</.test(text)) {
      checkFragment(file, text);
    } else if (dynamic) {
      add(interpolated, file, text.replace(/\u0000/g, '${…}'));
    } else if (!known(text)) {
      add(missing, file, text);
    }
  }
  function readString(quote) {
    let body = '';
    while (i < n) {
      const c = source[i];
      if (c === '\\') { body += c + (source[i + 1] ?? ''); i += 2; continue; }
      if (c === quote) { i++; return body; }
      if (quote === '`' && c === '$' && source[i + 1] === '{') { i += 2; scan(true); body += '\u0000'; continue; }
      body += c; i++;
    }
    return body;
  }
  function scan(inExpression) {
    let depth = 0;
    while (i < n) {
      const c = source[i], next = source[i + 1];
      if (c === '/' && next === '/') { while (i < n && source[i] !== '\n') i++; continue; }
      if (c === '/' && next === '*') { const end = source.indexOf('*/', i + 2); i = end < 0 ? n : end + 2; continue; }
      if (c === "'" || c === '"' || c === '`') { const start = i; i++; handle(readString(c), c, start); previous = c; continue; }
      if (c === '/' && regexStarts.has(previous)) {
        i++; let inClass = false;
        while (i < n && (inClass || source[i] !== '/')) { if (source[i] === '\\') i++; else if (source[i] === '[') inClass = true; else if (source[i] === ']') inClass = false; i++; }
        i++; previous = '/'; continue;
      }
      if (c === '{') depth++;
      if (c === '}') { if (depth === 0 && inExpression) { i++; return; } if (depth > 0) depth--; }
      if (!/\s/.test(c)) previous = c;
      i++;
    }
  }
  scan(false);
}

for (const file of fs.readdirSync(root).filter(name => name.endsWith('.js') && !name.startsWith('i18n') && !SKIP_JS.has(name))) {
  scanJS(file, fs.readFileSync(path.join(root, file), 'utf8'));
}

const holidays = fs.readFileSync(path.join(root, 'holidays-data.js'), 'utf8');
for (const [, value] of holidays.matchAll(/": "([^"]+)"/g)) {
  for (const part of value.split(' · ')) {
    const name = part.replace(/ \(대체공휴일\)$/, '');
    if (!known(name)) add(missing, 'holidays-data.js', name);
  }
}
if (!known('{name} (대체공휴일)')) add(missing, 'holidays-data.js', '{name} (대체공휴일)');

if (process.argv.includes('--keys')) {
  const keys = new Set();
  for (const [file, set] of missing) if (!PENDING_REVIEW.has(file)) for (const key of set) keys.add(key);
  console.log([...keys].join('\n'));
  process.exit(0);
}

let blocking = 0;
for (const [title, map] of [['MISSING', missing], ['INTERPOLATED (use t() with named parameters)', interpolated]]) {
  for (const [file, set] of [...map].sort()) {
    const pending = PENDING_REVIEW.has(file);
    console.log(`\n[${title}] ${file}${pending ? '  (legal text, pending human review)' : ''}: ${set.size}`);
    for (const key of set) console.log(`  - ${key.slice(0, 120)}`);
    if (!pending) blocking += set.size;
  }
}
const pendingTotal = [...missing].filter(([file]) => PENDING_REVIEW.has(file)).reduce((sum, [, set]) => sum + set.size, 0);
console.log(`\nUntranslated outside pending review: ${blocking}; pending legal review: ${pendingTotal}`);
process.exit(blocking ? 1 : 0);
