import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { strToU8, zipSync, zlibSync } from 'fflate';

import { FileProblem, markdownText, textFromFile } from '../src/lib/file-import.ts';
import { parseRecipeText } from '../src/lib/recipe-text.ts';

// The same recipe saved five ways (made with Chromium, LibreOffice, ReportLab and pandoc).
const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

const STEPS = [
  'Cook the spaghetti in plenty of salted boiling water until it is just tender, about ten minutes.',
  'Melt the butter in a pan and fry the garlic for a minute.',
  'Toss the pasta with the butter, lemon and parmesan, and serve straight away.',
];

for (const name of [
  'recipe-browser.pdf', // like a page printed from Notion, Google Docs or a browser
  'recipe-libreoffice.pdf', // like a PDF exported from Word
  'recipe-simple-fonts.pdf', // older PDFs with standard fonts
  'recipe.docx',
  'notion-export.zip',
]) {
  test(`reads the recipe from ${name}`, () => {
    const recipe = parseRecipeText(textFromFile({ name, bytes: fixture(name) }));
    assert.equal(recipe.title, 'Lemon Garlic Pasta');
    assert.equal(recipe.servings, 2);
    assert.equal(recipe.ingredients.length, 5);
    assert.match(recipe.ingredients[0], /200 g spaghetti/);
    assert.match(recipe.ingredients[4], /½ cup grated parmesan/);
    assert.deepEqual(
      recipe.steps.map((s) => s.replace(/^\d+\.\s*/, '')),
      STEPS,
    );
  });
}

test('finds the file type from its first bytes when the name has no extension', () => {
  const text = textFromFile({ name: 'download', bytes: fixture('recipe-browser.pdf') });
  assert.match(text, /Lemon Garlic Pasta/);
});

test('opens a Notion export zipped inside another zip', () => {
  const inner = zipSync({
    'Pancakes 9a8b.md': strToU8('# Pancakes\n\n## Ingredients\n\n- 2 eggs'),
  });
  const outer = zipSync({ 'Export-Part-1.zip': inner });
  assert.equal(
    textFromFile({ name: 'Export.zip', bytes: outer }),
    'Pancakes\n\nIngredients\n\n- 2 eggs',
  );
});

test('cleans Notion Markdown: headings, to-dos, links, bold and tables', () => {
  assert.equal(
    markdownText(
      [
        '# Soup',
        '- [ ] 1 **onion**',
        '- [x] [stock](https://example.com)',
        '![photo](soup.jpg)',
        '| Prep | 10 min |',
        '| --- | --- |',
        '> Tip: _don’t_ boil',
      ].join('\n'),
    ),
    ['Soup', '- 1 onion', '- stock', '', 'Prep 10 min', '', 'Tip: don’t boil'].join('\n'),
  );
});

test('reads HTML: lists become lines, entities are decoded, scripts are dropped', () => {
  const html =
    '<html><head><title>x</title></head><body><h1>Tea &amp; Toast</h1>' +
    '<script>var a = 1;</script><ul><li>1 slice\n bread</li><li>&frac12; tsp tea</li></ul></body></html>';
  assert.equal(
    textFromFile({ name: 'page.html', bytes: strToU8(html) }),
    'Tea & Toast\n\n- 1 slice bread\n- ½ tsp tea',
  );
});

test('reads UTF-16 text files', () => {
  const s = 'Crêpes\n2 eggs';
  const bytes = new Uint8Array(2 + s.length * 2);
  bytes.set([0xff, 0xfe]);
  for (let i = 0; i < s.length; i++) bytes[2 + i * 2] = s.charCodeAt(i);
  assert.equal(textFromFile({ name: 'notes.txt', bytes }), s);
});

/** Builds a PDF the way Word does: objects packed in a compressed object stream. */
function packedPdf(): Uint8Array {
  // Letters are stored as codes 1–26 (a–z) and 32 (space), mapped back by a ToUnicode CMap.
  const codes = (s: string) =>
    [...s]
      .map((ch) => (ch === ' ' ? '0020' : (ch.charCodeAt(0) - 96).toString(16).padStart(4, '0')))
      .join('');
  const content = [
    'BT /F1 12 Tf 72 700 Td',
    // No space glyph between the words, just a big gap, like some PDFs from Word.
    `[<${codes('plain')}> -300 <${codes('toast')}>] TJ`,
    `0 -16 Td <${codes('with butter')}> Tj`,
    'ET',
  ].join('\n');
  const cmap = [
    'begincmap',
    '1 begincodespacerange <0000> <FFFF> endcodespacerange',
    '1 beginbfchar <0020> <0020> endbfchar',
    '1 beginbfrange <0001> <001A> <0061> endbfrange',
    'endcmap',
  ].join('\n');
  const packed = [
    '<< /Type /Catalog /Pages 3 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 3 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type0 /BaseFont /X /Encoding /Identity-H /ToUnicode 6 0 R >>',
  ];
  let offsets = '';
  let body = '';
  packed.forEach((obj, i) => {
    offsets += `${i + 2} ${body.length} `;
    body += `${obj}\n`;
  });
  const objStm = zlibSync(strToU8(offsets + body));
  const flate = zlibSync(strToU8(content));

  const parts: (string | Uint8Array)[] = [
    '%PDF-1.5\n',
    `1 0 obj\n<< /Type /ObjStm /N ${packed.length} /First ${offsets.length} /Filter /FlateDecode /Length ${objStm.length} >>\nstream\n`,
    objStm,
    '\nendstream\nendobj\n',
    `6 0 obj\n<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream\nendobj\n`,
    `7 0 obj\n<< /Filter /FlateDecode /Length ${flate.length} >>\nstream\n`,
    flate,
    '\nendstream\nendobj\ntrailer\n<< /Root 2 0 R >>\n%%EOF\n',
  ];
  const chunks = parts.map((p) => (typeof p === 'string' ? strToU8(p, true) : p));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

test('reads PDFs with packed objects, two-byte fonts and gaps instead of spaces', () => {
  assert.equal(textFromFile({ name: 'w.pdf', bytes: packedPdf() }), 'plain toast\nwith butter');
});

const problem = (bytes: Uint8Array, name: string) => {
  try {
    textFromFile({ name, bytes });
  } catch (e) {
    assert.ok(e instanceof FileProblem);
    return e.message;
  }
  assert.fail('expected a FileProblem');
};

test('explains a scanned PDF that has no text', () => {
  const pdf = strToU8(
    '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
      '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n' +
      '4 0 obj << /Length 18 >>\nstream\nq 1 0 0 1 0 0 cm Q\nendstream endobj\n%%EOF',
  );
  assert.match(problem(pdf, 'scan.pdf'), /scanned picture/);
});

test('explains a locked PDF', () => {
  const pdf = strToU8('%PDF-1.6\n1 0 obj << >> endobj\ntrailer << /Root 1 0 R /Encrypt 5 0 R >>');
  assert.match(problem(pdf, 'locked.pdf'), /locked/);
});

test('refuses file types it can’t read', () => {
  assert.match(problem(Uint8Array.of(1, 2, 3), 'photo.heic'), /can’t be imported/);
  assert.match(problem(strToU8('PK\u0003\u0004 broken'), 'x.zip'), /damaged/);
});
